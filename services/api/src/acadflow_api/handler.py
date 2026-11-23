from __future__ import annotations

import base64
import json
import logging
import os
import time
from typing import Any, Callable

from acadflow_api.errors import (
    ApiError,
    InvalidJsonError,
    NotFoundError,
    UnauthorizedError,
    error_response,
    json_response,
)
from acadflow_api.page_repository import DynamoDBPageRepository, PageRepository
from acadflow_api.page_service import PageService
from acadflow_api.repository import DynamoDBTaskRepository, TaskRepository
from acadflow_api.service import TaskService

logger = logging.getLogger(__name__)

_DEFAULT_REPOSITORY: TaskRepository | None = None
_DEFAULT_PAGE_REPOSITORY: PageRepository | None = None


def _get_default_repository() -> TaskRepository:
    global _DEFAULT_REPOSITORY
    if _DEFAULT_REPOSITORY is None:
        table_name = os.environ.get("TASKS_TABLE", "").strip()
        if not table_name:
            raise RuntimeError("Environment variable TASKS_TABLE is not configured.")
        _DEFAULT_REPOSITORY = DynamoDBTaskRepository(table_name=table_name)
    return _DEFAULT_REPOSITORY


def _get_default_page_repository() -> PageRepository:
    global _DEFAULT_PAGE_REPOSITORY
    if _DEFAULT_PAGE_REPOSITORY is None:
        table_name = os.environ.get("PAGES_TABLE", "").strip()
        if not table_name:
            raise RuntimeError("Environment variable PAGES_TABLE is not configured.")
        _DEFAULT_PAGE_REPOSITORY = DynamoDBPageRepository(table_name=table_name)
    return _DEFAULT_PAGE_REPOSITORY


def extract_authenticated_owner_id(event: dict[str, Any]) -> str:
    """Extract and strictly validate ownerId (sub) from API Gateway JWT claims.

    Defense-in-depth rules:
    - Requires non-empty string claim `sub`.
    - Requires `token_use == "access"` (rejects missing `token_use` and ID tokens).
    - Rejects expired tokens if `exp` claim is present and in the past.
    """
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims")
    )
    if not isinstance(claims, dict):
        raise UnauthorizedError("Missing verified JWT claims.")

    token_use = claims.get("token_use")
    if token_use != "access":
        raise UnauthorizedError("A valid Cognito access token is required.")

    sub = claims.get("sub")
    if not isinstance(sub, str) or not sub.strip():
        raise UnauthorizedError("Token subject claim ('sub') is missing.")

    exp_raw = claims.get("exp")
    if exp_raw is not None:
        try:
            exp_ts = float(exp_raw)
        except (TypeError, ValueError) as exc:
            raise UnauthorizedError("Invalid token expiration claim.") from exc
        if exp_ts <= time.time():
            raise UnauthorizedError("Token has expired.")

    return sub.strip()


def _parse_json_body(event: dict[str, Any]) -> Any:
    raw_body = event.get("body")
    if raw_body is None or raw_body == "":
        raise InvalidJsonError("Request body is required.")

    if event.get("isBase64Encoded"):
        try:
            raw_body = base64.b64decode(raw_body).decode("utf-8")
        except Exception as exc:
            raise InvalidJsonError("Unable to decode base64 request body.") from exc

    if isinstance(raw_body, str):
        try:
            return json.loads(raw_body)
        except json.JSONDecodeError as exc:
            raise InvalidJsonError() from exc

    return raw_body


def _normalize_path(event: dict[str, Any]) -> str:
    raw_path = str(event.get("rawPath") or event.get("path") or "/")
    stage = event.get("requestContext", {}).get("stage")
    if stage and stage != "$default":
        prefix = f"/{stage}"
        if raw_path == prefix:
            raw_path = "/"
        elif raw_path.startswith(prefix + "/"):
            raw_path = raw_path[len(prefix) :]
    if len(raw_path) > 1 and raw_path.endswith("/"):
        raw_path = raw_path[:-1]
    return raw_path


def _extract_method(event: dict[str, Any]) -> str:
    http_ctx = event.get("requestContext", {}).get("http", {})
    method = http_ctx.get("method") or event.get("httpMethod") or ""
    return str(method).upper()


def _extract_resource_id(
    event: dict[str, Any], path: str, prefix: str
) -> str | None:
    path_params = event.get("pathParameters")
    if isinstance(path_params, dict) and path_params.get("id"):
        return str(path_params["id"]).strip()
    if path.startswith(prefix):
        remainder = path[len(prefix) :]
        if remainder and "/" not in remainder:
            return remainder.strip()
    return None


def create_handler(
    repository: TaskRepository | None = None,
    page_repository: PageRepository | None = None,
) -> Callable[[dict[str, Any], Any], dict[str, Any]]:
    """Create a Lambda handler bound to the provided repositories (for DI/tests)."""

    def _handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
        try:
            method = _extract_method(event)
            path = _normalize_path(event)

            if method == "GET" and path == "/health":
                return json_response(
                    200, {"status": "ok", "service": "acadflow-api"}
                )

            if path == "/tasks" or path.startswith("/tasks/"):
                repo = (
                    repository
                    if repository is not None
                    else _get_default_repository()
                )
                service = TaskService(repo)

                if path == "/tasks":
                    owner_id = extract_authenticated_owner_id(event)
                    if method == "GET":
                        return json_response(
                            200, {"items": service.list_tasks(owner_id)}
                        )
                    if method == "POST":
                        payload = _parse_json_body(event)
                        created = service.create_task(owner_id, payload)
                        return json_response(201, created)
                    raise ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.")

                task_id = _extract_resource_id(event, path, "/tasks/")
                if task_id is not None:
                    owner_id = extract_authenticated_owner_id(event)
                    if method == "GET":
                        return json_response(200, service.get_task(owner_id, task_id))
                    if method == "PATCH":
                        payload = _parse_json_body(event)
                        updated = service.update_task(owner_id, task_id, payload)
                        return json_response(200, updated)
                    if method == "DELETE":
                        service.delete_task(owner_id, task_id)
                        return json_response(204)
                    raise ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.")

            if path == "/pages" or path.startswith("/pages/"):
                p_repo = (
                    page_repository
                    if page_repository is not None
                    else _get_default_page_repository()
                )
                page_service = PageService(p_repo)

                if path == "/pages":
                    owner_id = extract_authenticated_owner_id(event)
                    if method == "GET":
                        return json_response(
                            200, {"items": page_service.list_pages(owner_id)}
                        )
                    if method == "POST":
                        payload = _parse_json_body(event)
                        created = page_service.create_page(owner_id, payload)
                        return json_response(201, created)
                    raise ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.")

                page_id = _extract_resource_id(event, path, "/pages/")
                if page_id is not None:
                    owner_id = extract_authenticated_owner_id(event)
                    if method == "GET":
                        return json_response(
                            200, page_service.get_page(owner_id, page_id)
                        )
                    if method == "PATCH":
                        payload = _parse_json_body(event)
                        updated = page_service.update_page(owner_id, page_id, payload)
                        return json_response(200, updated)
                    if method == "DELETE":
                        page_service.delete_page(owner_id, page_id)
                        return json_response(204)
                    raise ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.")

            raise NotFoundError("Route not found.")

        except ApiError as err:
            return error_response(err)
        except Exception:
            logger.exception("Unhandled error while processing AcadFlow API request.")
            return json_response(
                500,
                {
                    "error": {
                        "code": "INTERNAL_ERROR",
                        "message": "Internal server error.",
                    }
                },
            )

    return _handler


lambda_handler = create_handler()
