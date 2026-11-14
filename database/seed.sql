-- =====================================================================
--  Sample data (safe to run more than once)
--  Items 1-10 match the assignment example (Laptop 10 / Mouse 20 / Chair 15).
--  Items 11+ fill the storefront. Prices are in INR.
--  Run manually:   mysql -u root -p < database/seed.sql
--  Or via engine:  python engine/migrate.py --seed
-- =====================================================================

USE item_purchase_db;

INSERT IGNORE INTO item_types (type_name) VALUES
  ('Electronics'),
  ('Furniture'),
  ('Clothing'),
  ('Grocery'),
  ('Stationery'),
  ('Sports & Fitness'),
  ('Home & Kitchen');

-- One statement per item keeps IDs sequential and makes re-runs safe

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Laptop', t.id, '2026-08-01', 10, 1, 54999.00, '14-inch ultrabook with 16 GB RAM, 512 GB SSD, backlit keyboard and an all-day battery.' FROM item_types t
WHERE t.type_name = 'Electronics' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Laptop');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Mouse', t.id, '2026-08-01', 20, 1, 799.00, 'Wireless ergonomic mouse with silent clicks, 1600 DPI sensor and a 2.4 GHz nano receiver.' FROM item_types t
WHERE t.type_name = 'Electronics' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Mouse');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Keyboard', t.id, '2026-08-02', 25, 1, 1899.00, 'Low-profile mechanical keyboard with hot-swappable switches and white backlight.' FROM item_types t
WHERE t.type_name = 'Electronics' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Keyboard');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Monitor 24 inch', t.id, '2026-08-03', 4, 1, 11499.00, '24-inch IPS Full-HD display, 75 Hz, ultra-thin bezels and flicker-free panel.' FROM item_types t
WHERE t.type_name = 'Electronics' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Monitor 24 inch');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Chair', t.id, '2026-08-04', 15, 1, 6999.00, 'Ergonomic mesh office chair with lumbar support, 3D armrests and tilt lock.' FROM item_types t
WHERE t.type_name = 'Furniture' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Chair');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Office Desk', t.id, '2026-08-04', 6, 1, 12499.00, 'Engineered-wood work desk, 120 x 60 cm, with a hidden cable tray.' FROM item_types t
WHERE t.type_name = 'Furniture' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Office Desk');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Cotton T-Shirt', t.id, '2026-08-05', 50, 1, 499.00, '100% combed-cotton crew-neck tee. Pre-shrunk, breathable and soft.' FROM item_types t
WHERE t.type_name = 'Clothing' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Cotton T-Shirt');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Basmati Rice 5kg', t.id, '2026-08-06', 0, 1, 649.00, 'Aged long-grain basmati rice. Aromatic, fluffy and non-sticky.' FROM item_types t
WHERE t.type_name = 'Grocery' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Basmati Rice 5kg');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'A4 Notebook', t.id, '2026-08-07', 100, 1, 149.00, '200-page ruled A4 notebook with thick 70 GSM paper.' FROM item_types t
WHERE t.type_name = 'Stationery' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'A4 Notebook');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Legacy Printer', t.id, '2026-07-15', 3, 0, 8999.00, 'Discontinued inkjet printer, kept for order history.' FROM item_types t
WHERE t.type_name = 'Electronics' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Legacy Printer');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Wireless Headphones', t.id, '2026-08-08', 18, 1, 3499.00, 'Over-ear Bluetooth headphones with active noise cancellation and 30-hour battery.' FROM item_types t
WHERE t.type_name = 'Electronics' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Wireless Headphones');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Smart Watch', t.id, '2026-08-08', 3, 1, 4999.00, 'AMOLED fitness smartwatch with heart-rate, SpO2, GPS and 7-day battery.' FROM item_types t
WHERE t.type_name = 'Electronics' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Smart Watch');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Bluetooth Speaker', t.id, '2026-08-09', 22, 1, 2299.00, 'Portable IPX7 waterproof speaker with deep bass and 12-hour playtime.' FROM item_types t
WHERE t.type_name = 'Electronics' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Bluetooth Speaker');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Smartphone', t.id, '2026-08-09', 12, 1, 18999.00, '6.6-inch AMOLED display, 128 GB storage, 50 MP camera and 5000 mAh battery.' FROM item_types t
WHERE t.type_name = 'Electronics' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Smartphone');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'USB-C Charger 65W', t.id, '2026-08-10', 33, 1, 1999.00, 'GaN fast charger for laptops and phones, compact and travel-ready.' FROM item_types t
WHERE t.type_name = 'Electronics' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'USB-C Charger 65W');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'LED Desk Lamp', t.id, '2026-08-10', 30, 1, 1299.00, 'Dimmable LED lamp with three colour temperatures and USB charging port.' FROM item_types t
WHERE t.type_name = 'Furniture' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'LED Desk Lamp');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Bookshelf', t.id, '2026-08-11', 5, 1, 4499.00, 'Five-tier open bookshelf in oak finish with a steel frame.' FROM item_types t
WHERE t.type_name = 'Furniture' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Bookshelf');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Denim Jacket', t.id, '2026-08-11', 14, 1, 2199.00, 'Classic mid-wash denim jacket with button front and chest pockets.' FROM item_types t
WHERE t.type_name = 'Clothing' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Denim Jacket');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Hoodie', t.id, '2026-08-12', 26, 1, 1499.00, 'Brushed-fleece pullover hoodie with kangaroo pocket.' FROM item_types t
WHERE t.type_name = 'Clothing' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Hoodie');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Everyday Backpack 25L', t.id, '2026-08-12', 19, 1, 1799.00, 'Water-resistant 25 L backpack with padded 15.6-inch laptop sleeve.' FROM item_types t
WHERE t.type_name = 'Clothing' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Everyday Backpack 25L');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Arabica Coffee Beans 500g', t.id, '2026-08-13', 40, 1, 899.00, 'Medium-roast single-origin arabica beans with chocolate notes.' FROM item_types t
WHERE t.type_name = 'Grocery' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Arabica Coffee Beans 500g');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Green Tea 100 Bags', t.id, '2026-08-13', 2, 1, 349.00, 'Pure green tea bags, light and refreshing, rich in antioxidants.' FROM item_types t
WHERE t.type_name = 'Grocery' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Green Tea 100 Bags');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Gel Pen Set', t.id, '2026-08-14', 60, 1, 199.00, 'Set of 10 smooth-writing 0.5 mm gel pens in assorted colours.' FROM item_types t
WHERE t.type_name = 'Stationery' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Gel Pen Set');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Sketchbook A5', t.id, '2026-08-14', 0, 1, 299.00, '120-page acid-free sketchbook with 150 GSM paper.' FROM item_types t
WHERE t.type_name = 'Stationery' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Sketchbook A5');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Running Shoes', t.id, '2026-08-15', 9, 1, 3999.00, 'Lightweight cushioned running shoes with breathable knit upper.' FROM item_types t
WHERE t.type_name = 'Sports & Fitness' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Running Shoes');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Yoga Mat', t.id, '2026-08-15', 16, 1, 1199.00, '6 mm non-slip TPE yoga mat with carry strap.' FROM item_types t
WHERE t.type_name = 'Sports & Fitness' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Yoga Mat');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Dumbbell Set 10kg', t.id, '2026-08-16', 7, 1, 2499.00, 'Adjustable dumbbell pair with chrome handles and secure collars.' FROM item_types t
WHERE t.type_name = 'Sports & Fitness' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Dumbbell Set 10kg');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Steel Water Bottle 1L', t.id, '2026-08-16', 45, 1, 599.00, 'Double-wall insulated bottle, keeps drinks cold for 24 hours.' FROM item_types t
WHERE t.type_name = 'Home & Kitchen' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Steel Water Bottle 1L');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Ceramic Mug Set', t.id, '2026-08-17', 11, 1, 899.00, 'Set of four 350 ml stoneware mugs, microwave and dishwasher safe.' FROM item_types t
WHERE t.type_name = 'Home & Kitchen' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Ceramic Mug Set');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active, price, description)
SELECT 'Non-stick Frying Pan 28cm', t.id, '2026-08-17', 8, 1, 1349.00, 'Granite-coated non-stick pan, induction-ready, with soft-touch handle.' FROM item_types t
WHERE t.type_name = 'Home & Kitchen' AND NOT EXISTS (SELECT 1 FROM (SELECT name FROM items) x WHERE x.name = 'Non-stick Frying Pan 28cm');


