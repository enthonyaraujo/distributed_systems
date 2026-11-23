from __future__ import annotations

from decimal import Decimal
import json
from typing import Any


class ApiError(Exception):
    """Base HTTP domain error with consistent JSON serialization."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


class ValidationError(ApiError):
    def __init__(self, message: str) -> None:
        super().__init__(400, "VALIDATION_ERROR", message)


class InvalidJsonError(ApiError):
    def __init__(self, message: str = "Request body must be valid JSON.") -> None:
        super().__init__(400, "INVALID_JSON", message)


class UnauthorizedError(ApiError):
    def __init__(self, message: str = "Authentication required.") -> None:
        super().__init__(401, "UNAUTHORIZED", message)


class NotFoundError(ApiError):
    def __init__(self, message: str = "Task not found.") -> None:
        super().__init__(404, "TASK_NOT_FOUND", message)


class PageNotFoundError(ApiError):
    def __init__(self, message: str = "Page not found.") -> None:
        super().__init__(404, "PAGE_NOT_FOUND", message)


class ConflictError(ApiError):
    def __init__(
        self,
        message: str = "Page was modified by another session. Reload before saving.",
    ) -> None:
        super().__init__(409, "VERSION_CONFLICT", message)


def _json_default(obj: Any) -> Any:
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


BASE_SECURITY_HEADERS: dict[str, str] = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
}


def json_response(status_code: int, payload: Any = None) -> dict[str, Any]:
    """Build an API Gateway HTTP API (Payload Format v2.0) JSON response."""
    headers = dict(BASE_SECURITY_HEADERS)
    if status_code == 204 or payload is None:
        return {
            "statusCode": status_code,
            "headers": headers,
            "body": "",
        }
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": json.dumps(payload, ensure_ascii=False, default=_json_default),
    }


def error_response(error: ApiError) -> dict[str, Any]:
    return json_response(
        error.status_code,
        {"error": {"code": error.code, "message": error.message}},
    )
