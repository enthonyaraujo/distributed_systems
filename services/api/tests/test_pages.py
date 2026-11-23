from __future__ import annotations

import json
import time
from decimal import Decimal
from typing import Any

import pytest

from acadflow_api.errors import ConflictError, ValidationError
from acadflow_api.handler import create_handler
from acadflow_api.page_models import (
    MAX_CONTENT_BYTES,
    serialize_page,
    validate_create_page_payload,
    validate_patch_page_payload,
)
from acadflow_api.page_repository import DynamoDBPageRepository, InMemoryPageRepository
from acadflow_api.repository import InMemoryTaskRepository


def _access_claims(sub: str, exp_offset: int = 3600) -> dict[str, Any]:
    return {
        "sub": sub,
        "token_use": "access",
        "exp": int(time.time()) + exp_offset,
    }


def _make_event(
    method: str,
    path: str,
    *,
    body: Any = None,
    claims: dict[str, Any] | None = None,
) -> dict[str, Any]:
    request_context: dict[str, Any] = {"http": {"method": method}}
    if claims is not None:
        request_context["authorizer"] = {"jwt": {"claims": claims}}
    raw_body = (
        body
        if isinstance(body, str) or body is None
        else json.dumps(body, ensure_ascii=False)
    )
    return {
        "rawPath": path,
        "requestContext": request_context,
        "body": raw_body,
        "isBase64Encoded": False,
    }


def test_validate_create_page_defaults_and_rich_doc() -> None:
    created = validate_create_page_payload({"title": "  Notas de SD  "})
    assert created["title"] == "Notas de SD"
    assert created["icon"] == "📄"
    assert created["content"]["type"] == "doc"


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"title": "   "},
        {"title": "a" * 121},
        {"title": "Ok", "icon": "123456789"},
        {"title": "Ok", "content": "<script>alert(1)</script>"},
        {"title": "Ok", "content": {"type": "html", "content": []}},
        {"title": "Ok", "content": {"type": "doc", "content": "not-a-list"}},
        {"title": "Ok", "ownerId": "attacker"},
        {"title": "Ok", "version": 99},
    ],
)
def test_validate_create_page_rejects_invalid_and_unsafe_payloads(
    payload: dict[str, Any],
) -> None:
    with pytest.raises(ValidationError):
        validate_create_page_payload(payload)


def test_validate_page_rejects_oversized_content_and_excessive_depth() -> None:
    huge_text = "x" * (MAX_CONTENT_BYTES + 100)
    with pytest.raises(ValidationError):
        validate_create_page_payload(
            {
                "title": "Grande demais",
                "content": {
                    "type": "doc",
                    "content": [
                        {"type": "paragraph", "content": [{"type": "text", "text": huge_text}]}
                    ],
                },
            }
        )

    nested: dict[str, Any] = {"type": "paragraph"}
    for _ in range(25):
        nested = {"type": "blockquote", "content": [nested]}
    with pytest.raises(ValidationError):
        validate_create_page_payload(
            {"title": "Profundo demais", "content": {"type": "doc", "content": [nested]}}
        )


def test_validate_patch_page_requires_mutable_field_and_valid_expected_version() -> None:
    with pytest.raises(ValidationError):
        validate_patch_page_payload({"expectedVersion": 1})
    with pytest.raises(ValidationError):
        validate_patch_page_payload({"title": "Novo", "expectedVersion": 0})
    with pytest.raises(ValidationError):
        validate_patch_page_payload({"title": "Novo", "expectedVersion": True})

    updates, expected = validate_patch_page_payload(
        {"title": "Atualizado", "expectedVersion": 2}
    )
    assert updates == {"title": "Atualizado"}
    assert expected == 2


