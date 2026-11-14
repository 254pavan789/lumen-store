"""
Purchase / Order processing - the heart of the system.

Create  : validate -> lock items -> check active + stock -> INSERT purchase
          -> INSERT purchase_items -> deduct stock -> COMMIT (all-or-nothing)
Update  : stock adjusted by the DIFFERENCE between old and new quantities
Cancel  : optional status workflow; the record is kept, stock is returned
Delete  : intentionally NOT implemented - purchases are historical records
"""
from __future__ import annotations

from typing import Any

import pymysql

from db import clean_row, clean_rows, placeholders
from errors import (AppError, ConflictError, FieldErrors, NotFoundError,
                    ValidationError)
from stock import apply_stock_change, availability, record_movement
from validators import (MAX_QUANTITY, clean_text, coerce_int, parse_date,
                        parse_id, require_object, validate_order_id)

MAX_LINES = 200
MAX_REMARKS = 255


# ======================================================================
# helpers
# ======================================================================
def _parse_lines(raw: Any, errors: FieldErrors) -> list[tuple[int, int]]:
    """Validate the `items` array -> [(item_id, quantity), ...]."""
    if raw is None or raw == []:
        errors.add("items", "Purchase must contain at least one item")
        return []
    if not isinstance(raw, list):
        errors.add("items", "items must be an array of { item_id, quantity }")
        return []
    if len(raw) > MAX_LINES:
        errors.add("items", f"A purchase can contain at most {MAX_LINES} lines")
        return []

    lines: list[tuple[int, int]] = []
    seen: dict[int, int] = {}
    for index, line in enumerate(raw):
        prefix = f"items[{index}]"
        if not isinstance(line, dict):
            errors.add(prefix, "Each line must be an object { item_id, quantity }", line=index)
            continue

        raw_id = line.get("item_id", line.get("itemId"))
        item_id = coerce_int(raw_id)
        if raw_id in (None, ""):
            errors.add(f"{prefix}.item_id", "Item is required", line=index)
            item_id = None
        elif item_id is None or item_id <= 0:
            errors.add(f"{prefix}.item_id", "Invalid item ID", line=index)
            item_id = None

        raw_qty = line.get("quantity", line.get("qty"))
        quantity = coerce_int(raw_qty)
        if raw_qty in (None, ""):
            errors.add(f"{prefix}.quantity", "Quantity is required", line=index, item_id=item_id)
            quantity = None
        elif quantity is None:
            errors.add(f"{prefix}.quantity", "Quantity must be a whole number", line=index, item_id=item_id)
        elif quantity <= 0:
            errors.add(f"{prefix}.quantity", "Quantity must be greater than zero", line=index, item_id=item_id)
            quantity = None
        elif quantity > MAX_QUANTITY:
            errors.add(f"{prefix}.quantity", f"Quantity cannot exceed {MAX_QUANTITY:,}", line=index, item_id=item_id)
            quantity = None

        if item_id is not None:
            if item_id in seen:
                errors.add(
                    f"{prefix}.item_id",
                    f"Duplicate item in order (item ID {item_id} is already on line {seen[item_id] + 1}). "
                    "Combine the quantities into one line.",
                    line=index, item_id=item_id, code="DUPLICATE_ITEM_IN_ORDER",
                )
                continue
            seen[item_id] = index
        if item_id is not None and quantity is not None:
            lines.append((item_id, quantity))
    return lines


def _lock_items(cur, item_ids: list[int]) -> dict[int, dict[str, Any]]:
    """Row-lock every item involved (ordered by id -> no deadlocks)."""
    if not item_ids:
        return {}
    ids = sorted(set(item_ids))
    cur.execute(
        f"SELECT id, name, active, stock_available, price FROM items "
        f"WHERE id IN ({placeholders(len(ids))}) ORDER BY id FOR UPDATE",
        ids,
    )
    return {row["id"]: row for row in cur.fetchall()}


def _raise_business_errors(problems: list[dict[str, Any]]) -> None:
    if not problems:
        return
    any_missing = any(p.get("code") == "ITEM_NOT_FOUND" for p in problems)
    message = problems[0]["message"] if len(problems) == 1 else (
        f"Purchase rejected: {len(problems)} line(s) failed validation. No stock was changed.")
    if any_missing:
        raise NotFoundError(message, problems, code="ITEM_NOT_FOUND")
    codes = {p.get("code") for p in problems}
    code = codes.pop() if len(codes) == 1 else "PURCHASE_REJECTED"
    raise ConflictError(message, problems, code=code)


