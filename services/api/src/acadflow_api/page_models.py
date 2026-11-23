from __future__ import annotations

from decimal import Decimal
import json
import re
from typing import Any
from urllib.parse import urlsplit

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
MAX_CONTENT_NODES = 2_000
MAX_LINK_HREF_LEN = 2_048

ALLOWED_CREATE_FIELDS: frozenset[str] = frozenset({"title", "icon", "content"})
ALLOWED_PATCH_FIELDS: frozenset[str] = frozenset(
    {"title", "icon", "content", "expectedVersion"}
)

ALLOWED_NODE_KEYS: frozenset[str] = frozenset(
    {"type", "attrs", "content", "marks", "text"}
)
ALLOWED_MARK_KEYS: frozenset[str] = frozenset({"type", "attrs"})

ALLOWED_CONTAINER_NODES: frozenset[str] = frozenset(
    {
        "doc",
        "paragraph",
        "heading",
        "bulletList",
        "orderedList",
        "listItem",
        "taskList",
        "taskItem",
        "blockquote",
        "codeBlock",
    }
)
ALLOWED_LEAF_NODES: frozenset[str] = frozenset({"text", "hardBreak", "horizontalRule"})
ALLOWED_NODE_TYPES: frozenset[str] = ALLOWED_CONTAINER_NODES | ALLOWED_LEAF_NODES

ALLOWED_SIMPLE_MARKS: frozenset[str] = frozenset(
    {"bold", "italic", "strike", "code", "underline"}
)
ALLOWED_MARK_TYPES: frozenset[str] = ALLOWED_SIMPLE_MARKS | {"link"}
ALLOWED_HEADING_LEVELS: frozenset[int] = frozenset({1, 2, 3})
ALLOWED_LINK_SCHEMES: frozenset[str] = frozenset({"http", "https", "mailto"})
ALLOWED_LINK_TARGETS: frozenset[str] = frozenset({"_blank", "_self"})
ALLOWED_LINK_ATTR_KEYS: frozenset[str] = frozenset({"href", "target", "rel", "class"})

_CONTROL_CHAR_RE = re.compile(r"[\x00-\x1f\x7f]")
_SAFE_TOKEN_RE = re.compile(r"^[a-zA-Z0-9 _+#./-]{1,100}$")
_SAFE_LANG_RE = re.compile(r"^[a-zA-Z0-9_+#.-]{1,40}$")


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


def _validate_safe_url(raw_href: Any) -> str:
    if not isinstance(raw_href, str):
        raise ValidationError("Link 'href' must be a string.")
    if _CONTROL_CHAR_RE.search(raw_href):
        raise ValidationError("Link 'href' contains invalid control characters.")
    href = raw_href.strip()
    if not href or len(href) > MAX_LINK_HREF_LEN:
        raise ValidationError(
            f"Link 'href' must be between 1 and {MAX_LINK_HREF_LEN} characters."
        )
    parsed = urlsplit(href)
    scheme = parsed.scheme.lower()
    if scheme not in ALLOWED_LINK_SCHEMES:
        raise ValidationError(
            "Link 'href' must use an allowed scheme (http, https, or mailto)."
        )
    if scheme in {"http", "https"}:
        if not parsed.netloc or any(ch in parsed.netloc for ch in (" ", "<", ">", '"', "'")):
            raise ValidationError("Link 'href' must include a valid host.")
    elif scheme == "mailto":
        if not parsed.path or "@" not in parsed.path or any(
            ch in parsed.path for ch in (" ", "<", ">", '"', "'")
        ):
            raise ValidationError("Link 'href' must include a valid mailto target.")
    return href


def _validate_mark(mark: Any) -> None:
    if not isinstance(mark, dict):
        raise ValidationError("Each ProseMirror mark must be a JSON object.")
    unknown_keys = sorted(set(mark.keys()) - ALLOWED_MARK_KEYS)
    if unknown_keys:
        raise ValidationError(
            f"Unsupported ProseMirror mark key(s): {', '.join(unknown_keys)}."
        )
    mark_type = mark.get("type")
    if not isinstance(mark_type, str) or mark_type not in ALLOWED_MARK_TYPES:
        raise ValidationError(f"Unsupported ProseMirror mark type: {mark_type!r}.")

    attrs = mark.get("attrs")
    if mark_type in ALLOWED_SIMPLE_MARKS:
        if attrs is not None and attrs != {}:
            raise ValidationError(
                f"Mark '{mark_type}' does not accept custom attributes."
            )
        return

    # mark_type == "link"
    if not isinstance(attrs, dict):
        raise ValidationError("Mark 'link' requires an 'attrs' object with 'href'.")
    unknown_attrs = sorted(set(attrs.keys()) - ALLOWED_LINK_ATTR_KEYS)
    if unknown_attrs:
        raise ValidationError(
            f"Unsupported link attribute(s): {', '.join(unknown_attrs)}."
        )
    _validate_safe_url(attrs.get("href"))

    target = attrs.get("target")
    if target is not None and (
        not isinstance(target, str) or target not in ALLOWED_LINK_TARGETS
    ):
        raise ValidationError("Link 'target' must be '_blank', '_self', or null.")

    for opt_key in ("rel", "class"):
        opt_val = attrs.get(opt_key)
        if opt_val is not None and (
            not isinstance(opt_val, str) or not _SAFE_TOKEN_RE.match(opt_val)
        ):
            raise ValidationError(f"Link '{opt_key}' contains unsupported characters.")