def test_serialize_page_converts_dynamodb_decimal_version_and_nested_content() -> None:
    serialized = serialize_page(
        {
            "ownerId": "sub-1",
            "id": "p-1",
            "title": "Nota",
            "icon": "📚",
            "content": {
                "type": "doc",
                "content": [
                    {
                        "type": "heading",
                        "attrs": {"level": Decimal("2")},
                        "content": [{"type": "text", "text": "Subtítulo"}],
                    }
                ],
            },
            "version": Decimal("4"),
            "createdAt": "2026-11-22T18:00:00Z",
            "updatedAt": "2026-11-22T18:00:00Z",
        }
    )
    assert serialized["version"] == 4
    assert isinstance(serialized["version"], int)
    assert serialized["content"]["content"][0]["attrs"]["level"] == 2
    assert isinstance(serialized["content"]["content"][0]["attrs"]["level"], int)
    assert "ownerId" not in serialized
    json.dumps(serialized)


def test_pages_crud_conflict_and_cross_user_isolation() -> None:
    handler = create_handler(InMemoryTaskRepository(), InMemoryPageRepository())
    claims_a = _access_claims("user-a")
    claims_b = _access_claims("user-b")

    # Unauthenticated and ID token rejected
    assert handler(_make_event("GET", "/pages"), None)["statusCode"] == 401
    assert (
        handler(
            _make_event(
                "GET",
                "/pages",
                claims={"sub": "user-a", "token_use": "id", "exp": int(time.time()) + 60},
            ),
            None,
        )["statusCode"]
        == 401
    )

    # Create rich page with checklist & blockquote
    rich_doc = {
        "type": "doc",
        "content": [
            {
                "type": "heading",
                "attrs": {"level": 1},
                "content": [{"type": "text", "text": "Plano de Estudos"}],
            },
            {
                "type": "taskList",
                "content": [
                    {
                        "type": "taskItem",
                        "attrs": {"checked": True},
                        "content": [
                            {"type": "paragraph", "content": [{"type": "text", "text": "Revisar JWT"}]}
                        ],
                    }
                ],
            },
        ],
    }
    create_resp = handler(
        _make_event(
            "POST",
            "/pages",
            claims=claims_a,
            body={"title": "Plano de Estudos", "icon": "📘", "content": rich_doc},
        ),
        None,
    )
    assert create_resp["statusCode"] == 201
    created = json.loads(create_resp["body"])
    page_id = created["id"]
    assert created["version"] == 1
    assert "ownerId" not in created

    # List returns summaries (without full content)
    list_a = handler(_make_event("GET", "/pages", claims=claims_a), None)
    assert list_a["statusCode"] == 200
    items = json.loads(list_a["body"])["items"]
    assert len(items) == 1
    assert items[0]["id"] == page_id
    assert "content" not in items[0]

    # GET single page returns full document
    get_a = handler(_make_event("GET", f"/pages/{page_id}", claims=claims_a), None)
    assert get_a["statusCode"] == 200
    assert json.loads(get_a["body"])["content"] == rich_doc

    # User B cannot access, update or delete User A's page (anti-IDOR -> 404)
    assert handler(_make_event("GET", "/pages", claims=claims_b), None)["body"] == '{"items": []}'
    assert handler(_make_event("GET", f"/pages/{page_id}", claims=claims_b), None)["statusCode"] == 404
    assert (
        handler(
            _make_event(
                "PATCH",
                f"/pages/{page_id}",
                claims=claims_b,
                body={"title": "Invadida", "expectedVersion": 1},
            ),
            None,
        )["statusCode"]
        == 404
    )
    assert handler(_make_event("DELETE", f"/pages/{page_id}", claims=claims_b), None)["statusCode"] == 404

    # User A updates with expectedVersion=1 -> succeeds and bumps version to 2
    patch_ok = handler(
        _make_event(
            "PATCH",
            f"/pages/{page_id}",
            claims=claims_a,
            body={"title": "Plano de Estudos v2", "expectedVersion": 1},
        ),
        None,
    )
    assert patch_ok["statusCode"] == 200
    assert json.loads(patch_ok["body"])["version"] == 2

    # Stale expectedVersion=1 -> 409 CONFLICT
    patch_conflict = handler(
        _make_event(
            "PATCH",
            f"/pages/{page_id}",
            claims=claims_a,
            body={"title": "Sobrescrita antiga", "expectedVersion": 1},
        ),
        None,
    )
    assert patch_conflict["statusCode"] == 409
    assert json.loads(patch_conflict["body"])["error"]["code"] == "VERSION_CONFLICT"

    # Delete page -> 204, then GET -> 404
    del_a = handler(_make_event("DELETE", f"/pages/{page_id}", claims=claims_a), None)
    assert del_a["statusCode"] == 204
    assert handler(_make_event("GET", f"/pages/{page_id}", claims=claims_a), None)["statusCode"] == 404


