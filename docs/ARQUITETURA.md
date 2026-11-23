# Arquitetura e Decisões Técnicas — AcadFlow

> **Última atualização:** 22/11/2026  
> **Fontes:** `docs/PLANO_PROJETO_FINAL.md` e `REVISAO_IMPLEMENTATION_PLAN.md`.  
> **Nota importante:** Os quatro requisitos oficiais do docente são: (1) arquitetura de três camadas, (2) comunicação por APIs baseadas em recursos, (3) DNS personalizado para aplicação e API em HTTPS e (4) autenticação de usuário e autorização de chamadas à API. A stack abaixo é a escolha técnica desta implementação.

---

## 1. Diagnóstico Real da Fase 0 (Estado em 22/11/2026)

### 1.1. Ambiente Local Inicial (Windows -> Migrado para Fedora Linux em 23/11/2026)
- **Repositório:** `enthonyaraujo/distributed_systems` (branch `main`).
- **Estação inicial (Windows):** Node.js `v26.13.0`, npm `11.20.0` (`npm.cmd`), Python `3.15.2` (runtime validado na AWS Lambda `python3.12` em `AC-15`).
- **Estação alvo (Fedora Linux):** ver guia reproduzível completo em `docs/CONFIGURACAO_FEDORA.md` (Python 3.12 nativo, Node.js/npm e AWS CLI).

### 1.2. Matriz de Permissões AWS (Verificada em 22/11/2026 — Somente Leitura)

> Diagnóstico executado via `infra/check_aws_env.py` + `iam:SimulatePrincipalPolicy` (somente leitura, zero mutações). Conta AWS Academy Learner Lab (`****2503`, `assumed-role/voclabs`), região ativa **`us-east-1`**.

| Serviço / Verificação | Status Real | Detalhes Verificados |
|---|---|---|
| AWS STS (`GetCallerIdentity`) | `autorizado` | Conta `****2503` (`assumed-role/voclabs`), sem região default em `~/.aws/config`, recursos em `us-east-1` |
| Regiões (`ec2:DescribeRegions`) | `autorizado` | 17 regiões habilitadas; padrão dos recursos existentes: **`us-east-1`** |
| IAM Role de execução (`LabRole`) | `autorizado` | `LabRole` existente; `iam:PassRole` **`allowed`** especificamente em `LabRole` (`implicitDeny` em `*`); trust inclui `lambda.amazonaws.com` |
| Permissões runtime de `LabRole` | `autorizado` | `dynamodb:Query/GetItem/PutItem/UpdateItem/DeleteItem` e `logs:CreateLogGroup/CreateLogStream/PutLogEvents` -> todos **`allowed`** |
| Amazon DynamoDB | `autorizado` | `ListTables` (`0` tabelas atuais) + `CreateTable` **`allowed`** |
| AWS Lambda (`python3.12`) | `autorizado` | `ListFunctions` (9 funções existentes, incluindo `lambda-dados-enthony` em `python3.12`) + `CreateFunction`/`UpdateFunctionCode`/`AddPermission` **`allowed`** |
| Amazon CloudWatch Logs | `autorizado` | `DescribeLogGroups` (9 log groups) |
| Amazon API Gateway HTTP API (v2) | `autorizado` | `GetApis`/`GetDomainNames` + `POST/PATCH/DELETE` **`allowed`**; domínio `api.enthonyaraujo.grupo-03.sd.ufersa.dev.br` já `AVAILABLE` (`d-clp9xhs1n9.execute-api.us-east-1.amazonaws.com`, atualmente mapeado via `mqdslq` para `war28zsged` / `api-enthony-sd`) |
| Amazon Cognito User Pool | `autorizado` | `ListUserPools` (1 pool prévio `us-east-1_Klis7IMHv`) + `CreateUserPool`/`CreateUserPoolClient`/`CreateUserPoolDomain`/`AdminCreateUser`/`AdminSetUserPassword` **`allowed`** |
| AWS Amplify Hosting | `autorizado` | `ListApps` (0 apps) + `CreateApp`/`CreateBranch`/`CreateDeployment`/`StartDeployment`/`CreateDomainAssociation`/`UpdateApp` **`allowed`** |
| AWS Certificate Manager (ACM) | `autorizado` | `ListCertificates` + `RequestCertificate` **`allowed`**; certificado `ISSUED` para `api.enthonyaraujo.grupo-03.sd.ufersa.dev.br` válido até `2027-06-03` |
| Amazon Route 53 (`Z0906692126CHKWN9GQ2U`) | `autorizado` | Hosted Zone `enthonyaraujo.grupo-03.sd.ufersa.dev.br.` na **mesma conta `****2503`** (7 registros); `ChangeResourceRecordSets` simulado **`allowed`** na zona (escrita efetiva ainda não executada) |

