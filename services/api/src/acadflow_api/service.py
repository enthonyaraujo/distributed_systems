from __future__ import annotations

import datetime
import uuid
from typing import Any

from acadflow_api.errors import NotFoundError
from acadflow_api.models import (
    serialize_task,
    validate_create_payload,
    validate_patch_payload,
)
from acadflow_api.repository import TaskRepository


def _utc_now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class TaskService:
    """Layer 2 business use cases enforcing ownership scoping on every call."""

    def __init__(self, repository: TaskRepository) -> None:
        self._repository = repository

    def list_tasks(self, owner_id: str) -> list[dict[str, Any]]:
        items = self._repository.list_by_owner(owner_id)
        return [serialize_task(item) for item in items]

    def create_task(self, owner_id: str, payload: Any) -> dict[str, Any]:
        validated = validate_create_payload(payload)
        now = _utc_now_iso()
        item: dict[str, Any] = {
            "ownerId": owner_id,
            "id": str(uuid.uuid4()),
            "title": validated["title"],
            "description": validated["description"],
            "dueDate": validated["dueDate"],
            "priority": validated["priority"],
            "status": validated["status"],
            "createdAt": now,
            "updatedAt": now,
        }
        created = self._repository.create(item)
        return serialize_task(created)

    def get_task(self, owner_id: str, task_id: str) -> dict[str, Any]:
        item = self._repository.get(owner_id, task_id)
        if item is None:
            raise NotFoundError()
        return serialize_task(item)

    def update_task(
        self, owner_id: str, task_id: str, payload: Any
    ) -> dict[str, Any]:
        updates = validate_patch_payload(payload)
        updates["updatedAt"] = _utc_now_iso()
        updated = self._repository.update(owner_id, task_id, updates)
        if updated is None:
            raise NotFoundError()
        return serialize_task(updated)

    def delete_task(self, owner_id: str, task_id: str) -> None:
        deleted = self._repository.delete(owner_id, task_id)
        if not deleted:
            raise NotFoundError()
