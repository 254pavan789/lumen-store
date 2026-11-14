# Changelog

## 3.1.0 – 2026-11-15 — free online hosting
### Added
- **Deploy to the internet for free** with a shareable link: `Dockerfile` (Node.js 22 + Python 3, non-root), `render.yaml` Render Blueprint (free web service, Singapore, `/api/health` health check, auto-deploy on push), `deploy/entrypoint.sh`, step-by-step **DEPLOY.md** (GitHub → TiDB Cloud Starter → Render).
- `push-to-github.bat`: one double-click to upload the project to a GitHub repository (never uploads `.env`).
- Engine: `DATABASE_URL` connection string, `DB_SSL` / `DB_SSL_CA` for **verified TLS** (certificate + host name, TLS 1.2+) to cloud databases; TLS turns on automatically for TiDB Cloud / PlanetScale / Aiven / RDS / Azure hosts.
- `migrate.py --seed-if-empty` (sample data only for a brand-new database) and `--wait SECONDS` (retries while a serverless database wakes up).
- Schema: TiDB-only `AUTO_ID_CACHE=1` hint so IDs and order numbers stay sequential on TiDB (MySQL/MariaDB ignore it).
- `.gitignore`, `.dockerignore`, `.gitattributes` (LF for shell scripts, CRLF for .bat).

### Changed
- Default `DB_CONNECT_TIMEOUT` 5 s → 10 s (cloud cold starts).

## 3.0.1 – 2026-11-15
### Fixed
- Seller Hub sidebar: the Appearance (theme) button stretched to full screen height and pushed the menu out of place. Cause: the toggle got the class `hub`, which is also the page-layout class (`min-height: 100vh`). Toggle classes are now namespaced (`tt-*`).
- Seller Hub sidebar scrolls on short laptop screens instead of overflowing.
- Dashboard cards in the same row now line up at the top (stacked-card margin no longer applies inside grids).

## 3.0.0 – 2026-11-15 — design upgrade

### Added
- **Light / dark mode toggle** (store header, footer, Seller Hub sidebar, Seller Hub mobile bar and *More* sheet). Follows the OS until you choose; choice is remembered; no flash on load; circular reveal animation via the View Transitions API.
- **New home page**: bento hero with rotating headline, inline search and popular searches, spotlight product with add-to-cart, top-category tile, live stock counter with category bars, infinite category strip, *Discover* tabs with spring indicator, category bento, “how it works” cards with animated mock UI, recently viewed rail, Seller Hub banner, new footer.
- **Quick view** modal from any product card.
- **Bottom sheets on phones** for the cart, filters, quick view and Seller Hub *More*, with drag-to-dismiss (momentum projection, rubber-banding).
- Sticky **Add to cart** bar on mobile product pages and **Place order** bar on mobile checkout.
- **Seller Hub mobile app layout**: top bar with scroll-aware title, bottom tab bar (Dashboard, Products, Orders, Inventory, More), tables rendered as labelled cards, 2-column KPI grid, full-width action buttons, stacked filters.
- Recently viewed products (product page + home).
- Scroll-reveal for home sections; Motion library vendored for springs.

### Changed
- Dark mode is now driven by `html[data-theme]` instead of only the OS setting.
- Mobile toasts appear at the top so they never cover bottom bars or sheets.
- Mobile spacing, typography and alignment tuned for 360 – 880 px widths; safe-area insets respected.

## 2.0.0 – 2026-11-14 — Lumen storefront

### Added
- **E-commerce storefront**: animated startup screen (real loading progress), home with hero / categories / trending / low-stock / deals / new arrivals, shop with category, availability and price filters + sorting, instant search with keyboard navigation (`/`), product pages with live stock meter, cart drawer, checkout, order confirmation with confetti, order history, order details with timeline, **modify order** and **cancel order**, buy again, saved items, mobile tab bar, light/dark mode.
- Generated SVG product artwork for every product (picked by product name, coloured by category).
- Motion system: fly-to-cart, cart badge bump, drawer slide, staggered grids, press feedback — all transform/opacity, reduced-motion aware.
- **Seller Hub** (`#/admin`): the v1 management screens restyled, plus revenue / inventory value / best sellers on the dashboard, product thumbnails, prices and order amounts.
- Database: `items.price`, `items.description`, `purchase_items.unit_price` (price snapshot). `migrate.py` upgrades v1 databases in place and back-fills old order lines.
- API: price/description on items, `min_price` / `max_price`, sort by `price` / `newest` / `popular`, `units_sold`, order `total_amount`, line `unit_price` / `line_total`, dashboard revenue + best sellers.
- Seed data: 7 categories, 30 priced products.
- Tests: 74 API checks (pricing added); Postman collection 40 requests.

### Changed
- v1 URLs (`#/items`, `#/purchases`, `#/stock`, `#/item-types`) redirect to the Seller Hub.

## 1.0.0 – 2026-11-14

### Added
- Node.js + Express REST API (`backend/`) that forwards every request to a long-lived **Python processing engine** (`engine/`) over a JSON-lines protocol, with automatic restart, timeouts and Python executable fallback (`python` → `py` → `python3`).
- Python engine: validation, Item Type / Item / Purchase services, SQL JOINs, per-request MySQL transactions, row locking, safe error mapping (400 / 404 / 405 / 409 / 500 / 503).
- MySQL schema with foreign keys, unique keys and CHECK constraints (`stock_available >= 0`, `quantity > 0`), plus a `stock_movements` audit trail.
- Purchase create (multi-item, atomic), update (stock adjusted by difference), optional cancellation workflow (status change, record kept). No purchase delete – `DELETE` returns 405.
- Item delete only without purchase history; Activate / Deactivate; inactive items blocked from new purchases.
- Frontend SPA: Dashboard, Item Types, Items (filters), Add/Edit Item, Item Details (history + movements), Create/Update Purchase (line builder), Purchase List, Purchase Details, Stock & Availability. Responsive layout, light/dark mode, reduced-motion support.
- `engine/migrate.py` (create DB, tables, sample data, reset), Windows launchers `setup.bat` / `start.bat`, `start.sh`.
- `tests/e2e_test.py` – 68 automated API checks incl. transaction rollback and a concurrency test.
- API documentation, Postman collection (38 requests with tests), screenshots.
