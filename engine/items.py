"""Item Master management (items table) + item details / history."""
from __future__ import annotations

from typing import Any

from config import SETTINGS
from db import clean_row, clean_rows
from errors import ConflictError, FieldErrors, NotFoundError, ValidationError
from stock import (AVAILABILITY_KEYS, availability_sql, decorate_item,
                   record_movement)
from validators import (MAX_STOCK, clean_text, coerce_int, parse_active,
                        parse_date, parse_id, parse_price, require_object)

MAX_NAME = 100
MAX_DESCRIPTION = 500

# JOIN: Item + Item Type (mandatory JOIN requirement #1)
ITEM_SELECT = """
    SELECT i.id, i.name, i.item_type_id, it.type_name, i.purchase_date,
           i.stock_available, i.active, i.price, i.description, i.created_at, i.updated_at,
           (SELECT COUNT(*) FROM purchase_items pi WHERE pi.item_id = i.id) AS purchase_count,
           (SELECT COALESCE(SUM(pi.quantity), 0) FROM purchase_items pi
              JOIN purchases p ON p.id = pi.purchase_id
             WHERE pi.item_id = i.id AND p.status = 'COMPLETED') AS units_sold
    FROM items i
    JOIN item_types it ON i.item_type_id = it.id
"""

_SORTS = {
    "id": "i.id",
    "name": "i.name",
    "type": "it.type_name",
    "purchase_date": "i.purchase_date",
    "stock": "i.stock_available",
    "status": "i.active",
    "price": "i.price",
    "newest": "i.created_at",
    "popular": "units_sold",
}


def fetch_item(cur, item_id: int, lock: bool = False) -> dict[str, Any]:
    if lock:
        cur.execute("SELECT id FROM items WHERE id = %s FOR UPDATE", (item_id,))
        if not cur.fetchone():
            raise NotFoundError("Item not found", code="ITEM_NOT_FOUND")
    cur.execute(ITEM_SELECT + " WHERE i.id = %s", (item_id,))
    row = cur.fetchone()
    if not row:
        raise NotFoundError("Item not found", code="ITEM_NOT_FOUND")
    return decorate_item(clean_row(row))


def _validate_item_body(cur, body: dict[str, Any], *, creating: bool) -> dict[str, Any]:
    errors = FieldErrors()

    name = clean_text(body.get("name"))
    if not name:
        errors.add("name", "Item name is required")
    elif len(name) > MAX_NAME:
        errors.add("name", f"Item name must be at most {MAX_NAME} characters")

    raw_type = body.get("item_type_id")
    type_id: int | None = None
    if raw_type in (None, ""):
        errors.add("item_type_id", "Item type is required")
    else:
        type_id = coerce_int(raw_type)
        if type_id is None or type_id <= 0:
            errors.add("item_type_id", "Invalid item type")
            type_id = None

    purchase_date, date_err = parse_date(body.get("purchase_date"))
    if date_err == "required":
        errors.add("purchase_date", "Purchase date is required")
    elif date_err:
        errors.add("purchase_date", "Purchase date is invalid (use YYYY-MM-DD)")

    raw_stock = body.get("stock_available")
    stock: int | None = None
    if raw_stock in (None, ""):
        errors.add("stock_available", "Stock available is required")
    else:
        stock = coerce_int(raw_stock)
        if stock is None:
            errors.add("stock_available", "Stock must be a whole number")
        elif stock < 0:
            errors.add("stock_available", "Stock cannot be negative")
        elif stock > MAX_STOCK:
            errors.add("stock_available", f"Stock cannot exceed {MAX_STOCK:,}")

    raw_active = body.get("active")
    if raw_active is None and creating:
        active = 1  # new items default to Active when the flag is omitted
    else:
        active = parse_active(raw_active)
        if active is None:
            errors.add("active", "Status is required (Active or Inactive)")

    price = 0.0
    raw_price = body.get("price")
    if raw_price in (None, ""):
        price = None if not creating else 0.0  # optional; keeps v1 API clients working
    else:
        price, price_err = parse_price(raw_price)
        if price_err:
            errors.add("price", price_err)

    description = clean_text(body.get("description")) if body.get("description") is not None else None
    if description and len(description) > MAX_DESCRIPTION:
        errors.add("description", f"Description must be at most {MAX_DESCRIPTION} characters")

    # Item type must exist in item_types
    if type_id is not None:
        cur.execute("SELECT id FROM item_types WHERE id = %s", (type_id,))
        if not cur.fetchone():
            errors.add("item_type_id", "Invalid item type")

    errors.raise_if_any()
    return {"name": name, "item_type_id": type_id, "purchase_date": purchase_date,
            "stock_available": stock, "active": active, "price": price,
            "description": description}


