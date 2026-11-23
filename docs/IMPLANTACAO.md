# Guia de Implantação e Manutenção — AcadFlow

> **Status em 23/11/2026:** Infraestrutura **publicada, endurecida e validada em produção** na conta AWS Academy Learner Lab (`****2503`, região `us-east-1`), nos dois domínios institucionais HTTPS. **Não execute scripts de provisionamento/deploy nem altere DNS ou recursos de avaliações anteriores sem autorização explícita.**

---

## 1. Pré-requisitos e Diagnóstico Somente Leitura

1. **Ambiente local (Fedora Linux — padrão atual):**
   - Python **3.12** (`services/api/.venv`), Node.js `20+` LTS / npm `10+`, Git.
   - Credenciais temporárias de sessão AWS configuradas **fora do repositório** em `~/.aws/credentials` (permissões recomendadas: `chmod 700 ~/.aws && chmod 600 ~/.aws/credentials`) e `~/.aws/config` com `region = us-east-1`. **Nunca** commitar credenciais, `.env.local` ou `infra/deploy_state.json`.
2. **Criar ambiente virtual Python 3.12:**
   ```bash
   python3.12 -m venv services/api/.venv
   source services/api/.venv/bin/activate
   pip install -r services/api/requirements-dev.txt
   ```
   *(No Windows PowerShell: `python -m venv services/api/.venv` e `.\services\api\.venv\Scripts\python.exe -m pip install -r services/api/requirements-dev.txt`.)*
3. **Diagnóstico 100% somente leitura da conta AWS:**
   ```bash
   services/api/.venv/bin/python infra/check_aws_env.py \
     --region us-east-1 \
     --hosted-zone-id Z0906692126CHKWN9GQ2U \
     --owner-filter enthonyaraujo
   ```
   Classifica cada serviço em `autorizado`, `acesso_negado`, `recurso_inexistente`, `nao_verificado` ou `servico_indisponivel`.

---

## 2. Empacotamento e Validação do Backend Lambda (`python3.12`)

```bash
services/api/.venv/bin/pytest services/api/tests -v
services/api/.venv/bin/python services/api/build_package.py
```

- Gera `services/api/dist/acadflow-api.zip` (ignorado pelo Git) contendo exclusivamente os 9 módulos Python puros de `services/api/src/acadflow_api/` (sem `local_server.py`, sem testes e sem binários nativos).
- **Handler:** `acadflow_api.handler.lambda_handler` | **Runtime:** `python3.12` | **Env vars:** `TASKS_TABLE=acadflow-tasks`, `PAGES_TABLE=acadflow-pages`.
- O `boto3` utilizado em produção é o fornecido nativamente pelo runtime gerenciado da AWS Lambda.
- **Versão ativa em produção (23/11/2026):** `Version=1` (`CodeSha256: dlDX0MabbcRVYZ8R09KhN33AriYg3KLoHB4XIssi5AM=`), com allowlist ProseMirror/Tiptap (`SEC-04`) e cabeçalhos HTTP de segurança (`SEC-02`).

---

## 3. Provisionamento Idempotente e Dry-Run

- `infra/provision_stack.py` opera em modo **dry-run por padrão** (imprime o plano JSON sem alterar nada na AWS):
  ```bash
  services/api/.venv/bin/python infra/provision_stack.py \
    --region us-east-1 \
    --app-origin https://enthonyaraujo.grupo-03.sd.ufersa.dev.br \
    --role-arn <ARN_LABROLE>
  ```
- `infra/deploy_acadflow.py` executa etapas idempotentes (`step-a`, `amplify-init`, `amplify-deploy`, `amplify-domain`, `status`) preservando recursos de avaliações anteriores e registrando metadados não secretos em `infra/deploy_state.json` (ignorado pelo `.gitignore`).

### Recursos Ativos na Etapa de Backend + Identidade + Hardening
1. **DynamoDB:** `acadflow-tasks` e `acadflow-pages` (`ownerId` HASH S, `id` RANGE S, `PAY_PER_REQUEST`, **`DeletionProtectionEnabled=True`**, `PITR=DISABLED`).
2. **Cognito User Pool (`acadflow-users` / `us-east-1_tKA6pURyD`):** login por e-mail, App Client público `acadflow-web-client` (`30f7tlmajc9moo6tr5q06pmkg3`, Authorization Code + PKCE S256, `EnableTokenRevocation=true`, Access/ID Token `30 min`, Refresh `1 dia`).
3. **Lambda (`acadflow-api`):** `python3.12`, `LabRole`, log group `/aws/lambda/acadflow-api` com retenção de **14 dias**.
4. **API Gateway HTTP API v2 (`acadflow-http-api` / `u0mxrf6mnk`):**
   - CORS restrito às origens configuradas (`GET,POST,PATCH,DELETE,OPTIONS`; headers `Authorization,Content-Type`).
   - JWT Authorizer (`Issuer` + `Audience` + `AuthorizationScopes=["openid"]`) em todas as 10 rotas `/tasks*` e `/pages*` (apenas `GET /health` pública).
   - Stage `$default` com throttling (`ThrottlingRateLimit=20.0`, `ThrottlingBurstLimit=40`) e Access Logs mínimos em `/aws/apigateway/acadflow-http-api` (retenção de **14 dias**, zero PII/tokens).