-- Databases created before v2.0: fill in price / description for the original sample items

UPDATE items SET price = 54999.00, description = COALESCE(description, '14-inch ultrabook with 16 GB RAM, 512 GB SSD, backlit keyboard and an all-day battery.') WHERE name = 'Laptop' AND price = 0;

UPDATE items SET price = 799.00, description = COALESCE(description, 'Wireless ergonomic mouse with silent clicks, 1600 DPI sensor and a 2.4 GHz nano receiver.') WHERE name = 'Mouse' AND price = 0;

UPDATE items SET price = 1899.00, description = COALESCE(description, 'Low-profile mechanical keyboard with hot-swappable switches and white backlight.') WHERE name = 'Keyboard' AND price = 0;

UPDATE items SET price = 11499.00, description = COALESCE(description, '24-inch IPS Full-HD display, 75 Hz, ultra-thin bezels and flicker-free panel.') WHERE name = 'Monitor 24 inch' AND price = 0;

UPDATE items SET price = 6999.00, description = COALESCE(description, 'Ergonomic mesh office chair with lumbar support, 3D armrests and tilt lock.') WHERE name = 'Chair' AND price = 0;

UPDATE items SET price = 12499.00, description = COALESCE(description, 'Engineered-wood work desk, 120 x 60 cm, with a hidden cable tray.') WHERE name = 'Office Desk' AND price = 0;

UPDATE items SET price = 499.00, description = COALESCE(description, '100% combed-cotton crew-neck tee. Pre-shrunk, breathable and soft.') WHERE name = 'Cotton T-Shirt' AND price = 0;

UPDATE items SET price = 649.00, description = COALESCE(description, 'Aged long-grain basmati rice. Aromatic, fluffy and non-sticky.') WHERE name = 'Basmati Rice 5kg' AND price = 0;

UPDATE items SET price = 149.00, description = COALESCE(description, '200-page ruled A4 notebook with thick 70 GSM paper.') WHERE name = 'A4 Notebook' AND price = 0;

UPDATE items SET price = 8999.00, description = COALESCE(description, 'Discontinued inkjet printer, kept for order history.') WHERE name = 'Legacy Printer' AND price = 0;


-- Opening stock movement for every seeded item that has no history yet
INSERT INTO stock_movements (item_id, movement_type, quantity_change, balance_after, note)
SELECT i.id, 'INITIAL', i.stock_available, i.stock_available, 'Opening stock (seed data)'
FROM items i
LEFT JOIN stock_movements sm ON sm.item_id = i.id
WHERE sm.id IS NULL;
