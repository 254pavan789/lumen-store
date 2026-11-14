# Lumen Store — Item & Purchase Management System (v3)

> **Put it online for free with a shareable link:** see **[DEPLOY.md](DEPLOY.md)**. It uses GitHub, Render (app + Python engine) and TiDB Cloud Starter (MySQL-compatible database), takes about 20 minutes and needs no credit card.

A full-stack **e-commerce storefront + back office** built on the assignment's Item & Purchase Management requirements.

* **Lumen storefront** (`#/`) — animated startup screen, bento-style home, product catalogue with live stock, instant search, quick view, category/price/availability filters, product pages, cart drawer (bottom sheet on phones), checkout, order confirmation, order history, *modify order* and *cancel order*, recently viewed, saved items, **light / dark mode toggle**.
* **Seller Hub** (`#/admin`) — the assignment's management screens: Item master (Products), Item Types (Categories), Inventory / availability, Purchases (Orders) with create / view / update and the no-delete rule.

| Assignment term | In the app |
|---|---|
| Item | Product |
| Item Type | Category |
| Purchase / Order | Order (`PO-00001` …) |
| Stock / Availability view | Inventory (Seller Hub) + live stock on every product |

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, vanilla JavaScript (ES modules, no build step, no framework); SVG product art generated in code; [Motion](https://motion.dev) (vendored in `frontend/vendor/`, MIT) for spring animations |
| Backend (HTTP) | Node.js + Express.js REST API |
| **Core processing engine** | **Python 3** (`engine/`) – all validation, stock rules, SQL JOINs and transactions |
| Database | MySQL 8 (InnoDB, foreign keys, CHECK constraints, transactions); also runs on MariaDB 10.4+ and TiDB Cloud (hosted) |
| Hosting | Docker image (Node.js 22 + Python 3) → Render free web service; see [DEPLOY.md](DEPLOY.md) |

---

## 1. Architecture

```
 Browser (frontend/)                Node.js + Express (backend/)             Python engine (engine/)              MySQL
 ───────────────────               ─────────────────────────────            ───────────────────────             ───────
  Store + Seller Hub    ──HTTP──▶   /api/* routes  ──JSON line──▶            router → validators → services ──SQL──▶ item_types
  fetch('/api/...')     ◀─JSON───   PythonBridge   ◀─JSON line──             BEGIN … COMMIT / ROLLBACK        ◀──── items
                                    (stdin/stdout, long-lived process)                                             purchases
                                                                                                                   purchase_items
                                                                                                                   stock_movements
```

* Express is a thin HTTP layer: it parses the request, forwards `{ action, params, query, body }` to the Python engine and returns the engine's answer unchanged.
* The Python engine (`engine/engine.py`) is started **once** when the server starts and stays alive (no per-request start-up cost). It runs requests on a small thread pool; each thread has its own MySQL connection and **every request runs in its own database transaction** (COMMIT on success, ROLLBACK on any error).
* If the engine crashes, the bridge restarts it automatically and pending requests receive a safe `503` response.

### How the mandatory rules are enforced

| Rule | Where / how |
|---|---|
| Stock never negative | (1) engine validation with row locks `SELECT … FOR UPDATE`, (2) guarded update `UPDATE items SET stock = stock + Δ WHERE id = ? AND stock + Δ >= 0`, (3) DB `CHECK (stock_available >= 0)` |
| Atomic purchase | one transaction: validate → insert purchase → insert purchase_items → deduct stock → COMMIT, ROLLBACK on any failure |
| Purchase update | stock adjusted by **difference** (`new − old`) per item, re-validated against available stock |
| Purchases cannot be deleted | no DELETE route; `DELETE /api/purchases/:id` returns **405** with an explanation; FK `ON DELETE RESTRICT` |
| Item delete | allowed only without purchase history, otherwise **409** “mark it Inactive instead” |
| Inactive items | rejected by the engine (409) and not offered in the purchase form |
| Duplicate items in one order | rejected consistently (400) + DB `UNIQUE (purchase_id, item_id)`; the UI merges duplicate adds into one line |
| Concurrency | items are locked in id order (no deadlocks); 12 parallel buyers on stock 5 → exactly 5 succeed (see tests) |

---

## 2. Prerequisites

| Software | Version (tested) |
|---|---|
| Node.js | 18 or newer (tested 22.x) |
| npm | 9 or newer |
| Python | 3.9 or newer (tested 3.13) |
| MySQL Server | 8.0.16 or newer (MariaDB 10.4+ also works) |

Python packages: `PyMySQL`, `cryptography` (needed for MySQL 8 `caching_sha2_password` login).
Node packages: `express`, `cors`, `dotenv`.

---

## 3. Quick start – Windows (double-click)

1. Install **Node.js**, **Python** (tick *“Add python.exe to PATH”*) and **MySQL Server 8**, and make sure MySQL is running.
2. Extract the project, e.g. to `C:\Projects\item-purchase-management`.
3. Double-click **`setup.bat`**
   * it creates `.env` and opens it in Notepad → set `DB_PASSWORD` (and `DB_USER` if not `root`), save, close Notepad
   * installs Node + Python packages, creates the database, tables and sample data.
4. Double-click **`start.bat`** → the browser opens **http://localhost:3000**.

## 4. Manual setup (any OS)

```bash
# 1) go to the project folder
cd item-purchase-management

# 2) configuration
cp .env.example .env              # Windows: copy .env.example .env
#    edit .env -> DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

# 3) dependencies
npm install
python -m pip install -r requirements.txt     # macOS/Linux: python3 -m pip install -r requirements.txt

# 4) database + tables + sample data   (choose ONE option)
python engine/migrate.py --seed                # option A: uses .env, no mysql CLI needed
#   or
mysql -u root -p < database/schema.sql         # option B: mysql CLI
mysql -u root -p < database/seed.sql

# 5) start backend + frontend (same server)
npm start
```

> **Already installed v1?** Run `python engine/migrate.py --seed` (or `setup.bat`) once more — it upgrades your existing database in place and adds the new sample products. Your existing orders are kept.

Open **http://localhost:3000**. The API is under **http://localhost:3000/api** (health check: `/api/health`).

### MySQL credentials / configuration (`.env`)

| Key | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Express port (frontend + API) |
| `DB_HOST` / `DB_PORT` | `localhost` / `3306` | MySQL server |
| `DB_USER` / `DB_PASSWORD` | `root` / – | MySQL login |
| `DB_NAME` | `item_purchase_db` | database name (migrate.py creates it) |
| `PYTHON_PATH` | auto | Python executable (`python`, `py`, `python3` are tried automatically) |
| `LOW_STOCK_THRESHOLD` | `5` | stock 1…5 = *Low Stock* |
| `ENGINE_THREADS` | `4` | engine worker threads |
| `ENGINE_TIMEOUT_MS` | `15000` | request timeout |

Optional dedicated MySQL user:

```sql
CREATE USER 'ipms'@'localhost' IDENTIFIED BY 'StrongPassword!';
GRANT ALL PRIVILEGES ON item_purchase_db.* TO 'ipms'@'localhost';
```

### Startup commands

| What | Command |
|---|---|
| Backend + frontend | `npm start` (or `node backend/server.js`) |
| Backend with auto-reload | `npm run dev` |
| Frontend | served by Express at `http://localhost:3000` – no separate build/start needed. (To host it elsewhere, serve `frontend/` with any static server; the API allows CORS.) |
| Create tables + sample data | `npm run db:setup` → `python engine/migrate.py --seed` |
| Drop & recreate everything | `npm run db:reset` → `python engine/migrate.py --reset --seed` |
| API test suite (server must be running) | `npm test` → `python tests/e2e_test.py` |

---

## 5. Database design

```
item_types 1 ──< items 1 ──< purchase_items >── 1 purchases
                    │                                  │
                    └──< stock_movements >─────────────┘   (audit trail)
```

| Table | Purpose | Key constraints |
|---|---|---|
| `item_types` | Item Type categories | PK `id`, UNIQUE `type_name` |
| `items` | Item master + current stock + `price`, `description` (storefront) | FK `item_type_id → item_types.id` (RESTRICT), UNIQUE `name`, `CHECK stock_available >= 0`, `CHECK price >= 0` |
| `purchases` | Order header (`order_id` e.g. `PO-00001`) | UNIQUE `order_id`, `status` COMPLETED/CANCELLED |
| `purchase_items` | Items + quantities per order + `unit_price` snapshot (price at order time) | FKs to purchases/items (RESTRICT), UNIQUE `(purchase_id, item_id)`, `CHECK quantity > 0` |
| `stock_movements` | Every stock change (opening, adjustment, purchase, update, cancel) | FKs, `CHECK balance_after >= 0` |

`python engine/migrate.py --seed` also **upgrades an existing v1 database in place** (adds `price`, `description`, `unit_price` and back-fills old order lines). All required columns from the assignment (`id, type_name`, `id, name, purchase_date, stock_available, item_type_id, active, created_at, updated_at`, …) are present. Full DDL: [`database/schema.sql`](database/schema.sql).

### Required JOINs (used by the engine)

```sql
-- Item + Item Type  (engine/items.py → ITEM_SELECT)
SELECT i.id, i.name, it.type_name, i.purchase_date, i.stock_available, i.active
FROM items i JOIN item_types it ON i.item_type_id = it.id;

-- Purchase + Purchase Items + Items + Item Types  (engine/purchases.py → fetch_purchase_detail)
SELECT p.order_id, p.purchase_date, i.id AS item_id, i.name AS item_name, it.type_name, pi.quantity
FROM purchases p
JOIN purchase_items pi ON p.id = pi.purchase_id
JOIN items i           ON pi.item_id = i.id
JOIN item_types it     ON i.item_type_id = it.id
WHERE p.order_id = ?;
```

### Sample data (`database/seed.sql`)

7 categories and 30 priced products (INR). Items 1–10 are the original sample set, including the assignment's example **Laptop 10, Mouse 20, Chair 15**, low-stock items, out-of-stock items and an inactive item. No orders are seeded, so you can run the end-to-end example yourself.

---

## 6. Using the application

### Storefront (shoppers)

| Screen | URL | What you can do |
|---|---|---|
| Startup screen | first visit per session | animated logo + real loading progress (health check + catalogue); *Skip intro* / Esc |
| Home | `#/` | bento hero (rotating headline, search, spotlight product, top category, live stock counter), scrolling category strip, **Discover** tabs (Trending / New in / Under ₹999 / Almost gone), category bento, “how it works”, recently viewed, Seller Hub banner |
| Shop | `#/shop` | filter by category, availability, price range; sort by popularity / price / newest / name; URL keeps the filters. Phones: filters open as a bottom sheet with a live “Show N results” button |
| Search | header (press `/`) | instant suggestions with keyboard navigation; Enter = all results |
| Quick view | “Quick view” on any product card (mouse) | price, stock, description, quantity and Add to cart without leaving the page |
| Product | `#/product/:id` | price, live stock meter, quantity, Add to cart, Buy now, related + recently viewed. Phones: sticky “Add to cart” bar |
| Cart | cart button | drawer on desktop, **drag-to-dismiss bottom sheet** on phones; quantities limited to stock; remove with Undo |
| Checkout | `#/checkout` | review items, order date, delivery note, pay on delivery; sticky “Place order” bar on phones. If stock changed meanwhile, the server rejects the order and the page offers *Use available quantities* |
| Order placed | `#/order-placed/:id` | confirmation with order number and receipt |
| Orders | `#/orders` | history with All / Confirmed / Cancelled tabs and search |
| Order details | `#/orders/:id` | timeline, items with unit price, total; Modify, Buy again, Cancel |
| Modify order | `#/orders/:id/edit` | change quantities, remove lines, add products — stock adjusted by the difference |
| Saved | `#/saved` | wishlist (stored in the browser) |

**Light / dark mode:** sun/moon button in the store header, footer, Seller Hub sidebar and Seller Hub top bar. First visit follows the operating system; your choice is remembered. The switch animates as a circle growing from the button (View Transitions API) and falls back to an instant switch.

### Seller Hub (assignment management screens)

| Screen | URL | Actions |
|---|---|---|
| Dashboard | `#/admin` | revenue, orders, products, inventory value, stock health, recent orders, best sellers, restock list |
| Products (Items) | `#/admin/products` | search/filter, view, edit, activate/deactivate, delete (only without purchase history) |
| Add / Edit product | `#/admin/products/new`, `#/admin/products/:id/edit` | Item Name, Item Type, Purchase Date, Stock Available, Price, Description, Active/Inactive |
| Product details | `#/admin/products/:id` | details, stock, purchase history, stock-movement audit trail |
| Categories (Item Types) | `#/admin/categories` | create, rename, delete (blocked if used) |
| Inventory | `#/admin/inventory` | In Stock (> 5), Low Stock (1–5), Out of Stock (0) |
| Orders (Purchases) | `#/admin/orders` | list with amount; View & Update (no Delete); New order |
| Order details / update | `#/admin/orders/:id`, `/edit` | lines with unit price and stock; update with stock-difference preview; cancel |

On phones and small tablets (≤ 880 px) the Seller Hub switches to an app layout: a top bar (title appears as you scroll, theme toggle, storefront link), a bottom tab bar (Dashboard · Products · Orders · Inventory · More) and every table turns into readable cards with labelled fields. *More* opens a sheet with Categories, New order, Add product, Open storefront and Appearance.

Old v1 URLs (`#/items`, `#/purchases`, `#/stock`, `#/item-types`) redirect to the Seller Hub.

### Motion & accessibility

Startup animation plays once per session; sections fade up as they scroll into view; the Discover tab indicator slides with a spring; product images “fly” into the cart; drawers slide with an iOS-style curve and bottom sheets follow your finger; buttons give press feedback; confetti on a placed order. All motion uses `transform`/`opacity`, respects `prefers-reduced-motion` (falls back to simple fades), hover effects only on mouse/trackpad devices. Keyboard: `/` focuses search, arrows + Enter in suggestions, Esc closes drawers/dialogs, focus is trapped in dialogs. Light and dark mode follow the OS.

### End-to-end example (from the assignment)

1. Store → add *Laptop 2, Mouse 5, Chair 3* to the cart → **Checkout → Place order** → `PO-00001`.
2. Seller Hub → **Inventory** now shows Laptop 8, Mouse 15, Chair 12.
3. Ordering *10 Laptops* is impossible: the stepper stops at the available stock, and the API rejects it with `Insufficient stock for 'Laptop': requested 10, available 8`.
4. **Orders → PO-00001 → Modify order**: Laptop 2 → 4 deducts 2 more; reducing returns stock (difference based).

Cancellation: *Cancel order* sets status **CANCELLED**, returns the stock and **keeps the record**. Cancelled orders cannot be modified.

---

## 7. API summary

Full reference with request/response examples: **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)**.
Postman: import **`postman/Item_Purchase_Management.postman_collection.json`**.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | engine + database status |
| GET | `/api/dashboard` | summary counts |
| GET | `/api/stock` | stock / availability list (`?availability=in\|low\|out&search=`) |
| GET / POST | `/api/item-types` | list / create |
| GET / PUT / DELETE | `/api/item-types/:id` | get / rename / delete |
| GET / POST | `/api/items` | list (`search, type_id, status, availability, sort, order`) / create |
| GET / PUT / DELETE | `/api/items/:id` | details (+history) / update / delete |
| PATCH | `/api/items/:id/status` | activate / deactivate `{ "active": false }` |
| GET / POST | `/api/purchases` | list / create |
| GET | `/api/purchases/next-order-id` | next suggested Order ID |
| GET / PUT | `/api/purchases/:id` | details (id **or** Order ID) / update |
| POST | `/api/purchases/:id/cancel` | cancel (status change, record kept) |
| ~~DELETE~~ | `/api/purchases/:id` | **not provided** → `405 Method Not Allowed` |

