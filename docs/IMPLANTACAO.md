# Guia de Implantação Reproduzível — AcadFlow

> **Status:** Preparação local pronta (scripts em modo *dry-run* por padrão). **Nenhum recurso AWS foi criado ainda.** Execute comandos contra a AWS apenas após diagnóstico de permissões (`infra/check_aws_env.py`), conferência de custos e autorização explícita.

---

## 1. Pré-requisitos e Diagnóstico Somente Leitura (Fase 0)

1. Configurar credenciais temporárias de sessão AWS **fora do repositório** (em `~/.aws/credentials` ou variáveis de ambiente da sessão; **nunca** commitar chaves ou tokens).
2. Criar o ambiente virtual Python (preferencialmente Python 3.12 para espelhar o runtime da Lambda):
   ```powershell
   python -m venv services/api/.venv
   .\services\api\.venv\Scripts\python.exe -m pip install -r services/api/requirements-dev.txt
   ```
3. Executar o diagnóstico **100% somente leitura** (substituindo `<regiao>` pela região real confirmada):
   ```powershell
   .\services\api\.venv\Scripts\python.exe infra/check_aws_env.py --region <regiao>
   ```
   O relatório classifica cada recurso/serviço em: `autorizado`, `acesso_negado`, `recurso_inexistente`, `nao_verificado` ou `servico_indisponivel`.

---

## 2. Empacotamento do Backend Lambda (`python3.12`)

```powershell
python services/api/build_package.py
```

- Gera `services/api/dist/acadflow-api.zip` contendo apenas o pacote puro Python `acadflow_api/` (sem `local_server.py`, sem testes e sem binários nativos).
- Handler configurado na Lambda: `acadflow_api.handler.lambda_handler`.
- Runtime alvo: `python3.12`.
- Variáveis de ambiente da Lambda: `TASKS_TABLE=acadflow-tasks` e `PAGES_TABLE=acadflow-pages`.
- O `boto3` utilizado em execução é o fornecido pelo runtime gerenciado da AWS Lambda.

---

## 3. Planejamento (*Dry-Run*) e Provisionamento Controlado

O script `infra/provision_stack.py` opera em modo **dry-run por padrão** (não altera nada na AWS):

```powershell
.\services\api\.venv\Scripts\python.exe infra/provision_stack.py `
  --region <regiao> `
  --app-origin https://<SEUNOME>.<grupo>.sd.ufersa.dev.br `
  --role-arn <ARN_DA_ROLE_VERIFICADA>
```

Somente após revisão da saída do plano, estimativa de custos e autorização explícita do usuário, executar com `--apply`.

### Checklist de Recursos Criados na Etapa de Backend + Identidade
1. **DynamoDB:** tabelas `acadflow-tasks` (P0) e `acadflow-pages` (P1), ambas com `ownerId` HASH S, `id` RANGE S e `PAY_PER_REQUEST`.
2. **Cognito User Pool:** login por e-mail, App Client **público** (sem secret), Authorization Code + PKCE (`S256`), URLs de callback/logout temporária e final, access token com TTL curto (15–30 min), Hosted UI Domain, e **2 usuários de teste com e-mails válidos** (evitar `@teste.local`).
3. **Lambda:** `acadflow-api` (`python3.12`, handler `acadflow_api.handler.lambda_handler`, role de execução verificada com acesso a DynamoDB nas tabelas `acadflow-tasks` e `acadflow-pages`, e CloudWatch Logs).
4. **API Gateway HTTP API v2:**
   - CORS restrito às origens autorizadas (`GET,POST,PATCH,DELETE,OPTIONS`, headers `Authorization,Content-Type`).
   - JWT Authorizer apontando para o Issuer do User Pool, Audience = App Client ID e `authorizationScopes` efetivamente presente no **access token** (ex.: `openid` ou escopo de Resource Server verificado em teste real).
   - Permissão `lambda:AddPermission` para o API Gateway invocar `acadflow-api`.
   - Rotas: `GET /health` (pública), `/tasks`, `/tasks/{id}`, `/pages`, `/pages/{id}` (todas protegidas pelo JWT Authorizer).

---

## 4. Publicação do Frontend (AWS Amplify Hosting) e SPA Rewrite

1. Configurar as variáveis de ambiente no Amplify (conforme `apps/web/.env.example`, **sem segredos**):
   - `VITE_API_URL`
   - `VITE_COGNITO_REGION`
   - `VITE_COGNITO_USER_POOL_ID`
   - `VITE_COGNITO_CLIENT_ID`
   - `VITE_COGNITO_DOMAIN`
   - `VITE_APP_URL`
2. Build specification versionada em `apps/web/amplify.yml` (base directory `apps/web`, output `dist`).
3. **Regra obrigatória de SPA Rewrite no Amplify Hosting** (Rewrites and redirects) para evitar `404` em `/auth/callback` e em recargas (`F5`):
   - **Source address:** `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>`
   - **Target address:** `/index.html`
   - **Type:** `200 (Rewrite)`

---

## 5. Certificados HTTPS (ACM), Domínios Institucionais e Plano de Cutover/Rollback da API

> **Estado definitivo em 22/11/2026 (`us-east-1`, Conta `****2503`):**
> - **Frontend (`https://enthonyaraujo.grupo-03.sd.ufersa.dev.br`):** `AVAILABLE` (TLSv1.3 até `2027-06-08`) no Amplify `dysbk8tmbj14k` (`main`, `jobId=2`, `VITE_API_URL=https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br`, SPA Rewrite `200 -> /index.html`).
> - **API (`https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br`):** **CUTOVER CONCLUÍDO** via [infra/cutover_api_domain.py](../infra/cutover_api_domain.py) — `ApiMappingId=mqdslq` atualizado de `war28zsged` -> `u0mxrf6mnk` (`Stage=$default`, `ApiMappingKey=""`), TLSv1.3 válido até `2027-06-03`. API anterior `war28zsged` (`api-enthony-sd`) preservada intacta.