### 1.3. Domínios Institucionais e Recursos Reais Provisionados (22/11/2026, `us-east-1`, Conta `****2503`)
- **SEUNOME:** `enthonyaraujo` | **Grupo:** `grupo-03`
- **DynamoDB:** `acadflow-tasks` (`ACTIVE`, PK `ownerId`, SK `id`, `PAY_PER_REQUEST`) e `acadflow-pages` (`ACTIVE`, PK `ownerId`, SK `id`, `PAY_PER_REQUEST`).
- **Cognito:** User Pool `acadflow-users` (`us-east-1_tKA6pURyD`), App Client público `acadflow-web-client` (`30f7tlmajc9moo6tr5q06pmkg3`, PKCE S256, `EnableTokenRevocation=true`, Access Token 30 min, Refresh Token 1 dia), Hosted UI `https://acadflow-enthony-sd.auth.us-east-1.amazoncognito.com`. Nenhum usuário fictício foi criado.
- **Lambda:** `acadflow-api` (`python3.12`, `LabRole`, 256 MB, timeout 10s, `TASKS_TABLE=acadflow-tasks`, `PAGES_TABLE=acadflow-pages`, handler `acadflow_api.handler.lambda_handler`).
- **HTTP API (v2):** `acadflow-http-api` (`u0mxrf6mnk`), URL temporária `https://u0mxrf6mnk.execute-api.us-east-1.amazonaws.com`, JWT Authorizer `acadflow-cognito-jwt` (`0p1r2j`, `AuthorizationScopes=["openid"]`), 11 rotas (`GET /health` pública; 10 rotas `/tasks*` e `/pages*` protegidas por JWT), stage `$default` (`AutoDeploy=true`).
- **Amplify Hosting:** `acadflow-web` (`dysbk8tmbj14k`, branch `main`, SPA Rewrite `200 -> /index.html`, deploy `jobId=2` apontando `VITE_API_URL=https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br`), URL institucional ativa `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br` (`AVAILABLE`, TLSv1.3 válido até `2027-06-08`).
- **Frontend DNS (`Z0906692126CHKWN9GQ2U`):** `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br` com registro `A` ALIAS (`d1hravuu9u66au.cloudfront.net.`) e CNAME ACM (`_879fb87bbff1c6966ec697d456a1e770...`); todos os 7 registros anteriores preservados intactos.
- **API DNS (`api.enthonyaraujo.grupo-03.sd.ufersa.dev.br`):** **CUTOVER CONCLUÍDO (22/11/2026)** — `ApiMappingId=mqdslq` atualizado de `war28zsged` -> `u0mxrf6mnk` (`Stage=$default`, `ApiMappingKey=""`), TLSv1.3 válido até `2027-06-03`. API anterior `api-enthony-sd` (`war28zsged`) preservada intacta em `https://war28zsged.execute-api.us-east-1.amazonaws.com` com rollback documentado em `docs/IMPLANTACAO.md`.
- **Restrições do Learner Lab:** credenciais temporárias expiram ao fim da sessão (~4h); `iam:PassRole` restrito a `LabRole`; recursos de avaliações anteriores mantidos 100% isolados.

---

## 2. Arquitetura de Três Camadas

