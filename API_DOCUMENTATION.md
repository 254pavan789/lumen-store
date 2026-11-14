# API Documentation

Base URL: `http://localhost:3000/api`
Content type: `application/json` (requests and responses)
Postman collection: `postman/Item_Purchase_Management.postman_collection.json`

Every request is processed by the **Python engine** (validation, stock rules, JOINs, transactions). Express only forwards it.

## Response format

Success:

```json
{ "success": true, "message": "optional human message", "data": { }, "meta": { } }
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human readable message",
    "details": [ { "field": "items[0].quantity", "line": 0, "message": "Quantity must be greater than zero" } ]
  }
}
```

`details` lists every problem found (field-level). `line` is the 0-based index of the line in the submitted `items` array.

## Status codes

| Code | Meaning | Examples (`error.code`) |
|---|---|---|
| 200 | OK | – |
| 201 | Created | – |
| 400 | Validation error / malformed request | `VALIDATION_ERROR`, `MALFORMED_JSON`, `MALFORMED_REQUEST`, `INVALID_ID` |
| 404 | Record not found | `ITEM_NOT_FOUND`, `ITEM_TYPE_NOT_FOUND`, `PURCHASE_NOT_FOUND`, `ROUTE_NOT_FOUND` |
| 405 | Method not allowed | `METHOD_NOT_ALLOWED` (DELETE purchase) |
| 409 | Business rule conflict | `INSUFFICIENT_STOCK`, `ITEM_INACTIVE`, `ITEM_HAS_PURCHASE_HISTORY`, `ITEM_TYPE_IN_USE`, `DUPLICATE_ITEM`, `DUPLICATE_ITEM_TYPE`, `DUPLICATE_ORDER_ID`, `PURCHASE_CANCELLED`, `PURCHASE_REJECTED`, `TRANSACTION_CONFLICT` |
| 500 | Unexpected error (safe message only) | `INTERNAL_ERROR`, `DATABASE_ERROR` |
| 503 / 504 | Database / engine unavailable or timed out | `DATABASE_UNAVAILABLE`, `ENGINE_UNAVAILABLE`, `ENGINE_TIMEOUT` |

Availability rule: `stock = 0` → **Out of Stock**, `1 … LOW_STOCK_THRESHOLD (5)` → **Low Stock**, `> 5` → **In Stock**.

---

## System

### GET `/health`
```json
{ "success": true, "data": { "engine": "python", "engine_version": "1.0.0", "python": "3.13.18",
  "database": "item_purchase_db", "mysql_version": "8.0.39", "low_stock_threshold": 5 } }
```

### GET `/dashboard`
Counts (items, active/inactive, in/low/out of stock, units, item types, purchases, **revenue**, units sold, inventory value), items needing attention, recent purchases (with `total_amount`) and best sellers.

### GET `/stock`
Query: `availability=in|low|out|all`, `search=text`
Returns items with `availability`; `meta` = `{ total_items, in_stock, low_stock, out_of_stock, total_units, low_stock_threshold }`.

---

## Item Types

### GET `/item-types`
Lists types with `item_count`, `active_item_count`, `can_delete` (LEFT JOIN items).

### GET `/item-types/:id`

### POST `/item-types`
```json
{ "type_name": "Electronics" }
```
`201` → created type. `400` "Item type name is required". `409` "Item type 'Electronics' already exists" (case-insensitive).

### PUT `/item-types/:id`
```json
{ "type_name": "Consumer Electronics" }
```

### DELETE `/item-types/:id`
`200` when unused. `409 ITEM_TYPE_IN_USE` when items still reference it.

---

## Items

### GET `/items`
Query parameters (all optional):

| Param | Values |
|---|---|
| `search` | text in item name or type name |
| `type_id` | item type id |
| `status` | `active`, `inactive`, `all` |
| `availability` | `in`, `low`, `out`, `all` |
| `sort` | `id`, `name`, `type`, `purchase_date`, `stock`, `status`, `price`, `newest`, `popular` (units sold) |
| `min_price` / `max_price` | price range (INR) |
| `order` | `asc`, `desc` |

Each item (Item + Item Type JOIN):

```json
{ "id": 1, "name": "Laptop", "item_type_id": 1, "type_name": "Electronics", "purchase_date": "2026-08-01",
  "stock_available": 10, "active": true, "status": "Active", "availability": "In Stock",
  "price": 54999, "description": "14-inch ultrabook …", "units_sold": 0,
  "purchase_count": 0, "can_delete": true, "created_at": "2026-11-14 14:13:20", "updated_at": "2026-11-14 14:13:20" }
```

