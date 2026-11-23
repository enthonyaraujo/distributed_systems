"""Step B real AWS verification suite for AcadFlow (us-east-1).

Validates:
1. Real HTTPS API Gateway HTTP API (temp URL): /health, 401 without token,
   401 invalid token, CORS allowed vs disallowed origins.
2. Real AWS Lambda (python3.12) + Real DynamoDB (acadflow-tasks & acadflow-pages)
   via lambda:Invoke: strict JWT claim validation (missing token_use, ID token),
   CRUD persistence, Tiptap ProseMirror JSON round-trip, optimistic locking 409,
   anti-IDOR cross-user 404, and clean teardown.
3. CloudWatch Logs presence for /aws/lambda/acadflow-api.
4. Cognito Hosted UI HTTPS endpoint check for temp & institutional callback URLs.

Does NOT touch prior evaluation resources and prints ZERO secrets or tokens.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

import boto3

STATE_FILE = Path(__file__).resolve().parents[2] / "infra" / "deploy_state.json"


def _http(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
) -> tuple[int, dict[str, str], str]:
    req = urllib.request.Request(url=url, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return (
                resp.status,
                {k.lower(): v for k, v in resp.headers.items()},
                resp.read().decode("utf-8", errors="replace"),
            )
    except urllib.error.HTTPError as err:
        return (
            err.code,
            {k.lower(): v for k, v in err.headers.items()},
            err.read().decode("utf-8", errors="replace"),
        )


def _check(cond: bool, name: str, detail: str) -> None:
    print(f"[{'PASS' if cond else 'FAIL'}] {name} — {detail}")
    if not cond:
        raise AssertionError(f"{name}: {detail}")


def _invoke_lambda(
    lam_client: Any,
    fn_name: str,
    method: str,
    path: str,
    *,
    claims: dict[str, Any] | None = None,
    body: dict[str, Any] | None = None,
) -> tuple[int, Any]:
    req_ctx: dict[str, Any] = {"http": {"method": method}}
    if claims is not None:
        req_ctx["authorizer"] = {"jwt": {"claims": claims}}
    event: dict[str, Any] = {
        "rawPath": path,
        "requestContext": req_ctx,
        "body": json.dumps(body, ensure_ascii=False) if body is not None else None,
        "isBase64Encoded": False,
    }
    resp = lam_client.invoke(
        FunctionName=fn_name,
        InvocationType="RequestResponse",
        Payload=json.dumps(event).encode("utf-8"),
    )
    if resp.get("FunctionError"):
        raise RuntimeError(f"Lambda FunctionError: {resp['FunctionError']}")
    payload = json.loads(resp["Payload"].read().decode("utf-8"))
    status = int(payload["statusCode"])
    raw_body = payload.get("body", "")
    parsed = json.loads(raw_body) if raw_body else None
    return status, parsed


def main() -> int:
    state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    api_url = state["httpApiEndpoint"].rstrip("/")
    fn_name = state["lambdaName"]
    region = state["region"]
    amplify_url = state["amplifyBranchUrl"]
    prod_url = "https://enthonyaraujo.grupo-03.sd.ufersa.dev.br"

    print("=== B1: Real HTTPS API Gateway HTTP API (Temporary URL) ===")
    status, _, body = _http("GET", f"{api_url}/health")
    _check(
        status == 200 and json.loads(body).get("status") == "ok",
        "HTTPS GET /health",
        f"status={status}",
    )

    for path in ("/tasks", "/pages"):
        status, _, _ = _http("GET", f"{api_url}{path}")
        _check(status == 401, f"HTTPS GET {path} (no token)", f"status={status}")

        status, _, _ = _http(
            "GET",
            f"{api_url}{path}",
            headers={"Authorization": "Bearer invalid.jwt.token"},
        )
        _check(status == 401, f"HTTPS GET {path} (invalid token)", f"status={status}")

    # CORS verification (allowed vs unauthorized origins)
    for origin in (amplify_url, prod_url):
        status, hdrs, _ = _http(
            "OPTIONS",
            f"{api_url}/tasks",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Authorization,Content-Type",
            },
        )
        _check(
            status in {200, 204} and hdrs.get("access-control-allow-origin") == origin,
            f"CORS OPTIONS allowed ({origin})",
            f"status={status}, allow-origin={hdrs.get('access-control-allow-origin')}",
        )

    status, hdrs, _ = _http(
        "OPTIONS",
        f"{api_url}/tasks",
        headers={
            "Origin": "https://unauthorized.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    _check(
        hdrs.get("access-control-allow-origin") != "https://unauthorized.example",
        "CORS OPTIONS blocks unauthorized origin",
        f"allow-origin={hdrs.get('access-control-allow-origin')}",
    )

    print("\n=== B2: Real AWS Lambda (python3.12) + Real DynamoDB ===")
    session = boto3.Session(region_name=region)
    lam = session.client("lambda")
    exp = int(time.time()) + 3600
    claims_a = {"sub": "aws-verify-user-a", "token_use": "access", "exp": exp}
    claims_b = {"sub": "aws-verify-user-b", "token_use": "access", "exp": exp}

    # Strict Lambda JWT claim checks
    st, _ = _invoke_lambda(
        lam, fn_name, "GET", "/tasks", claims={"sub": "aws-verify-user-a", "exp": exp}
    )
    _check(st == 401, "Lambda python3.12 rejects missing token_use", f"status={st}")

    st, _ = _invoke_lambda(
        lam,
        fn_name,
        "GET",
        "/tasks",
        claims={"sub": "aws-verify-user-a", "token_use": "id", "exp": exp},
    )
    _check(st == 401, "Lambda python3.12 rejects ID token", f"status={st}")

    # Real DynamoDB acadflow-tasks CRUD + isolation + validation
    st, _ = _invoke_lambda(
        lam,
        fn_name,
        "POST",
        "/tasks",
        claims=claims_a,
        body={"title": "Inject", "ownerId": "other"},
    )
    _check(st == 400, "DynamoDB /tasks rejects client ownerId", f"status={st}")

    st, task = _invoke_lambda(
        lam,
        fn_name,
        "POST",
        "/tasks",
        claims=claims_a,
        body={
            "title": "Validacao Real AWS Lambda 3.12",
            "description": "Persistencia real DynamoDB",
            "dueDate": "2026-11-27",
            "priority": "high",
            "status": "pending",
        },
    )
    _check(st == 201 and "id" in task, "DynamoDB POST /tasks", f"status={st}")
    task_id = task["id"]

    st, listed = _invoke_lambda(lam, fn_name, "GET", "/tasks", claims=claims_a)
    _check(
        st == 200 and any(t["id"] == task_id for t in listed["items"]),
        "DynamoDB GET /tasks (Query)",
        f"status={st}",
    )

    st, updated = _invoke_lambda(
        lam,
        fn_name,
        "PATCH",
        f"/tasks/{task_id}",
        claims=claims_a,
        body={"status": "in_progress"},
    )
    _check(
        st == 200 and updated["status"] == "in_progress",
        "DynamoDB PATCH /tasks/{id}",
        f"status={st}",
    )

    for m, b in (("GET", None), ("PATCH", {"status": "done"}), ("DELETE", None)):
        st, _ = _invoke_lambda(lam, fn_name, m, f"/tasks/{task_id}", claims=claims_b, body=b)
        _check(st == 404, f"DynamoDB User B {m} User A task -> 404", f"status={st}")

    st, _ = _invoke_lambda(lam, fn_name, "DELETE", f"/tasks/{task_id}", claims=claims_a)
    _check(st == 204, "DynamoDB DELETE /tasks/{id}", f"status={st}")

    # Real DynamoDB acadflow-pages CRUD + Tiptap JSON + 409 conflict + isolation
    tiptap_doc = {
        "type": "doc",
        "content": [
            {
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": "Resumo Real AWS"}],
            },
            {
                "type": "taskList",
                "content": [
                    {
                        "type": "taskItem",
                        "attrs": {"checked": True},
                        "content": [
                            {"type": "paragraph", "content": [{"type": "text", "text": "DynamoDB validado"}]}
                        ],
                    }
                ],
            },
            {
                "type": "blockquote",
                "content": [
                    {"type": "paragraph", "content": [{"type": "text", "text": "Arquitetura 3 camadas"}]}
                ],
            },
        ],
    }
    st, page = _invoke_lambda(
        lam,
        fn_name,
        "POST",
        "/pages",
        claims=claims_a,
        body={"title": "Pagina Real AWS", "icon": "📘", "content": tiptap_doc},
    )
    _check(
        st == 201 and page["version"] == 1 and page["content"] == tiptap_doc,
        "DynamoDB POST /pages (Tiptap ProseMirror JSON)",
        f"status={st}, version={page.get('version')}",
    )
    page_id = page["id"]

    st, page_get = _invoke_lambda(lam, fn_name, "GET", f"/pages/{page_id}", claims=claims_a)
    _check(
        st == 200 and page_get["content"] == tiptap_doc and isinstance(page_get["version"], int),
        "DynamoDB GET /pages/{id} (Decimal->int & AST integrity)",
        f"status={st}",
    )

    st, page_patch = _invoke_lambda(
        lam,
        fn_name,
        "PATCH",
        f"/pages/{page_id}",
        claims=claims_a,
        body={"title": "Pagina Real AWS v2", "expectedVersion": 1},
    )
    _check(
        st == 200 and page_patch["version"] == 2,
        "DynamoDB PATCH /pages/{id} (version 1 -> 2)",
        f"status={st}, version={page_patch.get('version')}",
    )

    st, conflict_body = _invoke_lambda(
        lam,
        fn_name,
        "PATCH",
        f"/pages/{page_id}",
        claims=claims_a,
        body={"title": "Conflito", "expectedVersion": 1},
    )
    _check(
        st == 409 and conflict_body["error"]["code"] == "VERSION_CONFLICT",
        "DynamoDB PATCH /pages/{id} optimistic locking -> 409",
        f"status={st}",
    )

    for m, b in (("GET", None), ("PATCH", {"title": "Hack", "expectedVersion": 2}), ("DELETE", None)):
        st, _ = _invoke_lambda(lam, fn_name, m, f"/pages/{page_id}", claims=claims_b, body=b)
        _check(st == 404, f"DynamoDB User B {m} User A page -> 404", f"status={st}")

    st, _ = _invoke_lambda(lam, fn_name, "DELETE", f"/pages/{page_id}", claims=claims_a)
    _check(st == 204, "DynamoDB DELETE /pages/{id}", f"status={st}")

    print("\n=== B3: CloudWatch Logs & Cognito Hosted UI Check ===")
    logs = session.client("logs")
    lg = logs.describe_log_groups(logGroupNamePrefix=f"/aws/lambda/{fn_name}").get("logGroups", [])
    _check(len(lg) >= 1, "CloudWatch Log Group created", f"count={len(lg)}")

    for cb_origin in (amplify_url, prod_url):
        q = urllib.parse.urlencode(
            {
                "client_id": state["cognitoClientId"],
                "response_type": "code",
                "scope": "openid email profile",
                "redirect_uri": f"{cb_origin}/auth/callback",
            }
        )
        cog_url = f"https://{state['cognitoDomain']}/oauth2/authorize?{q}"
        status, _, html = _http("GET", cog_url)
        _check(
            status == 200 and "redirect_mismatch" not in html.lower(),
            f"Cognito Hosted UI accepts callback ({cb_origin})",
            f"status={status}",
        )

    print("\nALL STEP B REAL AWS CHECKS PASSED!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
