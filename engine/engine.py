"""
Python Processing Engine - Item & Purchase Management System
=============================================================

All business logic (validation, stock rules, SQL JOINs, transactions) lives
here. The Node.js / Express server is a thin HTTP layer that forwards every
API call to this process.

Protocol (newline-delimited JSON over stdin / stdout):

    request  -> {"id": 7, "action": "items.create", "payload": {"params": {}, "query": {}, "body": {...}}}
    response <- {"id": 7, "status": 201, "body": {"success": true, "message": "...", "data": {...}}}

The process stays alive for the lifetime of the server (no per-request start
up cost) and serves requests on a small thread pool; each worker thread owns
its own MySQL connection and every request runs in its own transaction.

Run standalone for a smoke test:
    echo {"id":1,"action":"system.health","payload":{}} | python engine/engine.py
"""
from __future__ import annotations

import json
import sys
import threading
import traceback
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

try:
    import pymysql
except ImportError:  # friendly message instead of a traceback loop
    print("[engine] PyMySQL is not installed. Run:  python -m pip install -r requirements.txt",
          file=sys.stderr, flush=True)
    sys.exit(3)

import dashboard
import db
import item_types
import items
import purchases
from config import SETTINGS
from errors import AppError, ConflictError, ServiceUnavailableError

ENGINE_VERSION = "3.0.0"

Handler = Callable[[Any, dict[str, Any]], dict[str, Any]]


def _health(cur, req: dict[str, Any]) -> dict[str, Any]:
    cur.execute("SELECT VERSION() AS version, DATABASE() AS db")
    info = cur.fetchone()
    return {"status": 200, "data": {"engine": "python", "engine_version": ENGINE_VERSION,
                                    "python": sys.version.split()[0],
                                    "database": info["db"], "mysql_version": info["version"],
                                    "low_stock_threshold": SETTINGS.low_stock_threshold}}


ACTIONS: dict[str, Handler] = {
    "system.health": _health,
    # item types
    "itemTypes.list": item_types.list_types,
    "itemTypes.get": item_types.get_type,
    "itemTypes.create": item_types.create_type,
    "itemTypes.update": item_types.update_type,
    "itemTypes.delete": item_types.delete_type,
    # items
    "items.list": items.list_items,
    "items.get": items.get_item,
    "items.create": items.create_item,
    "items.update": items.update_item,
    "items.setStatus": items.set_item_status,
    "items.delete": items.delete_item,
    # purchases (no delete action exists - by design)
    "purchases.list": purchases.list_purchases,
    "purchases.get": purchases.get_purchase,
    "purchases.nextOrderId": purchases.next_order_id,
    "purchases.create": purchases.create_purchase,
    "purchases.update": purchases.update_purchase,
    "purchases.cancel": purchases.cancel_purchase,
    # stock / dashboard
    "stock.overview": dashboard.stock_overview,
    "dashboard.summary": dashboard.dashboard,
}

_SAFE_500 = {"success": False, "error": {"code": "INTERNAL_ERROR",
                                         "message": "An unexpected server error occurred. Please try again."}}


def log(message: str) -> None:
    """Logs go to stderr - stdout is reserved for the JSON protocol."""
    print(f"[engine] {message}", file=sys.stderr, flush=True)