---

## 4. Publicação do Frontend (AWS Amplify Hosting), SPA Rewrite e Cabeçalhos

1. **Variáveis públicas de ambiente** (conforme [apps/web/.env.example](../apps/web/.env.example), **sem segredos**):
   - `VITE_API_URL` (`https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br`)
   - `VITE_COGNITO_REGION` (`us-east-1`)
   - `VITE_COGNITO_USER_POOL_ID` (`us-east-1_tKA6pURyD`)
   - `VITE_COGNITO_CLIENT_ID` (`30f7tlmajc9moo6tr5q06pmkg3`)
   - `VITE_COGNITO_DOMAIN` (`acadflow-enthony-sd.auth.us-east-1.amazoncognito.com`)
   - `VITE_COGNITO_SCOPES` (`openid email profile`)
   - `VITE_APP_URL` (`https://enthonyaraujo.grupo-03.sd.ufersa.dev.br`, ou vazio em `.env.local` para usar `window.location.origin`)
2. **Build local e verificação pré-deploy:**
   ```bash
   cd apps/web
   npm ci
   npm run test
   npm run typecheck
   npm run build
   npm audit
   ```
3. **Regra obrigatória de SPA Rewrite no Amplify (`dysbk8tmbj14k`)** para evitar `404` em `/auth/callback` e recargas (`F5`):
   - **Source:** `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>`
   - **Target:** `/index.html` | **Type:** `200 (Rewrite)`
4. **Cabeçalhos de segurança (`customHeaders`):** versionados em [infra/amplify_security_headers.yml](../infra/amplify_security_headers.yml) e ativos em produção com `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` e **`Content-Security-Policy-Report-Only`**.
5. **Deploy ativo em produção (23/11/2026):** `acadflow-web` (`dysbk8tmbj14k`, branch `main`, **`jobId=3`**, bundle `/assets/index-BLG3afUM.js`; baseline anterior `jobId=2` preservado para rollback).

---

## 5. Domínios Institucionais HTTPS, Cutover da API e Procedimentos de Rollback

- **Frontend:** `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br` (`AVAILABLE`, TLSv1.3 até `2027-06-08`) -> Amplify `dysbk8tmbj14k` (`main`, `jobId=3`).
- **API:** `https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br` (`AVAILABLE`, TLSv1.3 até `2027-06-03`) -> Cutover concluído em 22/11 via [infra/cutover_api_domain.py](../infra/cutover_api_domain.py) (`ApiMappingId=mqdslq` apontando para `u0mxrf6mnk` / `$default` / `ApiMappingKey=""`). API anterior `war28zsged` (`api-enthony-sd`) preservada intacta.

### 5.1. Snapshot Pré-Cutover da API (Referência para Rollback)
- **Custom Domain:** `api.enthonyaraujo.grupo-03.sd.ufersa.dev.br` (`d-clp9xhs1n9.execute-api.us-east-1.amazonaws.com`)
- **Mapeamento raiz anterior:** `ApiMappingId=mqdslq`, `ApiId=war28zsged`, `Stage=$default`, `ApiMappingKey=""`.

### 5.2. Rollbacks Verificáveis (< 1 minuto)
- **Rollback do mapeamento DNS da API (`mqdslq` -> `war28zsged`):**
  ```python
  import boto3
  apigw = boto3.client("apigatewayv2", region_name="us-east-1")
  apigw.update_api_mapping(
      ApiMappingId="mqdslq",
      DomainName="api.enthonyaraujo.grupo-03.sd.ufersa.dev.br",
      ApiId="war28zsged",
      Stage="$default",
      ApiMappingKey="",
  )
  ```
- **Rollback da Lambda, Amplify `customHeaders`, Throttling, Logs e DynamoDB:** documentados individualmente na Seção 3 de [docs/AUDITORIA_SEGURANCA.md](AUDITORIA_SEGURANCA.md).

### 5.3. Verificação Pós-Manutenção e Retomada após Learner Lab
As credenciais do AWS Academy Learner Lab expiram ao fim de cada sessão (~4h), porém os serviços já publicados continuam operando normalmente na AWS. Ao iniciar uma nova sessão administrativa, atualize `~/.aws/credentials` e valide a integridade somente leitura com:
```bash
services/api/.venv/bin/python tests/e2e/verify_prod_domains.py
```