### GET `/items/:id`
Item + `purchase_history` (purchase_items JOIN purchases), `stock_movements` (audit trail) and `stats { orders, units_purchased }`.

`400 INVALID_ID` for `/items/abc`, `404` "Item not found".

### POST `/items`
```json
{ "name": "Laptop", "item_type_id": 1, "purchase_date": "2026-08-25", "stock_available": 10,
  "price": 54999, "description": "14-inch ultrabook", "active": true }
```

| Field | Rule | Error message |
|---|---|---|
| `name` | required, ≤ 100 chars, unique | `Item name is required` / 409 `An item named 'X' already exists` |
| `item_type_id` | required, must exist in `item_types` | `Item type is required` / `Invalid item type` |
| `purchase_date` | required, valid date `YYYY-MM-DD` (also accepts `DD-MM-YYYY`) | `Purchase date is required` / `Purchase date is invalid` |
| `stock_available` | required whole number ≥ 0 | `Stock cannot be negative` / `Stock must be a whole number` |
| `active` | `true/false` (also `1/0`, `"active"/"inactive"`); defaults to `true` on create | `Status is required (Active or Inactive)` |
| `price` | optional on create (default 0) and update (omitted = keep); ≥ 0, max 2 decimals | `Price cannot be negative` / `Price can have at most 2 decimal places` |
| `description` | optional, ≤ 500 chars | `Description must be at most 500 characters` |

Example validation error (`400`):

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Item name is required (+1 more error)",
  "details": [ { "field": "name", "message": "Item name is required" },
               { "field": "stock_available", "message": "Stock cannot be negative" } ] } }
```

### PUT `/items/:id`
Same body and rules as POST (name, type, date, stock, active required; `price`/`description` optional — omitted keeps the current value). A stock change is recorded as a manual `ADJUSTMENT` movement.

### PATCH `/items/:id/status`
```json
{ "active": false }
```

### DELETE `/items/:id`
* `200` – item had no purchase history and was deleted.
* `409 ITEM_HAS_PURCHASE_HISTORY` – *"Item 'Laptop' is used in 1 purchase(s) and cannot be deleted because that would break purchase history. Mark it Inactive instead."*

---

## Purchases

### GET `/purchases`
Query: `search` (Order ID or item name), `status=completed|cancelled|all`, `date_from`, `date_to` (`YYYY-MM-DD`).

```json
{ "id": 1, "order_id": "PO-00001", "purchase_date": "2026-08-25", "status": "COMPLETED", "remarks": null,
  "line_count": 3, "total_quantity": 10, "total_amount": 134990, "item_ids": [1, 2, 5],
  "items_summary": "Laptop – 2; Mouse – 5; Chair – 3", "created_at": "…", "updated_at": "…" }
