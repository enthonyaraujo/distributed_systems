from __future__ import annotations

import uuid
from typing import Any

from acadflow_api.errors import PageNotFoundError
from acadflow_api.page_models import (
    serialize_page,
    serialize_page_summary,
    validate_create_page_payload,
    validate_patch_page_payload,
)
from acadflow_api.page_repository import PageRepository
from acadflow_api.service import _utc_now_iso


class PageService:
    """Layer 2 business use cases for personal academic workspace pages."""

    def __init__(self, repository: PageRepository) -> None:
        self._repository = repository

    def list_pages(self, owner_id: str) -> list[dict[str, Any]]:
        items = self._repository.list_by_owner(owner_id)
        return [serialize_page_summary(item) for item in items]

    def create_page(self, owner_id: str, payload: Any) -> dict[str, Any]:
        validated = validate_create_page_payload(payload)
        now = _utc_now_iso()
        item: dict[str, Any] = {
            "ownerId": owner_id,
            "id": str(uuid.uuid4()),
            "title": validated["title"],
            "icon": validated["icon"],
            "content": validated["content"],
            "version": 1,
            "createdAt": now,
            "updatedAt": now,
        }
        created = self._repository.create(item)
        return serialize_page(created)

    def get_page(self, owner_id: str, page_id: str) -> dict[str, Any]:
        item = self._repository.get(owner_id, page_id)
        if item is None:
            raise PageNotFoundError()
        return serialize_page(item)

    def update_page(
        self, owner_id: str, page_id: str, payload: Any
    ) -> dict[str, Any]:
        updates, expected_version = validate_patch_page_payload(payload)
        updates["updatedAt"] = _utc_now_iso()
        updated = self._repository.update(
            owner_id, page_id, updates, expected_version=expected_version
        )
        if updated is None:
            raise PageNotFoundError()
        return serialize_page(updated)

    def delete_page(self, owner_id: str, page_id: str) -> None:
        deleted = self._repository.delete(owner_id, page_id)
        if not deleted:
            raise PageNotFoundError()
