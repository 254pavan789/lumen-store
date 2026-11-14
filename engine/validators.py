"""
Backend validation helpers. These are the single source of truth for input
rules - the frontend only mirrors them for convenience.
"""
from __future__ import annotations

import datetime as dt
import re
from typing import Any

from errors import ValidationError

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_DMY_RE = re.compile(r"^(\d{2})-(\d{2})-(\d{4})$")
_INT_RE = re.compile(r"^[+-]?\d+$")
_ORDER_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,29}$")

MAX_QUANTITY = 1_000_000
MAX_STOCK = 100_000_000


def require_object(body: Any, label: str = "Request body") -> dict[str, Any]:
    if body is None:
        body = {}
    if not isinstance(body, dict):
        raise ValidationError(f"{label} must be a JSON object", code="MALFORMED_REQUEST")
    return body


def parse_id(value: Any, label: str = "ID") -> int:
    """Path/body IDs must be positive integers."""
    if isinstance(value, bool):
        raise ValidationError(f"Invalid {label}: must be a positive whole number", code="INVALID_ID")
    if isinstance(value, int):
        number = value
    elif isinstance(value, str) and value.strip().isdigit():
        number = int(value.strip())
    else:
        raise ValidationError(f"Invalid {label}: must be a positive whole number", code="INVALID_ID")
    if number <= 0 or number > 4_294_967_295:
        raise ValidationError(f"Invalid {label}: must be a positive whole number", code="INVALID_ID")
    return number


def coerce_int(value: Any) -> int | None:
    """Return an int for int-like input (5, "5", 5.0) or None when not whole."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value) if value.is_integer() else None
    if isinstance(value, str):
        text = value.strip()
        if _INT_RE.match(text):
            return int(text)
        try:
            as_float = float(text)
        except ValueError:
            return None
        return int(as_float) if as_float.is_integer() else None
    return None


MAX_PRICE = 10_000_000


def parse_price(value: Any) -> tuple[float | None, str | None]:
    """Money: >= 0, at most 2 decimals. Returns (value, error)."""
    if isinstance(value, bool) or value is None or (isinstance(value, str) and not value.strip()):
        return None, "required"
    try:
        number = float(str(value).replace(",", "").strip())
    except ValueError:
        return None, "Price must be a number"
    if number != number or number in (float("inf"), float("-inf")):
        return None, "Price must be a number"
    if number < 0:
        return None, "Price cannot be negative"
    if number > MAX_PRICE:
        return None, f"Price cannot exceed {MAX_PRICE:,}"
    if round(number, 2) != round(number, 6):
        return None, "Price can have at most 2 decimal places"
    return round(number, 2), None


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    if not isinstance(value, (str, int, float)) or isinstance(value, bool):
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def parse_date(value: Any) -> tuple[str | None, str | None]:
    """Return (iso_date, error_message). Accepts YYYY-MM-DD or DD-MM-YYYY."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return None, "required"
    if not isinstance(value, str):
        return None, "invalid"
    text = value.strip()[:10] if "T" in value else value.strip()
    match = _DMY_RE.match(text)
    if match:
        text = f"{match.group(3)}-{match.group(2)}-{match.group(1)}"
    if not _DATE_RE.match(text):
        return None, "invalid"
    try:
        parsed = dt.date.fromisoformat(text)
    except ValueError:
        return None, "invalid"
    if parsed.year < 1900 or parsed.year > 2999:
        return None, "invalid"
    return parsed.isoformat(), None


def parse_active(value: Any) -> int | None:
    """Active/Inactive flag -> 1/0. None when the value is not recognisable."""
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, int) and value in (0, 1):
        return value
    if isinstance(value, str):
        text = value.strip().lower()
        if text in ("1", "true", "active", "yes", "y", "on"):
            return 1
        if text in ("0", "false", "inactive", "no", "n", "off"):
            return 0
    return None


def validate_order_id(value: Any) -> tuple[str | None, str | None]:
    text = clean_text(value).upper()
    if not text:
        return None, None  # optional - engine generates one
    if not _ORDER_ID_RE.match(text):
        return None, ("Order ID may contain only letters, numbers, '-' or '_' "
                      "(max 30 characters)")
    return text, None
