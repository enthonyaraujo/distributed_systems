from __future__ import annotations

from copy import deepcopy
from typing import Any, Protocol


class TaskRepository(Protocol):
    def list_by_owner(self, owner_id: str) -> list[dict[str, Any]]: ...

    def get(self, owner_id: str, task_id: str) -> dict[str, Any] | None: ...

    def create(self, item: dict[str, Any]) -> dict[str, Any]: ...

    def update(
        self, owner_id: str, task_id: str, updates: dict[str, Any]
    ) -> dict[str, Any] | None: ...

    def delete(self, owner_id: str, task_id: str) -> bool: ...


class InMemoryTaskRepository:
    """Deterministic in-memory repository for unit tests and local dev only."""

    def __init__(self) -> None:
        self._items: dict[tuple[str, str], dict[str, Any]] = {}

    def list_by_owner(self, owner_id: str) -> list[dict[str, Any]]:
        result = [
            deepcopy(item)
            for (item_owner, _), item in self._items.items()
            if item_owner == owner_id
        ]
        result.sort(key=lambda x: x["createdAt"], reverse=True)
        return result

    def get(self, owner_id: str, task_id: str) -> dict[str, Any] | None:
        item = self._items.get((owner_id, task_id))
        return deepcopy(item) if item is not None else None

    def create(self, item: dict[str, Any]) -> dict[str, Any]:
        key = (item["ownerId"], item["id"])
        self._items[key] = deepcopy(item)
        return deepcopy(item)

    def update(
        self, owner_id: str, task_id: str, updates: dict[str, Any]
    ) -> dict[str, Any] | None:
        key = (owner_id, task_id)
        existing = self._items.get(key)
        if existing is None:
            return None
        updated = {**existing, **updates}
        self._items[key] = deepcopy(updated)
        return deepcopy(updated)

    def delete(self, owner_id: str, task_id: str) -> bool:
        return self._items.pop((owner_id, task_id), None) is not None


class DynamoDBTaskRepository:
    """Layer 3 adapter backed by Amazon DynamoDB (PK=ownerId, SK=id).

    Always scopes every read/write/delete to the authenticated ownerId and never
    performs Scan operations.
    """

    def __init__(self, table_name: str, table: Any = None) -> None:
        if table is not None:
            self._table = table
        else:
            import boto3  # Provided natively by the AWS Lambda Python runtime

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

        items.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
        return items

    def get(self, owner_id: str, task_id: str) -> dict[str, Any] | None:
        response = self._table.get_item(Key={"ownerId": owner_id, "id": task_id})
        item = response.get("Item")
        return dict(item) if item is not None else None

    def create(self, item: dict[str, Any]) -> dict[str, Any]:
        self._table.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(ownerId) AND attribute_not_exists(id)",
        )
        return dict(item)

    def update(
        self, owner_id: str, task_id: str, updates: dict[str, Any]
    ) -> dict[str, Any] | None:
        expr_names: dict[str, str] = {}
        expr_values: dict[str, Any] = {}
        set_clauses: list[str] = []

        for idx, (field, value) in enumerate(updates.items()):
            name_placeholder = f"#f{idx}"
            val_placeholder = f":v{idx}"
            expr_names[name_placeholder] = field
            expr_values[val_placeholder] = value
            set_clauses.append(f"{name_placeholder} = {val_placeholder}")

        try:
            response = self._table.update_item(
                Key={"ownerId": owner_id, "id": task_id},
                UpdateExpression="SET " + ", ".join(set_clauses),
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_values,
                ConditionExpression="attribute_exists(ownerId) AND attribute_exists(id)",
                ReturnValues="ALL_NEW",
            )
        except Exception as exc:
            if _is_conditional_check_failed(exc):
                return None
            raise

        attributes = response.get("Attributes")
        return dict(attributes) if attributes is not None else None

    def delete(self, owner_id: str, task_id: str) -> bool:
        try:
            self._table.delete_item(
                Key={"ownerId": owner_id, "id": task_id},
                ConditionExpression="attribute_exists(ownerId) AND attribute_exists(id)",
            )
            return True
        except Exception as exc:
            if _is_conditional_check_failed(exc):
                return False
            raise


def _is_conditional_check_failed(exc: Exception) -> bool:
    response = getattr(exc, "response", None)
    if isinstance(response, dict):
        code = response.get("Error", {}).get("Code")
        if code == "ConditionalCheckFailedException":
            return True
    return exc.__class__.__name__ == "ConditionalCheckFailedException"