def _next_order_id(cur) -> str:
    cur.execute("SELECT COALESCE(MAX(id), 0) AS max_id FROM purchases")
    number = int(cur.fetchone()["max_id"]) + 1
    while True:
        candidate = f"PO-{number:05d}"
        cur.execute("SELECT 1 FROM purchases WHERE order_id = %s", (candidate,))
        if not cur.fetchone():
            return candidate
        number += 1


def _resolve_purchase(cur, ref: Any, lock: bool = False) -> dict[str, Any]:
    """Accept numeric purchase id (12) or an Order ID (PO-00012)."""
    text = clean_text(ref)
    if not text:
        raise ValidationError("Invalid purchase ID", code="INVALID_ID")
    suffix = " FOR UPDATE" if lock else ""
    if text.isdigit():
        purchase_id = parse_id(text, "purchase ID")
        cur.execute("SELECT * FROM purchases WHERE id = %s" + suffix, (purchase_id,))
    else:
        order_id, err = validate_order_id(text)
        if err or not order_id:
            raise ValidationError("Invalid purchase ID or Order ID", code="INVALID_ID")
        cur.execute("SELECT * FROM purchases WHERE order_id = %s" + suffix, (order_id,))
    row = cur.fetchone()
    if not row:
        raise NotFoundError("Purchase not found", code="PURCHASE_NOT_FOUND")
    return row


def fetch_purchase_detail(cur, purchase_id: int) -> dict[str, Any]:
    cur.execute("SELECT * FROM purchases WHERE id = %s", (purchase_id,))
    header = clean_row(cur.fetchone())
    if not header:
        raise NotFoundError("Purchase not found", code="PURCHASE_NOT_FOUND")

    # JOIN: Purchase + Purchase Items + Items + Item Types (mandatory JOIN #2)
    cur.execute(
        """
        SELECT p.order_id, p.purchase_date,
               pi.id AS line_id, i.id AS item_id, i.name AS item_name,
               it.id AS item_type_id, it.type_name, pi.quantity, pi.unit_price,
               i.price AS current_price,
               i.stock_available AS current_stock, i.active AS item_active
        FROM purchases p
        JOIN purchase_items pi ON p.id = pi.purchase_id
        JOIN items i           ON pi.item_id = i.id
        JOIN item_types it     ON i.item_type_id = it.id
        WHERE p.order_id = %s
        ORDER BY pi.id
        """,
        (header["order_id"],),
    )
    lines = clean_rows(cur.fetchall())
    for line in lines:
        line["item_active"] = bool(line["item_active"])
        line["item_status"] = "Active" if line["item_active"] else "Inactive"
        line["availability"] = availability(int(line["current_stock"]))
        line["unit_price"] = float(line["unit_price"] or 0)
        line["current_price"] = float(line["current_price"] or 0)
        line["line_total"] = round(line["unit_price"] * int(line["quantity"]), 2)
        line.pop("order_id", None)
        line.pop("purchase_date", None)

    header["items"] = lines
    header["line_count"] = len(lines)
    header["total_quantity"] = sum(int(l["quantity"]) for l in lines)
    header["total_amount"] = round(sum(l["line_total"] for l in lines), 2)
    header["can_update"] = header["status"] == "COMPLETED"
    return header


def _validate_header(body: dict[str, Any], errors: FieldErrors) -> tuple[str | None, str]:
    purchase_date, date_err = parse_date(body.get("purchase_date"))
    if date_err == "required":
        errors.add("purchase_date", "Purchase date is required")
    elif date_err:
        errors.add("purchase_date", "Purchase date is invalid (use YYYY-MM-DD)")
    remarks = clean_text(body.get("remarks"))
    if len(remarks) > MAX_REMARKS:
        errors.add("remarks", f"Remarks must be at most {MAX_REMARKS} characters")
    return purchase_date, remarks


