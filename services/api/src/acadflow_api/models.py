from __future__ import annotations

import datetime
import re
from typing import Any

from acadflow_api.errors import ValidationError

VALID_PRIORITIES: tuple[str, ...] = ("low", "medium", "high")
VALID_STATUSES: tuple[str, ...] = ("pending", "in_progress", "done")
ALLOWED_MUTABLE_FIELDS: frozenset[str] = frozenset(
    {"title", "description", "dueDate", "priority", "status"}
)
TITLE_MIN_LEN = 1
TITLE_MAX_LEN = 120
DESCRIPTION_MAX_LEN = 1000
_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _validate_allowed_keys(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValidationError("Request body must be a JSON object.")

    unknown_keys = sorted(set(payload.keys()) - ALLOWED_MUTABLE_FIELDS)
    if unknown_keys:
        joined = ", ".join(unknown_keys)
        raise ValidationError(f"Unsupported or read-only field(s): {joined}.")
    return payload


def _validate_title(value: Any) -> str:
    if not isinstance(value, str):
        raise ValidationError("Field 'title' must be a string.")
    cleaned = value.strip()
    if len(cleaned) < TITLE_MIN_LEN or len(cleaned) > TITLE_MAX_LEN:
        raise ValidationError(
            f"Field 'title' must be between {TITLE_MIN_LEN} and {TITLE_MAX_LEN} characters."
        )
    return cleaned


def _validate_description(value: Any) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        raise ValidationError("Field 'description' must be a string.")
    cleaned = value.strip()
    if len(cleaned) > DESCRIPTION_MAX_LEN:
        raise ValidationError(
            f"Field 'description' must be at most {DESCRIPTION_MAX_LEN} characters."
        )
    return cleaned


def _validate_due_date(value: Any) -> str | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str) or not _ISO_DATE_RE.match(value):
        raise ValidationError("Field 'dueDate' must use format YYYY-MM-DD.")
    try:
        datetime.date.fromisoformat(value)
    except ValueError as exc:
        raise ValidationError("Field 'dueDate' is not a valid calendar date.") from exc
    return value


def _validate_priority(value: Any) -> str:
    if not isinstance(value, str) or value not in VALID_PRIORITIES:
        allowed = ", ".join(VALID_PRIORITIES)
        raise ValidationError(f"Field 'priority' must be one of: {allowed}.")
    return value


def _validate_status(value: Any) -> str:
    if not isinstance(value, str) or value not in VALID_STATUSES:
        allowed = ", ".join(VALID_STATUSES)
        raise ValidationError(f"Field 'status' must be one of: {allowed}.")
    return value


def validate_create_payload(payload: Any) -> dict[str, Any]:
    data = _validate_allowed_keys(payload)
    if "title" not in data:
        raise ValidationError("Field 'title' is required.")

    return {
        "title": _validate_title(data["title"]),
        "description": _validate_description(data.get("description", "")),
        "dueDate": _validate_due_date(data.get("dueDate")),
        "priority": _validate_priority(data.get("priority", "medium")),
        "status": _validate_status(data.get("status", "pending")),
    }


def validate_patch_payload(payload: Any) -> dict[str, Any]:
    data = _validate_allowed_keys(payload)
    if not data:
        raise ValidationError("At least one updatable field must be provided.")

    updates: dict[str, Any] = {}
    if "title" in data:
        updates["title"] = _validate_title(data["title"])
    if "description" in data:
        updates["description"] = _validate_description(data["description"])
    if "dueDate" in data:
        updates["dueDate"] = _validate_due_date(data["dueDate"])
    if "priority" in data:
        updates["priority"] = _validate_priority(data["priority"])
    if "status" in data:
        updates["status"] = _validate_status(data["status"])
    return updates


def serialize_task(item: dict[str, Any]) -> dict[str, Any]:
    """Return the public Task contract without exposing internal ownership metadata."""
    return {
        "id": item["id"],
        "title": item["title"],
        "description": item.get("description", ""),
        "dueDate": item.get("dueDate"),
        "priority": item["priority"],
        "status": item["status"],
        "createdAt": item["createdAt"],
        "updatedAt": item["updatedAt"],
    }
