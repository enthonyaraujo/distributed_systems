"""Automated read-only production verification for both institutional HTTPS domains.

Verifies:
1. Valid TLS certificates on both institutional domains.
2. Live Amplify frontend serves all 5 SPA routes (200 OK) AND its live JS bundle
   points exclusively to `https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br`
   (not the temporary execute-api URL).
3. Institutional API domain serves GET /health (200), rejects unauthenticated and
   invalid JWT calls to /tasks and /pages (401), and enforces CORS strictly for
   `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br`.
4. Cognito Hosted UI accepts the institutional callback URL (200 OK).
"""

from __future__ import annotations

import json
import re
import socket
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request

FRONTEND_HOST = "enthonyaraujo.grupo-03.sd.ufersa.dev.br"
API_HOST = "api.enthonyaraujo.grupo-03.sd.ufersa.dev.br"
FRONTEND_URL = f"https://{FRONTEND_HOST}"
API_URL = f"https://{API_HOST}"
TEMP_API_HOST = "u0mxrf6mnk.execute-api.us-east-1.amazonaws.com"
COGNITO_DOMAIN = "acadflow-enthony-sd.auth.us-east-1.amazoncognito.com"
COGNITO_CLIENT_ID = "30f7tlmajc9moo6tr5q06pmkg3"


def _http(
    method: str, url: str, headers: dict[str, str] | None = None
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


def _check(cond: bool, label: str, detail: str) -> None:
    print(f"[{'PASS' if cond else 'FAIL'}] {label} — {detail}")
    if not cond:
        raise AssertionError(f"{label}: {detail}")


def _check_tls(host: str) -> str:
    ctx = ssl.create_default_context()
    with socket.create_connection((host, 443), timeout=15) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as ssock:
            cert = ssock.getpeercert()
            return f"tls={ssock.version()}, notAfter={cert.get('notAfter')}"


def main() -> int:
    # 1. TLS certificates on both institutional domains
    _check(True, f"TLS {FRONTEND_HOST}", _check_tls(FRONTEND_HOST))
    _check(True, f"TLS {API_HOST}", _check_tls(API_HOST))

    # 2. Frontend SPA routes + verify live JS bundle points to institutional API
    index_html = ""
    for path in ("/", "/login", "/auth/callback", "/tasks", "/pages/demo-id"):
        st, _, html = _http("GET", f"{FRONTEND_URL}{path}")
        _check(st == 200 and "AcadFlow" in html, f"Frontend SPA GET {path}", f"status={st}")
        if path == "/":
            index_html = html

    match = re.search(r'src="(/assets/index-[^"]+\.js)"', index_html)
    _check(match is not None, "Frontend index.html references built JS bundle", f"match={match.group(1) if match else None}")
    bundle_path = match.group(1)
    st, _, js_code = _http("GET", f"{FRONTEND_URL}{bundle_path}")
    _check(st == 200, f"Fetch live bundle {bundle_path}", f"status={st}, bytes={len(js_code)}")
    _check(
        API_URL in js_code and TEMP_API_HOST not in js_code,
        "Live frontend bundle targets official institutional API URL",
        f"has_official={API_URL in js_code}, has_temp={TEMP_API_HOST in js_code}",
    )

    # 3. Institutional API health, 401 enforcement & CORS
    st, _, body = _http("GET", f"{API_URL}/health")
    _check(
        st == 200 and json.loads(body) == {"status": "ok", "service": "acadflow-api"},
        "API GET /health",
        f"status={st}",
    )

    for path in ("/tasks", "/pages"):
        st, _, _ = _http("GET", f"{API_URL}{path}")
        _check(st == 401, f"API GET {path} (no token)", f"status={st}")

        st, _, _ = _http("GET", f"{API_URL}{path}", headers={"Authorization": "Bearer invalid.jwt.token"})
        _check(st == 401, f"API GET {path} (invalid token)", f"status={st}")

        st, hdrs, _ = _http(
            "OPTIONS",
            f"{API_URL}{path}",
            headers={
                "Origin": FRONTEND_URL,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Authorization,Content-Type",
            },
        )
        _check(
            st in {200, 204} and hdrs.get("access-control-allow-origin") == FRONTEND_URL,
            f"API CORS OPTIONS {path}",
            f"status={st}, allow-origin={hdrs.get('access-control-allow-origin')}",
        )

    # 4. Cognito Hosted UI institutional callback check
    q = urllib.parse.urlencode(
        {
            "client_id": COGNITO_CLIENT_ID,
            "response_type": "code",
            "scope": "openid email profile",
            "redirect_uri": f"{FRONTEND_URL}/auth/callback",
        }
    )
    st, _, html = _http("GET", f"https://{COGNITO_DOMAIN}/oauth2/authorize?{q}")
    _check(
        st == 200 and "redirect_mismatch" not in html.lower(),
        "Cognito Hosted UI accepts institutional callback",
        f"status={st}",
    )

    print("\nALL AUTOMATED PRODUCTION DOMAIN CHECKS PASSED!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
