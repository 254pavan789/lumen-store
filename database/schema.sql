-- =====================================================================
--  Item & Purchase Management System - MySQL schema
--  Compatible with MySQL 8.0.16+ (CHECK constraints), MariaDB 10.4+ and
--  TiDB / TiDB Cloud (the /*T! ... */ comments are read only by TiDB)
--
--  Run manually:   mysql -u root -p < database/schema.sql
--  Or via engine:  python engine/migrate.py            (uses .env settings)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS item_purchase_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE item_purchase_db;

-- ---------------------------------------------------------------------
-- 1. item_types : Item Type categories (Electronics, Furniture, ...)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS item_types (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  type_name   VARCHAR(50)   NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_item_types_type_name (type_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci /*T![auto_id_cache] AUTO_ID_CACHE=1 */;

-- ---------------------------------------------------------------------
-- 2. items : Item Master + current stock (+ price/description for the storefront)
--    item_types 1 -> many items
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name             VARCHAR(100)  NOT NULL,
  item_type_id     INT UNSIGNED  NOT NULL,
  purchase_date    DATE          NOT NULL,
  stock_available  INT           NOT NULL DEFAULT 0,
  active           TINYINT(1)    NOT NULL DEFAULT 1,
  price            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  description      VARCHAR(500)  NULL,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_items_name (name),
  KEY idx_items_item_type_id (item_type_id),
  KEY idx_items_active (active),
  CONSTRAINT fk_items_item_type
    FOREIGN KEY (item_type_id) REFERENCES item_types (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_items_stock_non_negative CHECK (stock_available >= 0),
  CONSTRAINT chk_items_active_flag CHECK (active IN (0, 1)),
  CONSTRAINT chk_items_price_non_negative CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci /*T![auto_id_cache] AUTO_ID_CACHE=1 */;

-- ---------------------------------------------------------------------
-- 3. purchases : Purchase / Order header (never deleted - history)
--    status supports a future-safe cancellation workflow instead of delete
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchases (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  order_id       VARCHAR(30)   NOT NULL,
  purchase_date  DATE          NOT NULL,
  status         ENUM('COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'COMPLETED',
  remarks        VARCHAR(255)  NULL,
  cancelled_at   DATETIME      NULL,
  cancel_reason  VARCHAR(255)  NULL,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_purchases_order_id (order_id),
  KEY idx_purchases_purchase_date (purchase_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci /*T![auto_id_cache] AUTO_ID_CACHE=1 */;

-- ---------------------------------------------------------------------
-- 4. purchase_items : Items + quantities belonging to a purchase
--    purchases 1 -> many purchase_items
--    items     1 -> many purchase_items
--    One line per item per order (duplicates rejected consistently).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_items (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  purchase_id  INT UNSIGNED  NOT NULL,
  item_id      INT UNSIGNED  NOT NULL,
  quantity     INT           NOT NULL,
  unit_price   DECIMAL(10,2) NOT NULL DEFAULT 0.00,  -- price snapshot at order time
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_purchase_items_purchase_item (purchase_id, item_id),
  KEY idx_purchase_items_item_id (item_id),
  CONSTRAINT fk_purchase_items_purchase
    FOREIGN KEY (purchase_id) REFERENCES purchases (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_purchase_items_item
    FOREIGN KEY (item_id) REFERENCES items (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_purchase_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT chk_purchase_items_unit_price CHECK (unit_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci /*T![auto_id_cache] AUTO_ID_CACHE=1 */;

-- ---------------------------------------------------------------------
-- 5. stock_movements : audit trail for every stock change (traceability)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  item_id          INT UNSIGNED  NOT NULL,
  purchase_id      INT UNSIGNED  NULL,
  movement_type    ENUM('INITIAL', 'ADJUSTMENT', 'PURCHASE', 'PURCHASE_UPDATE', 'PURCHASE_CANCEL') NOT NULL,
  quantity_change  INT           NOT NULL,
  balance_after    INT           NOT NULL,
  note             VARCHAR(255)  NULL,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stock_movements_item_id (item_id),
  KEY idx_stock_movements_purchase_id (purchase_id),
  CONSTRAINT fk_stock_movements_item
    FOREIGN KEY (item_id) REFERENCES items (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_stock_movements_purchase
    FOREIGN KEY (purchase_id) REFERENCES purchases (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_stock_movements_balance CHECK (balance_after >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci /*T![auto_id_cache] AUTO_ID_CACHE=1 */;
