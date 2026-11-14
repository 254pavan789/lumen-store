"""
Configuration loader for the Python processing engine.

Values come from environment variables. When the engine is started by the
Node.js server the environment is inherited from it; when a script is run
directly (e.g. migrate.py) the project-level .env file is read here so both
paths share exactly the same configuration.
"""
from __future__ import annotations

import os
import ssl
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

ENGINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = ENGINE_DIR.parent
DATABASE_DIR = PROJECT_ROOT / "database"


def _load_dotenv(path: Path) -> None:
    """Minimal .env parser (KEY=VALUE, # comments, optional quotes).

    Existing environment variables always win, so values passed in by the
    Node.js parent process are never overridden.
    """
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        elif " #" in value:
            value = value.split(" #", 1)[0].rstrip()
        if key and key not in os.environ:
            os.environ[key] = value


def _int_env(name: str, default: int, minimum: int = 0) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return max(value, minimum)


_TRUE = {"1", "true", "yes", "on", "required", "require", "verify_identity", "verify-full"}
_FALSE = {"0", "false", "no", "off", "disabled", "disable"}

# Managed MySQL-compatible clouds that only accept encrypted connections.
_TLS_REQUIRED_HOSTS = ("tidbcloud.com", "psdb.cloud", "aivencloud.com", "rds.amazonaws.com",
                       "database.azure.com", "mysql.database.azure.com")


@dataclass(frozen=True)
class Settings:
    db_host: str
    db_port: int
    db_user: str
    db_password: str
    db_name: str
    db_ssl: bool
    db_ssl_ca: str
    low_stock_threshold: int
    engine_threads: int
    connect_timeout: int


def _from_database_url(url: str) -> dict[str, str]:
    """mysql://user:password@host:4000/dbname?ssl=true  ->  DB_* values.

    User and password may be URL-encoded (e.g. %40 for @)."""
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("mysql", "mysql2", "mysql+pymysql", "tidb", "mariadb"):
        return {}
    values: dict[str, str] = {}
    if parsed.hostname:
        values["DB_HOST"] = parsed.hostname
    if parsed.port:
        values["DB_PORT"] = str(parsed.port)
    if parsed.username:
        values["DB_USER"] = unquote(parsed.username)
    if parsed.password is not None:
        values["DB_PASSWORD"] = unquote(parsed.password)
    name = parsed.path.lstrip("/")
    if name:
        values["DB_NAME"] = unquote(name)
    query = {k.lower(): v[-1] for k, v in parse_qs(parsed.query).items()}
    for key in ("ssl", "ssl-mode", "sslmode", "ssl_mode", "tls"):
        if key in query:
            values["DB_SSL"] = query[key]
            break
    if "sslca" in query or "ssl-ca" in query or "ssl_ca" in query:
        values["DB_SSL_CA"] = query.get("sslca") or query.get("ssl-ca") or query.get("ssl_ca") or ""
    return values


def _ssl_enabled(host: str, raw: str) -> bool:
    raw = raw.strip().lower()
    if raw in _TRUE:
        return True
    if raw in _FALSE:
        return False
    # "auto" / empty: encrypt automatically for known cloud database hosts
    return host.lower().endswith(_TLS_REQUIRED_HOSTS)


def load_settings() -> Settings:
    _load_dotenv(PROJECT_ROOT / ".env")
    url_values = _from_database_url(os.environ.get("DATABASE_URL", ""))

    def get(name: str, default: str) -> str:
        # DATABASE_URL (when set) wins over the separate DB_* variables
        if name in url_values:
            return url_values[name]
        value = os.environ.get(name, "").strip()
        return value if value else default

    host = get("DB_HOST", "localhost")
    port_raw = get("DB_PORT", "3306")
    try:
        port = max(int(port_raw), 1)
    except ValueError:
        port = 3306
    return Settings(
        db_host=host,
        db_port=port,
        db_user=get("DB_USER", "root"),
        db_password=url_values.get("DB_PASSWORD", os.environ.get("DB_PASSWORD", "")),
        db_name=get("DB_NAME", "item_purchase_db"),
        db_ssl=_ssl_enabled(host, get("DB_SSL", "auto")),
        db_ssl_ca=get("DB_SSL_CA", ""),
        low_stock_threshold=_int_env("LOW_STOCK_THRESHOLD", 5, 0),
        engine_threads=_int_env("ENGINE_THREADS", 4, 1),
        connect_timeout=_int_env("DB_CONNECT_TIMEOUT", 10, 1),
    )


SETTINGS = load_settings()


def _ssl_context() -> ssl.SSLContext:
    """Verified TLS (certificate + host name). Uses DB_SSL_CA when given,
    otherwise the operating system's trusted CA store (TiDB Cloud, PlanetScale,
    etc. use publicly trusted certificates, so no extra file is needed)."""
    ca_file = SETTINGS.db_ssl_ca or None
    if ca_file and not os.path.isabs(ca_file):
        ca_file = str(PROJECT_ROOT / ca_file)
    context = ssl.create_default_context(cafile=ca_file)
    if ca_file is None and not context.get_ca_certs():
        # Some minimal images ship certificates outside OpenSSL's default path
        for candidate in ("/etc/ssl/certs/ca-certificates.crt", "/etc/pki/tls/certs/ca-bundle.crt",
                          "/etc/ssl/cert.pem"):
            if os.path.isfile(candidate):
                context.load_verify_locations(cafile=candidate)
                break
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    return context


def connection_options(database: str | None = None) -> dict[str, Any]:
    """Keyword arguments for pymysql.connect() shared by the engine and migrate.py."""
    options: dict[str, Any] = {
        "host": SETTINGS.db_host,
        "port": SETTINGS.db_port,
        "user": SETTINGS.db_user,
        "password": SETTINGS.db_password,
        "charset": "utf8mb4",
        "connect_timeout": SETTINGS.connect_timeout,
    }
    if database:
        options["database"] = database
    if SETTINGS.db_ssl:
        options["ssl"] = _ssl_context()
    return options
