# Arquitetura e Contratos Técnicos — AcadFlow

> **Última atualização:** 23/11/2026  
> **Referência oficial:** [docs/AVALIACAO.md](AVALIACAO.md) *(somente leitura)*.  
> **Nota:** Os quatro requisitos oficiais do docente são: (1) arquitetura de três camadas, (2) comunicação por APIs baseadas em recursos, (3) DNS personalizado para aplicação e API em HTTPS e (4) autenticação de usuário e autorização de chamadas à API. A stack abaixo representa a escolha técnica desta implementação.

---

## 1. Infraestrutura Publicada na AWS (`us-east-1`, Conta `****2503`)

| Camada / Serviço | Recurso Real | Configuração Ativa Verificada (23/11/2026) |
|---|---|---|
| **Camada 1 — Apresentação** | AWS Amplify Hosting `acadflow-web` (`dysbk8tmbj14k`) | Branch `main`, `jobId=3` (bundle `/assets/index-BLG3afUM.js`), SPA Rewrite `200 -> /index.html`, `customHeaders` de segurança (`HSTS`, `nosniff`, `DENY`, `Referrer-Policy`, `Permissions-Policy`, `CSP-Report-Only`), domínio `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br` (`AVAILABLE`, TLSv1.3 até 08/06/2027) |
| **DNS & Certificados** | Amazon Route 53 (`Z0906692126CHKWN9GQ2U`) + ACM | Frontend: registro `A` ALIAS -> CloudFront do Amplify; API: `CNAME` -> `d-clp9xhs1n9.execute-api.us-east-1.amazonaws.com` (ACM `ISSUED`, TLSv1.3 até 03/06/2027); recursos de avaliações anteriores preservados intactos |
| **Identidade** | Amazon Cognito `acadflow-users` (`us-east-1_tKA6pURyD`) | Login por e-mail, App Client público `acadflow-web-client` (`30f7tlmajc9moo6tr5q06pmkg3`, sem `client_secret`), OAuth2 **Authorization Code + PKCE (S256)**, `EnableTokenRevocation=true`, `PreventUserExistenceErrors=ENABLED`, Access/ID Token `30 min`, Refresh Token `1 dia`, Hosted UI `acadflow-enthony-sd.auth.us-east-1.amazoncognito.com` |
| **Camada 2 — Entrada REST** | API Gateway HTTP API v2 `acadflow-http-api` (`u0mxrf6mnk`) | Domínio oficial `https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br` (`ApiMappingId=mqdslq`, stage `$default`), JWT Authorizer `acadflow-cognito-jwt` (`Issuer`, `Audience`, `AuthorizationScopes=["openid"]`), CORS restrito, throttling `20 req/s` (burst `40`), Access Logs JSON mínimos (`/aws/apigateway/acadflow-http-api`, retenção `14 dias`) |
| **Camada 2 — Negócios** | AWS Lambda `acadflow-api` (`Version=1`, `python3.12`) | Handler `acadflow_api.handler.lambda_handler`, 256 MB, timeout 10s, `LabRole`, env `TASKS_TABLE=acadflow-tasks` e `PAGES_TABLE=acadflow-pages`, código Python puro (zero dependências externas no ZIP), allowlist ProseMirror/Tiptap (`SEC-04`), cabeçalhos HTTP de segurança (`SEC-02`), logs `/aws/lambda/acadflow-api` com retenção `14 dias` |
| **Camada 3 — Dados** | Amazon DynamoDB `acadflow-tasks` e `acadflow-pages` | `ACTIVE`, `PAY_PER_REQUEST`, PK `ownerId` (`S`), SK `id` (`S`), `DeletionProtectionEnabled=True`, criptografia em repouso AES-256 gerenciada pela AWS, `PITR=DISABLED` (sem custo adicional no Learner Lab) |

---

## 2. Arquitetura em Três Camadas e Fluxo de Requisições