def _ensure_unique_name(cur, name: str, exclude_id: int | None = None) -> None:
    sql = "SELECT id FROM items WHERE LOWER(name) = LOWER(%s)"
    params: list[Any] = [name]
    if exclude_id:
        sql += " AND id <> %s"
        params.append(exclude_id)
    cur.execute(sql, params)
    if cur.fetchone():
        raise ConflictError(f"An item named '{name}' already exists", code="DUPLICATE_ITEM",
                            details=[{"field": "name", "message": "Item name already exists"}])


# ---------------------------------------------------------------- queries
def list_items(cur, req: dict[str, Any]) -> dict[str, Any]:
    q = req.get("query") or {}
    where: list[str] = []
    params: list[Any] = []

    search = clean_text(q.get("search"))
    if search:
        where.append("(i.name LIKE %s OR it.type_name LIKE %s)")
        like = f"%{search}%"
        params += [like, like]

    if q.get("type_id") not in (None, "", "all"):
        type_id = parse_id(q.get("type_id"), "item type ID")
        where.append("i.item_type_id = %s")
        params.append(type_id)

    status = clean_text(q.get("status")).lower()
    if status in ("active", "inactive"):
        where.append("i.active = %s")
        params.append(1 if status == "active" else 0)
    elif status not in ("", "all"):
        raise ValidationError("status filter must be one of: all, active, inactive")

    avail = clean_text(q.get("availability")).lower()
    if avail in AVAILABILITY_KEYS:
        where.append(f"{availability_sql()} = %s")
        params.append(AVAILABILITY_KEYS[avail])
    elif avail not in ("", "all"):
        raise ValidationError("availability filter must be one of: all, in, low, out")

    for key, op in (("min_price", ">="), ("max_price", "<=")):
        if q.get(key) not in (None, ""):
            value, err = parse_price(q.get(key))
            if err:
                raise ValidationError(f"{key} must be a non-negative number")
            where.append(f"i.price {op} %s")
            params.append(value)

    sort_col = _SORTS.get(clean_text(q.get("sort")).lower(), "i.id")
    direction = "DESC" if clean_text(q.get("order")).lower() == "desc" else "ASC"

    sql = ITEM_SELECT
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += f" ORDER BY {sort_col} {direction}, i.id ASC"
    cur.execute(sql, params)
    rows = [decorate_item(clean_row(r)) for r in cur.fetchall()]
    return {"status": 200, "data": rows,
            "meta": {"count": len(rows), "low_stock_threshold": SETTINGS.low_stock_threshold}}


def get_item(cur, req: dict[str, Any]) -> dict[str, Any]:
    item_id = parse_id(req["params"].get("id"), "item ID")
    item = fetch_item(cur, item_id)

    # Purchase history for this item: purchase_items JOIN purchases
    cur.execute(
        """
        SELECT p.id AS purchase_id, p.order_id, p.purchase_date, p.status, pi.quantity, pi.unit_price
        FROM purchase_items pi
        JOIN purchases p ON p.id = pi.purchase_id
        WHERE pi.item_id = %s
        ORDER BY p.purchase_date DESC, p.id DESC
        """,
        (item_id,),
    )
    history = clean_rows(cur.fetchall())
    for h in history:
        h["unit_price"] = float(h["unit_price"] or 0)

    cur.execute(
        """
        SELECT sm.id, sm.movement_type, sm.quantity_change, sm.balance_after, sm.note,
               sm.created_at, sm.purchase_id, p.order_id
        FROM stock_movements sm
        LEFT JOIN purchases p ON p.id = sm.purchase_id
        WHERE sm.item_id = %s
        ORDER BY sm.id DESC
        LIMIT 100
        """,
        (item_id,),
    )
    movements = clean_rows(cur.fetchall())

    completed = [h for h in history if h["status"] == "COMPLETED"]
    item["purchase_history"] = history
    item["stock_movements"] = movements
    item["stats"] = {
        "orders": len(completed),
        "units_purchased": sum(int(h["quantity"]) for h in completed),
    }
    return {"status": 200, "data": item}