# ======================================================================
# queries
# ======================================================================
def list_purchases(cur, req: dict[str, Any]) -> dict[str, Any]:
    q = req.get("query") or {}
    where: list[str] = []
    params: list[Any] = []

    search = clean_text(q.get("search"))
    if search:
        like = f"%{search}%"
        where.append(
            "(p.order_id LIKE %s OR p.id IN (SELECT pi2.purchase_id FROM purchase_items pi2 "
            "JOIN items i2 ON i2.id = pi2.item_id WHERE i2.name LIKE %s))"
        )
        params += [like, like]

    status = clean_text(q.get("status")).upper()
    if status in ("COMPLETED", "CANCELLED"):
        where.append("p.status = %s")
        params.append(status)
    elif status not in ("", "ALL"):
        raise ValidationError("status filter must be one of: all, completed, cancelled")

    for key, op in (("date_from", ">="), ("date_to", "<=")):
        if q.get(key):
            value, err = parse_date(q.get(key))
            if err:
                raise ValidationError(f"{key} is invalid (use YYYY-MM-DD)")
            where.append(f"p.purchase_date {op} %s")
            params.append(value)

    sql = """
        SELECT p.id, p.order_id, p.purchase_date, p.status, p.remarks,
               p.created_at, p.updated_at,
               COUNT(pi.id)                 AS line_count,
               COALESCE(SUM(pi.quantity), 0) AS total_quantity,
               COALESCE(SUM(pi.quantity * pi.unit_price), 0) AS total_amount,
               GROUP_CONCAT(pi.item_id ORDER BY pi.id SEPARATOR ',') AS item_ids,
               GROUP_CONCAT(CONCAT(i.name, ' – ', pi.quantity) ORDER BY pi.id SEPARATOR '; ') AS items_summary
        FROM purchases p
        JOIN purchase_items pi ON pi.purchase_id = p.id
        JOIN items i           ON i.id = pi.item_id
    """
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " GROUP BY p.id ORDER BY p.purchase_date DESC, p.id DESC"
    cur.execute(sql, params)
    rows = clean_rows(cur.fetchall())
    for row in rows:
        row["line_count"] = int(row["line_count"])
        row["total_quantity"] = int(row["total_quantity"])
        row["total_amount"] = float(row["total_amount"] or 0)
        row["item_ids"] = [int(x) for x in str(row.get("item_ids") or "").split(",") if x]
    return {"status": 200, "data": rows, "meta": {"count": len(rows)}}


def get_purchase(cur, req: dict[str, Any]) -> dict[str, Any]:
    header = _resolve_purchase(cur, req["params"].get("id"))
    return {"status": 200, "data": fetch_purchase_detail(cur, header["id"])}


def next_order_id(cur, req: dict[str, Any]) -> dict[str, Any]:
    return {"status": 200, "data": {"order_id": _next_order_id(cur)}}