def _validate_node_attrs(node_type: str, attrs: Any) -> None:
    if attrs is None:
        return
    if not isinstance(attrs, dict):
        raise ValidationError(f"Node '{node_type}' attrs must be a JSON object.")

    if node_type == "heading":
        unknown = sorted(set(attrs.keys()) - {"level"})
        if unknown:
            raise ValidationError(
                f"Unsupported heading attribute(s): {', '.join(unknown)}."
            )
        level = attrs.get("level")
        if isinstance(level, bool) or not isinstance(level, int) or level not in ALLOWED_HEADING_LEVELS:
            raise ValidationError("Heading 'level' must be an integer between 1 and 3.")
        return

    if node_type == "taskItem":
        unknown = sorted(set(attrs.keys()) - {"checked"})
        if unknown:
            raise ValidationError(
                f"Unsupported taskItem attribute(s): {', '.join(unknown)}."
            )
        checked = attrs.get("checked")
        if checked is not None and not isinstance(checked, bool):
            raise ValidationError("Field 'taskItem.attrs.checked' must be a boolean.")
        return

    if node_type == "orderedList":
        unknown = sorted(set(attrs.keys()) - {"start", "type"})
        if unknown:
            raise ValidationError(
                f"Unsupported orderedList attribute(s): {', '.join(unknown)}."
            )
        start = attrs.get("start")
        if start is not None and (
            isinstance(start, bool) or not isinstance(start, int) or start < 1
        ):
            raise ValidationError("Field 'orderedList.attrs.start' must be a positive integer.")
        list_type = attrs.get("type")
        if list_type is not None and (
            not isinstance(list_type, str) or not _SAFE_TOKEN_RE.match(list_type)
        ):
            raise ValidationError("Field 'orderedList.attrs.type' is invalid.")
        return

    if node_type == "codeBlock":
        unknown = sorted(set(attrs.keys()) - {"language"})
        if unknown:
            raise ValidationError(
                f"Unsupported codeBlock attribute(s): {', '.join(unknown)}."
            )
        lang = attrs.get("language")
        if lang is not None and lang != "" and (
            not isinstance(lang, str) or not _SAFE_LANG_RE.match(lang)
        ):
            raise ValidationError("Field 'codeBlock.attrs.language' is invalid.")
        return

    if attrs != {}:
        raise ValidationError(f"Node '{node_type}' does not accept custom attributes.")


def _validate_node(node: Any, depth: int, counter: list[int]) -> None:
    if depth > MAX_CONTENT_DEPTH:
        raise ValidationError(
            f"Field 'content' exceeds maximum nesting depth of {MAX_CONTENT_DEPTH}."
        )
    counter[0] += 1
    if counter[0] > MAX_CONTENT_NODES:
        raise ValidationError(
            f"Field 'content' exceeds maximum node count of {MAX_CONTENT_NODES}."
        )
    if not isinstance(node, dict):
        raise ValidationError("Each ProseMirror node must be a JSON object.")

    unknown_keys = sorted(set(node.keys()) - ALLOWED_NODE_KEYS)
    if unknown_keys:
        raise ValidationError(
            f"Unsupported ProseMirror node key(s): {', '.join(unknown_keys)}."
        )

    node_type = node.get("type")
    if not isinstance(node_type, str) or node_type not in ALLOWED_NODE_TYPES:
        raise ValidationError(f"Unsupported ProseMirror node type: {node_type!r}.")
    if depth > 0 and node_type == "doc":
        raise ValidationError("Nested 'doc' nodes are not allowed.")

    _validate_node_attrs(node_type, node.get("attrs"))

    if node_type == "text":
        if "content" in node:
            raise ValidationError("Text nodes cannot contain child 'content'.")
        text_val = node.get("text")
        if not isinstance(text_val, str):
            raise ValidationError("Text nodes must include a string 'text' field.")
        marks = node.get("marks")
        if marks is not None:
            if not isinstance(marks, list):
                raise ValidationError("Field 'marks' must be a list.")
            for mark in marks:
                _validate_mark(mark)
        return

    if "text" in node:
        raise ValidationError(f"Node '{node_type}' cannot contain a 'text' field.")

    if node_type in ALLOWED_LEAF_NODES:
        if "content" in node:
            raise ValidationError(f"Leaf node '{node_type}' cannot contain child 'content'.")
        if node_type == "hardBreak" and "marks" in node:
            marks = node.get("marks")
            if marks is not None:
                if not isinstance(marks, list):
                    raise ValidationError("Field 'marks' must be a list.")
                for mark in marks:
                    _validate_mark(mark)
        elif "marks" in node:
            raise ValidationError(f"Node '{node_type}' cannot contain 'marks'.")
        return

    if "marks" in node:
        raise ValidationError(f"Container node '{node_type}' cannot contain 'marks'.")

    if "content" in node:
        children = node["content"]
        if not isinstance(children, list):
            raise ValidationError(
                f"Field 'content' on node '{node_type}' must be a list of nodes."
            )
        for child in children:
            _validate_node(child, depth + 1, counter)


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

    _validate_node(value, depth=0, counter=[0])

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
