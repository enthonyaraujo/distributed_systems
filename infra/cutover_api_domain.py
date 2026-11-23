"""Controlled Step C API custom domain cutover script with automatic rollback.

Updates existing root ApiMapping `mqdslq` on
`api.enthonyaraujo.grupo-03.sd.ufersa.dev.br` from `war28zsged` to `u0mxrf6mnk`
after verifying pre-cutover health and capturing an exact rollback snapshot.
Preserves `war28zsged` and all prior evaluation resources untouched.
"""

from __future__ import annotations

import json
import ssl
import socket
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import boto3

REGION = "us-east-1"
DOMAIN_NAME = "api.enthonyaraujo.grupo-03.sd.ufersa.dev.br"
MAPPING_ID = "mqdslq"
OLD_API_ID = "war28zsged"
NEW_API_ID = "u0mxrf6mnk"
STAGE = "$default"
MAPPING_KEY = ""
TEMP_API_URL = f"https://{NEW_API_ID}.execute-api.{REGION}.amazonaws.com"
PROD_API_URL = f"https://{DOMAIN_NAME}"
FRONTEND_ORIGIN = "https://enthonyaraujo.grupo-03.sd.ufersa.dev.br"

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_FILE = REPO_ROOT / "infra" / "deploy_state.json"


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


def _verify_tls_cert(hostname: str) -> dict[str, Any]:
    ctx = ssl.create_default_context()
    with socket.create_connection((hostname, 443), timeout=15) as sock:
        with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
            cert = ssock.getpeercert()
            return {
                "subject": cert.get("subject"),
                "notAfter": cert.get("notAfter"),
                "tlsVersion": ssock.version(),
            }


def _rollback(apigw: Any) -> None:
    print("!!! CRITICAL VALIDATION FAILED — EXECUTING ROLLBACK TO war28zsged !!!")
    apigw.update_api_mapping(
        ApiMappingId=MAPPING_ID,
        DomainName=DOMAIN_NAME,
        ApiId=OLD_API_ID,
        Stage=STAGE,
        ApiMappingKey=MAPPING_KEY,
    )
    time.sleep(2)
    mappings = apigw.get_api_mappings(DomainName=DOMAIN_NAME).get("Items", [])
    restored = next((m for m in mappings if m["ApiMappingId"] == MAPPING_ID), None)
    print("ROLLBACK VERIFICATION:", json.dumps(restored, indent=2))
    if not restored or restored.get("ApiId") != OLD_API_ID:
        raise RuntimeError("Rollback verification failed!")