### API usage examples (curl)

```bash
# create a purchase with several items
curl -X POST http://localhost:3000/api/purchases -H "Content-Type: application/json" \
  -d '{"purchase_date":"2026-08-25","items":[{"item_id":1,"quantity":2},{"item_id":2,"quantity":5},{"item_id":5,"quantity":3}]}'

# purchase details (by id or Order ID)
curl http://localhost:3000/api/purchases/PO-00001

# update quantities (stock adjusted by the difference)
curl -X PUT http://localhost:3000/api/purchases/1 -H "Content-Type: application/json" \
  -d '{"purchase_date":"2026-08-25","items":[{"item_id":1,"quantity":4},{"item_id":2,"quantity":5},{"item_id":5,"quantity":3}]}'

# create an item
curl -X POST http://localhost:3000/api/items -H "Content-Type: application/json" \
  -d '{"name":"Printer","item_type_id":1,"purchase_date":"2026-08-25","stock_available":7,"price":8999,"description":"All-in-one inkjet","active":true}'
```

> Windows PowerShell: use `curl.exe` and escape inner quotes, or use Postman.

### Error format and status codes

```json
{ "success": false,
  "error": { "code": "INSUFFICIENT_STOCK",
             "message": "Insufficient stock for 'Laptop': requested 10, available 8",
             "details": [ { "field": "items[0].quantity", "line": 0, "item_id": 1, "requested": 10, "available": 8, "message": "…" } ] } }
```

