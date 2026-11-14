"""
MySQL access layer (PyMySQL).

* One connection per worker thread (threading.local) - connections are never
  shared between concurrently running requests.
* Every engine request runs inside `transaction()`: COMMIT on success,
  ROLLBACK on any exception, so no partial writes can ever survive.
* Row values (DATE, DATETIME, DECIMAL) are converted to JSON-safe values.
"""
from __future__ import annotations

import datetime as dt
import threading
from contextlib import contextmanager
from decimal import Decimal
from typing import Any, Iterator

import pymysql
from pymysql.cursors import DictCursor

from config import SETTINGS, connection_options
from errors import ServiceUnavailableError

_local = threading.local()


def _connect(database: str | None = SETTINGS.db_name) -> pymysql.connections.Connection:
    try:
        return pymysql.connect(
            **connection_options(database),
            cursorclass=DictCursor,
            autocommit=False,
        )
    except pymysql.err.OperationalError as exc:  # host down, bad credentials, unknown DB
        raise ServiceUnavailableError(
            "Database is unavailable. Check that MySQL is running and the DB_* settings are correct."
        ) from exc


def get_connection() -> pymysql.connections.Connection:
    conn = getattr(_local, "conn", None)
    if conn is not None:
        try:
            conn.ping(reconnect=True)
            return conn
        except pymysql.err.Error:
            try:
                conn.close()
            except Exception:  # noqa: BLE001 - already broken
                pass
            _local.conn = None
    conn = _connect()
    _local.conn = conn
    return conn


@contextmanager
def transaction() -> Iterator[pymysql.cursors.Cursor]:
    """BEGIN ... COMMIT / ROLLBACK around one engine request."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        conn.begin()
        yield cursor
        conn.commit()
    except BaseException:
        try:
            conn.rollback()
        except pymysql.err.Error:
            pass
        raise
    finally:
        cursor.close()


def ping() -> dict[str, Any]:
    with transaction() as cur:
        cur.execute("SELECT VERSION() AS version, DATABASE() AS db")
        return cur.fetchone()


def to_json_value(value: Any) -> Any:
    if isinstance(value, dt.datetime):
        return value.isoformat(sep=" ", timespec="seconds")
    if isinstance(value, dt.date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def clean_row(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {key: to_json_value(val) for key, val in row.items()}


def clean_rows(rows: list[dict[str, Any]] | tuple) -> list[dict[str, Any]]:
    return [clean_row(r) for r in rows]


def placeholders(count: int) -> str:
    return ", ".join(["%s"] * count)
