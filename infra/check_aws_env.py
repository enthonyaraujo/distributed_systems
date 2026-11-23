"""Read-only Phase 0 AWS diagnostic script for AcadFlow.

NEVER mutates AWS resources and NEVER prints credentials, keys, secrets or tokens.
Classifies every checked service/operation strictly into:
  - autorizado
  - acesso_negado
  - recurso_inexistente
  - nao_verificado
  - servico_indisponivel
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Callable


def _classify_client_error(exc: Exception) -> tuple[str, str]:
    response = getattr(exc, "response", None)
    if isinstance(response, dict):
        err = response.get("Error", {})
        code = str(err.get("Code", "Unknown"))
        msg = str(err.get("Message", ""))[:200]
        if code in {
            "AccessDenied",
            "AccessDeniedException",
            "UnauthorizedOperation",
            "UnrecognizedClientException",
            "ExpiredToken",
            "ExpiredTokenException",
            "InvalidClientTokenId",
            "NotAuthorizedException",
        }:
            return "acesso_negado", f"{code}: {msg}"
        if code in {
            "NoSuchEntity",
            "NoSuchHostedZone",
            "ResourceNotFoundException",
            "NotFoundException",
        }:
            return "recurso_inexistente", f"{code}: {msg}"
        if code in {
            "OptInRequired",
            "SubscriptionRequiredException",
            "ServiceUnavailable",
            "EndpointConnectionError",
        }:
            return "servico_indisponivel", f"{code}: {msg}"
        return "nao_verificado", f"{code}: {msg}"
    return "servico_indisponivel", f"{exc.__class__.__name__}: {str(exc)[:200]}"


def _run_check(name: str, fn: Callable[[], Any]) -> dict[str, Any]:
    try:
        data = fn()
        return {"check": name, "status": "autorizado", "data": data}
    except Exception as exc:
        status, detail = _classify_client_error(exc)
        return {"check": name, "status": status, "detail": detail}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Read-only AWS permission and resource diagnostic for AcadFlow."
    )
    parser.add_argument(
        "--region",
        default="",
        help="Target AWS region (defaults to session/profile region, or us-east-1 fallback for probe).",
    )
    parser.add_argument(
        "--role-name",
        default="LabRole",
        help="IAM execution role name to verify via iam:GetRole (default: LabRole).",
    )
    parser.add_argument(
        "--hosted-zone-id",
        default="",
        help="Specific Route 53 Hosted Zone ID to verify via route53:GetHostedZone.",
    )
    parser.add_argument(
        "--owner-filter",
        default="enthonyaraujo",
        help="Substring filter for listing relevant DNS records without dumping unrelated entries.",
    )
    args = parser.parse_args()

    try:
        import boto3
    except ImportError:
        print(
            "ERROR: boto3 is not installed in this Python environment. "
            "Install requirements-dev.txt in a venv first.",
            file=sys.stderr,
        )
        return 2

    default_session = boto3.Session()
    configured_region = default_session.region_name
    active_region = args.region or configured_region or "us-east-1"
    session = boto3.Session(region_name=active_region)

    results: list[dict[str, Any]] = []
    caller_arn = ""

    # 1. STS Caller Identity
    def check_sts() -> dict[str, Any]:
        nonlocal caller_arn
        ident = session.client("sts").get_caller_identity()
        caller_arn = str(ident.get("Arn", ""))
        acct = str(ident.get("Account", ""))
        masked_acct = f"****{acct[-4:]}" if len(acct) >= 4 else "****"
        arn_tail = caller_arn.split(":", 5)[5] if caller_arn.count(":") >= 5 else caller_arn
        return {
            "accountMasked": masked_acct,
            "principal": arn_tail,
            "configuredDefaultRegion": configured_region,
            "probedRegion": active_region,
        }

    results.append(_run_check("sts:GetCallerIdentity", check_sts))

    # 2. Regions check (read-only)
    def check_regions() -> dict[str, Any]:
        ec2 = session.client("ec2")
        regions = [
            r["RegionName"]
            for r in ec2.describe_regions(AllRegions=False).get("Regions", [])
        ]
        return {"enabledRegionCount": len(regions), "sample": sorted(regions)[:10]}

    results.append(_run_check("ec2:DescribeRegions", check_regions))

    # 3. IAM Execution Role & Policy Simulation (read-only)
    if args.role_name:
        def check_role() -> dict[str, Any]:
            role = session.client("iam").get_role(RoleName=args.role_name)["Role"]
            arn = str(role["Arn"])
            masked_arn = arn.replace(arn.split(":")[4], f"****{arn.split(':')[4][-4:]}") if arn.count(":") >= 5 else arn
            return {
                "roleName": role["RoleName"],
                "arnMasked": masked_arn,
                "assumeRoleServices": [
                    stmt.get("Principal", {}).get("Service")
                    for stmt in role.get("AssumeRolePolicyDocument", {}).get("Statement", [])
                ],
            }

        results.append(_run_check(f"iam:GetRole({args.role_name})", check_role))

    def check_simulate_permissions() -> dict[str, Any]:
        if not caller_arn:
            return {"note": "Caller ARN unavailable"}
        # For assumed-role ARNs, iam:SimulatePrincipalPolicy expects the IAM role ARN
        policy_source_arn = caller_arn
        if ":assumed-role/" in caller_arn:
            parts = caller_arn.split(":")
            role_part = parts[5].split("/")[1]
            policy_source_arn = f"arn:{parts[1]}:iam::{parts[4]}:role/{role_part}"
        actions = [
            "dynamodb:CreateTable",
            "lambda:CreateFunction",
            "iam:PassRole",
            "apigateway:POST",
            "cognito-idp:CreateUserPool",
            "amplify:CreateApp",
            "acm:RequestCertificate",
            "route53:ChangeResourceRecordSets",
        ]
        sim = session.client("iam").simulate_principal_policy(
            PolicySourceArn=policy_source_arn,
            ActionNames=actions,
        )
        return {
            res["EvalActionName"]: res["EvalDecision"]
            for res in sim.get("EvaluationResults", [])
        }

    results.append(_run_check("iam:SimulatePrincipalPolicy", check_simulate_permissions))

    # 4. DynamoDB
    results.append(
        _run_check(
            "dynamodb:ListTables",
            lambda: {
                "tables": session.client("dynamodb")
                .list_tables(Limit=50)
                .get("TableNames", [])
            },
        )
    )

    # 5. Lambda
    def check_lambda() -> dict[str, Any]:
        funcs = session.client("lambda").list_functions(MaxItems=50).get("Functions", [])
        return {
            "count": len(funcs),
            "functions": [
                {
                    "name": f["FunctionName"],
                    "runtime": f.get("Runtime"),
                    "handler": f.get("Handler"),
                }
                for f in funcs
            ],
        }

    results.append(_run_check("lambda:ListFunctions", check_lambda))

    # 6. CloudWatch Logs
    results.append(
        _run_check(
            "logs:DescribeLogGroups",
            lambda: {
                "count": len(
                    session.client("logs")
                    .describe_log_groups(limit=25)
                    .get("logGroups", [])
                )
            },
        )
    )

    # 7. API Gateway v2 (HTTP APIs & Custom Domains)
    def check_apigw_v2() -> dict[str, Any]:
        client = session.client("apigatewayv2")
        apis = client.get_apis(MaxResults="50").get("Items", [])
        domains = client.get_domain_names(MaxResults="50").get("Items", [])
        return {
            "apis": [
                {
                    "name": a.get("Name"),
                    "apiId": a.get("ApiId"),
                    "protocol": a.get("ProtocolType"),
                    "endpoint": a.get("ApiEndpoint"),
                }
                for a in apis
            ],
            "customDomains": [
                {
                    "domainName": d.get("DomainName"),
                    "targets": [
                        {
                            "apiGatewayDomainName": c.get("ApiGatewayDomainName"),
                            "endpointType": c.get("EndpointType"),
                            "status": c.get("DomainNameStatus"),
                        }
                        for c in d.get("DomainNameConfigurations", [])
                    ],
                }
                for d in domains
            ],
        }

    results.append(_run_check("apigatewayv2:GetApis+GetDomainNames", check_apigw_v2))

    # 8. API Gateway v1 (REST APIs & Custom Domains — reusable/existing check)
    def check_apigw_v1() -> dict[str, Any]:
        client = session.client("apigateway")
        apis = client.get_rest_apis(limit=50).get("items", [])
        domains = client.get_domain_names(limit=50).get("items", [])
        return {
            "restApis": [{"name": a.get("name"), "id": a.get("id")} for a in apis],
            "customDomains": [
                {
                    "domainName": d.get("domainName"),
                    "regionalDomainName": d.get("regionalDomainName"),
                    "distributionDomainName": d.get("distributionDomainName"),
                }
                for d in domains
            ],
        }

    results.append(_run_check("apigateway(v1):GetRestApis+GetDomainNames", check_apigw_v1))

    # 9. Cognito User Pools
    def check_cognito() -> dict[str, Any]:
        client = session.client("cognito-idp")
        pools = client.list_user_pools(MaxResults=50).get("UserPools", [])
        return {
            "count": len(pools),
            "userPools": [{"id": p.get("Id"), "name": p.get("Name")} for p in pools],
        }

    results.append(_run_check("cognito-idp:ListUserPools", check_cognito))

    # 10. Amplify Hosting
    def check_amplify() -> dict[str, Any]:
        client = session.client("amplify")
        apps = client.list_apps(maxResults=50).get("apps", [])
        summary = []
        for app in apps:
            app_info: dict[str, Any] = {
                "appId": app.get("appId"),
                "name": app.get("name"),
                "defaultDomain": app.get("defaultDomain"),
            }
            try:
                domains = client.list_domain_associations(
                    appId=app["appId"], maxResults=20
                ).get("domainAssociations", [])
                app_info["domains"] = [
                    {
                        "domainName": d.get("domainName"),
                        "status": d.get("domainStatus"),
                    }
                    for d in domains
                ]
            except Exception:
                app_info["domains"] = "unavailable"
            summary.append(app_info)
        return {"count": len(summary), "apps": summary}

    results.append(_run_check("amplify:ListApps", check_amplify))

    # 11. ACM Certificates
    def check_acm() -> dict[str, Any]:
        client = session.client("acm")
        certs = client.list_certificates(MaxItems=50).get("CertificateSummaryList", [])
        return {
            "count": len(certs),
            "certificates": [
                {
                    "domainName": c.get("DomainName"),
                    "status": c.get("Status"),
                    "type": c.get("Type"),
                    "inUse": c.get("InUse"),
                    "subjectAlternativeNames": c.get("SubjectAlternativeNameSummaries", []),
                }
                for c in certs
            ],
        }

    results.append(_run_check("acm:ListCertificates", check_acm))

    # 12. Route 53 Hosted Zones & Specific Hosted Zone Check
    def check_route53_zones() -> dict[str, Any]:
        client = session.client("route53")
        zones = client.list_hosted_zones(MaxItems="50").get("HostedZones", [])
        return {
            "count": len(zones),
            "zones": [
                {
                    "id": z.get("Id", "").replace("/hostedzone/", ""),
                    "name": z.get("Name"),
                    "recordSetCount": z.get("ResourceRecordSetCount"),
                }
                for z in zones
            ],
        }

    results.append(_run_check("route53:ListHostedZones", check_route53_zones))

    if args.hosted_zone_id:
        def check_specific_zone() -> dict[str, Any]:
            client = session.client("route53")
            hz = client.get_hosted_zone(Id=args.hosted_zone_id)
            zone = hz.get("HostedZone", {})
            ns = hz.get("DelegationSet", {}).get("NameServers", [])
            records_resp = client.list_resource_record_sets(
                HostedZoneId=args.hosted_zone_id, MaxItems="100"
            )
            matching_records = []
            for r in records_resp.get("ResourceRecordSets", []):
                rname = str(r.get("Name", ""))
                if args.owner_filter.lower() in rname.lower():
                    matching_records.append(
                        {
                            "name": rname,
                            "type": r.get("Type"),
                            "ttl": r.get("TTL"),
                            "values": [
                                rr.get("Value") for rr in r.get("ResourceRecords", [])
                            ],
                            "aliasTarget": (r.get("AliasTarget") or {}).get("DNSName"),
                        }
                    )
            return {
                "zoneId": zone.get("Id", "").replace("/hostedzone/", ""),
                "zoneName": zone.get("Name"),
                "nameServers": ns,
                "totalRecords": zone.get("ResourceRecordSetCount"),
                "matchingRecords": matching_records,
            }

        results.append(
            _run_check(
                f"route53:GetHostedZone+ListRecords({args.hosted_zone_id})",
                check_specific_zone,
            )
        )

    report: dict[str, Any] = {
        "region": active_region,
        "readOnly": True,
        "checks": results,
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