# ======================================================================
# commands
# ======================================================================
def create_purchase(cur, req: dict[str, Any]) -> dict[str, Any]:
    body = require_object(req.get("body"))
    errors = FieldErrors()

    order_id, order_err = validate_order_id(body.get("order_id"))
    if order_err:
        errors.add("order_id", order_err)
    purchase_date, remarks = _validate_header(body, errors)
    lines = _parse_lines(body.get("items"), errors)
    errors.raise_if_any()

    # 1) lock + validate every item (exists, active, enough stock)
    locked = _lock_items(cur, [item_id for item_id, _ in lines])
    problems: list[dict[str, Any]] = []
    for index, (item_id, qty) in enumerate(lines):
        item = locked.get(item_id)
        field = f"items[{index}]"
        if not item:
            problems.append({"field": field, "line": index, "item_id": item_id,
                             "code": "ITEM_NOT_FOUND", "message": f"Item not found (item ID {item_id})"})
        elif not item["active"]:
            problems.append({"field": field, "line": index, "item_id": item_id, "code": "ITEM_INACTIVE",
                             "message": f"Item '{item['name']}' is inactive and cannot be purchased"})
        elif qty > item["stock_available"]:
            problems.append({"field": f"{field}.quantity", "line": index, "item_id": item_id,
                             "code": "INSUFFICIENT_STOCK", "requested": qty,
                             "available": item["stock_available"],
                             "message": (f"Insufficient stock for '{item['name']}': requested {qty}, "
                                         f"available {item['stock_available']}")})
    _raise_business_errors(problems)

    # 2) order id: client supplied (must be unique) or generated
    if order_id:
        cur.execute("SELECT 1 FROM purchases WHERE order_id = %s", (order_id,))
        if cur.fetchone():
            raise ConflictError(f"Order ID '{order_id}' already exists", code="DUPLICATE_ORDER_ID",
                                details=[{"field": "order_id", "message": "Order ID already exists"}])

    # 3) insert header (retry generated ids if another request took the same number)
    purchase_id = None
    for _attempt in range(5):
        final_order_id = order_id or _next_order_id(cur)
        try:
            cur.execute(
                "INSERT INTO purchases (order_id, purchase_date, remarks) VALUES (%s, %s, %s)",
                (final_order_id, purchase_date, remarks or None),
            )
            purchase_id = cur.lastrowid
            break
        except pymysql.err.IntegrityError:
            if order_id:
                raise ConflictError(f"Order ID '{order_id}' already exists", code="DUPLICATE_ORDER_ID")
    if purchase_id is None:
        raise AppError("Could not allocate a unique Order ID, please retry")

    # 4) insert lines + 5) deduct stock (guarded UPDATE) + audit trail
    for item_id, qty in lines:
        item = locked[item_id]
        cur.execute("INSERT INTO purchase_items (purchase_id, item_id, quantity, unit_price) "
                    "VALUES (%s, %s, %s, %s)", (purchase_id, item_id, qty, item["price"]))
        apply_stock_change(cur, item_id, -qty, item["name"])
        new_balance = item["stock_available"] - qty
        record_movement(cur, item_id, "PURCHASE", -qty, new_balance, purchase_id,
                        note=f"Purchased on {final_order_id}")

    detail = fetch_purchase_detail(cur, purchase_id)
    return {"status": 201,
            "message": f"Purchase {detail['order_id']} created with {detail['line_count']} item(s)",
            "data": detail}