def main() -> int:
    session = boto3.Session(region_name=REGION)
    apigw = session.client("apigatewayv2")

    # 1. Pre-cutover health check on temporary URL
    st, _, body = _http("GET", f"{TEMP_API_URL}/health")
    if st != 200 or json.loads(body).get("status") != "ok":
        print(f"ABORT: Temporary API URL failed health check (status={st})", file=sys.stderr)
        return 1
    print(f"[PASS] Pre-cutover temp API health OK ({TEMP_API_URL}/health -> 200)")

    # 2. Snapshot current mapping & confirm identifiers
    mappings = apigw.get_api_mappings(DomainName=DOMAIN_NAME).get("Items", [])
    current = next((m for m in mappings if m["ApiMappingId"] == MAPPING_ID), None)
    if not current:
        print(f"ABORT: Mapping {MAPPING_ID} not found on {DOMAIN_NAME}", file=sys.stderr)
        return 1
    print("[SNAPSHOT] Current mapping before cutover:")
    print(json.dumps(current, indent=2))

    # 3. Execute controlled UpdateApiMapping (idempotent if already u0mxrf6mnk)
    if current.get("ApiId") == OLD_API_ID:
        updated = apigw.update_api_mapping(
            ApiMappingId=MAPPING_ID,
            DomainName=DOMAIN_NAME,
            ApiId=NEW_API_ID,
            Stage=STAGE,
            ApiMappingKey=MAPPING_KEY,
        )
        print(
            f"[UPDATED] ApiMapping {MAPPING_ID}: {OLD_API_ID} -> {updated['ApiId']} "
            f"(Stage={updated['Stage']}, Key='{updated.get('ApiMappingKey', '')}')"
        )
    elif current.get("ApiId") == NEW_API_ID:
        print(f"[OK] ApiMapping {MAPPING_ID} already points to {NEW_API_ID}")
    else:
        print(f"ABORT: Unexpected ApiId on {MAPPING_ID}: {current.get('ApiId')}", file=sys.stderr)
        return 1

    # 4. Validate cutover over institutional HTTPS (retry briefly for edge propagation)
    try:
        tls_info = _verify_tls_cert(DOMAIN_NAME)
        print("[PASS] TLS certificate valid:", json.dumps(tls_info))

        health_ok = False
        last_status = 0
        last_body = ""
        for _ in range(10):
            last_status, _, last_body = _http("GET", f"{PROD_API_URL}/health")
            try:
                parsed = json.loads(last_body)
            except json.JSONDecodeError:
                parsed = {}
            if last_status == 200 and parsed == {"status": "ok", "service": "acadflow-api"}:
                health_ok = True
                break
            time.sleep(2)
        if not health_ok:
            raise AssertionError(
                f"GET {PROD_API_URL}/health returned status={last_status}, body={last_body[:160]}"
            )
        print(f"[PASS] HTTPS GET {PROD_API_URL}/health -> 200 (acadflow-api)")

        for path in ("/tasks", "/pages"):
            st, _, _ = _http("GET", f"{PROD_API_URL}{path}")
            if st != 401:
                raise AssertionError(f"GET {path} without token expected 401, got {st}")
            print(f"[PASS] HTTPS GET {PROD_API_URL}{path} (no token) -> 401")

            st, _, _ = _http(
                "GET",
                f"{PROD_API_URL}{path}",
                headers={"Authorization": "Bearer invalid.jwt.token"},
            )
            if st != 401:
                raise AssertionError(f"GET {path} invalid token expected 401, got {st}")
            print(f"[PASS] HTTPS GET {PROD_API_URL}{path} (invalid token) -> 401")

            st, hdrs, _ = _http(
                "OPTIONS",
                f"{PROD_API_URL}{path}",
                headers={
                    "Origin": FRONTEND_ORIGIN,
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "Authorization,Content-Type",
                },
            )
            if st not in {200, 204} or hdrs.get("access-control-allow-origin") != FRONTEND_ORIGIN:
                raise AssertionError(
                    f"CORS OPTIONS {path} failed: status={st}, allow-origin={hdrs.get('access-control-allow-origin')}"
                )
            print(f"[PASS] CORS OPTIONS {PROD_API_URL}{path} ({FRONTEND_ORIGIN}) -> {st}")

        # Verify unauthorized origin blocked
        st, hdrs, _ = _http(
            "OPTIONS",
            f"{PROD_API_URL}/tasks",
            headers={
                "Origin": "https://unauthorized.example",
                "Access-Control-Request-Method": "GET",
            },
        )
        if hdrs.get("access-control-allow-origin") == "https://unauthorized.example":
            raise AssertionError("CORS allowed unauthorized origin!")
        print("[PASS] CORS OPTIONS blocks unauthorized origin")

        # Confirm previous API war28zsged is preserved intact
        old_api = apigw.get_api(ApiId=OLD_API_ID)
        print(
            f"[PASS] Previous API preserved intact: {old_api['Name']} "
            f"({old_api['ApiId']} -> {old_api['ApiEndpoint']})"
        )

    except Exception as exc:
        print(f"ERROR during post-cutover verification: {exc}", file=sys.stderr)
        _rollback(apigw)
        return 1

    # Save non-secret checkpoint
    if STATE_FILE.exists():
        state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        state["apiCustomDomain"] = PROD_API_URL
        state["apiCutoverCompletedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print("\n=== STEP C OFFICIAL API CUTOVER VERIFIED SUCCESSFULLY ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
