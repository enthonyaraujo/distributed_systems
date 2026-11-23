from __future__ import annotations

from decimal import Decimal
import json
from typing import Any

from acadflow_api.errors import ValidationError

DEFAULT_PAGE_ICON = "📄"
DEFAULT_PAGE_CONTENT: dict[str, Any] = {
    "type": "doc",
    "content": [{"type": "paragraph"}],
}
PAGE_TITLE_MIN_LEN = 1
PAGE_TITLE_MAX_LEN = 120
PAGE_ICON_MAX_LEN = 8
MAX_CONTENT_BYTES = 102_400  # 100 KB UTF-8 (safely under DynamoDB's 400 KB item limit)
MAX_CONTENT_DEPTH = 20

ALLOWED_CREATE_FIELDS: frozenset[str] = frozenset({"title", "icon", "content"})
ALLOWED_PATCH_FIELDS: frozenset[str] = frozenset(
    {"title", "icon", "content", "expectedVersion"}
)


def _validate_keys(payload: Any, allowed: frozenset[str]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValidationError("Request body must be a JSON object.")
    unknown_keys = sorted(set(payload.keys()) - allowed)
    if unknown_keys:
        joined = ", ".join(unknown_keys)
        raise ValidationError(f"Unsupported or read-only field(s): {joined}.")
    return payload


def _validate_title(value: Any) -> str:
    if not isinstance(value, str):
        raise ValidationError("Field 'title' must be a string.")
    cleaned = value.strip()
    if len(cleaned) < PAGE_TITLE_MIN_LEN or len(cleaned) > PAGE_TITLE_MAX_LEN:
        raise ValidationError(
            f"Field 'title' must be between {PAGE_TITLE_MIN_LEN} and {PAGE_TITLE_MAX_LEN} characters."
        )
    return cleaned


def _validate_icon(value: Any) -> str:
    if value is None or value == "":
        return DEFAULT_PAGE_ICON
    if not isinstance(value, str):
        raise ValidationError("Field 'icon' must be a string.")
    cleaned = value.strip()
    if not cleaned:
        return DEFAULT_PAGE_ICON
    if len(cleaned) > PAGE_ICON_MAX_LEN:
        raise ValidationError(
            f"Field 'icon' must be at most {PAGE_ICON_MAX_LEN} characters."
        )
    return cleaned


def _check_depth(node: Any, depth: int = 0) -> None:
    if depth > MAX_CONTENT_DEPTH:
        raise ValidationError(
            f"Field 'content' exceeds maximum nesting depth of {MAX_CONTENT_DEPTH}."
        )
    if isinstance(node, dict):
        for val in node.values():
            _check_depth(val, depth + 1)
    elif isinstance(node, list):
        for item in node:
            _check_depth(item, depth + 1)


def _validate_content(value: Any) -> dict[str, Any]:
    if value is None:
        return {
            "type": "doc",
            "content": [{"type": "paragraph"}],
        }
    if not isinstance(value, dict):
        raise ValidationError(
            "Field 'content' must be a structured ProseMirror JSON object (not raw HTML)."
        )
    if value.get("type") != "doc":
        raise ValidationError("Field 'content.type' must be 'doc'.")
    children = value.get("content", [])
    if not isinstance(children, list):
        raise ValidationError("Field 'content.content' must be a list of nodes.")

    _check_depth(value)

    try:
        encoded = json.dumps(value, ensure_ascii=False).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise ValidationError("Field 'content' must be JSON serializable.") from exc

    if len(encoded) > MAX_CONTENT_BYTES:
        raise ValidationError(
            f"Field 'content' exceeds maximum size of {MAX_CONTENT_BYTES} bytes (100 KB)."
        )
    return value


def _validate_expected_version(value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValidationError("Field 'expectedVersion' must be a positive integer.")
    return value


def validate_create_page_payload(payload: Any) -> dict[str, Any]:
    data = _validate_keys(payload, ALLOWED_CREATE_FIELDS)
    if "title" not in data:
        raise ValidationError("Field 'title' is required.")
    return {
        "title": _validate_title(data["title"]),
        "icon": _validate_icon(data.get("icon", DEFAULT_PAGE_ICON)),
        "content": _validate_content(data.get("content")),
    }


def validate_patch_page_payload(payload: Any) -> tuple[dict[str, Any], int | None]:
    data = _validate_keys(payload, ALLOWED_PATCH_FIELDS)
    expected_version: int | None = None
    if "expectedVersion" in data and data["expectedVersion"] is not None:
        expected_version = _validate_expected_version(data["expectedVersion"])

    updates: dict[str, Any] = {}
    if "title" in data:
        updates["title"] = _validate_title(data["title"])
    if "icon" in data:
        updates["icon"] = _validate_icon(data["icon"])
    if "content" in data:
        updates["content"] = _validate_content(data["content"])

    if not updates:
        raise ValidationError(
            "At least one updatable field ('title', 'icon', or 'content') must be provided."
        )
    return updates, expected_version


def serialize_page_summary(item: dict[str, Any]) -> dict[str, Any]:
    """Lightweight page representation for sidebar and dashboard lists."""
    return {
        "id": item["id"],
        "title": item["title"],
        "icon": item.get("icon", DEFAULT_PAGE_ICON),
        "version": int(item.get("version", 1)),
        "createdAt": item["createdAt"],
        "updatedAt": item["updatedAt"],
    }


def _normalize_dynamodb_numbers(value: Any) -> Any:
    """Recursively convert DynamoDB Decimal values inside rich JSON ASTs to int/float."""
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    if isinstance(value, dict):
        return {k: _normalize_dynamodb_numbers(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_normalize_dynamodb_numbers(v) for v in value]
    return value


def serialize_page(item: dict[str, Any]) -> dict[str, Any]:
    """Full public Page contract without internal ownerId metadata."""
    return {
        "id": item["id"],
        "title": item["title"],
        "icon": item.get("icon", DEFAULT_PAGE_ICON),
        "content": _normalize_dynamodb_numbers(
            item.get("content", DEFAULT_PAGE_CONTENT)
        ),
        "version": int(item.get("version", 1)),
        "createdAt": item["createdAt"],
        "updatedAt": item["updatedAt"],
    }
