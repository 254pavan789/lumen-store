"""Stock / Availability view and dashboard summary."""
from __future__ import annotations

from typing import Any

from config import SETTINGS
from db import clean_rows
from items import list_items
from stock import IN_STOCK, LOW_STOCK, OUT_OF_STOCK


def stock_overview(cur, req: dict[str, Any]) -> dict[str, Any]:
    result = list_items(cur, req)
    rows = result["data"]
    summary = {
        "total_items": len(rows),
        "in_stock": sum(1 for r in rows if r["availability"] == IN_STOCK),
        "low_stock": sum(1 for r in rows if r["availability"] == LOW_STOCK),
        "out_of_stock": sum(1 for r in rows if r["availability"] == OUT_OF_STOCK),
        "total_units": sum(int(r["stock_available"]) for r in rows),
        "low_stock_threshold": SETTINGS.low_stock_threshold,
    }
    return {"status": 200, "data": rows, "meta": summary}


def dashboard(cur, req: dict[str, Any]) -> dict[str, Any]:
    low = SETTINGS.low_stock_threshold
    cur.execute(
        """
        SELECT COUNT(*)                                        AS total_items,
               COALESCE(SUM(active = 1), 0)                    AS active_items,
               COALESCE(SUM(active = 0), 0)                    AS inactive_items,
               COALESCE(SUM(stock_available = 0), 0)           AS out_of_stock,
               COALESCE(SUM(stock_available > 0 AND stock_available <= %s), 0) AS low_stock,
               COALESCE(SUM(stock_available > %s), 0)          AS in_stock,
               COALESCE(SUM(stock_available), 0)               AS total_units
        FROM items
        """,
        (low, low),
    )
    counts = {k: int(v) for k, v in cur.fetchone().items()}

    cur.execute("SELECT COUNT(*) AS n FROM item_types")
    counts["item_types"] = int(cur.fetchone()["n"])
    cur.execute(
        "SELECT COUNT(*) AS total, COALESCE(SUM(status = 'COMPLETED'), 0) AS completed, "
        "COALESCE(SUM(status = 'CANCELLED'), 0) AS cancelled FROM purchases"
    )
    p = cur.fetchone()
    counts.update({"purchases": int(p["total"]), "completed_purchases": int(p["completed"]),
                   "cancelled_purchases": int(p["cancelled"])})
    cur.execute(
        "SELECT COALESCE(SUM(pi.quantity * pi.unit_price), 0) AS revenue, COALESCE(SUM(pi.quantity), 0) AS units "
        "FROM purchase_items pi JOIN purchases p ON p.id = pi.purchase_id WHERE p.status = 'COMPLETED'"
    )
    sales = cur.fetchone()
    counts["revenue"] = float(sales["revenue"] or 0)
    counts["units_sold"] = int(sales["units"] or 0)
    cur.execute("SELECT COALESCE(SUM(stock_available * price), 0) AS v FROM items WHERE active = 1")
    counts["inventory_value"] = float(cur.fetchone()["v"] or 0)

    cur.execute(
        """
        SELECT i.id, i.name, it.type_name, i.stock_available, i.active
        FROM items i JOIN item_types it ON i.item_type_id = it.id
        WHERE i.stock_available <= %s
        ORDER BY i.stock_available ASC, i.name ASC
        LIMIT 8
        """,
        (low,),
    )
    attention = clean_rows(cur.fetchall())
    for row in attention:
        row["active"] = bool(row["active"])
        row["availability"] = OUT_OF_STOCK if row["stock_available"] <= 0 else LOW_STOCK

    cur.execute(
        """
        SELECT p.id, p.order_id, p.purchase_date, p.status,
               COUNT(pi.id) AS line_count, COALESCE(SUM(pi.quantity), 0) AS total_quantity,
               COALESCE(SUM(pi.quantity * pi.unit_price), 0) AS total_amount
        FROM purchases p
        JOIN purchase_items pi ON pi.purchase_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT 6
        """
    )
    recent = clean_rows(cur.fetchall())
    for row in recent:
        row["line_count"] = int(row["line_count"])
        row["total_quantity"] = int(row["total_quantity"])
        row["total_amount"] = float(row["total_amount"] or 0)

    # best sellers (completed orders)
    cur.execute(
        """
        SELECT i.id, i.name, it.type_name, i.price, i.stock_available, SUM(pi.quantity) AS units,
               SUM(pi.quantity * pi.unit_price) AS revenue
        FROM purchase_items pi
        JOIN purchases p   ON p.id = pi.purchase_id AND p.status = 'COMPLETED'
        JOIN items i       ON i.id = pi.item_id
        JOIN item_types it ON it.id = i.item_type_id
        GROUP BY i.id
        ORDER BY units DESC, revenue DESC
        LIMIT 5
        """
    )
    best = clean_rows(cur.fetchall())
    for row in best:
        row["units"] = int(row["units"])
        row["revenue"] = float(row["revenue"] or 0)
        row["price"] = float(row["price"] or 0)

    return {"status": 200, "data": {"counts": counts, "attention": attention,
                                    "recent_purchases": recent, "best_sellers": best,
                                    "low_stock_threshold": low}}
