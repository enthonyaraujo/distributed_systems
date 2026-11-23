from __future__ import annotations

import base64
import json
import time
from typing import Any

from acadflow_api.handler import create_handler
from acadflow_api.repository import InMemoryTaskRepository


def _make_event(
    method: str,
    path: str,
    *,
    body: Any = None,
    claims: dict[str, Any] | None = None,
    base64_body: bool = False,
    stage: str | None = None,
) -> dict[str, Any]:
    request_context: dict[str, Any] = {"http": {"method": method}}
    if stage is not None:
        request_context["stage"] = stage
    if claims is not None:
        request_context["authorizer"] = {"jwt": {"claims": claims}}

    raw_body: str | None = None
    if body is not None:
        raw_body = body if isinstance(body, str) else json.dumps(body)
        if base64_body:
            raw_body = base64.b64encode(raw_body.encode("utf-8")).decode("ascii")

    return {
        "rawPath": path,
        "requestContext": request_context,
        "body": raw_body,
        "isBase64Encoded": base64_body,
    }


def _access_claims(sub: str, exp_offset: int = 3600) -> dict[str, Any]:
    return {
        "sub": sub,
        "token_use": "access",
        "exp": int(time.time()) + exp_offset,
    }


def test_health_is_public() -> None:
    handler = create_handler(InMemoryTaskRepository())
    resp = handler(_make_event("GET", "/health"), None)
    assert resp["statusCode"] == 200
    assert json.loads(resp["body"]) == {"status": "ok", "service": "acadflow-api"}
    assert resp["headers"]["Cache-Control"] == "no-store"
    assert resp["headers"]["X-Content-Type-Options"] == "nosniff"
    assert resp["headers"]["X-Frame-Options"] == "DENY"
    assert resp["headers"]["Referrer-Policy"] == "no-referrer"


def test_tasks_rejects_missing_claims_and_non_access_tokens() -> None:
    handler = create_handler(InMemoryTaskRepository())

    # No JWT claims at all
    resp_none = handler(_make_event("GET", "/tasks"), None)
    assert resp_none["statusCode"] == 401

    # Missing token_use claim must be rejected (defense-in-depth ALTO 3)
    resp_no_use = handler(
        _make_event("GET", "/tasks", claims={"sub": "user-a", "exp": int(time.time()) + 60}),
        None,
    )
    assert resp_no_use["statusCode"] == 401

    # Cognito ID token must be rejected
    resp_id_token = handler(
        _make_event(
            "GET",
            "/tasks",
            claims={"sub": "user-a", "token_use": "id", "exp": int(time.time()) + 60},
        ),
        None,
    )
    assert resp_id_token["statusCode"] == 401

    # Empty sub must be rejected
    resp_no_sub = handler(
        _make_event(
            "GET",
            "/tasks",
            claims={"sub": "   ", "token_use": "access", "exp": int(time.time()) + 60},
        ),
        None,
    )
    assert resp_no_sub["statusCode"] == 401

    # Expired token must be rejected
    resp_expired = handler(
        _make_event("GET", "/tasks", claims=_access_claims("user-a", exp_offset=-10)),
        None,
    )
    assert resp_expired["statusCode"] == 401


def test_full_crud_and_cross_user_isolation() -> None:
    repo = InMemoryTaskRepository()
    handler = create_handler(repo)
    claims_a = _access_claims("user-a-sub")
    claims_b = _access_claims("user-b-sub")

    # User A creates a task (base64 body + prefixed stage also exercised)
    create_resp = handler(
        _make_event(
            "POST",
            "/prod/tasks",
            stage="prod",
            claims=claims_a,
            body={
                "title": "Preparar demo de SD",
                "description": "Validar HTTPS e Cognito",
                "dueDate": "2026-11-27",
                "priority": "high",
                "status": "pending",
            },
            base64_body=True,
        ),
        None,
    )
    assert create_resp["statusCode"] == 201
    created = json.loads(create_resp["body"])
    task_id = created["id"]
    assert created["title"] == "Preparar demo de SD"
    assert "ownerId" not in created

    # User A lists and gets own task
    list_a = handler(_make_event("GET", "/tasks", claims=claims_a), None)
    assert list_a["statusCode"] == 200
    assert len(json.loads(list_a["body"])["items"]) == 1

    get_a = handler(_make_event("GET", f"/tasks/{task_id}", claims=claims_a), None)
    assert get_a["statusCode"] == 200
    assert json.loads(get_a["body"])["id"] == task_id

    # User B cannot list, read, update or delete User A's task (anti-IDOR -> 404)
    list_b = handler(_make_event("GET", "/tasks", claims=claims_b), None)
    assert list_b["statusCode"] == 200
    assert json.loads(list_b["body"])["items"] == []

    get_b = handler(_make_event("GET", f"/tasks/{task_id}", claims=claims_b), None)
    assert get_b["statusCode"] == 404

    patch_b = handler(
        _make_event(
            "PATCH",
            f"/tasks/{task_id}",
            claims=claims_b,
            body={"status": "done"},
        ),
        None,
    )
    assert patch_b["statusCode"] == 404

    del_b = handler(_make_event("DELETE", f"/tasks/{task_id}", claims=claims_b), None)
    assert del_b["statusCode"] == 404

    # User A updates own task
    patch_a = handler(
        _make_event(
            "PATCH",
            f"/tasks/{task_id}",
            claims=claims_a,
            body={"status": "in_progress", "title": "Demo de SD revisada"},
        ),
        None,
    )
    assert patch_a["statusCode"] == 200
    updated = json.loads(patch_a["body"])
    assert updated["status"] == "in_progress"
    assert updated["title"] == "Demo de SD revisada"

    # User A deletes own task -> 204, then GET -> 404
    del_a = handler(_make_event("DELETE", f"/tasks/{task_id}", claims=claims_a), None)
    assert del_a["statusCode"] == 204
    assert del_a["body"] == ""

    get_after_del = handler(_make_event("GET", f"/tasks/{task_id}", claims=claims_a), None)
    assert get_after_del["statusCode"] == 404


def test_validation_and_owner_injection_rejected() -> None:
    handler = create_handler(InMemoryTaskRepository())
    claims_a = _access_claims("user-a-sub")

    bad_json = handler(
        _make_event("POST", "/tasks", claims=claims_a, body="{not-json"),
        None,
    )
    assert bad_json["statusCode"] == 400
    assert json.loads(bad_json["body"])["error"]["code"] == "INVALID_JSON"

    owner_inject = handler(
        _make_event(
            "POST",
            "/tasks",
            claims=claims_a,
            body={"title": "Tarefa", "ownerId": "victim-sub"},
        ),
        None,
    )
    assert owner_inject["statusCode"] == 400
    assert json.loads(owner_inject["body"])["error"]["code"] == "VALIDATION_ERROR"


def test_unhandled_error_does_not_leak_stack_trace() -> None:
    class ExplodingRepo(InMemoryTaskRepository):
        def list_by_owner(self, owner_id: str) -> list[dict[str, Any]]:
            raise RuntimeError("sensitive internal db connection string")

    handler = create_handler(ExplodingRepo())
    resp = handler(_make_event("GET", "/tasks", claims=_access_claims("user-a")), None)
    assert resp["statusCode"] == 500
    parsed = json.loads(resp["body"])
    assert parsed == {
        "error": {"code": "INTERNAL_ERROR", "message": "Internal server error."}
    }
    assert "sensitive" not in resp["body"]