def update_purchase(cur, req: dict[str, Any]) -> dict[str, Any]:
    body = require_object(req.get("body"))
    header = _resolve_purchase(cur, req["params"].get("id"), lock=True)
    if header["status"] != "COMPLETED":
        raise ConflictError(f"Purchase {header['order_id']} is cancelled and cannot be updated",
                            code="PURCHASE_CANCELLED")

    errors = FieldErrors()
    supplied_order = clean_text(body.get("order_id")).upper()
    if supplied_order and supplied_order != header["order_id"]:
        errors.add("order_id", "Order ID cannot be changed once the purchase is created")
    purchase_date, remarks = _validate_header(body, errors)
    lines = _parse_lines(body.get("items"), errors)
    errors.raise_if_any()

    purchase_id = header["id"]
    cur.execute("SELECT id, item_id, quantity FROM purchase_items WHERE purchase_id = %s", (purchase_id,))
    old_rows = {row["item_id"]: row for row in cur.fetchall()}
    old_qty = {item_id: int(row["quantity"]) for item_id, row in old_rows.items()}
    new_qty = {item_id: qty for item_id, qty in lines}
    line_index = {item_id: idx for idx, (item_id, _) in enumerate(lines)}

    locked = _lock_items(cur, list(set(old_qty) | set(new_qty)))

    # validate the DIFFERENCE for each item
    problems: list[dict[str, Any]] = []
    for item_id, qty in new_qty.items():
        item = locked.get(item_id)
        idx = line_index[item_id]
        need = qty - old_qty.get(item_id, 0)  # >0 means extra stock required
        if not item:
            problems.append({"field": f"items[{idx}]", "line": idx, "item_id": item_id,
                             "code": "ITEM_NOT_FOUND", "message": f"Item not found (item ID {item_id})"})
        elif need > 0 and not item["active"]:
            problems.append({"field": f"items[{idx}]", "line": idx, "item_id": item_id, "code": "ITEM_INACTIVE",
                             "message": (f"Item '{item['name']}' is inactive and cannot be purchased "
                                         "(its quantity can only be kept or reduced)")})
        elif need > item["stock_available"]:
            problems.append({
                "field": f"items[{idx}].quantity", "line": idx, "item_id": item_id,
                "code": "INSUFFICIENT_STOCK", "requested": qty,
                "available": item["stock_available"],
                "max_quantity": old_qty.get(item_id, 0) + item["stock_available"],
                "message": (f"Insufficient stock for '{item['name']}': {need} more required, "
                            f"only {item['stock_available']} available "
                            f"(maximum quantity for this order is {old_qty.get(item_id, 0) + item['stock_available']})"),
            })
    _raise_business_errors(problems)

    # apply header + line changes + stock difference
    cur.execute("UPDATE purchases SET purchase_date = %s, remarks = %s WHERE id = %s",
                (purchase_date, remarks or None, purchase_id))

    adjustments: list[dict[str, Any]] = []
    for item_id in sorted(set(old_qty) | set(new_qty)):
        before_qty = old_qty.get(item_id, 0)
        after_qty = new_qty.get(item_id, 0)
        diff = after_qty - before_qty
        item = locked[item_id]
        stock_before = int(item["stock_available"])

        if after_qty == 0:  # line removed from the order
            cur.execute("DELETE FROM purchase_items WHERE id = %s", (old_rows[item_id]["id"],))
            action = "removed"
        elif before_qty == 0:  # new line
            cur.execute("INSERT INTO purchase_items (purchase_id, item_id, quantity, unit_price) "
                        "VALUES (%s, %s, %s, %s)", (purchase_id, item_id, after_qty, item["price"]))
            action = "added"
        elif diff:
            cur.execute("UPDATE purchase_items SET quantity = %s WHERE id = %s",
                        (after_qty, old_rows[item_id]["id"]))
            action = "increased" if diff > 0 else "decreased"
        else:
            action = "unchanged"

        if diff:
            # stock moves opposite to the purchase quantity
            apply_stock_change(cur, item_id, -diff, item["name"])
            record_movement(cur, item_id, "PURCHASE_UPDATE", -diff, stock_before - diff, purchase_id,
                            note=f"{header['order_id']} quantity {before_qty} -> {after_qty}")

        adjustments.append({
            "item_id": item_id, "item_name": item["name"], "action": action,
            "old_quantity": before_qty, "new_quantity": after_qty,
            "stock_change": -diff, "stock_before": stock_before, "stock_after": stock_before - diff,
        })

    detail = fetch_purchase_detail(cur, purchase_id)
    detail["stock_adjustments"] = adjustments
    changed = [a for a in adjustments if a["stock_change"]]
    message = (f"Purchase {header['order_id']} updated; stock adjusted for {len(changed)} item(s)"
               if changed else f"Purchase {header['order_id']} updated; no stock change needed")
    return {"status": 200, "message": message, "data": detail}


def cancel_purchase(cur, req: dict[str, Any]) -> dict[str, Any]:
    """Cancellation workflow (status change) - the record is never deleted."""
    body = require_object(req.get("body"))
    header = _resolve_purchase(cur, req["params"].get("id"), lock=True)
    if header["status"] == "CANCELLED":
        raise ConflictError(f"Purchase {header['order_id']} is already cancelled", code="PURCHASE_CANCELLED")
    reason = clean_text(body.get("reason"))
    if len(reason) > MAX_REMARKS:
        raise ValidationError(f"Reason must be at most {MAX_REMARKS} characters",
                              details=[{"field": "reason", "message": "Too long"}])

    cur.execute("SELECT item_id, quantity FROM purchase_items WHERE purchase_id = %s", (header["id"],))
    lines = cur.fetchall()
    locked = _lock_items(cur, [l["item_id"] for l in lines])
    for line in lines:
        item = locked[line["item_id"]]
        qty = int(line["quantity"])
        apply_stock_change(cur, item["id"], qty, item["name"])
        record_movement(cur, item["id"], "PURCHASE_CANCEL", qty, int(item["stock_available"]) + qty,
                        header["id"], note=f"{header['order_id']} cancelled - stock returned")
    cur.execute("UPDATE purchases SET status = 'CANCELLED', cancelled_at = NOW(), cancel_reason = %s "
                "WHERE id = %s", (reason or None, header["id"]))
    return {"status": 200,
            "message": f"Purchase {header['order_id']} cancelled and stock returned. The record is kept for history.",
            "data": fetch_purchase_detail(cur, header["id"])}
