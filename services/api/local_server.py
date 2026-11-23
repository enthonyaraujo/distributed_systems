"""DEV-ONLY local HTTP server wrapping the real Lambda handler in-memory.

Never packaged into the AWS Lambda ZIP. Intended only to exercise real HTTP
requests locally against the exact same `acadflow_api.handler` business code
before AWS provisioning is authorized.

Simulated development bearer tokens:
  - Authorization: Bearer dev-user-a     -> sub="dev-user-a", token_use="access"
  - Authorization: Bearer dev-user-b     -> sub="dev-user-b", token_use="access"
  - Authorization: Bearer dev-id-token   -> sub="dev-user-a", token_use="id" (rejected)
  - Authorization: Bearer dev-expired    -> sub="dev-user-a", token_use="access", exp=1 (rejected)
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

SRC_DIR = Path(__file__).resolve().parent / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from acadflow_api.handler import create_handler  # noqa: E402
from acadflow_api.page_repository import InMemoryPageRepository  # noqa: E402
from acadflow_api.repository import InMemoryTaskRepository  # noqa: E402

ALLOWED_DEV_ORIGINS = {"http://localhost:5173", "http://127.0.0.1:5173"}


def _dev_claims_from_auth_header(auth_header: str | None) -> dict[str, Any] | None:
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header[len("Bearer ") :].strip()
    future_exp = int(time.time()) + 3600
    mapping: dict[str, dict[str, Any]] = {
        "dev-user-a": {"sub": "dev-user-a", "token_use": "access", "exp": future_exp},
        "dev-user-b": {"sub": "dev-user-b", "token_use": "access", "exp": future_exp},
        "dev-id-token": {"sub": "dev-user-a", "token_use": "id", "exp": future_exp},
        "dev-expired": {"sub": "dev-user-a", "token_use": "access", "exp": 1},
    }
    return mapping.get(token)


def run_server(host: str = "127.0.0.1", port: int = 8000) -> None:
    repo = InMemoryTaskRepository()
    page_repo = InMemoryPageRepository()
    handler = create_handler(repo, page_repo)

    class DevRequestHandler(BaseHTTPRequestHandler):
        def _send_cors_headers(self) -> None:
            origin = self.headers.get("Origin", "")
            if origin in ALLOWED_DEV_ORIGINS:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            self.send_header(
                "Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS"
            )
            self.send_header(
                "Access-Control-Allow-Headers", "Authorization,Content-Type"
            )

        def do_OPTIONS(self) -> None:  # noqa: N802
            self.send_response(204)
            self._send_cors_headers()
            self.end_headers()

        def _dispatch(self, method: str) -> None:
            parsed = urlparse(self.path)
            content_length = int(self.headers.get("Content-Length", "0") or "0")
            body = (
                self.rfile.read(content_length).decode("utf-8")
                if content_length > 0
                else None
            )
            claims = _dev_claims_from_auth_header(self.headers.get("Authorization"))
            request_context: dict[str, Any] = {"http": {"method": method}}
            if claims is not None:
                request_context["authorizer"] = {"jwt": {"claims": claims}}

            event: dict[str, Any] = {
                "rawPath": parsed.path,
                "requestContext": request_context,
                "body": body,
                "isBase64Encoded": False,
            }
            response = handler(event, None)
            status = int(response["statusCode"])
            resp_body = response.get("body", "")

            self.send_response(status)
            self._send_cors_headers()
            for k, v in response.get("headers", {}).items():
                self.send_header(k, v)
            self.end_headers()
            if resp_body:
                self.wfile.write(resp_body.encode("utf-8"))

        def do_GET(self) -> None:  # noqa: N802
            self._dispatch("GET")

        def do_POST(self) -> None:  # noqa: N802
            self._dispatch("POST")

        def do_PATCH(self) -> None:  # noqa: N802
            self._dispatch("PATCH")

        def do_DELETE(self) -> None:  # noqa: N802
            self._dispatch("DELETE")

        def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
            # Never log Authorization headers or tokens
            print(f"[local-api] {self.address_string()} - {format % args}")

    server = HTTPServer((host, port), DevRequestHandler)
    print(f"AcadFlow local dev API listening on http://{host}:{port}")
    print("Note: DEV-ONLY in-memory server. Never deploy this file to AWS Lambda.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping local dev API.")
    finally:
        server.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AcadFlow local dev API server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    run_server(host=args.host, port=args.port)
