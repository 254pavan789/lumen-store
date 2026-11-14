"""
Application error types.

Every business / validation failure is raised as an AppError subclass that
carries the HTTP status code, a stable machine-readable code, a human message
and an optional list of field-level details. The engine turns these into the
JSON error body that Express sends back unchanged.
"""
from __future__ import annotations

from typing import Any


class AppError(Exception):
    status = 500
    code = "INTERNAL_ERROR"

    def __init__(self, message: str, details: list[dict[str, Any]] | None = None,
                 code: str | None = None, status: int | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or []
        if code:
            self.code = code
        if status:
            self.status = status

    def to_body(self) -> dict[str, Any]:
        error: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.details:
            error["details"] = self.details
        return {"success": False, "error": error}


class ValidationError(AppError):
    """400 - malformed request or invalid field values."""
    status = 400
    code = "VALIDATION_ERROR"


class NotFoundError(AppError):
    """404 - referenced record does not exist."""
    status = 404
    code = "NOT_FOUND"


class ConflictError(AppError):
    """409 - request is well formed but breaks a business rule."""
    status = 409
    code = "BUSINESS_RULE_CONFLICT"


class ServiceUnavailableError(AppError):
    """503 - database cannot be reached."""
    status = 503
    code = "DATABASE_UNAVAILABLE"


class FieldErrors:
    """Collects several field errors so the client sees all problems at once."""

    def __init__(self) -> None:
        self.items: list[dict[str, Any]] = []

    def add(self, field: str, message: str, **extra: Any) -> None:
        entry: dict[str, Any] = {"field": field, "message": message}
        entry.update({k: v for k, v in extra.items() if v is not None})
        self.items.append(entry)

    def __bool__(self) -> bool:
        return bool(self.items)

    def raise_if_any(self, summary: str | None = None) -> None:
        if not self.items:
            return
        first = self.items[0]["message"]
        extra = len(self.items) - 1
        # Lead with the first concrete problem (e.g. "Item name is required");
        # every problem is listed in `details`.
        message = first if not extra else f"{first} (+{extra} more error{'s' if extra > 1 else ''})"
        if summary and extra:
            message = f"{summary} {message}"
        raise ValidationError(message, self.items)