```text
[Navegador (Desktop / Mobile 375x812)]
        |  HTTPS TLSv1.3 (https://enthonyaraujo.grupo-03.sd.ufersa.dev.br)
        v
[Camada 1 — Apresentação: React 19 + TypeScript + Vite + Tiptap (AWS Amplify)]
        |  1) OAuth2 Authorization Code + PKCE (oidc-client-ts) <--> [Amazon Cognito User Pool]
        |  2) REST/JSON + Authorization: Bearer <access_token>
        v
[Amazon API Gateway HTTP API v2 (https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br)]
        |  JWT Authorizer (Issuer + Audience + scope=openid -> rejeita anônimos 401 e ID tokens 403)
        |  CORS restrito + Throttling (20 req/s, burst 40) + Access Logs mínimos (14 dias)
        v
[Camada 2 — Negócios: AWS Lambda Python 3.12 (acadflow_api.handler.lambda_handler)]
        |  Defesa em profundidade: exige claims.sub não vazio + token_use=="access" + exp vigente
        |  Validação estrita (allowlist de campos e AST ProseMirror) + headers de segurança
        |  AWS SDK (boto3 do runtime) via IAM Execution Role (LabRole)
        v
[Camada 3 — Persistência: Amazon DynamoDB (PK=ownerId, SK=id, DeletionProtection=True)]
        ├── acadflow-tasks  (Query por ownerId + ConditionExpression em escrita/exclusão)
        └── acadflow-pages  (Query por ownerId + controle otimista por version -> 409)
```

### Responsabilidades por Camada
1. **Apresentação (`apps/web`):** renderização da interface responsiva, fluxo OIDC PKCE (`oidc-client-ts`), armazenamento transitório de sessão em `sessionStorage`, validação preventiva de formulários, editor estruturado Tiptap com debounce de auto-save (1,5 s) e tratamento explícito de `401`/`403`/`409`. Nunca recebe credenciais AWS nem acessa o DynamoDB diretamente.
2. **Aplicação / Negócios (`services/api` + API Gateway + Cognito):** autenticação de identidade no Cognito, validação criptográfica do JWT no API Gateway, extração exclusiva do proprietário (`ownerId = claims["sub"]`), regras de validação, serialização sanitizada (sem `ownerId` nas respostas e sem stack traces em erro `500`) e controle de versão otimista.
3. **Persistência (`acadflow-tasks` e `acadflow-pages`):** armazenamento isolado por chave composta `(ownerId, id)` utilizando apenas `Query`, `GetItem`, `PutItem`, `UpdateItem` e `DeleteItem` condicionais (**zero `Scan`**).

---

## 3. Contrato da API REST (Verificado no Código e em Produção)

URL base de produção: `https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br`

### 3.1. Rotas Implementadas

| Método | Rota | Autenticação | Status de Sucesso | Finalidade |
|---|---|---|---|---|
| `GET` | `/health` | Pública | `200 OK` | Verificação básica de disponibilidade (`{"status":"ok","service":"acadflow-api"}`). |
| `GET` | `/tasks` | JWT Access Token | `200 OK` | Lista apenas as tarefas do usuário autenticado (`Query` por `ownerId = sub`, ordenadas por `createdAt` desc). |
| `POST` | `/tasks` | JWT Access Token | `201 Created` | Cria tarefa com `id` UUID, `ownerId = sub` e timestamps UTC gerados no servidor. |
| `GET` | `/tasks/{id}` | JWT Access Token | `200 OK` | Consulta tarefa própria por `(ownerId, id)`; retorna `404` se inexistente ou de outro usuário. |
| `PATCH` | `/tasks/{id}` | JWT Access Token | `200 OK` | Atualização parcial condicional (`title`, `description`, `dueDate`, `priority`, `status`); `404` se não pertencer ao `sub`. |
| `DELETE` | `/tasks/{id}` | JWT Access Token | `204 No Content` | Exclusão condicional em `(ownerId, id)`; `404` se não pertencer ao `sub`. |
| `GET` | `/pages` | JWT Access Token | `200 OK` | Lista resumos (`PageSummary`, sem `content`) das páginas próprias ordenadas por `updatedAt` desc. |
| `POST` | `/pages` | JWT Access Token | `201 Created` | Cria página pessoal com `version = 1` e conteúdo estruturado ProseMirror validado. |
| `GET` | `/pages/{id}` | JWT Access Token | `200 OK` | Retorna página completa (`Page`) própria ou `404` se inexistente/alheia. |
| `PATCH` | `/pages/{id}` | JWT Access Token | `200 OK` | Atualiza `title`/`icon`/`content`, incrementa `version`; aceita `expectedVersion` (`409` em conflito); `404` se inexistente/alheia. |
| `DELETE` | `/pages/{id}` | JWT Access Token | `204 No Content` | Remove página própria ou retorna `404` se inexistente/alheia. |

