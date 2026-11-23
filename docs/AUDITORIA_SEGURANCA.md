# Auditoria Técnica de Segurança, Hardening e Privacidade — AcadFlow

> **Versão pública sanitizada** (adequada para repositório público no GitHub: não contém credenciais, tokens, IDs de conta, dados pessoais ou detalhes exploráveis sobre riscos ainda abertos).  
> **Última atualização:** 23/11/2026  
> **Referências:** OWASP Top 10 (2021), OWASP API Security Top 10 (2023), AWS Well-Architected Security Pillar e LGPD (Lei nº 13.709/2018).  
> **Nota de transparência:** As medidas aplicadas e os testes aprovados reduzem riscos concretos, mas **não declaram o sistema invulnerável ou 100% seguro**; segurança e privacidade são processos contínuos.

---

## 1. Resumo Executivo dos Controles e Achados

| ID | Área | Severidade | Estado em 23/11/2026 |
|---|---|---|---|
| **SEC-04** | Allowlist estrita do JSON ProseMirror/Tiptap no backend (nós, marcas, atributos e URLs seguras) | Média | **Implantado na Lambda `acadflow-api` (v1) e validado em produção** |
| **SEC-02** | Cabeçalhos HTTP de segurança na API + `customHeaders` no Amplify com CSP em `Report-Only` | Média | **Implantado na API e no Amplify (`Report-Only` ativo; sem CSP bloqueante ainda)** |
| **SEC-03** | Throttling no stage `$default` do API Gateway (`20 req/s`, `burst 40`) | Média | **Implantado na AWS e validado** (zero `429`) |
| **SEC-06a** | Retenção de 14 dias em `/aws/lambda/acadflow-api` | Média | **Implantado na AWS e validado** (zero perda de logs existentes) |
| **SEC-06b** | Access Logs JSON mínimos do API Gateway (`/aws/apigateway/acadflow-http-api`, 14 dias) | Média | **Implantado na AWS e validado** (eventos reais confirmados sem PII/tokens) |
| **SEC-08** | `DeletionProtectionEnabled=True` nas tabelas DynamoDB `acadflow-tasks` e `acadflow-pages` | Baixa | **Implantado na AWS e validado** (PITR mantido desabilitado) |
| **SEC-05** | Higiene de origens/callbacks de desenvolvimento em produção | Média | **Adiado propositalmente** (callbacks `localhost` preservados para dev local no Fedora) |
| **SEC-07** | Auto-cadastro aberto, MFA e política de senha do Cognito | Baixa | **Preservado sem alteração** (compatível com a demonstração acadêmica) |
| **SEC-09** | Privacidade, minimização de dados e práticas LGPD | Baixa | **Fortalecido** (logs mínimos + retenção 14 dias; aviso na UI e eliminação automatizada de conta no backlog) |
| **SEC-01** | Execução da Lambda com `LabRole` compartilhada | Alta *(estrutural Lab)* | **Risco residual aceito** (restrição nativa do AWS Academy Learner Lab) |
| **SEC-10 / SEC-11** | Validação de formato UUID em `{id}` e timeout explícito `fetch` | Informativa | **Backlog de defesa em profundidade** |

---

## 2. Isolamento de Usuários e Autorização

- **Controles ativos em produção:**
  - JWT Authorizer no API Gateway HTTP API em todas as 10 rotas `/tasks*` e `/pages*` (`GET /health` única rota pública).
  - Defesa em profundidade na Lambda exigindo `sub` não vazio, `token_use == "access"` e `exp` vigente.
  - Chaves compostas `(ownerId=sub, id)` em `acadflow-tasks` e `acadflow-pages`, uso exclusivo de `Query` (zero `Scan`), `ConditionExpression`, rejeição de `ownerId` no payload (`400`) e retorno uniforme `404` para recursos inexistentes ou de terceiros.
- **Evidências obtidas:**
  - Fronteira HTTP em produção: **13/13 `401`** (10 rotas anônimas + 3 tokens inválidos/forjados).
  - Lambda `python3.12` + DynamoDB reais (sondas efêmeras isoladas): **19/19 PASS** (CRUD, `409`, `400` para payloads inseguros, `404` cruzado).
  - Suíte local Python `3.12.14`: **60/60 Pytest PASS** + **26/26 Smoke HTTP PASS**.
