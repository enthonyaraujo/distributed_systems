"""Sanitized HTTP E2E acceptance test suite for AcadFlow (AC-02 through AC-10).

Reads bearer tokens exclusively from environment variables so secrets never
appear in command history, stdout or evidence files:
  - ACADFLOW_TOKEN_A     (required for authenticated checks: User A access_token)
  - ACADFLOW_TOKEN_B     (optional for AC-09 anti-IDOR checks: User B access_token)
  - ACADFLOW_ID_TOKEN_A  (optional for AC-04 ID token rejection check)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any


def _http_request(
    method: str,
    url: str,
    *,
    token: str | None = None,
    payload: dict[str, Any] | None = None,
) -> tuple[int, Any]:
    headers: dict[str, str] = {"Accept": "application/json"}
    data: bytes | None = None
    if token is not None:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(url=url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        try:
            body = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            body = raw
        return err.code, body


def _assert(condition: bool, label: str, detail: str) -> None:
    prefix = "PASS" if condition else "FAIL"
    print(f"[{prefix}] {label} — {detail}")
    if not condition:
        raise AssertionError(f"{label}: {detail}")


def run_suite(api_url: str) -> int:
    base = api_url.rstrip("/")
    token_a = os.environ.get("ACADFLOW_TOKEN_A", "").strip()
    token_b = os.environ.get("ACADFLOW_TOKEN_B", "").strip()
    id_token_a = os.environ.get("ACADFLOW_ID_TOKEN_A", "").strip()

    # AC-02: Public health check
    status, body = _http_request("GET", f"{base}/health")
    _assert(status == 200 and isinstance(body, dict) and body.get("status") == "ok", "AC-02 GET /health", f"status={status}")

    # AC-03: Unauthenticated request rejected
    status, _ = _http_request("GET", f"{base}/tasks")
    _assert(status in {401, 403}, "AC-03 GET /tasks without token", f"status={status}")

    # AC-04: Invalid token rejected
    status, _ = _http_request("GET", f"{base}/tasks", token="invalid.jwt.token")
    _assert(status in {401, 403}, "AC-04 GET /tasks invalid token", f"status={status}")

    if id_token_a:
        status, _ = _http_request("GET", f"{base}/tasks", token=id_token_a)
        _assert(status in {401, 403}, "AC-04 GET /tasks with ID token rejected", f"status={status}")
    else:
        print("[SKIP] AC-04 ID token check — set ACADFLOW_ID_TOKEN_A to verify.")

    if not token_a:
        print("[SKIP] AC-05..AC-10 authenticated CRUD checks — set ACADFLOW_TOKEN_A.")
        return 0

    # AC-10: Invalid payload & ownerId injection rejected
    status, _ = _http_request(
        "POST",
        f"{base}/tasks",
        token=token_a,
        payload={"title": "", "status": "invalid"},
    )
    _assert(status == 400, "AC-10 POST /tasks invalid payload", f"status={status}")

    status, _ = _http_request(
        "POST",
        f"{base}/tasks",
        token=token_a,
        payload={"title": "Tentativa", "ownerId": "other-user"},
    )
    _assert(status == 400, "AC-10 POST /tasks rejects client ownerId", f"status={status}")

    # AC-06: Create task
    status, created = _http_request(
        "POST",
        f"{base}/tasks",
        token=token_a,
        payload={
            "title": "Smoke test AcadFlow",
            "description": "Validacao automatizada",
            "dueDate": "2026-11-27",
            "priority": "high",
            "status": "pending",
        },
    )
    _assert(status == 201 and isinstance(created, dict) and "id" in created, "AC-06 POST /tasks", f"status={status}")
    task_id = created["id"]

    # AC-05: List own tasks
    status, listed = _http_request("GET", f"{base}/tasks", token=token_a)
    ids = [item.get("id") for item in (listed or {}).get("items", [])] if isinstance(listed, dict) else []
    _assert(status == 200 and task_id in ids, "AC-05 GET /tasks", f"status={status}, count={len(ids)}")

    # AC-07: Update task
    status, updated = _http_request(
        "PATCH",
        f"{base}/tasks/{task_id}",
        token=token_a,
        payload={"status": "in_progress"},
    )
    _assert(status == 200 and isinstance(updated, dict) and updated.get("status") == "in_progress", "AC-07 PATCH /tasks/{id}", f"status={status}")

    # AC-09: Cross-user isolation
    if token_b:
        for method, extra_payload in [
            ("GET", None),
            ("PATCH", {"status": "done"}),
            ("DELETE", None),
        ]:
            status, _ = _http_request(
                method,
                f"{base}/tasks/{task_id}",
                token=token_b,
                payload=extra_payload,
            )
            _assert(status == 404, f"AC-09 User B {method} User A task", f"status={status}")
    else:
        print("[SKIP] AC-09 cross-user isolation — set ACADFLOW_TOKEN_B to verify.")

    # AC-08: Delete own task
    status, _ = _http_request("DELETE", f"{base}/tasks/{task_id}", token=token_a)
    _assert(status == 204, "AC-08 DELETE /tasks/{id}", f"status={status}")

    status, _ = _http_request("GET", f"{base}/tasks/{task_id}", token=token_a)
    _assert(status == 404, "AC-08 GET deleted task returns 404", f"status={status}")

    # --- P1 Workspace Pages (/pages) checks ---
    status, _ = _http_request("GET", f"{base}/pages")
    _assert(status in {401, 403}, "AC-P1-02 GET /pages without token", f"status={status}")

    if id_token_a:
        status, _ = _http_request("GET", f"{base}/pages", token=id_token_a)
        _assert(status in {401, 403}, "AC-P1-02 GET /pages ID token rejected", f"status={status}")

    status, _ = _http_request(
        "POST",
        f"{base}/pages",
        token=token_a,
        payload={"title": "Injeção", "ownerId": "other-user"},
    )
    _assert(status == 400, "AC-P1-02 POST /pages rejects client ownerId", f"status={status}")

    status, page = _http_request(
        "POST",
        f"{base}/pages",
        token=token_a,
        payload={
            "title": "Anotação Smoke Test",
            "icon": "📘",
            "content": {
                "type": "doc",
                "content": [
                    {"type": "paragraph", "content": [{"type": "text", "text": "Conteúdo inicial"}]}
                ],
            },
        },
    )
    _assert(
        status == 201 and isinstance(page, dict) and page.get("version") == 1,
        "AC-P1-01 POST /pages",
        f"status={status}",
    )
    page_id = page["id"]

    status, pages_list = _http_request("GET", f"{base}/pages", token=token_a)
    p_ids = [p.get("id") for p in (pages_list or {}).get("items", [])] if isinstance(pages_list, dict) else []
    _assert(status == 200 and page_id in p_ids, "AC-P1-01 GET /pages", f"status={status}, count={len(p_ids)}")

    status, page_updated = _http_request(
        "PATCH",
        f"{base}/pages/{page_id}",
        token=token_a,
        payload={"title": "Anotação Atualizada", "expectedVersion": 1},
    )
    _assert(
        status == 200 and isinstance(page_updated, dict) and page_updated.get("version") == 2,
        "AC-P1-01 PATCH /pages/{id}",
        f"status={status}",
    )

    status, _ = _http_request(
        "PATCH",
        f"{base}/pages/{page_id}",
        token=token_a,
        payload={"title": "Versão obsoleta", "expectedVersion": 1},
    )
    _assert(status == 409, "AC-P1-03 PATCH /pages/{id} stale version conflict", f"status={status}")

    if token_b:
        for method, extra_payload in [
            ("GET", None),
            ("PATCH", {"title": "Cross-user", "expectedVersion": 2}),
            ("DELETE", None),
        ]:
            status, _ = _http_request(
                method,
                f"{base}/pages/{page_id}",
                token=token_b,
                payload=extra_payload,
            )
            _assert(status == 404, f"AC-P1-02 User B {method} User A page", f"status={status}")

    status, _ = _http_request("DELETE", f"{base}/pages/{page_id}", token=token_a)
    _assert(status == 204, "AC-P1-01 DELETE /pages/{id}", f"status={status}")

    status, _ = _http_request("GET", f"{base}/pages/{page_id}", token=token_a)
    _assert(status == 404, "AC-P1-01 GET deleted page returns 404", f"status={status}")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="AcadFlow HTTP smoke/acceptance tests.")
    parser.add_argument("--api-url", required=True, help="Base API URL (e.g. https://api.<...>)")
    args = parser.parse_args()
    try:
        return run_suite(args.api_url)
    except AssertionError as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
