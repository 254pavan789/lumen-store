"""Item Type management (item_types table)."""
from __future__ import annotations

from typing import Any

from db import clean_row
from errors import ConflictError, FieldErrors, NotFoundError
from validators import clean_text, parse_id, require_object

MAX_TYPE_NAME = 50

_SELECT_TYPES = """
    SELECT it.id, it.type_name, it.created_at, it.updated_at,
           COUNT(i.id) AS item_count,
           COALESCE(SUM(i.active = 1), 0) AS active_item_count
    FROM item_types it
    LEFT JOIN items i ON i.item_type_id = it.id
"""


def _decorate(row: dict[str, Any]) -> dict[str, Any]:
    row = clean_row(row)
    row["item_count"] = int(row["item_count"] or 0)
    row["active_item_count"] = int(row["active_item_count"] or 0)
    row["can_delete"] = row["item_count"] == 0
    return row


def _validated_name(body: dict[str, Any]) -> str:
    errors = FieldErrors()
    name = clean_text(body.get("type_name", body.get("name")))
    if not name:
        errors.add("type_name", "Item type name is required")
    elif len(name) > MAX_TYPE_NAME:
        errors.add("type_name", f"Item type name must be at most {MAX_TYPE_NAME} characters")
    errors.raise_if_any()
    return name


def _ensure_unique(cur, name: str, exclude_id: int | None = None) -> None:
    sql = "SELECT id FROM item_types WHERE LOWER(type_name) = LOWER(%s)"
    params: list[Any] = [name]
    if exclude_id:
        sql += " AND id <> %s"
        params.append(exclude_id)
    cur.execute(sql, params)
    if cur.fetchone():
        raise ConflictError(f"Item type '{name}' already exists", code="DUPLICATE_ITEM_TYPE",
                            details=[{"field": "type_name", "message": "Item type already exists"}])


def _fetch(cur, type_id: int) -> dict[str, Any]:
    cur.execute(_SELECT_TYPES + " WHERE it.id = %s GROUP BY it.id, it.type_name, it.created_at, it.updated_at", (type_id,))
    row = cur.fetchone()
    if not row:
        raise NotFoundError("Item type not found", code="ITEM_TYPE_NOT_FOUND")
    return _decorate(row)


def list_types(cur, req: dict[str, Any]) -> dict[str, Any]:
    cur.execute(_SELECT_TYPES + " GROUP BY it.id, it.type_name, it.created_at, it.updated_at ORDER BY it.type_name")
    return {"status": 200, "data": [_decorate(r) for r in cur.fetchall()]}


def get_type(cur, req: dict[str, Any]) -> dict[str, Any]:
    type_id = parse_id(req["params"].get("id"), "item type ID")
    return {"status": 200, "data": _fetch(cur, type_id)}


def create_type(cur, req: dict[str, Any]) -> dict[str, Any]:
    body = require_object(req.get("body"))
    name = _validated_name(body)
    _ensure_unique(cur, name)
    cur.execute("INSERT INTO item_types (type_name) VALUES (%s)", (name,))
    return {"status": 201, "message": f"Item type '{name}' created",
            "data": _fetch(cur, cur.lastrowid)}


def update_type(cur, req: dict[str, Any]) -> dict[str, Any]:
    type_id = parse_id(req["params"].get("id"), "item type ID")
    body = require_object(req.get("body"))
    cur.execute("SELECT id FROM item_types WHERE id = %s FOR UPDATE", (type_id,))
    if not cur.fetchone():
        raise NotFoundError("Item type not found", code="ITEM_TYPE_NOT_FOUND")
    name = _validated_name(body)
    _ensure_unique(cur, name, exclude_id=type_id)
    cur.execute("UPDATE item_types SET type_name = %s WHERE id = %s", (name, type_id))
    return {"status": 200, "message": f"Item type renamed to '{name}'",
            "data": _fetch(cur, type_id)}


def delete_type(cur, req: dict[str, Any]) -> dict[str, Any]:
    type_id = parse_id(req["params"].get("id"), "item type ID")
    cur.execute("SELECT id, type_name FROM item_types WHERE id = %s FOR UPDATE", (type_id,))
    row = cur.fetchone()
    if not row:
        raise NotFoundError("Item type not found", code="ITEM_TYPE_NOT_FOUND")
    cur.execute("SELECT COUNT(*) AS n FROM items WHERE item_type_id = %s", (type_id,))
    used = int(cur.fetchone()["n"])
    if used:
        raise ConflictError(
            f"Item type '{row['type_name']}' is used by {used} item(s) and cannot be deleted. "
            "Move those items to another type first.",
            code="ITEM_TYPE_IN_USE",
        )
    cur.execute("DELETE FROM item_types WHERE id = %s", (type_id,))
    return {"status": 200, "message": f"Item type '{row['type_name']}' deleted",
            "data": {"id": type_id}}