- **Pendência prioritária (não substituída por simulações):**
  - O User Pool Cognito possui atualmente **1 conta `CONFIRMED` e 1 conta `UNCONFIRMED`**. A confirmação da 2ª conta real pelo usuário e a execução do teste autenticado com dois JWTs reais (`tests/e2e/smoke_api.py` com `ACADFLOW_TOKEN_A`, `ACADFLOW_TOKEN_B` e `ACADFLOW_ID_TOKEN_A`) continuam obrigatórias para encerrar `AC-04`, `AC-09` e `AC-P1-02`.

---

## 3. Alterações Aplicadas na AWS — Antes, Depois e Rollback

### 3.1. Etapa 1 — Lambda `acadflow-api` (`SEC-04` + `SEC-02` API)
- **Compatibilidade pré-deploy:** 2/2 páginas existentes em `acadflow-pages` validadas em memória sem exibir conteúdo -> **100% compatíveis**.
- **Antes:** `$LATEST`, `CodeSha256: jE1XyDG+LlzoKo0nBuPD0TMRogDkGPxXJuwr8iNY2Gk=` (`11.993` bytes; backup local salvo).
- **Depois:** versão publicada **`1`** (`CodeSha256: dlDX0MabbcRVYZ8R09KhN33AriYg3KLoHB4XIssi5AM=`, `13.953` bytes, `LastUpdateStatus: Successful`):
  - Allowlist ProseMirror/Tiptap server-side (`doc`, `paragraph`, `heading` `1..3`, `bulletList`, `orderedList`, `listItem`, `taskList`, `taskItem`, `blockquote`, `codeBlock`, `text`, `hardBreak`, `horizontalRule`; marcas `bold`, `italic`, `strike`, `code`, `underline`, `link` restrita a `http`/`https`/`mailto`; limites de 20 níveis, 2.000 nós e 100 KB).
  - Cabeçalhos HTTP em todas as respostas JSON: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
- **Validação pós-deploy:** `GET /health` retornando `200` com todos os 4 cabeçalhos + **19/19** asserções reais na Lambda/DynamoDB + **18/18** em `verify_prod_domains.py`.
- **Rollback:** reenviar o ZIP anterior via `lambda:UpdateFunctionCode(FunctionName="acadflow-api", ZipFile=...)`.