### 3.2. Códigos de Resposta HTTP

| Código | Significado no AcadFlow | Exemplo de Ocorrência |
|---|---|---|
| `200 OK` | Consulta ou atualização bem-sucedida | `GET /health`, `GET/PATCH /tasks*`, `GET/PATCH /pages*` |
| `201 Created` | Recurso criado e persistido no DynamoDB | `POST /tasks`, `POST /pages` |
| `204 No Content` | Exclusão concluída ou preflight CORS | `DELETE /tasks/{id}`, `DELETE /pages/{id}`, `OPTIONS` |
| `400 Bad Request` | JSON inválido (`INVALID_JSON`) ou violação de contrato (`VALIDATION_ERROR`) | Título ausente, status inválido, `ownerId` enviado no body, nó/URL ProseMirror proibido |
| `401 Unauthorized` | Token ausente, malformado, expirado ou `token_use != "access"` na Lambda | Chamada anônima ou JWT expirado/inválido |
| `403 Forbidden` | JWT rejeitado pelo authorizer por falta de escopo exigido (`scope=openid`) | Envio de **ID token** Cognito em vez de *access token* (comprovado em produção) |
| `404 Not Found` | Rota inexistente ou recurso inexistente/pertencente a outro usuário | `GET/PATCH/DELETE` de recurso de `Usuário A` feito por `Usuário B` (anti-IDOR) |
| `409 Conflict` | Conflito de concorrência otimista (`VERSION_CONFLICT`) | `PATCH /pages/{id}` com `expectedVersion` diferente da versão atual no DynamoDB |
| `500 Internal Server Error` | Falha interna inesperada (`INTERNAL_ERROR`, sem stack trace) | Erro não tratado na camada de execução |