```text
[Navegador (Desktop / Mobile)]
        |  HTTPS (https://<SEUNOME>.<grupo>.sd.ufersa.dev.br)
        v
[Camada 1 — Apresentação: React + TypeScript + Vite no AWS Amplify]
        |  OAuth2 Authorization Code + PKCE (oidc-client-ts) <--> [Amazon Cognito User Pool]
        |  REST/JSON + Authorization: Bearer <access_token>
        v
[Amazon API Gateway HTTP API v2 (https://api.<SEUNOME>.<grupo>.sd.ufersa.dev.br)]
        |  JWT Authorizer (Issuer + Audience + authorizationScopes)
        v
[Camada 2 — Negócios: AWS Lambda Python 3.12 (acadflow_api.handler.lambda_handler)]
        |  Exige claims.sub não vazio + claims.token_use == "access"
        |  AWS SDK (boto3 do runtime) via IAM Execution Role
        v
[Camada 3 — Dados: Amazon DynamoDB (tabela acadflow-tasks, PK=ownerId, SK=id)]
```

### Substituições e Contingências
Nenhuma substituição (ex.: S3 + CloudFront ou API Gateway REST API) é considerada pré-aprovada. Caso o diagnóstico real indique `acesso_negado` ou `servico_indisponivel`, uma proposta formal com impacto em contratos/eventos/custos será submetida para aprovação explícita do usuário.

---

## 3. Contratos Congelados de Dados e API