| Status | When |
|---|---|
| 400 | validation errors, malformed JSON, invalid IDs (`Item name is required`, `Invalid item type`, `Quantity must be greater than zero`, duplicate item in order…) |
| 404 | record not found (`Item not found`, `Purchase not found`) |
| 405 | DELETE on a purchase |
| 409 | business conflicts (`Insufficient stock…`, `Item is inactive and cannot be purchased`, item with purchase history, duplicate names/Order IDs) |
| 500 / 503 | unexpected or database errors – safe message only, details are logged on the server |

---

## 8. Project structure

```
item-purchase-management/
├── backend/
│   ├── server.js              Express app: JSON parsing, static frontend, error handling
│   └── src/
│       ├── pythonBridge.js    long-lived Python process, JSON-lines protocol, restart/timeout
│       └── routes.js          REST routes → engine actions (no purchase DELETE)
├── engine/                    ★ Python core processing engine
│   ├── engine.py              entry point, action router, transaction + error mapping
│   ├── config.py              .env / environment settings, DATABASE_URL, verified TLS (DB_SSL)
│   ├── db.py                  PyMySQL connections (per thread), transaction context
│   ├── validators.py          backend validation helpers
│   ├── errors.py              400/404/409/503 error types
│   ├── stock.py               availability rules, guarded stock updates, audit trail
│   ├── item_types.py          Item Type CRUD
│   ├── items.py               Item CRUD, status, delete rule, JOIN with item_types
│   ├── purchases.py           create / update (difference) / cancel / details JOIN
│   ├── dashboard.py           dashboard + stock overview
│   └── migrate.py             creates DB, tables, sample data (--seed-if-empty, --wait for deploys)
├── frontend/
│   ├── index.html
│   ├── css/  base.css (design system + themes) · splash.css · store.css · admin.css
│   ├── vendor/motion.js       Motion animation library (MIT, offline copy)
│   └── js/
│       ├── app.js             router: storefront + Seller Hub layouts
│       ├── api.js · ui.js · state.js · theme.js (light/dark)
│       ├── store/             art.js (SVG product art) · catalog.js · cart.js · components.js · quickview.js
│       │                      motion.js · overlay.js (drawers/sheets) · shell.js (header, search, cart) · splash.js
│       │   └── views/         home · shop · product · checkout · success · orders · orderDetail · orderEdit · saved
│       └── admin/views/       dashboard · items · itemForm · itemDetails · itemTypes · stock · purchases · purchaseForm · purchaseDetails
├── database/  schema.sql · seed.sql
├── tests/e2e_test.py          74 automated API checks for every mandatory rule
├── postman/Item_Purchase_Management.postman_collection.json
├── screenshots/               screenshots of the working application
├── deploy/entrypoint.sh       container start: migrate (+ sample data if empty) → server
├── Dockerfile · .dockerignore  one image: Node.js 22 + Python 3 + PyMySQL
├── render.yaml                Render Blueprint (free web service, health check, auto-deploy)
├── API_DOCUMENTATION.md · CHANGELOG.md · README.md · DEPLOY.md
├── .env.example · .gitignore · .gitattributes · package.json · requirements.txt
└── setup.bat · start.bat · start.sh · push-to-github.bat
```