def process(action: str, payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    """Run one action inside a DB transaction and build the HTTP body."""
    handler = ACTIONS.get(action)
    if handler is None:
        return 404, {"success": False, "error": {"code": "UNKNOWN_ACTION",
                                                 "message": f"Unknown engine action '{action}'"}}
    request = {
        "params": payload.get("params") or {},
        "query": payload.get("query") or {},
        "body": payload.get("body"),
    }
    try:
        with db.transaction() as cur:  # COMMIT on success / ROLLBACK on any error
            result = handler(cur, request)
        body: dict[str, Any] = {"success": True}
        if result.get("message"):
            body["message"] = result["message"]
        body["data"] = result.get("data")
        if result.get("meta") is not None:
            body["meta"] = result["meta"]
        return int(result.get("status", 200)), body
    except AppError as err:
        return err.status, err.to_body()
    except pymysql.err.IntegrityError as exc:
        log(f"integrity error in {action}: {exc}")
        conflict = ConflictError("The request conflicts with existing data (duplicate or referenced record).",
                                 code="DATA_INTEGRITY_CONFLICT")
        return conflict.status, conflict.to_body()
    except pymysql.err.OperationalError as exc:
        log(f"database operational error in {action}: {exc}")
        code = exc.args[0] if exc.args else None
        if code in (1205, 1213):  # lock wait timeout / deadlock
            busy = ConflictError("The records are busy with another transaction. Please retry.",
                                 code="TRANSACTION_CONFLICT")
            return busy.status, busy.to_body()
        if code in _CONNECTION_ERRORS:
            unavailable = ServiceUnavailableError("Database is unavailable. Please try again shortly.")
            return unavailable.status, unavailable.to_body()
        return 500, {"success": False, "error": {"code": "DATABASE_ERROR",
                                                 "message": f"A database error occurred (MySQL {code}). "
                                                            "No changes were saved."}}
    except pymysql.err.Error as exc:
        log(f"database error in {action}: {exc}")
        return 500, {"success": False, "error": {"code": "DATABASE_ERROR",
                                                 "message": "A database error occurred. No changes were saved."}}
    except Exception:  # noqa: BLE001 - never leak internals to the client
        log(f"unhandled error in {action}:\n{traceback.format_exc()}")
        return 500, _SAFE_500


# MySQL client/server error codes that mean "cannot reach / use the database right now"
_CONNECTION_ERRORS = {1040, 1044, 1045, 1049, 1053, 1129, 1130, 1203, 1226, 2002, 2003, 2005, 2006,
                      2013, 2026, 2055, 8004, 9001, 9002, 9003, 9004, 9005, 9006, 9007}


class Engine:
    def __init__(self) -> None:
        self._write_lock = threading.Lock()
        self._pool = ThreadPoolExecutor(max_workers=SETTINGS.engine_threads,
                                        thread_name_prefix="engine-worker")

    def send(self, message: dict[str, Any]) -> None:
        line = json.dumps(message, ensure_ascii=False, default=str)
        with self._write_lock:
            sys.stdout.write(line + "\n")
            sys.stdout.flush()

    def handle_line(self, line: str) -> None:
        try:
            message = json.loads(line)
            if not isinstance(message, dict):
                raise ValueError("message must be an object")
        except (ValueError, json.JSONDecodeError) as exc:
            log(f"discarding malformed protocol line: {exc}")
            return
        request_id = message.get("id")
        action = str(message.get("action", ""))
        payload = message.get("payload") if isinstance(message.get("payload"), dict) else {}
        self._pool.submit(self._run, request_id, action, payload)

    def _run(self, request_id: Any, action: str, payload: dict[str, Any]) -> None:
        try:
            status, body = process(action, payload)
        except Exception:  # noqa: BLE001 - absolute last resort
            log(traceback.format_exc())
            status, body = 500, _SAFE_500
        self.send({"id": request_id, "status": status, "body": body})

    def serve_forever(self) -> None:
        self.send({"type": "ready", "engine_version": ENGINE_VERSION,
                   "python": sys.version.split()[0]})
        log(f"ready (python {sys.version.split()[0]}, db={SETTINGS.db_name}@{SETTINGS.db_host}:{SETTINGS.db_port}, "
            f"threads={SETTINGS.engine_threads})")
        while True:
            line = sys.stdin.readline()
            if not line:  # parent closed stdin -> shut down
                break
            line = line.strip()
            if line:
                self.handle_line(line)
        self._pool.shutdown(wait=True)
        log("stdin closed, engine stopped")


def main() -> None:
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    Engine().serve_forever()


if __name__ == "__main__":
    main()
