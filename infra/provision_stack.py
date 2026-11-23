"""Idempotent AWS infrastructure planner / provisioner for AcadFlow.

Safety rules:
- Runs in DRY-RUN mode by default (makes ZERO AWS calls).
- Actual provisioning requires explicit `--apply` flag AND user authorization.
- Never embeds or prints credentials, secrets or JWT tokens.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
from typing import Any


def build_plan(args: argparse.Namespace) -> dict[str, Any]:
    return {
        "mode": "APPLY" if args.apply else "DRY_RUN",
        "region": args.region,
        "resources": [
            {
                "service": "Amazon DynamoDB",
                "name": args.table_name,
                "config": {
                    "KeySchema": [
                        {"AttributeName": "ownerId", "KeyType": "HASH"},
                        {"AttributeName": "id", "KeyType": "RANGE"},
                    ],
                    "BillingMode": "PAY_PER_REQUEST",
                },
                "iam_required": ["dynamodb:CreateTable", "dynamodb:DescribeTable"],
                "cost_note": "On-demand WRU/RRU + storage; verify credits/Free Tier before applying.",
            },
            {
                "service": "Amazon DynamoDB",
                "name": args.pages_table_name,
                "config": {
                    "KeySchema": [
                        {"AttributeName": "ownerId", "KeyType": "HASH"},
                        {"AttributeName": "id", "KeyType": "RANGE"},
                    ],
                    "BillingMode": "PAY_PER_REQUEST",
                },
                "iam_required": ["dynamodb:CreateTable", "dynamodb:DescribeTable"],
                "cost_note": "P1 workspace pages table (100 KB app limit per doc); verify credits/Free Tier before applying.",
            },
            {
                "service": "AWS Lambda",
                "name": args.function_name,
                "config": {
                    "Runtime": "python3.12",
                    "Handler": "acadflow_api.handler.lambda_handler",
                    "Role": args.role_arn or "<REQUIRED_EXECUTION_ROLE_ARN>",
                    "Package": str(args.zip_path),
                    "Environment": {
                        "TASKS_TABLE": args.table_name,
                        "PAGES_TABLE": args.pages_table_name,
                    },
                    "Timeout": 10,
                    "MemorySize": 256,
                },
                "iam_required": [
                    "lambda:CreateFunction",
                    "lambda:UpdateFunctionCode",
                    "lambda:UpdateFunctionConfiguration",
                    "lambda:AddPermission",
                    "iam:PassRole",
                ],
                "cost_note": "Billed per invocation and GB-second; low academic traffic expected.",
            },
            {
                "service": "Amazon API Gateway HTTP API (v2)",
                "name": args.api_name,
                "config": {
                    "ProtocolType": "HTTP",
                    "CorsAllowedOrigins": [args.app_origin],
                    "Routes": [
                        "GET /health (public)",
                        "GET /tasks (JWT Authorizer)",
                        "POST /tasks (JWT Authorizer)",
                        "GET /tasks/{id} (JWT Authorizer)",
                        "PATCH /tasks/{id} (JWT Authorizer)",
                        "DELETE /tasks/{id} (JWT Authorizer)",
                        "GET /pages (JWT Authorizer)",
                        "POST /pages (JWT Authorizer)",
                        "GET /pages/{id} (JWT Authorizer)",
                        "PATCH /pages/{id} (JWT Authorizer)",
                        "DELETE /pages/{id} (JWT Authorizer)",
                    ],
                    "JwtAuthorizer": {
                        "Issuer": args.cognito_issuer or "<COGNITO_USER_POOL_ISSUER>",
                        "Audience": [args.cognito_client_id or "<COGNITO_APP_CLIENT_ID>"],
                        "AuthorizationScopes": args.authorization_scopes,
                    },
                },
                "iam_required": ["apigateway:POST", "apigateway:GET", "apigateway:PATCH"],
                "cost_note": "Billed per million requests; verify account limits.",
            },
        ],
    }


def apply_plan(args: argparse.Namespace) -> int:
    if not args.role_arn:
        print("ERROR: --role-arn is required when using --apply.", file=sys.stderr)
        return 2
    zip_path = pathlib.Path(args.zip_path)
    if not zip_path.exists():
        print(
            f"ERROR: Lambda ZIP not found at {zip_path}. Run services/api/build_package.py first.",
            file=sys.stderr,
        )
        return 2

    import boto3
    from botocore.exceptions import ClientError

    session = boto3.Session(region_name=args.region)
    ddb = session.client("dynamodb")
    lam = session.client("lambda")

    # 1. DynamoDB Tables (idempotent)
    for table_name in (args.table_name, args.pages_table_name):
        try:
            ddb.describe_table(TableName=table_name)
            print(f"[ok] DynamoDB table already exists: {table_name}")
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

    # 2. Lambda Function (idempotent)
    zip_bytes = zip_path.read_bytes()
    lambda_env = {
        "Variables": {
            "TASKS_TABLE": args.table_name,
            "PAGES_TABLE": args.pages_table_name,
        }
    }
    try:
        lam.get_function(FunctionName=args.function_name)
        lam.update_function_code(FunctionName=args.function_name, ZipFile=zip_bytes)
        lam.get_waiter("function_updated_v2").wait(FunctionName=args.function_name)
        lam.update_function_configuration(
            FunctionName=args.function_name,
            Runtime="python3.12",
            Handler="acadflow_api.handler.lambda_handler",
            Timeout=10,
            MemorySize=256,
            Environment=lambda_env,
        )
        print(f"[updated] Lambda function: {args.function_name}")
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ResourceNotFoundException":
            raise
        lam.create_function(
            FunctionName=args.function_name,
            Runtime="python3.12",
            Role=args.role_arn,
            Handler="acadflow_api.handler.lambda_handler",
            Code={"ZipFile": zip_bytes},
            Timeout=10,
            MemorySize=256,
            Environment=lambda_env,
        )
        print(f"[created] Lambda function: {args.function_name}")

    print(
        "[next] Configure Cognito User Pool, HTTP API JWT Authorizer (with verified "
        "authorizationScopes), lambda:AddPermission and Custom Domains per docs/IMPLANTACAO.md."
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="AcadFlow AWS stack planner (dry-run by default)."
    )
    parser.add_argument("--region", required=True, help="Confirmed AWS region.")
    parser.add_argument("--table-name", default="acadflow-tasks")
    parser.add_argument("--pages-table-name", default="acadflow-pages")
    parser.add_argument("--function-name", default="acadflow-api")
    parser.add_argument("--api-name", default="acadflow-http-api")
    parser.add_argument(
        "--app-origin",
        required=True,
        help="Allowed CORS origin (e.g. https://<SEUNOME>.<grupo>.sd.ufersa.dev.br).",
    )
    parser.add_argument("--role-arn", default="")
    parser.add_argument("--cognito-issuer", default="")
    parser.add_argument("--cognito-client-id", default="")
    parser.add_argument(
        "--authorization-scopes",
        nargs="*",
        default=["openid"],
        help="Access-token scopes enforced by HTTP API JWT Authorizer.",
    )
    parser.add_argument(
        "--zip-path", default="services/api/dist/acadflow-api.zip"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Execute AWS write operations (ONLY with explicit user authorization).",
    )
    args = parser.parse_args()

    plan = build_plan(args)
    print(json.dumps(plan, indent=2, ensure_ascii=False))
    if not args.apply:
        print("\nDRY-RUN COMPLETE: No AWS resources were created or modified.")
        return 0
    return apply_plan(args)


if __name__ == "__main__":
    raise SystemExit(main())