Todas as respostas emitidas pela Lambda incluem os cabeçalhos `Content-Type: application/json`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` e `Referrer-Policy: no-referrer`.

### 3.3. Modelos de Dados e Exemplos Seguros

#### `POST /tasks` — Exemplo de requisição e resposta (`201 Created`)
```json
// Request (Header: Authorization: Bearer <access_token>)
{
  "title": "Revisar slides de Sistemas Distribuídos",
  "description": "Conferir arquitetura de 3 camadas e demo",
  "dueDate": "2026-11-27",
  "priority": "high",
  "status": "pending"
}
```
```json
// Response (201 Created — ownerId nunca é retornado)
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Revisar slides de Sistemas Distribuídos",
  "description": "Conferir arquitetura de 3 camadas e demo",
  "dueDate": "2026-11-27",
  "priority": "high",
  "status": "pending",
  "createdAt": "2026-11-23T18:00:00Z",
  "updatedAt": "2026-11-23T18:00:00Z"
}
```
- **Regras (`services/api/src/acadflow_api/models.py`):** `title` obrigatório (`1–120` chars), `description` opcional (`<= 1.000` chars), `dueDate` (`null` ou `YYYY-MM-DD` válido), `priority` (`low` | `medium` | `high`), `status` (`pending` | `in_progress` | `done`). Campos desconhecidos ou protegidos (`ownerId`, `id`, `createdAt`, `updatedAt`) -> `400 VALIDATION_ERROR`.

#### `POST /pages` e `PATCH /pages/{id}` — Exemplo de requisição e resposta (`201` / `200`)
```json
// Request POST /pages
{
  "title": "Resumo — Sistemas Distribuídos",
  "icon": "📘",
  "content": {
    "type": "doc",
    "content": [
      {
        "type": "heading",
        "attrs": { "level": 2 },
        "content": [{ "type": "text", "text": "Arquitetura em 3 camadas" }]
      },
      {
        "type": "paragraph",
        "content": [{ "type": "text", "text": "Amplify, API Gateway + Lambda e DynamoDB." }]
      }
    ]
  }
}
```
```json
// Envelope padrão de erro (400 / 401 / 404 / 409 / 500)
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Page was modified by another session. Reload before saving."
  }
}
```
- **Regras (`services/api/src/acadflow_api/page_models.py`):** `title` obrigatório (`1–120` chars), `icon` opcional (`<= 8` chars, default `"📄"`), `expectedVersion` inteiro positivo no `PATCH`. O campo `content` aceita exclusivamente JSON estruturado ProseMirror (`type: "doc"`) com profundidade máxima `20`, máximo de `2.000` nós, limite de **100 KB (`102.400` bytes UTF-8)** e allowlist estrita de nós (`doc`, `paragraph`, `heading` `1..3`, `bulletList`, `orderedList`, `listItem`, `taskList`, `taskItem`, `blockquote`, `codeBlock`, `text`, `hardBreak`, `horizontalRule`), marcas (`bold`, `italic`, `strike`, `code`, `underline`, `link`) e esquemas de URL (`http`, `https`, `mailto`).

---

## 4. Segurança, Sessão e Limitações Conhecidas

- **Autenticação e logout:** o frontend (`oidc-client-ts`) usa Authorization Code + PKCE (`S256`) em `sessionStorage`, substitui a URL após `/auth/callback` e envia apenas `access_token`. No logout, chama `/oauth2/revoke` (melhor esforço para o *refresh token*), limpa `sessionStorage` e redireciona ao `/logout` do Cognito Hosted UI.
- **Limitação transparente de JWT stateless:** `/logout` no Cognito encerra a sessão no navegador e revoga o *refresh token*, mas *access tokens* JWT já emitidos permanecem tecnicamente válidos até `exp` (30 min).
- **Hardening e riscos residuais:** cabeçalhos de segurança (`CSP-Report-Only` no Amplify + headers na API), throttling `20/40`, retenção de 14 dias nos logs da Lambda e Access Logs mínimos sem PII, e `DeletionProtectionEnabled=True` nas duas tabelas DynamoDB. Riscos residuais detalhados (incluindo `LabRole` compartilhada no Learner Lab, CSP em `Report-Only` e callbacks `localhost` para desenvolvimento) estão documentados em [docs/AUDITORIA_SEGURANCA.md](AUDITORIA_SEGURANCA.md).

---

## 5. Diagnóstico Histórico da Fase 0 (22/11/2026)

A matriz de permissões inicial verificada via `infra/check_aws_env.py` + `iam:SimulatePrincipalPolicy` confirmou disponibilidade integral na conta AWS Academy Learner Lab (`****2503`, `us-east-1`, `LabRole`) para STS, EC2, IAM (`PassRole` restrito a `LabRole`), DynamoDB, Lambda `python3.12`, CloudWatch Logs, API Gateway HTTP API, Cognito, Amplify Hosting, ACM e Route 53 (`Z0906692126CHKWN9GQ2U`). Todas as decisões técnicas pendentes da Fase 0 foram concluídas; resta apenas a apresentação presencial e a submissão no SIGAA em **27/11/2026**.