# ---------------------------------------------------------------- commands
def create_item(cur, req: dict[str, Any]) -> dict[str, Any]:
    body = require_object(req.get("body"))
    data = _validate_item_body(cur, body, creating=True)
    _ensure_unique_name(cur, data["name"])
    cur.execute(
        "INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (data["name"], data["item_type_id"], data["purchase_date"],
         data["stock_available"], data["active"], data["price"] or 0, data["description"] or None),
    )
    item_id = cur.lastrowid
    record_movement(cur, item_id, "INITIAL", data["stock_available"], data["stock_available"],
                    note="Opening stock")
    return {"status": 201, "message": f"Item '{data['name']}' created",
            "data": fetch_item(cur, item_id)}


def update_item(cur, req: dict[str, Any]) -> dict[str, Any]:
    item_id = parse_id(req["params"].get("id"), "item ID")
    body = require_object(req.get("body"))
    current = fetch_item(cur, item_id, lock=True)
    data = _validate_item_body(cur, body, creating=False)
    _ensure_unique_name(cur, data["name"], exclude_id=item_id)

    # price / description are optional on update: omitted -> keep current value
    price = current["price"] if data["price"] is None else data["price"]
    description = current.get("description") if data["description"] is None else (data["description"] or None)
    cur.execute(
        "UPDATE items SET name = %s, item_type_id = %s, purchase_date = %s, "
        "stock_available = %s, active = %s, price = %s, description = %s WHERE id = %s",
        (data["name"], data["item_type_id"], data["purchase_date"],
         data["stock_available"], data["active"], price, description, item_id),
    )
    delta = data["stock_available"] - int(current["stock_available"])
    if delta:
        record_movement(cur, item_id, "ADJUSTMENT", delta, data["stock_available"],
                        note=f"Manual stock update {current['stock_available']} -> {data['stock_available']}")
    return {"status": 200, "message": f"Item '{data['name']}' updated",
            "data": fetch_item(cur, item_id)}


def set_item_status(cur, req: dict[str, Any]) -> dict[str, Any]:
    item_id = parse_id(req["params"].get("id"), "item ID")
    body = require_object(req.get("body"))
    active = parse_active(body.get("active"))
    if active is None:
        raise ValidationError("Status is required (Active or Inactive)",
                              details=[{"field": "active", "message": "Use true/false"}])
    item = fetch_item(cur, item_id, lock=True)
    cur.execute("UPDATE items SET active = %s WHERE id = %s", (active, item_id))
    label = "activated" if active else "deactivated"
    return {"status": 200, "message": f"Item '{item['name']}' {label}",
            "data": fetch_item(cur, item_id)}


def delete_item(cur, req: dict[str, Any]) -> dict[str, Any]:
    item_id = parse_id(req["params"].get("id"), "item ID")
    item = fetch_item(cur, item_id, lock=True)
    if item["purchase_count"] > 0:
        raise ConflictError(
            f"Item '{item['name']}' is used in {item['purchase_count']} purchase(s) and cannot be "
            "deleted because that would break purchase history. Mark it Inactive instead.",
            code="ITEM_HAS_PURCHASE_HISTORY",
        )
    cur.execute("DELETE FROM items WHERE id = %s", (item_id,))
    return {"status": 200, "message": f"Item '{item['name']}' deleted", "data": {"id": item_id}}