---

## 9. Testing

With the server running:

```bash
python tests/e2e_test.py            # or: npm test
```

Covers item types, item validation & CRUD, the full end-to-end example, insufficient stock, transaction rollback (no partial purchase), inactive items, zero/negative/fractional quantities, duplicate lines, purchase update by difference (3→5→2), delete rules (405 / 409), cancellation, and a concurrency test (12 parallel purchases on stock 5 → exactly 5 succeed, stock ends at 0). Pricing checks (negative price, decimals, `unit_price` snapshot) are included. Result on the reference machine: **74 passed, 0 failed**; Postman collection: **40/40 assertions pass**.

---

## 10. Mandatory checklist

| Requirement | Status |
|---|---|
| Item can be created / viewed with details / updated | ✅ |
| Item can be deleted when permitted (no purchase history) | ✅ |
| Item can be Active or Inactive; inactive item cannot be purchased | ✅ |
| One purchase contains multiple items, each with a quantity | ✅ |
| Stock validated on the backend; can never become negative | ✅ (validation + guarded UPDATE + CHECK + row locks) |
| Successful purchase updates stock | ✅ |
| Purchase viewable in detail; updatable with correct stock adjustment | ✅ |
| Purchase CANNOT be deleted; history remains available | ✅ (no route, 405, FK RESTRICT) |
| Item Type stored in separate table; JOIN for item type and purchase details | ✅ |
| Database errors handled gracefully | ✅ (safe 500/503 messages, rollback) |
| Basic CSS styling, responsive layout | ✅ (full design system, light/dark mode, mobile tab bar) |

