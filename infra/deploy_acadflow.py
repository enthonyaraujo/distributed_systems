"""Idempotent, checkpointed AWS provisioning script for AcadFlow (Steps A & D).

Safety invariants:
- NEVER touches prior evaluation resources (does not modify `mqdslq`, `war28zsged`,
  `us-east-1_Klis7IMHv`, prior Lambdas, or existing Route 53 records).
- NEVER creates IAM roles (exclusively uses verified `LabRole`).
- NEVER creates Cognito users with fake/uncontrolled emails.
- NEVER prints or persists credentials, tokens, or secrets.
- Saves non-secret checkpoint metadata to `infra/deploy_state.json` so execution
  can resume safely if Learner Lab session credentials expire.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time
import urllib.request
import zipfile
from typing import Any

import boto3
from botocore.exceptions import ClientError

REGION = "us-east-1"
TASKS_TABLE = "acadflow-tasks"
PAGES_TABLE = "acadflow-pages"
USER_POOL_NAME = "acadflow-users"
APP_CLIENT_NAME = "acadflow-web-client"
COGNITO_DOMAIN_PREFIX = "acadflow-enthony-sd"
LAMBDA_NAME = "acadflow-api"
HTTP_API_NAME = "acadflow-http-api"
JWT_AUTHORIZER_NAME = "acadflow-cognito-jwt"
AMPLIFY_APP_NAME = "acadflow-web"
AMPLIFY_BRANCH = "main"
FRONTEND_DOMAIN = "enthonyaraujo.grupo-03.sd.ufersa.dev.br"
HOSTED_ZONE_ID = "Z0906692126CHKWN9GQ2U"

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
STATE_FILE = REPO_ROOT / "infra" / "deploy_state.json"
LAMBDA_ZIP = REPO_ROOT / "services" / "api" / "dist" / "acadflow-api.zip"
WEB_DIST_DIR = REPO_ROOT / "apps" / "web" / "dist"
WEB_DIST_ZIP = REPO_ROOT / "apps" / "web" / "acadflow-web-dist.zip"

SPA_REWRITE_RULES = [
    {
        "source": "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>",
        "target": "/index.html",
        "status": "200",
    }
]

PROTECTED_ROUTES = [
    "GET /tasks",
    "POST /tasks",
    "GET /tasks/{id}",
    "PATCH /tasks/{id}",
    "DELETE /tasks/{id}",
    "GET /pages",
    "POST /pages",
    "GET /pages/{id}",
    "PATCH /pages/{id}",
    "DELETE /pages/{id}",
]


def load_state() -> dict[str, Any]:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {"region": REGION}


def save_state(state: dict[str, Any]) -> None:
    STATE_FILE.write_text(
        json.dumps(state, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def ensure_dynamodb_tables(session: boto3.Session, state: dict[str, Any]) -> None:
    ddb = session.client("dynamodb")
    for table_name in (TASKS_TABLE, PAGES_TABLE):
        try:
            desc = ddb.describe_table(TableName=table_name)["Table"]
            print(f"[ok] DynamoDB table exists: {table_name} ({desc['TableStatus']})")
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") != "ResourceNotFoundException":
                raise
            ddb.create_table(
                TableName=table_name,
                AttributeDefinitions=[
                    {"AttributeName": "ownerId", "AttributeType": "S"},
                    {"AttributeName": "id", "AttributeType": "S"},
                ],
                KeySchema=[
                    {"AttributeName": "ownerId", "KeyType": "HASH"},
                    {"AttributeName": "id", "KeyType": "RANGE"},
                ],
                BillingMode="PAY_PER_REQUEST",
            )
            print(f"[created] DynamoDB table requested: {table_name}")
            ddb.get_waiter("table_exists").wait(TableName=table_name)
            print(f"[active] DynamoDB table active: {table_name}")
    state["tasksTable"] = TASKS_TABLE
    state["pagesTable"] = PAGES_TABLE
    save_state(state)


def ensure_cognito(
    session: boto3.Session,
    state: dict[str, Any],
    callback_urls: list[str],
    logout_urls: list[str],
) -> None:
    cognito = session.client("cognito-idp")

    # 1. User Pool (idempotent by name)
    pool_id = state.get("cognitoUserPoolId", "")
    if pool_id:
        try:
            cognito.describe_user_pool(UserPoolId=pool_id)
        except ClientError:
            pool_id = ""

    if not pool_id:
        pools = cognito.list_user_pools(MaxResults=60).get("UserPools", [])
        for p in pools:
            if p.get("Name") == USER_POOL_NAME:
                pool_id = p["Id"]
                print(f"[ok] Cognito User Pool exists: {USER_POOL_NAME} ({pool_id})")
                break

    if not pool_id:
        created = cognito.create_user_pool(
            PoolName=USER_POOL_NAME,
            UsernameAttributes=["email"],
            AutoVerifiedAttributes=["email"],
            Policies={
                "PasswordPolicy": {
                    "MinimumLength": 8,
                    "RequireUppercase": True,
                    "RequireLowercase": True,
                    "RequireNumbers": True,
                    "RequireSymbols": False,
                    "TemporaryPasswordValidityDays": 7,
                }
            },
            AccountRecoverySetting={
                "RecoveryMechanisms": [{"Priority": 1, "Name": "verified_email"}]
            },
            Schema=[
                {
                    "Name": "email",
                    "AttributeDataType": "String",
                    "Required": True,
                    "Mutable": True,
                }
            ],
        )["UserPool"]
        pool_id = created["Id"]
        print(f"[created] Cognito User Pool: {USER_POOL_NAME} ({pool_id})")

    state["cognitoUserPoolId"] = pool_id
    state["cognitoIssuer"] = f"https://cognito-idp.{REGION}.amazonaws.com/{pool_id}"
    save_state(state)

    # 2. App Client (public client, PKCE, no client_secret, short access token TTL)
    client_id = state.get("cognitoClientId", "")
    if not client_id:
        clients = cognito.list_user_pool_clients(
            UserPoolId=pool_id, MaxResults=60
        ).get("UserPoolClients", [])
        for c in clients:
            if c.get("ClientName") == APP_CLIENT_NAME:
                client_id = c["ClientId"]
                break

    client_kwargs: dict[str, Any] = {
        "UserPoolId": pool_id,
        "ClientName": APP_CLIENT_NAME,
        "AllowedOAuthFlowsUserPoolClient": True,
        "AllowedOAuthFlows": ["code"],
        "AllowedOAuthScopes": ["openid", "email", "profile"],
        "CallbackURLs": callback_urls,
        "LogoutURLs": logout_urls,
        "SupportedIdentityProviders": ["COGNITO"],
        "ExplicitAuthFlows": [
            "ALLOW_USER_SRP_AUTH",
            "ALLOW_REFRESH_TOKEN_AUTH",
        ],
        "PreventUserExistenceErrors": "ENABLED",
        "EnableTokenRevocation": True,
        "AccessTokenValidity": 30,
        "IdTokenValidity": 30,
        "RefreshTokenValidity": 1,
        "TokenValidityUnits": {
            "AccessToken": "minutes",
            "IdToken": "minutes",
            "RefreshToken": "days",
        },
    }

    if not client_id:
        created_client = cognito.create_user_pool_client(
            GenerateSecret=False, **client_kwargs
        )["UserPoolClient"]
        client_id = created_client["ClientId"]
        print(f"[created] Cognito public App Client: {APP_CLIENT_NAME} ({client_id})")
    else:
        cognito.update_user_pool_client(ClientId=client_id, **client_kwargs)
        print(f"[updated] Cognito public App Client: {APP_CLIENT_NAME} ({client_id})")

    state["cognitoClientId"] = client_id
    save_state(state)

    # 3. Cognito Hosted UI Domain
    pool_desc = cognito.describe_user_pool(UserPoolId=pool_id)["UserPool"]
    existing_domain = pool_desc.get("Domain")
    if existing_domain:
        domain_prefix = existing_domain
        print(f"[ok] Cognito domain exists: {domain_prefix}.auth.{REGION}.amazoncognito.com")
    else:
        domain_prefix = COGNITO_DOMAIN_PREFIX
        try:
            cognito.create_user_pool_domain(
                Domain=domain_prefix, UserPoolId=pool_id
            )
            print(f"[created] Cognito domain: {domain_prefix}.auth.{REGION}.amazoncognito.com")
        except ClientError as exc:
            # Fallback suffix if prefix is already globally taken
            suffix = pool_id.split("_")[-1].lower()[:6]
            domain_prefix = f"{COGNITO_DOMAIN_PREFIX}-{suffix}"
            cognito.create_user_pool_domain(
                Domain=domain_prefix, UserPoolId=pool_id
            )
            print(f"[created] Cognito domain: {domain_prefix}.auth.{REGION}.amazoncognito.com (fallback after {exc.response.get('Error', {}).get('Code')})")

    state["cognitoDomain"] = f"{domain_prefix}.auth.{REGION}.amazoncognito.com"
    save_state(state)


def ensure_lambda(session: boto3.Session, state: dict[str, Any]) -> None:
    if not LAMBDA_ZIP.exists():
        raise FileNotFoundError(
            f"Lambda package not found at {LAMBDA_ZIP}. Run services/api/build_package.py first."
        )

    iam = session.client("iam")
    lab_role_arn = iam.get_role(RoleName="LabRole")["Role"]["Arn"]
    lam = session.client("lambda")
    zip_bytes = LAMBDA_ZIP.read_bytes()
    env_vars = {"Variables": {"TASKS_TABLE": TASKS_TABLE, "PAGES_TABLE": PAGES_TABLE}}

    try:
        fn = lam.get_function(FunctionName=LAMBDA_NAME)["Configuration"]
        lam.update_function_code(FunctionName=LAMBDA_NAME, ZipFile=zip_bytes)
        lam.get_waiter("function_updated_v2").wait(FunctionName=LAMBDA_NAME)
        fn = lam.update_function_configuration(
            FunctionName=LAMBDA_NAME,
            Runtime="python3.12",
            Handler="acadflow_api.handler.lambda_handler",
            Timeout=10,
            MemorySize=256,
            Environment=env_vars,
        )
        lam.get_waiter("function_updated_v2").wait(FunctionName=LAMBDA_NAME)
        print(f"[updated] Lambda function: {LAMBDA_NAME} (python3.12)")
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ResourceNotFoundException":
            raise
        fn = lam.create_function(
            FunctionName=LAMBDA_NAME,
            Runtime="python3.12",
            Role=lab_role_arn,
            Handler="acadflow_api.handler.lambda_handler",
            Code={"ZipFile": zip_bytes},
            Timeout=10,
            MemorySize=256,
            Environment=env_vars,
        )
        lam.get_waiter("function_active_v2").wait(FunctionName=LAMBDA_NAME)
        print(f"[created] Lambda function: {LAMBDA_NAME} (python3.12)")

    state["lambdaName"] = LAMBDA_NAME
    state["lambdaArn"] = fn["FunctionArn"]
    save_state(state)


def ensure_http_api(
    session: boto3.Session,
    state: dict[str, Any],
    allowed_origins: list[str],
) -> None:
    apigw = session.client("apigatewayv2")
    lam = session.client("lambda")
    sts = session.client("sts")
    account_id = sts.get_caller_identity()["Account"]

    cors_config = {
        "AllowOrigins": allowed_origins,
        "AllowMethods": ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        "AllowHeaders": ["Authorization", "Content-Type"],
        "MaxAge": 3600,
    }

    # 1. HTTP API (idempotent by name)
    api_id = state.get("httpApiId", "")
    api_endpoint = state.get("httpApiEndpoint", "")
    if api_id:
        try:
            existing = apigw.get_api(ApiId=api_id)
            api_endpoint = existing["ApiEndpoint"]
        except ClientError:
            api_id = ""

    if not api_id:
        for item in apigw.get_apis(MaxResults="50").get("Items", []):
            if item.get("Name") == HTTP_API_NAME:
                api_id = item["ApiId"]
                api_endpoint = item["ApiEndpoint"]
                break

    if not api_id:
        created = apigw.create_api(
            Name=HTTP_API_NAME,
            ProtocolType="HTTP",
            CorsConfiguration=cors_config,
        )
        api_id = created["ApiId"]
        api_endpoint = created["ApiEndpoint"]
        print(f"[created] HTTP API: {HTTP_API_NAME} ({api_id}) -> {api_endpoint}")
    else:
        apigw.update_api(ApiId=api_id, CorsConfiguration=cors_config)
        print(f"[updated] HTTP API CORS: {HTTP_API_NAME} ({api_id}) -> {api_endpoint}")

    state["httpApiId"] = api_id
    state["httpApiEndpoint"] = api_endpoint
    save_state(state)

    # 2. Lambda Integration (payload v2.0)
    integrations = apigw.get_integrations(ApiId=api_id).get("Items", [])
    integration_id = ""
    for integ in integrations:
        if integ.get("IntegrationUri") == state["lambdaArn"]:
            integration_id = integ["IntegrationId"]
            break
    if not integration_id:
        created_integ = apigw.create_integration(
            ApiId=api_id,
            IntegrationType="AWS_PROXY",
            IntegrationUri=state["lambdaArn"],
            PayloadFormatVersion="2.0",
        )
        integration_id = created_integ["IntegrationId"]
        print(f"[created] Lambda integration: {integration_id}")
    else:
        print(f"[ok] Lambda integration exists: {integration_id}")

    # 3. JWT Authorizer (Cognito)
    jwt_config = {
        "Issuer": state["cognitoIssuer"],
        "Audience": [state["cognitoClientId"]],
    }
    authorizers = apigw.get_authorizers(ApiId=api_id).get("Items", [])
    authorizer_id = ""
    for auth in authorizers:
        if auth.get("Name") == JWT_AUTHORIZER_NAME:
            authorizer_id = auth["AuthorizerId"]
            break
    if not authorizer_id:
        created_auth = apigw.create_authorizer(
            ApiId=api_id,
            Name=JWT_AUTHORIZER_NAME,
            AuthorizerType="JWT",
            IdentitySource=["$request.header.Authorization"],
            JwtConfiguration=jwt_config,
        )
        authorizer_id = created_auth["AuthorizerId"]
        print(f"[created] JWT Authorizer: {JWT_AUTHORIZER_NAME} ({authorizer_id})")
    else:
        apigw.update_authorizer(
            ApiId=api_id,
            AuthorizerId=authorizer_id,
            IdentitySource=["$request.header.Authorization"],
            JwtConfiguration=jwt_config,
        )
        print(f"[updated] JWT Authorizer: {JWT_AUTHORIZER_NAME} ({authorizer_id})")

    state["jwtAuthorizerId"] = authorizer_id
    save_state(state)

    # 4. Routes: GET /health public; /tasks* and /pages* JWT + scope ["openid"]
    existing_routes = {
        r["RouteKey"]: r["RouteId"]
        for r in apigw.get_routes(ApiId=api_id, MaxResults="50").get("Items", [])
    }
    target = f"integrations/{integration_id}"

    if "GET /health" not in existing_routes:
        apigw.create_route(
            ApiId=api_id,
            RouteKey="GET /health",
            AuthorizationType="NONE",
            Target=target,
        )
        print("[created] Route: GET /health (public)")
    else:
        apigw.update_route(
            ApiId=api_id,
            RouteId=existing_routes["GET /health"],
            AuthorizationType="NONE",
            Target=target,
        )

    for route_key in PROTECTED_ROUTES:
        route_kwargs: dict[str, Any] = {
            "ApiId": api_id,
            "RouteKey": route_key,
            "AuthorizationType": "JWT",
            "AuthorizerId": authorizer_id,
            "AuthorizationScopes": ["openid"],
            "Target": target,
        }
        if route_key not in existing_routes:
            apigw.create_route(**route_kwargs)
            print(f"[created] Route: {route_key} (JWT + scope=openid)")
        else:
            apigw.update_route(
                RouteId=existing_routes[route_key], **route_kwargs
            )
    print(f"[ok] All {1 + len(PROTECTED_ROUTES)} HTTP API routes configured.")

    # 5. Stage $default (AutoDeploy=True)
    stages = {
        s["StageName"] for s in apigw.get_stages(ApiId=api_id).get("Items", [])
    }
    if "$default" not in stages:
        apigw.create_stage(ApiId=api_id, StageName="$default", AutoDeploy=True)
        print("[created] Stage: $default (AutoDeploy=True)")
    else:
        print("[ok] Stage $default exists.")

    # 6. Lambda invoke permission for API Gateway
    statement_id = f"apigw-invoke-{api_id}"
    source_arn = f"arn:aws:execute-api:{REGION}:{account_id}:{api_id}/*/*"
    try:
        lam.add_permission(
            FunctionName=LAMBDA_NAME,
            StatementId=statement_id,
            Action="lambda:InvokeFunction",
            Principal="apigateway.amazonaws.com",
            SourceArn=source_arn,
        )
        print(f"[created] Lambda invoke permission: {statement_id}")
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ResourceConflictException":
            print(f"[ok] Lambda invoke permission exists: {statement_id}")
        else:
            raise


def ensure_amplify_app(session: boto3.Session, state: dict[str, Any]) -> None:
    amplify = session.client("amplify")
    app_id = state.get("amplifyAppId", "")
    default_domain = state.get("amplifyDefaultDomain", "")

    if app_id:
        try:
            app = amplify.get_app(appId=app_id)["app"]
            default_domain = app["defaultDomain"]
        except ClientError:
            app_id = ""

    if not app_id:
        for app in amplify.list_apps(maxResults=50).get("apps", []):
            if app.get("name") == AMPLIFY_APP_NAME:
                app_id = app["appId"]
                default_domain = app["defaultDomain"]
                break

    if not app_id:
        app = amplify.create_app(
            name=AMPLIFY_APP_NAME,
            platform="WEB",
            customRules=SPA_REWRITE_RULES,
        )["app"]
        app_id = app["appId"]
        default_domain = app["defaultDomain"]
        print(f"[created] Amplify app: {AMPLIFY_APP_NAME} ({app_id}) -> {default_domain}")
    else:
        amplify.update_app(appId=app_id, customRules=SPA_REWRITE_RULES)
        print(f"[updated] Amplify app SPA rules: {AMPLIFY_APP_NAME} ({app_id})")

    try:
        amplify.get_branch(appId=app_id, branchName=AMPLIFY_BRANCH)
        print(f"[ok] Amplify branch exists: {AMPLIFY_BRANCH}")
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "NotFoundException":
            raise
        amplify.create_branch(
            appId=app_id,
            branchName=AMPLIFY_BRANCH,
            stage="PRODUCTION",
        )
        print(f"[created] Amplify branch: {AMPLIFY_BRANCH}")

    state["amplifyAppId"] = app_id
    state["amplifyDefaultDomain"] = default_domain
    state["amplifyBranchUrl"] = f"https://{AMPLIFY_BRANCH}.{default_domain}"
    save_state(state)


def deploy_amplify_bundle(session: boto3.Session, state: dict[str, Any]) -> None:
    if not WEB_DIST_DIR.exists():
        raise FileNotFoundError(
            f"Frontend build directory not found: {WEB_DIST_DIR}. Run npm.cmd run build first."
        )

    with zipfile.ZipFile(WEB_DIST_ZIP, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(WEB_DIST_DIR.rglob("*")):
            if p.is_file():
                zf.write(p, arcname=p.relative_to(WEB_DIST_DIR).as_posix())
    print(f"[packaged] Frontend dist ZIP: {WEB_DIST_ZIP.name} ({WEB_DIST_ZIP.stat().st_size} bytes)")

    amplify = session.client("amplify")
    app_id = state["amplifyAppId"]
    dep = amplify.create_deployment(appId=app_id, branchName=AMPLIFY_BRANCH)
    job_id = dep["jobId"]
    upload_url = dep["zipUploadUrl"]

    req = urllib.request.Request(
        upload_url,
        data=WEB_DIST_ZIP.read_bytes(),
        method="PUT",
        headers={"Content-Type": "application/zip"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        if resp.status not in {200, 204}:
            raise RuntimeError(f"Amplify ZIP upload failed with HTTP {resp.status}")

    amplify.start_deployment(
        appId=app_id, branchName=AMPLIFY_BRANCH, jobId=job_id
    )
    print(f"[deploying] Amplify job started: jobId={job_id}")

    for _ in range(40):
        job = amplify.get_job(
            appId=app_id, branchName=AMPLIFY_BRANCH, jobId=job_id
        )["job"]["summary"]
        status = job["status"]
        if status == "SUCCEED":
            print(f"[deployed] Amplify job SUCCEED -> {state['amplifyBranchUrl']}")
            state["amplifyLastJobId"] = job_id
            save_state(state)
            return
        if status in {"FAILED", "CANCELLED"}:
            raise RuntimeError(f"Amplify deployment ended with status={status}")
        time.sleep(3)
    raise TimeoutError("Timed out waiting for Amplify deployment to finish.")


def ensure_amplify_domain(session: boto3.Session, state: dict[str, Any]) -> None:
    amplify = session.client("amplify")
    app_id = state["amplifyAppId"]

    try:
        assoc = amplify.get_domain_association(
            appId=app_id, domainName=FRONTEND_DOMAIN
        )["domainAssociation"]
        print(
            f"[ok] Amplify domain association exists: {FRONTEND_DOMAIN} "
            f"(status={assoc.get('domainStatus')})"
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "NotFoundException":
            raise
        assoc = amplify.create_domain_association(
            appId=app_id,
            domainName=FRONTEND_DOMAIN,
            enableAutoSubDomain=False,
            subDomainSettings=[{"prefix": "", "branchName": AMPLIFY_BRANCH}],
        )["domainAssociation"]
        print(
            f"[created] Amplify domain association requested: {FRONTEND_DOMAIN} "
            f"(status={assoc.get('domainStatus')})"
        )

    state["amplifyDomainStatus"] = assoc.get("domainStatus")
    state["amplifyCertificateVerificationDNSRecord"] = assoc.get(
        "certificateVerificationDNSRecord"
    )
    state["amplifySubDomains"] = assoc.get("subDomains", [])
    save_state(state)
    print(
        json.dumps(
            {
                "domainName": FRONTEND_DOMAIN,
                "domainStatus": assoc.get("domainStatus"),
                "statusReason": assoc.get("statusReason"),
                "certificateVerificationDNSRecord": assoc.get(
                    "certificateVerificationDNSRecord"
                ),
                "subDomains": assoc.get("subDomains", []),
            },
            indent=2,
            ensure_ascii=False,
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="AcadFlow AWS deployment runner.")
    parser.add_argument(
        "step",
        choices=["step-a", "amplify-init", "amplify-deploy", "amplify-domain", "status"],
    )
    args = parser.parse_args()

    session = boto3.Session(region_name=REGION)
    state = load_state()

    if args.step == "status":
        print(json.dumps(state, indent=2, ensure_ascii=False))
        return 0

    if args.step == "step-a":
        ensure_dynamodb_tables(session, state)
        ensure_amplify_app(session, state)
        temp_amplify = state["amplifyBranchUrl"]
        prod_frontend = f"https://{FRONTEND_DOMAIN}"
        callbacks = [
            f"{prod_frontend}/auth/callback",
            f"{temp_amplify}/auth/callback",
            "http://localhost:5173/auth/callback",
        ]
        logouts = [
            f"{prod_frontend}/",
            f"{temp_amplify}/",
            "http://localhost:5173/",
        ]
        origins = [prod_frontend, temp_amplify, "http://localhost:5173"]
        ensure_cognito(session, state, callbacks, logouts)
        ensure_lambda(session, state)
        ensure_http_api(session, state, origins)
        print("\n=== STEP A + AMPLIFY APP INIT COMPLETE ===")
        print(json.dumps(state, indent=2, ensure_ascii=False))
        return 0

    if args.step == "amplify-init":
        ensure_amplify_app(session, state)
        return 0

    if args.step == "amplify-deploy":
        deploy_amplify_bundle(session, state)
        return 0

    if args.step == "amplify-domain":
        ensure_amplify_domain(session, state)
        return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