### 3.2. Etapa 2 — Cabeçalhos de Segurança no AWS Amplify (`SEC-02`)
- **Antes:** `customHeaders: ""` (nenhum cabeçalho HTTP de segurança).
- **Depois:** aplicado [infra/amplify_security_headers.yml](../infra/amplify_security_headers.yml) em `acadflow-web`:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Content-Security-Policy-Report-Only` (estritamente não bloqueante, sem endpoint externo `report-uri`/`report-to`, calibrada para React/Vite, Tiptap, API institucional e Cognito).
- **Validação pós-alteração:** confirmados todos os 6 cabeçalhos ao vivo em `/`, `/login`, bundle JS e CSS (`Content-Security-Policy` bloqueante permanece `null`) + `verify_prod_domains.py` **18/18 PASS**.
- **Validação complementar pendente no navegador:** inspecionar o console do DevTools durante login Cognito, uso do editor Tiptap e viewport mobile (`375x812`) para confirmar zero avisos de CSP antes de qualquer futura promoção para modo bloqueante.
- **Rollback:** `amplify:UpdateApp(appId="<AMPLIFY_APP_ID>", customHeaders="")`.

### 3.3. Etapa 3 — Proteção do DynamoDB (`SEC-08`)
- **Antes:** `acadflow-tasks` e `acadflow-pages` com `DeletionProtectionEnabled: false`, `PITR: DISABLED`.
- **Depois:** `DeletionProtectionEnabled: true` em ambas as tabelas (`TableStatus: ACTIVE`, `PITR: DISABLED` mantido sem custo adicional).
- **Distinção técnica importante:**
  - **`DeletionProtectionEnabled` (custo zero):** impede exclusivamente exclusão acidental da tabela inteira (`DeleteTable`).
  - **Exclusão de registros individuais (`DeleteItem`):** controlada por autorização por proprietário (`ownerId=sub`), confirmação na interface e concorrência otimista (`version`).
  - **Backup e recuperação (PITR / backups sob demanda):** únicos mecanismos que recuperam dados apagados ou corrompidos, porém envolvem cobrança adicional — mantidos desligados no Learner Lab.
- **Validação pós-alteração:** CRUD real de registros individuais em ambas as tabelas aprovado sem regressão.
- **Rollback:** `dynamodb:UpdateTable(TableName="<tabela>", DeletionProtectionEnabled=False)`.

### 3.4. Etapa 4 — Throttling (`SEC-03`) e Logs Mínimos com Privacidade (`SEC-06`)
- **Throttling (`acadflow-http-api`, stage `$default`):**
  - **Antes:** `DefaultRouteSettings: {"DetailedMetricsEnabled": false}`.
  - **Depois:** `ThrottlingRateLimit: 20.0`, `ThrottlingBurstLimit: 40` (demais APIs da conta confirmadas inalteradas).
  - **Rollback:** restaurar `DefaultRouteSettings={"DetailedMetricsEnabled": False}`.
- **Retenção Lambda (`/aws/lambda/acadflow-api`):**
  - **Antes:** `retentionInDays: null` (infinita).
  - **Depois:** `retentionInDays: 14` (zero logs existentes perdidos).
  - **Rollback:** `logs:DeleteRetentionPolicy(logGroupName="/aws/lambda/acadflow-api")`.
- **Access Logs mínimos (`/aws/apigateway/acadflow-http-api`, stage `$default`):**
  - **Antes:** Log Group inexistente; `AccessLogSettings: null`.
  - **Depois:** Log Group criado com **`retentionInDays: 14`** e formato JSON estritamente mínimo:
    ```json
    {"timestamp":"$context.requestTime","requestId":"$context.requestId","route":"$context.routeKey","method":"$context.httpMethod","status":"$context.status","responseTimeMs":"$context.responseLatency"}
    ```
  - **Campos explicitamente excluídos:** senhas, JWTs, `Authorization`, cookies, e-mails, conteúdo de páginas/tarefas, corpos de requisição, query strings e IPs de origem.
  - **Validação real:** eventos gravados em `/aws/apigateway/acadflow-http-api` inspecionados — formato JSON válido, exatamente as 6 chaves permitidas e **zero** dados sensíveis detectados.
  - **Rollback:** remover `AccessLogSettings` via `apigatewayv2:UpdateStage` (preservando `DefaultRouteSettings`).

---

## 4. Avaliação de Privacidade (LGPD) e Riscos Residuais

- **Postura de privacidade atual:**
  - Minimização efetiva (apenas e-mail no Cognito; apenas `sub` opaco como `ownerId` no DynamoDB; `ownerId` omitido nas respostas).
  - Tokens apenas em `sessionStorage`, zero cookies/analytics de terceiros, `Cache-Control: no-store` ativo na API, logs da Lambda e Access Logs do API Gateway com retenção finita de 14 dias e sem PII/tokens.
- **Riscos residuais conhecidos:**
  1. `LabRole` compartilhada na Lambda (`SEC-01`, restrição do AWS Academy Learner Lab).
  2. Teste HTTP com 2 contas reais Cognito ainda pendente da confirmação da 2ª conta (`AC-04`, `AC-09`, `AC-P1-02`).
  3. CSP ainda em modo `Report-Only` até validação em navegador autenticado (`SEC-02`).
  4. Origens/callbacks de desenvolvimento mantidos para suporte ao ambiente local Fedora (`SEC-05`) e auto-cadastro/MFA preservados para a demonstração (`SEC-07`).
  5. *Access tokens* JWT stateless permanecem válidos até expiração (30 min) após logout; aviso conciso de privacidade na tela de login e exclusão automatizada completa de conta permanecem no backlog (`SEC-09`).
  6. Validação de formato UUID em `{id}` e timeout explícito `fetch` no frontend no backlog (`SEC-10`, `SEC-11`).