```

### GET `/purchases/next-order-id`
```json
{ "success": true, "data": { "order_id": "PO-00002" } }
```

### GET `/purchases/:id`
`:id` may be the numeric id (`1`) **or** the Order ID (`PO-00001`). Uses the JOIN purchases → purchase_items → items → item_types.

```json
{
  "success": true,
  "data": {
    "id": 1, "order_id": "PO-00001", "purchase_date": "2026-08-25", "status": "COMPLETED",
    "remarks": null, "cancelled_at": null, "cancel_reason": null,
    "created_at": "2026-11-14 14:27:02", "updated_at": "2026-11-14 14:27:02",
    "items": [
      { "line_id": 1, "item_id": 1, "item_name": "Laptop", "type_name": "Electronics", "quantity": 2,
        "unit_price": 54999, "line_total": 109998, "current_price": 54999,
        "current_stock": 8, "item_active": true, "item_status": "Active", "availability": "In Stock" },
      { "line_id": 2, "item_id": 2, "item_name": "Mouse", "type_name": "Electronics", "quantity": 5,
        "current_stock": 15, "item_active": true, "item_status": "Active", "availability": "In Stock" },
      { "line_id": 3, "item_id": 5, "item_name": "Chair", "type_name": "Furniture", "quantity": 3,
        "current_stock": 12, "item_active": true, "item_status": "Active", "availability": "In Stock" }
    ],
    "line_count": 3, "total_quantity": 10, "total_amount": 134990, "can_update": true
  }
}
```

### POST `/purchases`
```json
{
  "order_id": "PO-00001",
  "purchase_date": "2026-08-25",
  "remarks": "optional",
  "items": [
    { "item_id": 1, "quantity": 2 },
    { "item_id": 2, "quantity": 5 },
    { "item_id": 5, "quantity": 3 }
  ]
}
```
`order_id` is optional – when omitted the next `PO-xxxxx` is generated.

Each line stores `unit_price` = the item's price at order time, so later price changes never rewrite past orders. On update, existing lines keep their `unit_price`; newly added lines take the current price.

Processing (one MySQL transaction):

1. validate header + every line (400 on shape errors)
2. lock all items `SELECT … FOR UPDATE` (ordered by id)
3. check each item exists (404), is Active (409) and has enough stock (409)
4. insert `purchases`, insert `purchase_items`
5. deduct stock with a guarded `UPDATE` (never below 0) and write `stock_movements`
6. `COMMIT` – or `ROLLBACK` on any failure (no partial purchase is ever stored)

| Situation | Status | Message |
|---|---|---|
| no items | 400 | `Purchase must contain at least one item` |
| quantity ≤ 0 | 400 | `Quantity must be greater than zero` |
| quantity not whole | 400 | `Quantity must be a whole number` |
| same item twice | 400 | `Duplicate item in order (item ID 1 is already on line 1). Combine the quantities into one line.` |
| missing / invalid date | 400 | `Purchase date is required` / `Purchase date is invalid (use YYYY-MM-DD)` |
| item does not exist | 404 | `Item not found (item ID 99)` |
| item inactive | 409 | `Item 'Legacy Printer' is inactive and cannot be purchased` |
| not enough stock | 409 | `Insufficient stock for 'Laptop': requested 10, available 8` (+ `requested`, `available` in details) |
| Order ID taken | 409 | `Order ID 'PO-00001' already exists` |

Insufficient stock response:

```json
{ "success": false, "error": { "code": "INSUFFICIENT_STOCK",
  "message": "Insufficient stock for 'Laptop': requested 10, available 8",
  "details": [ { "field": "items[0].quantity", "line": 0, "item_id": 1, "code": "INSUFFICIENT_STOCK",
                 "requested": 10, "available": 8,
                 "message": "Insufficient stock for 'Laptop': requested 10, available 8" } ] } }
```

### PUT `/purchases/:id`
Replaces the order's lines; stock is adjusted by the **difference** for each item.

```json
{ "purchase_date": "2026-08-25",
  "items": [ { "item_id": 1, "quantity": 4 }, { "item_id": 2, "quantity": 5 }, { "item_id": 5, "quantity": 3 } ] }
```

| Old qty → New qty | Stock effect |
|---|---|
| 3 → 5 | deduct 2 more (validated against available stock) |
| 5 → 2 | return 3 |
| line added (0 → n) | deduct n (item must be Active) |
| line removed (n → 0) | return n |

Rules: at least one line must remain, the Order ID cannot change, cancelled purchases cannot be updated (409), an inactive item's quantity can be kept or reduced but not increased (409). Error message for over-requests:
`Insufficient stock for 'Widget': 3 more required, only 1 available (maximum quantity for this order is 3)`.

The response contains the updated purchase plus `stock_adjustments`:

```json
"stock_adjustments": [
  { "item_id": 1, "item_name": "Laptop", "action": "increased", "old_quantity": 2, "new_quantity": 4,
    "stock_change": -2, "stock_before": 8, "stock_after": 6 }
]
```

### POST `/purchases/:id/cancel`
Optional cancellation workflow – the record is **not deleted**.

```json
{ "reason": "Ordered by mistake" }
```
Sets `status = CANCELLED`, `cancelled_at`, `cancel_reason`, returns every line's quantity to stock (`PURCHASE_CANCEL` movements). `409` if already cancelled.

### DELETE `/purchases/:id` – not available
There is no delete endpoint. Any DELETE on a purchase returns:

```http
HTTP/1.1 405 Method Not Allowed
Allow: GET, PUT
```
```json
{ "success": false, "error": { "code": "METHOD_NOT_ALLOWED",
  "message": "Purchases cannot be deleted. They are historical transactions kept for audit and stock traceability. Use POST /api/purchases/:id/cancel to cancel an order instead." } }
```
