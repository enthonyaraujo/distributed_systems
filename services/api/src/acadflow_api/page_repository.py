from __future__ import annotations

from copy import deepcopy
from typing import Any, Protocol

from acadflow_api.errors import ConflictError
from acadflow_api.repository import _is_conditional_check_failed


class PageRepository(Protocol):
    def list_by_owner(self, owner_id: str) -> list[dict[str, Any]]: ...

    def get(self, owner_id: str, page_id: str) -> dict[str, Any] | None: ...

    def create(self, item: dict[str, Any]) -> dict[str, Any]: ...

    def update(
        self,
        owner_id: str,
        page_id: str,
        updates: dict[str, Any],
        expected_version: int | None = None,
    ) -> dict[str, Any] | None: ...

    def delete(self, owner_id: str, page_id: str) -> bool: ...


class InMemoryPageRepository:
    """Deterministic in-memory page store for unit tests and local dev only."""

    def __init__(self) -> None:
        self._items: dict[tuple[str, str], dict[str, Any]] = {}

    def list_by_owner(self, owner_id: str) -> list[dict[str, Any]]:
        result = [
            deepcopy(item)
            for (item_owner, _), item in self._items.items()
            if item_owner == owner_id
        ]
        result.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)
        return result

    def get(self, owner_id: str, page_id: str) -> dict[str, Any] | None:
        item = self._items.get((owner_id, page_id))
        return deepcopy(item) if item is not None else None

    def create(self, item: dict[str, Any]) -> dict[str, Any]:
        key = (item["ownerId"], item["id"])
        self._items[key] = deepcopy(item)
        return deepcopy(item)

    def update(
        self,
        owner_id: str,
        page_id: str,
        updates: dict[str, Any],
        expected_version: int | None = None,
    ) -> dict[str, Any] | None:
        key = (owner_id, page_id)
        existing = self._items.get(key)
        if existing is None:
            return None
        current_version = int(existing.get("version", 1))
        if expected_version is not None and current_version != expected_version:
            raise ConflictError()
        updated = {**existing, **updates, "version": current_version + 1}
        self._items[key] = deepcopy(updated)
        return deepcopy(updated)

    def delete(self, owner_id: str, page_id: str) -> bool:
        return self._items.pop((owner_id, page_id), None) is not None


class DynamoDBPageRepository:
    """Layer 3 adapter backed by Amazon DynamoDB table `acadflow-pages` (PK=ownerId, SK=id).

    Enforces ownerId scoping on every operation, never calls Scan, and supports
    optimistic concurrency via conditional `version` checks.
    """

    def __init__(self, table_name: str, table: Any = None) -> None:
        if table is not None:
            self._table = table
        else:
            import boto3  # Provided natively by AWS Lambda Python runtime

            self._table = boto3.resource("dynamodb").Table(table_name)

    def list_by_owner(self, owner_id: str) -> list[dict[str, Any]]:
        from boto3.dynamodb.conditions import Key

        items: list[dict[str, Any]] = []
        query_kwargs: dict[str, Any] = {
            "KeyConditionExpression": Key("ownerId").eq(owner_id)
        }
        while True:
            response = self._table.query(**query_kwargs)
            items.extend(response.get("Items", []))
            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                break
            query_kwargs["ExclusiveStartKey"] = last_key

        items.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)
        return items

    def get(self, owner_id: str, page_id: str) -> dict[str, Any] | None:
        response = self._table.get_item(Key={"ownerId": owner_id, "id": page_id})
        item = response.get("Item")
        return dict(item) if item is not None else None

    def create(self, item: dict[str, Any]) -> dict[str, Any]:
        self._table.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(ownerId) AND attribute_not_exists(id)",
        )
        return dict(item)

    def update(
        self,
        owner_id: str,
        page_id: str,
        updates: dict[str, Any],
        expected_version: int | None = None,
    ) -> dict[str, Any] | None:
        expr_names: dict[str, str] = {"#ver": "version"}
        expr_values: dict[str, Any] = {":inc": 1}
        set_clauses: list[str] = ["#ver = #ver + :inc"]

        for idx, (field, value) in enumerate(updates.items()):
            name_placeholder = f"#f{idx}"
            val_placeholder = f":v{idx}"
            expr_names[name_placeholder] = field
            expr_values[val_placeholder] = value
            set_clauses.append(f"{name_placeholder} = {val_placeholder}")

        condition = "attribute_exists(ownerId) AND attribute_exists(id)"
        if expected_version is not None:
            condition += " AND #ver = :expectedVersion"
            expr_values[":expectedVersion"] = expected_version

        try:
            response = self._table.update_item(
                Key={"ownerId": owner_id, "id": page_id},
                UpdateExpression="SET " + ", ".join(set_clauses),
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_values,
                ConditionExpression=condition,
                ReturnValues="ALL_NEW",
            )
        except Exception as exc:
            if _is_conditional_check_failed(exc):
                # Distinguish version conflict (409) from missing/foreign page (404)
                # without ever leaking pages belonging to other owners.
                if expected_version is not None and self.get(owner_id, page_id) is not None:
                    raise ConflictError() from exc
                return None
            raise

        attributes = response.get("Attributes")
        return dict(attributes) if attributes is not None else None

    def delete(self, owner_id: str, page_id: str) -> bool:
        try:
            self._table.delete_item(
                Key={"ownerId": owner_id, "id": page_id},
                ConditionExpression="attribute_exists(ownerId) AND attribute_exists(id)",
            )
            return True
        except Exception as exc:
            if _is_conditional_check_failed(exc):
                return False
            raise
