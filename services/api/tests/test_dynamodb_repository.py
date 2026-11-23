from __future__ import annotations

from typing import Any

from acadflow_api.repository import DynamoDBTaskRepository


class FakeConditionalCheckError(Exception):
    def __init__(self) -> None:
        super().__init__("ConditionalCheckFailedException")
        self.response = {"Error": {"Code": "ConditionalCheckFailedException"}}


class FakeDynamoTable:
    def __init__(self) -> None:
        self.items: dict[tuple[str, str], dict[str, Any]] = {}
        self.scan_called = False
        self.query_calls = 0

    def scan(self, **_kwargs: Any) -> dict[str, Any]:
        self.scan_called = True
        raise AssertionError("Scan must never be called!")

    def query(self, **kwargs: Any) -> dict[str, Any]:
        self.query_calls += 1
        all_items = list(self.items.values())
        if "ExclusiveStartKey" not in kwargs and len(all_items) > 1:
            return {"Items": [all_items[0]], "LastEvaluatedKey": {"page": 1}}
        if "ExclusiveStartKey" in kwargs:
            return {"Items": all_items[1:]}
        return {"Items": all_items}

    def get_item(self, Key: dict[str, str]) -> dict[str, Any]:  # noqa: N803
        item = self.items.get((Key["ownerId"], Key["id"]))
        return {"Item": item} if item is not None else {}

    def put_item(self, Item: dict[str, Any], ConditionExpression: str) -> None:  # noqa: N803
        assert "attribute_not_exists(ownerId)" in ConditionExpression
        key = (Item["ownerId"], Item["id"])
        if key in self.items:
            raise FakeConditionalCheckError()
        self.items[key] = dict(Item)

    def update_item(
        self,
        Key: dict[str, str],  # noqa: N803
        UpdateExpression: str,  # noqa: N803
        ExpressionAttributeNames: dict[str, str],  # noqa: N803
        ExpressionAttributeValues: dict[str, Any],  # noqa: N803
        ConditionExpression: str,  # noqa: N803
        ReturnValues: str,  # noqa: N803
    ) -> dict[str, Any]:
        assert "attribute_exists(ownerId)" in ConditionExpression
        assert ReturnValues == "ALL_NEW"
        assert UpdateExpression.startswith("SET ")
        key = (Key["ownerId"], Key["id"])
        if key not in self.items:
            raise FakeConditionalCheckError()
        item = dict(self.items[key])
        for idx, (placeholder, field_name) in enumerate(ExpressionAttributeNames.items()):
            item[field_name] = ExpressionAttributeValues[f":v{idx}"]
        self.items[key] = item
        return {"Attributes": item}

    def delete_item(self, Key: dict[str, str], ConditionExpression: str) -> None:  # noqa: N803
        assert "attribute_exists(ownerId)" in ConditionExpression
        key = (Key["ownerId"], Key["id"])
        if key not in self.items:
            raise FakeConditionalCheckError()
        del self.items[key]


def test_dynamodb_repository_uses_query_and_composite_keys() -> None:
    table = FakeDynamoTable()
    repo = DynamoDBTaskRepository(table_name="acadflow-tasks", table=table)

    repo.create(
        {
            "ownerId": "u1",
            "id": "t1",
            "title": "Primeira",
            "createdAt": "2026-11-22T10:00:00Z",
        }
    )
    repo.create(
        {
            "ownerId": "u1",
            "id": "t2",
            "title": "Segunda",
            "createdAt": "2026-11-22T12:00:00Z",
        }
    )

    listed = repo.list_by_owner("u1")
    assert table.scan_called is False
    assert table.query_calls == 2
    assert [i["id"] for i in listed] == ["t2", "t1"]

    assert repo.get("u1", "t1") is not None
    assert repo.get("u2", "t1") is None

    # Update belonging to another owner returns None via ConditionalCheckFailedException
    assert repo.update("u2", "t1", {"title": "Hack"}) is None
    updated = repo.update("u1", "t1", {"title": "Atualizada"})
    assert updated is not None
    assert updated["title"] == "Atualizada"

    # Delete belonging to another owner returns False
    assert repo.delete("u2", "t1") is False
    assert repo.delete("u1", "t1") is True
    assert repo.delete("u1", "t1") is False