### 5.1. Snapshot Exato do Mapeamento Atual da API (Pré-Cutover)
- **Custom Domain:** `api.enthonyaraujo.grupo-03.sd.ufersa.dev.br` (`REGIONAL`, `AVAILABLE`, `TLS_1_2`)
- **Target Regional:** `d-clp9xhs1n9.execute-api.us-east-1.amazonaws.com` (CNAME já propagado em `Z0906692126CHKWN9GQ2U`)
- **Certificado ACM:** `ISSUED`, válido até `2027-06-03`
- **Mapeamento Raiz Atual:**
  - `ApiMappingId`: `mqdslq`
  - `ApiId`: `war28zsged` (`api-enthony-sd`, URL direta `https://war28zsged.execute-api.us-east-1.amazonaws.com`)
  - `Stage`: `$default`
  - `ApiMappingKey`: `""` (raiz)

### 5.2. Consequências da Substituição e Alternativa Temporária `/acadflow`
- **Consequência de atualizar `mqdslq` (`war28zsged` -> `u0mxrf6mnk`):**
  - `https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br/*` passará a rotear para o AcadFlow (`acadflow-http-api`, `u0mxrf6mnk`).
  - A API anterior `api-enthony-sd` (`war28zsged`) **não é excluída** e continuará acessível por sua URL direta `https://war28zsged.execute-api.us-east-1.amazonaws.com`, mas deixará de responder no domínio customizado enquanto `mqdslq` apontar para `u0mxrf6mnk`.
- **Alternativa temporária sem impacto (`ApiMappingKey = "acadflow"`):**
  - É possível criar um mapeamento adicional em `api.enthonyaraujo.grupo-03.sd.ufersa.dev.br` com `ApiMappingKey="acadflow"` apontando para `u0mxrf6mnk` (`$default`), respondendo em `https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br/acadflow/health`, `/acadflow/tasks`, `/acadflow/pages`, **sem alterar `mqdslq`**.
  - No API Gateway HTTP API v2, o prefixo `ApiMappingKey` é removido automaticamente antes da chamada ao Lambda (`rawPath` chega como `/health`, `/tasks`, `/pages` quando não há stage nomeado — validar no primeiro teste!).
  - Para a apresentação final de 27/11, o cutover do mapeamento raiz (`mqdslq` -> `u0mxrf6mnk`) continua sendo a configuração mais limpa para o requisito oficial `https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br`.

### 5.3. Procedimento Verificável de Rollback (1 comando, < 5 segundos)
Caso seja necessário restaurar exatamente o estado anterior após um cutover autorizado de `mqdslq`:
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
Verificação pós-rollback: `get_api_mappings(DomainName="api.enthonyaraujo.grupo-03.sd.ufersa.dev.br")` confirma `ApiId == "war28zsged"`, `ApiMappingKey == ""`, `Stage == "$default"`.

### 5.4. Retomada Segura após Expiração do Learner Lab
O script [infra/deploy_acadflow.py](../infra/deploy_acadflow.py) é idempotente e salva metadados não secretos em `infra/deploy_state.json` (ignorado no `.gitignore`). Ao iniciar nova sessão do Learner Lab, basta atualizar `~/.aws/credentials` e reexecutar o passo desejado.
