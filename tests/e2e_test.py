"""
End-to-end API test - verifies every mandatory rule of the assignment
against a running server (no extra packages needed).

    1. start the app:   npm start
    2. run the tests:   python tests/e2e_test.py  [base_url]

The test creates its own uniquely-named records, so it can run against a
database that already contains data (seed data is never modified).
"""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000").rstrip("/") + "/api"
TAG = time.strftime("%H%M%S")
PASSED: list[str] = []
FAILED: list[str] = []


def call(method: str, path: str, body=None, raw: bytes | None = None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return res.status, json.loads(res.read().decode() or "{}")
    except urllib.error.HTTPError as err:
        text = err.read().decode()
        return err.code, (json.loads(text) if text else {})


def check(name: str, condition: bool, info=None) -> None:
    if condition:
        PASSED.append(name)
        print(f"  PASS  {name}")
    else:
        FAILED.append(name)
        print(f"  FAIL  {name}  ->  {json.dumps(info)[:400] if info is not None else ''}")


def err_msg(body) -> str:
    return (body.get("error") or {}).get("message", "")


def stock_of(item_id: int) -> int:
    return call("GET", f"/items/{item_id}")[1]["data"]["stock_available"]


def make_item(name: str, type_id: int, stock: int, active=True) -> int:
    status, body = call("POST", "/items", {"name": f"{name} {TAG}", "item_type_id": type_id,
                                           "purchase_date": "2026-08-25", "stock_available": stock,
                                           "active": active})
    assert status == 201, body
    return body["data"]["id"]


def main() -> int:
    print(f"Testing {BASE}\n")
    status, body = call("GET", "/health")
    check("health endpoint reports python engine + DB", status == 200 and body["data"]["engine"] == "python", body)
    if status != 200:
        return 1

    # ------------------------------------------------------------ item types
    print("\n[Item Types]")
    s, b = call("POST", "/item-types", {"type_name": f"Electronics {TAG}"})
    check("create item type -> 201", s == 201, b)
    elec = b["data"]["id"]
    s, b = call("POST", "/item-types", {"type_name": f"electronics {TAG}"})
    check("duplicate item type (case-insensitive) -> 409", s == 409, b)
    s, b = call("POST", "/item-types", {"type_name": "  "})
    check("blank item type name -> 400", s == 400, b)
    s, b = call("POST", "/item-types", {"type_name": f"Furniture {TAG}"})
    furn = b["data"]["id"]
    s, b = call("PUT", f"/item-types/{furn}", {"type_name": f"Furniture & Fixtures {TAG}"})
    check("rename item type -> 200", s == 200 and "Fixtures" in b["data"]["type_name"], b)
    s, b = call("GET", "/item-types")
    check("list item types (JOIN item counts)", s == 200 and any(t["id"] == elec for t in b["data"]), b)

    # ------------------------------------------------------------ item validation
    print("\n[Item validation]")
    s, b = call("POST", "/items", {"item_type_id": elec, "purchase_date": "2026-08-25", "stock_available": 1, "active": True})
    check("missing item name -> 400 'Item name is required'", s == 400 and "Item name is required" in json.dumps(b), b)
    s, b = call("POST", "/items", {"name": "X", "item_type_id": 999999, "purchase_date": "2026-08-25", "stock_available": 1, "active": True})
    check("invalid item type -> 400 'Invalid item type'", s == 400 and "Invalid item type" in json.dumps(b), b)
    s, b = call("POST", "/items", {"name": "X", "item_type_id": elec, "purchase_date": "2026-02-30", "stock_available": 1, "active": True})
    check("invalid purchase date -> 400", s == 400 and "Purchase date" in json.dumps(b), b)
    s, b = call("POST", "/items", {"name": "X", "item_type_id": elec, "stock_available": 1, "active": True})
    check("missing purchase date -> 400", s == 400 and "Purchase date is required" in json.dumps(b), b)
    s, b = call("POST", "/items", {"name": "X", "item_type_id": elec, "purchase_date": "2026-08-25", "stock_available": -1, "active": True})
    check("negative stock -> 400 'Stock cannot be negative'", s == 400 and "Stock cannot be negative" in json.dumps(b), b)
    s, b = call("POST", "/items", raw=b'{"name": ')
    check("malformed JSON -> 400", s == 400, b)
    s, b = call("POST", "/items", [1, 2, 3])
    check("non-object body -> 400", s == 400, b)
    s, b = call("GET", "/items/abc")
    check("invalid item id -> 400", s == 400, b)
    s, b = call("GET", "/items/99999999")
    check("unknown item -> 404 'Item not found'", s == 404 and err_msg(b) == "Item not found", b)

    # ------------------------------------------------------------ item CRUD
    print("\n[Item CRUD]")
    laptop = make_item("Laptop", elec, 10)
    mouse = make_item("Mouse", elec, 20)
    chair = make_item("Chair", furn, 15)
    s, b = call("GET", f"/items/{laptop}")
    check("view item details (JOIN item type)", s == 200 and b["data"]["type_name"].startswith("Electronics"), b)
    s, b = call("POST", "/items", {"name": f"laptop {TAG}", "item_type_id": elec, "purchase_date": "2026-08-25", "stock_available": 1})
    check("duplicate item name -> 409", s == 409, b)
    temp = make_item("Temp Item", elec, 3)
    s, b = call("PUT", f"/items/{temp}", {"name": f"Temp Item Renamed {TAG}", "item_type_id": furn,
                                           "purchase_date": "2026-08-26", "stock_available": 0, "active": True})
    check("update item -> 200, availability Out of Stock", s == 200 and b["data"]["availability"] == "Out of Stock", b)
    s, b = call("PATCH", f"/items/{temp}/status", {"active": False})
    check("deactivate item -> 200", s == 200 and b["data"]["active"] is False, b)
    s, b = call("PATCH", f"/items/{temp}/status", {"active": True})
    check("activate item -> 200", s == 200 and b["data"]["active"] is True, b)
    s, b = call("GET", "/items?availability=out&search=" + TAG)
    check("filter items by availability", s == 200 and any(i["id"] == temp for i in b["data"]), b)
    s, b = call("DELETE", f"/items/{temp}")
    check("delete item without purchase history -> 200", s == 200, b)
    s, b = call("GET", f"/items/{temp}")
    check("deleted item is gone -> 404", s == 404, b)

    # ------------------------------------------------------------ end-to-end example
    print("\n[Purchase - end-to-end example]")
    s, b = call("POST", "/purchases", {"purchase_date": "2026-08-25",
                                       "items": [{"item_id": laptop, "quantity": 2},
                                                 {"item_id": mouse, "quantity": 5},
                                                 {"item_id": chair, "quantity": 3}]})
    check("purchase with 3 items under one Order ID -> 201", s == 201 and b["data"]["line_count"] == 3, b)
    order = b["data"]
    check("order id generated (PO-xxxxx)", order["order_id"].startswith("PO-"), order)
    check("stock deducted: Laptop 8, Mouse 15, Chair 12",
          (stock_of(laptop), stock_of(mouse), stock_of(chair)) == (8, 15, 12),
          [stock_of(laptop), stock_of(mouse), stock_of(chair)])

    s, b = call("GET", "/purchases")
    before_count = len(b["data"])
    s, b = call("POST", "/purchases", {"purchase_date": "2026-08-26", "items": [{"item_id": laptop, "quantity": 10}]})
    check("10 laptops with only 8 available -> 409 insufficient stock",
          s == 409 and "Insufficient stock" in err_msg(b) and "available 8" in err_msg(b), b)
    check("rejected purchase leaves Laptop stock at 8", stock_of(laptop) == 8)

    # atomicity: one good line + one bad line -> nothing saved
    s, b = call("POST", "/purchases", {"purchase_date": "2026-08-26",
                                       "items": [{"item_id": mouse, "quantity": 1},
                                                 {"item_id": laptop, "quantity": 99}]})
    check("mixed valid/invalid lines -> rejected", s == 409, b)
    s, b = call("GET", "/purchases")
    check("transaction rollback: no partial purchase saved", len(b["data"]) == before_count)
    check("transaction rollback: Mouse stock unchanged (15)", stock_of(mouse) == 15)

    # ------------------------------------------------------------ purchase validation
    print("\n[Purchase validation]")
    s, b = call("POST", "/purchases", {"purchase_date": "2026-08-26", "items": []})
    check("empty purchase -> 400 'at least one item'", s == 400 and "at least one item" in json.dumps(b), b)
    s, b = call("POST", "/purchases", {"purchase_date": "2026-08-26", "items": [{"item_id": laptop, "quantity": 0}]})
    check("quantity 0 -> 400 'Quantity must be greater than zero'",
          s == 400 and "Quantity must be greater than zero" in json.dumps(b), b)
    s, b = call("POST", "/purchases", {"purchase_date": "2026-08-26", "items": [{"item_id": laptop, "quantity": -3}]})
    check("negative quantity -> 400", s == 400, b)
    s, b = call("POST", "/purchases", {"purchase_date": "2026-08-26", "items": [{"item_id": laptop, "quantity": 1.5}]})
    check("fractional quantity -> 400", s == 400, b)
    s, b = call("POST", "/purchases", {"purchase_date": "2026-08-26",
                                       "items": [{"item_id": laptop, "quantity": 1}, {"item_id": laptop, "quantity": 1}]})
    check("duplicate item in one order -> 400 rejected consistently", s == 400 and "Duplicate item" in json.dumps(b), b)
    s, b = call("POST", "/purchases", {"items": [{"item_id": laptop, "quantity": 1}]})
    check("missing purchase date -> 400", s == 400, b)
    s, b = call("POST", "/purchases", {"purchase_date": "2026-08-26", "items": [{"item_id": 99999999, "quantity": 1}]})
    check("unknown item in purchase -> 404 'Item not found'", s == 404 and "Item not found" in err_msg(b), b)
    inactive = make_item("Inactive Gadget", elec, 50, active=False)
    s, b = call("POST", "/purchases", {"purchase_date": "2026-08-26", "items": [{"item_id": inactive, "quantity": 1}]})
    check("inactive item -> 409 'inactive and cannot be purchased'",
          s == 409 and "inactive and cannot be purchased" in err_msg(b), b)
    s, b = call("POST", "/purchases", {"order_id": order["order_id"], "purchase_date": "2026-08-26",
                                       "items": [{"item_id": mouse, "quantity": 1}]})
    check("duplicate Order ID -> 409", s == 409, b)

    # ------------------------------------------------------------ details / JOIN
    print("\n[Purchase details]")
    s, b = call("GET", f"/purchases/{order['id']}")
    check("purchase details by id (JOIN purchases+items+types)",
          s == 200 and {l["item_id"] for l in b["data"]["items"]} == {laptop, mouse, chair}
          and all(l["type_name"] for l in b["data"]["items"]), b)
    s, b = call("GET", f"/purchases/{order['order_id']}")
    check("purchase details by Order ID", s == 200 and b["data"]["id"] == order["id"], b)
    s, b = call("GET", "/purchases/999999")
    check("unknown purchase -> 404", s == 404, b)

    # ------------------------------------------------------------ update with stock difference
    print("\n[Purchase update - stock difference]")
    widget = make_item("Widget", elec, 10)
    s, b = call("POST", "/purchases", {"purchase_date": "2026-08-27", "items": [{"item_id": widget, "quantity": 3}]})
    pid = b["data"]["id"]
    check("initial 10, purchase 3 -> remaining 7", stock_of(widget) == 7, stock_of(widget))
    s, b = call("PUT", f"/purchases/{pid}", {"purchase_date": "2026-08-27", "items": [{"item_id": widget, "quantity": 5}]})
    check("3 -> 5 deducts 2 more -> remaining 5", s == 200 and stock_of(widget) == 5, b)
    s, b = call("PUT", f"/purchases/{pid}", {"purchase_date": "2026-08-27", "items": [{"item_id": widget, "quantity": 2}]})
    check("5 -> 2 returns 3 -> remaining 8", s == 200 and stock_of(widget) == 8, b)
    adj = b["data"]["stock_adjustments"][0]
    check("update response reports stock adjustment", adj["stock_change"] == 3 and adj["stock_after"] == 8, adj)
    s, b = call("PUT", f"/purchases/{pid}", {"purchase_date": "2026-08-27", "items": [{"item_id": widget, "quantity": 11}]})
    check("update beyond available (max 10) -> 409, stock unchanged", s == 409 and stock_of(widget) == 8, b)
    s, b = call("PUT", f"/purchases/{pid}", {"purchase_date": "2026-08-27", "items": [{"item_id": widget, "quantity": 10}]})
    check("update to exactly available -> stock 0 (never negative)", s == 200 and stock_of(widget) == 0, b)
    s, b = call("PUT", f"/purchases/{pid}", {"purchase_date": "2026-08-28",
                                             "items": [{"item_id": widget, "quantity": 4}, {"item_id": mouse, "quantity": 2}]})
    check("update can add a new line + reduce another", s == 200 and stock_of(widget) == 6 and stock_of(mouse) == 13, b)
    s, b = call("PUT", f"/purchases/{pid}", {"purchase_date": "2026-08-28", "items": [{"item_id": widget, "quantity": 4}]})
    check("removing a line on update returns its stock", s == 200 and stock_of(mouse) == 15, b)
    s, b = call("PUT", f"/purchases/{pid}", {"purchase_date": "2026-08-28", "items": []})
    check("update with no items -> 400", s == 400, b)
    call("PATCH", f"/items/{widget}/status", {"active": False})
    s, b = call("PUT", f"/purchases/{pid}", {"purchase_date": "2026-08-28", "items": [{"item_id": widget, "quantity": 5}]})
    check("inactive item cannot be increased on update -> 409", s == 409, b)
    s, b = call("PUT", f"/purchases/{pid}", {"purchase_date": "2026-08-28", "items": [{"item_id": widget, "quantity": 1}]})
    check("inactive item quantity can be reduced on update", s == 200 and stock_of(widget) == 9, b)

    # ------------------------------------------------------------ deletion rules
    print("\n[Deletion rules]")
    s, b = call("DELETE", f"/purchases/{order['id']}")
    check("DELETE purchase -> 405 (no delete endpoint)", s == 405, b)
    s, b = call("GET", f"/purchases/{order['id']}")
    check("purchase still available after delete attempt", s == 200, b)
    s, b = call("DELETE", f"/items/{laptop}")
    check("delete item with purchase history -> 409", s == 409 and "Inactive" in err_msg(b), b)
    s, b = call("DELETE", f"/item-types/{elec}")
    check("delete item type in use -> 409", s == 409, b)
    call("PATCH", f"/items/{laptop}/status", {"active": False})
    s, b = call("GET", f"/purchases/{order['id']}")
    check("inactive item still visible in historical purchase",
          any(l["item_id"] == laptop and l["item_status"] == "Inactive" for l in b["data"]["items"]), b)
    call("PATCH", f"/items/{laptop}/status", {"active": True})

    # ------------------------------------------------------------ cancellation workflow
    print("\n[Cancellation workflow]")
    s, b = call("POST", f"/purchases/{order['id']}/cancel", {"reason": "Test cancel"})
    check("cancel purchase -> 200, record kept with status CANCELLED",
          s == 200 and b["data"]["status"] == "CANCELLED", b)
    check("cancel returns stock: Laptop 10, Mouse 20, Chair 15",
          (stock_of(laptop), stock_of(mouse), stock_of(chair)) == (10, 20, 15))
    s, b = call("PUT", f"/purchases/{order['id']}", {"purchase_date": "2026-08-25", "items": [{"item_id": laptop, "quantity": 1}]})
    check("cancelled purchase cannot be updated -> 409", s == 409, b)

    # ------------------------------------------------------------ concurrency
    print("\n[Concurrency - stock can never go negative]")
    hot = make_item("Hot Item", elec, 5)

    def buy(_):
        return call("POST", "/purchases", {"purchase_date": "2026-08-29", "items": [{"item_id": hot, "quantity": 1}]})[0]

    with ThreadPoolExecutor(max_workers=12) as pool:
        results = list(pool.map(buy, range(12)))
    check("12 parallel buys of stock 5 -> exactly 5 succeed", results.count(201) == 5, results)
    check("final stock is 0, not negative", stock_of(hot) == 0, stock_of(hot))

    # ------------------------------------------------------------ pricing (storefront)
    print("\n[Pricing]")
    s, b = call("POST", "/items", {"name": f"Priced {TAG}", "item_type_id": elec, "purchase_date": "2026-08-25",
                                   "stock_available": 9, "price": -1})
    check("negative price -> 400", s == 400 and "Price cannot be negative" in json.dumps(b), b)
    s, b = call("POST", "/items", {"name": f"Priced {TAG}", "item_type_id": elec, "purchase_date": "2026-08-25",
                                   "stock_available": 9, "price": "12.345"})
    check("price with 3 decimals -> 400", s == 400, b)
    s, b = call("POST", "/items", {"name": f"Priced {TAG}", "item_type_id": elec, "purchase_date": "2026-08-25",
                                   "stock_available": 9, "price": 250.5, "description": "Test product"})
    check("create priced item -> 201", s == 201 and b["data"]["price"] == 250.5, b)
    priced = b["data"]["id"]
    s, b = call("POST", "/purchases", {"purchase_date": "2026-08-30", "items": [{"item_id": priced, "quantity": 2}]})
    check("order total = qty x price (501.0)", s == 201 and b["data"]["total_amount"] == 501.0, b)
    snap = b["data"]["id"]
    call("PUT", f"/items/{priced}", {"name": f"Priced {TAG}", "item_type_id": elec, "purchase_date": "2026-08-25",
                                     "stock_available": 7, "price": 999, "active": True})
    s, b = call("GET", f"/purchases/{snap}")
    check("price change does not rewrite past orders (unit_price snapshot)",
          b["data"]["items"][0]["unit_price"] == 250.5 and b["data"]["total_amount"] == 501.0, b)
    s, b = call("PUT", f"/items/{priced}", {"name": f"Priced {TAG}", "item_type_id": elec, "purchase_date": "2026-08-25",
                                            "stock_available": 7, "active": True})
    check("PUT without price keeps current price", s == 200 and b["data"]["price"] == 999, b)

    # ------------------------------------------------------------ misc
    print("\n[Misc]")
    s, b = call("GET", "/stock")
    check("stock overview with availability summary", s == 200 and "low_stock" in b["meta"], b)
    s, b = call("GET", "/dashboard")
    check("dashboard summary", s == 200 and "counts" in b["data"], b)
    s, b = call("GET", "/purchases/next-order-id")
    check("next order id preview", s == 200 and b["data"]["order_id"].startswith("PO-"), b)
    s, b = call("GET", "/nope")
    check("unknown API route -> 404 JSON", s == 404 and b.get("success") is False, b)

    print(f"\n{len(PASSED)} passed, {len(FAILED)} failed")
    for name in FAILED:
        print("  FAILED:", name)
    return 0 if not FAILED else 1


if __name__ == "__main__":
    sys.exit(main())