class FakePageConditionalError(Exception):
    def __init__(self) -> None:
        super().__init__("ConditionalCheckFailedException")
        self.response = {"Error": {"Code": "ConditionalCheckFailedException"}}


class FakeDynamoPagesTable:
    def __init__(self) -> None:
        self.items: dict[tuple[str, str], dict[str, Any]] = {}
        self.scan_called = False

    def scan(self, **_kwargs: Any) -> dict[str, Any]:
        self.scan_called = True
        raise AssertionError("Scan must never be called!")

    def query(self, **_kwargs: Any) -> dict[str, Any]:
        return {"Items": list(self.items.values())}

    def get_item(self, Key: dict[str, str]) -> dict[str, Any]:  # noqa: N803
        item = self.items.get((Key["ownerId"], Key["id"]))
        return {"Item": dict(item)} if item is not None else {}

    def put_item(self, Item: dict[str, Any], ConditionExpression: str) -> None:  # noqa: N803
        assert "attribute_not_exists(ownerId)" in ConditionExpression
        self.items[(Item["ownerId"], Item["id"])] = dict(Item)

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
        assert "#ver = #ver + :inc" in UpdateExpression
        key = (Key["ownerId"], Key["id"])
        if key not in self.items:
            raise FakePageConditionalError()
        item = dict(self.items[key])
        if ":expectedVersion" in ExpressionAttributeValues:
            if int(item["version"]) != int(ExpressionAttributeValues[":expectedVersion"]):
                raise FakePageConditionalError()
        item["version"] = int(item["version"]) + int(ExpressionAttributeValues[":inc"])
        for placeholder, field_name in ExpressionAttributeNames.items():
            if placeholder == "#ver":
                continue
            val_key = placeholder.replace("#f", ":v")
            item[field_name] = ExpressionAttributeValues[val_key]
        self.items[key] = item
        return {"Attributes": dict(item)}

    def delete_item(self, Key: dict[str, str], ConditionExpression: str) -> None:  # noqa: N803
        assert "attribute_exists(ownerId)" in ConditionExpression
        key = (Key["ownerId"], Key["id"])
        if key not in self.items:
            raise FakePageConditionalError()
        del self.items[key]


def test_dynamodb_page_repository_optimistic_locking_and_isolation() -> None:
    table = FakeDynamoPagesTable()
    repo = DynamoDBPageRepository(table_name="acadflow-pages", table=table)

    repo.create(
        {
            "ownerId": "u1",
            "id": "p1",
            "title": "Inicial",
            "version": 1,
            "updatedAt": "2026-11-22T18:00:00Z",
        }
    )

    assert len(repo.list_by_owner("u1")) == 1
    assert table.scan_called is False

    updated = repo.update("u1", "p1", {"title": "Nova"}, expected_version=1)
    assert updated is not None and updated["version"] == 2

    # Wrong version for owner -> ConflictError (409)
    with pytest.raises(ConflictError):
        repo.update("u1", "p1", {"title": "Conflito"}, expected_version=1)

    # Wrong owner with expected_version -> None (404, never leaks existence!)
    assert repo.update("u2", "p1", {"title": "Hack"}, expected_version=1) is None
    assert repo.delete("u2", "p1") is False
    assert repo.delete("u1", "p1") is True
