from __future__ import annotations

import pytest

from acadflow_api.errors import ValidationError
from acadflow_api.models import (
    serialize_task,
    validate_create_payload,
    validate_patch_payload,
)


def test_validate_create_defaults() -> None:
    result = validate_create_payload({"title": "  Estudar Sistemas Distribuídos  "})
    assert result == {
        "title": "Estudar Sistemas Distribuídos",
        "description": "",
        "dueDate": None,
        "priority": "medium",
        "status": "pending",
    }


def test_validate_create_full_payload() -> None:
    result = validate_create_payload(
        {
            "title": "Entregar projeto final",
            "description": "Testar DNS e Cognito",
            "dueDate": "2026-11-27",
            "priority": "high",
            "status": "in_progress",
        }
    )
    assert result["dueDate"] == "2026-11-27"
    assert result["priority"] == "high"
    assert result["status"] == "in_progress"


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"title": ""},
        {"title": "   "},
        {"title": "a" * 121},
        {"title": 123},
        {"title": "Ok", "description": "x" * 1001},
        {"title": "Ok", "dueDate": "27/11/2026"},
        {"title": "Ok", "dueDate": "2026-02-30"},
        {"title": "Ok", "priority": "urgent"},
        {"title": "Ok", "status": "archived"},
        {"title": "Ok", "ownerId": "attacker-sub"},
        {"title": "Ok", "id": "custom-id"},
        {"title": "Ok", "createdAt": "2026-01-01T00:00:00Z"},
    ],
)
def test_validate_create_rejects_invalid_inputs(payload: dict) -> None:
    with pytest.raises(ValidationError):
        validate_create_payload(payload)


def test_validate_patch_partial_and_clear_due_date() -> None:
    result = validate_patch_payload({"status": "done", "dueDate": None})
    assert result == {"status": "done", "dueDate": None}


def test_validate_patch_rejects_empty_or_forbidden_fields() -> None:
    with pytest.raises(ValidationError):
        validate_patch_payload({})
    with pytest.raises(ValidationError):
        validate_patch_payload({"ownerId": "other-user"})


def test_serialize_task_omits_internal_owner_id() -> None:
    serialized = serialize_task(
        {
            "ownerId": "user-sub-123",
            "id": "task-1",
            "title": "T1",
            "description": "",
            "dueDate": None,
            "priority": "low",
            "status": "pending",
            "createdAt": "2026-11-22T18:00:00Z",
            "updatedAt": "2026-11-22T18:00:00Z",
        }
    )
    assert "ownerId" not in serialized
    assert serialized["id"] == "task-1"