### 3.1. Modelo `Task`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Entregar trabalho de SD",
  "description": "Preparar apresentação e testar deploy",
  "dueDate": "2026-11-27",
  "priority": "high",
  "status": "pending",
  "createdAt": "2026-11-22T18:00:00Z",
  "updatedAt": "2026-11-22T18:00:00Z"
}
```

- `title`: obrigatório, 1–120 caracteres após `strip()`.
- `description`: opcional (default `""`), até 1.000 caracteres.
- `dueDate`: opcional (`null` ou `YYYY-MM-DD` válido).
- `priority`: `low` | `medium` | `high` (default `medium` no `POST`).
- `status`: `pending` | `in_progress` | `done` (default `pending` no `POST`).
- Campos desconhecidos ou protegidos (`ownerId`, `id`, `createdAt`, `updatedAt`) no payload: rejeitados com `400 VALIDATION_ERROR`.

### 3.2. Endpoints HTTP
| Método | Rota | Auth | Sucesso | Observação |
|---|---|---|---|---|
| `GET` | `/health` | Pública | `200 OK` | `{"status":"ok","service":"acadflow-api"}` |
| `GET` | `/tasks` | JWT Access Token | `200 OK` | `{"items":[Task,...]}` via `Query` por `ownerId = sub` |
| `POST` | `/tasks` | JWT Access Token | `201 Created` | Gera `id`, `createdAt`, `updatedAt` em UTC |
| `GET` | `/tasks/{id}` | JWT Access Token | `200 OK` | Chave `(ownerId, id)`; `404` se inexistente ou de outro usuário |
| `PATCH` | `/tasks/{id}` | JWT Access Token | `200 OK` | Atualização parcial com `ConditionExpression`; `404` se não pertencer ao `sub` |
| `DELETE` | `/tasks/{id}` | JWT Access Token | `204 No Content` | Exclusão condicional em `(ownerId, id)`; `404` se não pertencer ao `sub` |

### 3.3. Segurança de Autenticação, Autorização e Sessão
- **API Gateway JWT Authorizer:** configurado em todas as rotas de `/tasks` e `/tasks/{id}` com `Issuer`, `Audience` (App Client ID) e `authorizationScopes` compatível com o **access token** emitido pelo Cognito (verificado em teste real), rejeitando ID tokens já no Gateway quando suportado.
- **Defesa em profundidade na Lambda:** exige obrigatoriamente `claims["sub"]` não vazio **e** `claims["token_use"] == "access"`. Ausência de `token_use` ou `token_use == "id"` resulta em `401 UNAUTHORIZED`.
- **Frontend OIDC (`oidc-client-ts`):** cliente público (sem `client_secret`) com Authorization Code + PKCE (`S256`), validação de `state`, armazenamento de sessão em `sessionStorage`, limpeza da URL após `/auth/callback` e envio exclusivo de `access_token` no header `Authorization: Bearer`.
- **Logout e revogação (comportamento transparente):**
  1. Quando há `refresh_token`, o frontend tenta chamar `/oauth2/revoke` no domínio Cognito.
  2. Remove o usuário da sessão local (`sessionStorage`).
  3. Redireciona para `/logout` do Cognito Hosted UI para encerrar a sessão do navegador no provedor.
  4. **Nota honesta:** o endpoint `/logout` do Cognito não invalida access tokens JWT já emitidos antes da expiração (`exp`). Por isso, configurar TTL curto de access token (ex.: 15–30 min) no App Client Cognito.
- **Decisão de empacotamento Lambda:** utilizar o `boto3` pré-instalado no runtime `python3.12` da AWS Lambda, evitando empacotar binários nativos de Windows/Python 3.15 no ZIP. A versão real do `boto3` no runtime será registrada nos testes em nuvem (`AC-15`).

---

## 4. Decisões Pendentes e Bloqueios

| Item | Estado | Impacto | Ação Necessária |
|---|---|---|---|
| Grafia exata de `SEUNOME` e `grupo` | **Confirmado (22/11)** | `enthonyaraujo.grupo-03.sd.ufersa.dev.br` e `api.enthonyaraujo.grupo-03.sd.ufersa.dev.br` | Concluído |
| Acesso à Hosted Zone `Z0906692126CHKWN9GQ2U` | **Verificado na mesma conta (22/11)** | `GetHostedZone` autorizado e `ChangeResourceRecordSets` simulado `allowed` na conta `****2503` | Validar escrita efetiva somente após autorização de deploy |
| Conta AWS, região e `LabRole` | **Confirmado (22/11)** | Conta Learner Lab `****2503`, região `us-east-1`, `LabRole` + todos os serviços liberados | Aguardando autorização explícita para provisionamento |
| Repontamento do domínio `api.enthonyaraujo.grupo-03.sd.ufersa.dev.br` | **Concluído (22/11)** | `mqdslq` atualizado para `u0mxrf6mnk` (`acadflow-http-api`); `war28zsged` preservado intacto com rollback verificável | Validar uso autenticado no navegador + 2ª conta real |
| Ambiente Python 3.12 na Lambda real | **Validado na AWS (`AC-15`, 22/11)** | Execução real em `acadflow-api` (`python3.12`) aprovada com DynamoDB e CloudWatch | Concluído (`python3.12` local opcional) |
| Formato de submissão no SIGAA | **Pendente** | Preparação do pacote final de entrega (27/11) | Confirmação do usuário |

---

## 5. Evolução P1 — Workspace Acadêmico (`/pages` + Tiptap)

Decisões arquiteturais complementares (detalhadas em `docs/WORKSPACE_ACADFLOW.md`), preservando intacto o contrato de `/tasks`:

- **Persistência de Páginas:** tabela DynamoDB dedicada `acadflow-pages` (`PK = ownerId`, `SK = id`, `PAY_PER_REQUEST`, variável Lambda `PAGES_TABLE`) para manter isolamento limpo e zero risco de regressão nas consultas `Query` de `acadflow-tasks`.
- **Formato e segurança do editor:** conteúdo rico salvo como JSON ProseMirror/Tiptap (`type: "doc"`), validado no servidor com profundidade máxima de 20 níveis e limite de **100 KB (102.400 bytes UTF-8)** — sem armazenamento de HTML bruto e sem `dangerouslySetInnerHTML`.
- **Concorrência otimista:** campo `version` incrementado em cada `PATCH /pages/{id}`, aceitando `expectedVersion` opcional e retornando `409 CONFLICT` (`VERSION_CONFLICT`) quando outra sessão alterou a página antes do salvamento.
- **Rotas adicionais protegidas por JWT Access Token:** `GET /pages`, `POST /pages`, `GET /pages/{id}`, `PATCH /pages/{id}`, `DELETE /pages/{id}` (todas exigindo `sub` e `token_use == "access"`).