---

## 11. Screenshots

All in `screenshots/`:

| Storefront (desktop) | Phones & dark mode | Seller Hub |
|---|---|---|
| `01-startup-splash` · `02-home` · `03-home-full` | `28-mobile-home` · `29-mobile-product` | `20-hub-dashboard` · `21-hub-products` |
| `04-add-to-cart-fly` · `05-live-search` | `30-mobile-cart-sheet` | `22-hub-product-form-validation` · `23-hub-product-detail` |
| `06-product-page` · `07-shop-category-filter` · `07b-quick-view` · `08-shop-sorted` | `31-dark-mode-home` · `31b-dark-mode-shop` · `31c-dark-mode-hub` | `24-hub-inventory-low` · `25-hub-orders` · `26-hub-order-detail` · `27-hub-categories` |
| `09-cart-drawer` · `10-checkout` · `11-order-placed-confetti` · `12-order-placed` | `32-mobile-hub-dashboard` · `33-mobile-hub-products` | |
| `13-orders` · `14-order-detail` · `15-modify-order` · `16-order-modified-stock-diff` | `34-mobile-hub-orders` · `35-mobile-hub-more` | |
| `17-checkout-stock-conflict` · `18-checkout-fixed` · `19-saved` | | |

---

## 12. Troubleshooting

| Problem | Fix |
|---|---|
| `Database is unavailable` / sidebar shows *Database offline* | start MySQL; check `DB_*` values in `.env`; run `python engine/migrate.py --seed` |
| `Access denied for user` | wrong `DB_USER`/`DB_PASSWORD` in `.env` |
| `Unknown database 'item_purchase_db'` | run `python engine/migrate.py --seed` |
| `Python executable … was not found` | install Python 3.9+ or set `PYTHON_PATH` in `.env` (e.g. `PYTHON_PATH=py`) |
| `PyMySQL is not installed` | `python -m pip install -r requirements.txt` |
| `RuntimeError: 'cryptography' package is required` | `python -m pip install cryptography` |
| `Port 3000 is already in use` | change `PORT` in `.env` |
| `'python' is not recognized` on Windows | reinstall Python with *Add to PATH*, or use `py engine\migrate.py --seed` |
| Problems with the hosted (Render / TiDB) version | see the *Troubleshooting* table in [DEPLOY.md](DEPLOY.md) |
