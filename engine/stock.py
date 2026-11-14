"""
Stock rules shared by Items, Purchases and the Stock view.

Availability:   stock = 0           -> Out of Stock
                0 < stock <= LOW    -> Low Stock   (LOW = LOW_STOCK_THRESHOLD, default 5)
                stock > LOW         -> In Stock
"""
from __future__ import annotations

from typing import Any

from config import SETTINGS
from errors import ConflictError

IN_STOCK = "In Stock"
LOW_STOCK = "Low Stock"
OUT_OF_STOCK = "Out of Stock"

AVAILABILITY_KEYS = {"in": IN_STOCK, "low": LOW_STOCK, "out": OUT_OF_STOCK}


def availability(stock: int) -> str:
    if stock <= 0:
        return OUT_OF_STOCK
    if stock <= SETTINGS.low_stock_threshold:
        return LOW_STOCK
    return IN_STOCK


def availability_sql(column: str = "i.stock_available") -> str:
    """SQL CASE expression mirroring availability() - used for filtering/sorting."""
    low = int(SETTINGS.low_stock_threshold)
    return (f"CASE WHEN {column} <= 0 THEN '{OUT_OF_STOCK}' "
            f"WHEN {column} <= {low} THEN '{LOW_STOCK}' "
            f"ELSE '{IN_STOCK}' END")


def decorate_item(row: dict[str, Any]) -> dict[str, Any]:
    """Add derived, display-ready fields to an item row."""
    row["active"] = bool(row.get("active"))
    row["status"] = "Active" if row["active"] else "Inactive"
    row["availability"] = availability(int(row.get("stock_available") or 0))
    if "price" in row:
        row["price"] = float(row["price"] or 0)
    if "units_sold" in row:
        row["units_sold"] = int(row["units_sold"] or 0)
    if "purchase_count" in row:
        row["purchase_count"] = int(row["purchase_count"] or 0)
        row["can_delete"] = row["purchase_count"] == 0
    return row


def record_movement(cur, item_id: int, movement_type: str, change: int,
                    balance_after: int, purchase_id: int | None = None,
                    note: str | None = None) -> None:
    cur.execute(
        "INSERT INTO stock_movements (item_id, purchase_id, movement_type, quantity_change, balance_after, note) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        (item_id, purchase_id, movement_type, change, balance_after, note),
    )


def apply_stock_change(cur, item_id: int, delta: int, item_name: str) -> None:
    """Atomically change stock by `delta` (negative = deduct).

    The WHERE guard makes it impossible for the row to go negative even if
    validation were bypassed - the database row itself refuses the update.
    """
    cur.execute(
        "UPDATE items SET stock_available = stock_available + %s "
        "WHERE id = %s AND stock_available + %s >= 0",
        (delta, item_id, delta),
    )
    if cur.rowcount != 1:
        raise ConflictError(
            f"Insufficient stock for '{item_name}'. Stock cannot become negative.",
            code="INSUFFICIENT_STOCK",
        )
