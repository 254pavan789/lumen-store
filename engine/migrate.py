"""
Database migration tool (no mysql CLI needed).

    python engine/migrate.py            create database + tables
    python engine/migrate.py --seed     ...and load sample data
    python engine/migrate.py --reset --seed
                                        DROP all tables first, then recreate + seed
    python engine/migrate.py --seed-if-empty --wait 60
                                        used on deploy: create/upgrade tables, load
                                        sample data only into an empty database,
                                        retry the connection for up to 60 s

Connection settings are read from the environment / project .env file
(DATABASE_URL or DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL).
"""
from __future__ import annotations

import argparse
import re
import sys
import time

import pymysql

from config import DATABASE_DIR, SETTINGS, connection_options

DEFAULT_DB = "item_purchase_db"
DROP_ORDER = ["stock_movements", "purchase_items", "purchases", "items", "item_types"]

# Columns added in v2.0 (storefront). Existing v1 databases are upgraded in place.
UPGRADE_COLUMNS = [
    ("items", "price", "DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0) AFTER active"),
    ("items", "description", "VARCHAR(500) NULL AFTER price"),
    ("purchase_items", "unit_price", "DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0) AFTER quantity"),
]


def upgrade(cur) -> list[str]:
    added: list[str] = []
    for table, column, ddl in UPGRADE_COLUMNS:
        cur.execute(
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = %s",
            (SETTINGS.db_name, table, column),
        )
        if cur.fetchone()[0] == 0:
            cur.execute(f"ALTER TABLE `{table}` ADD COLUMN `{column}` {ddl}")
            print(f"  - upgraded: added {table}.{column}")
            added.append(f"{table}.{column}")
    return added


def split_sql(script: str) -> list[str]:
    """Split a .sql file into statements (ignores -- comments, respects quotes)."""
    statements, buf, quote = [], [], None
    lines = [ln for ln in script.splitlines() if not ln.strip().startswith("--")]
    text = "\n".join(lines)
    for ch in text:
        if quote:
            buf.append(ch)
            if ch == quote:
                quote = None
            continue
        if ch in ("'", '"', "`"):
            quote = ch
        if ch == ";":
            stmt = "".join(buf).strip()
            if stmt:
                statements.append(stmt)
            buf = []
            continue
        buf.append(ch)
    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)
    return statements


def load(name: str) -> list[str]:
    script = (DATABASE_DIR / name).read_text(encoding="utf-8")
    # honour a custom DB_NAME from .env
    script = re.sub(rf"\b{DEFAULT_DB}\b", SETTINGS.db_name, script)
    return split_sql(script)


def main() -> int:
    parser = argparse.ArgumentParser(description="Create / seed the MySQL database")
    parser.add_argument("--seed", action="store_true", help="load sample data")
    parser.add_argument("--reset", action="store_true", help="drop all tables before creating them")
    parser.add_argument("--seed-if-empty", action="store_true",
                        help="load sample data only when the database has no item types yet")
    parser.add_argument("--wait", type=int, default=0, metavar="SECONDS",
                        help="keep retrying the connection for this many seconds (cloud cold starts)")
    args = parser.parse_args()

    if not re.fullmatch(r"[A-Za-z0-9_]+", SETTINGS.db_name):
        print("DB_NAME may contain only letters, numbers and underscore.", file=sys.stderr)
        return 2

    tls = "TLS" if SETTINGS.db_ssl else "no TLS"
    print(f"Connecting to MySQL {SETTINGS.db_user}@{SETTINGS.db_host}:{SETTINGS.db_port} ({tls}) ...")
    deadline = time.monotonic() + max(args.wait, 0)
    while True:
        try:
            conn = pymysql.connect(**connection_options(), autocommit=True)
            break
        except pymysql.err.OperationalError as exc:
            reason = exc.args[-1] if exc.args else exc
            if time.monotonic() < deadline:
                print(f"  - not reachable yet ({reason}); retrying in 3 s ...")
                time.sleep(3)
                continue
            print(f"\nERROR: cannot connect to MySQL: {reason}", file=sys.stderr)
            print("Check that MySQL is running and DB_HOST / DB_PORT / DB_USER / DB_PASSWORD "
                  "(or DATABASE_URL) are correct.", file=sys.stderr)
            return 1

    with conn:
        with conn.cursor() as cur:
            if args.reset:
                cur.execute(f"CREATE DATABASE IF NOT EXISTS `{SETTINGS.db_name}` "
                            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
                cur.execute(f"USE `{SETTINGS.db_name}`")
                cur.execute("SET FOREIGN_KEY_CHECKS = 0")
                for table in DROP_ORDER:
                    cur.execute(f"DROP TABLE IF EXISTS `{table}`")
                cur.execute("SET FOREIGN_KEY_CHECKS = 1")
                print(f"  - dropped existing tables in '{SETTINGS.db_name}'")

            for stmt in load("schema.sql"):
                cur.execute(stmt)
            cur.execute(f"USE `{SETTINGS.db_name}`")
            added = upgrade(cur)
            print(f"  - schema ready in database '{SETTINGS.db_name}'")

            seed = args.seed
            if args.seed_if_empty and not seed:
                cur.execute("SELECT COUNT(*) FROM item_types")
                seed = cur.fetchone()[0] == 0
                if not seed:
                    print("  - database already has data, sample data not loaded")
            if seed:
                for stmt in load("seed.sql"):
                    cur.execute(stmt)
                print("  - sample data loaded")

            if "purchase_items.unit_price" in added:
                # v1 orders had no price: use the item's current price as their snapshot
                cur.execute("UPDATE purchase_items pi JOIN items i ON i.id = pi.item_id "
                            "SET pi.unit_price = i.price WHERE pi.unit_price = 0")
                print(f"  - back-filled unit_price for {cur.rowcount} existing order line(s)")

            cur.execute(f"USE `{SETTINGS.db_name}`")
            for table in reversed(DROP_ORDER):
                cur.execute(f"SELECT COUNT(*) FROM `{table}`")
                print(f"      {table:<16} {cur.fetchone()[0]:>6} rows")
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
