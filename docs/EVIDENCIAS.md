# Evidências e Matriz Central de Critérios de Aceitação — AcadFlow

> **Regra de integridade:** Nenhum critério que exige Cognito real, dois usuários reais, DynamoDB em produção ou verificação visual no navegador é marcado como `Aceito` com base em mocks ou testes locais. Esta matriz diferencia explicitamente **testes reais de API em produção** de **validações visuais no navegador**, sem registrar tokens, senhas, e-mails ou dados pessoais.

---

## 1. Matriz Central Única de Critérios de Aceitação (`AC-01` a `AC-15`)

| ID | Requisito Oficial (`docs/AVALIACAO.md`) | Cenário / Teste Reproduzível | Escopo Comprovado (API vs. Navegador) | Estado | Data |
|---|---|---|---|---|---|
| **AC-01** | DNS da Aplicação (Req. 3) | Acessar `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br` | Produção HTTPS (`verify_prod_domains.py` 18/18 + acesso navegador; `TLSv1.3` até 08/06/2027) | **Aceito** | 23/11/2026 |
| **AC-02** | DNS da API (Req. 2, 3) | `GET https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br/health` | Produção HTTPS (`verify_prod_domains.py` + `smoke_api.py`: `200 OK`, `TLSv1.3` até 03/06/2027) | **Aceito** | 23/11/2026 |
| **AC-03** | Autorização API (Req. 4) | `GET /tasks` e `GET /pages` sem header `Authorization` | Produção API (`verify_prod_domains.py` + `smoke_api.py`: `401` pelo API Gateway em todas as rotas protegidas) | **Aceito** | 23/11/2026 |
| **AC-04** | Autorização API (Req. 4) | `GET /tasks` e `GET /pages` com token inválido, expirado e **ID token Cognito real** | **Produção API (`smoke_api.py` 33/33 com conta real):** inválido `401`, expirado `401`, **ID token real rejeitado com `HTTP 403`** no API Gateway (`scope=openid`) + defesa `401` na Lambda | **Aceito** | 23/11/2026 |
| **AC-05** | Autenticação + API (Req. 2, 4) | Login Cognito (PKCE) + `GET /tasks` com `access_token` válido | **API em produção aprovada** (`GET /tasks` `200 OK` com `access_token` Cognito real via `smoke_api.py`); **pendente captura visual** do fluxo PKCE e listagem no navegador | **Parcial (API aprovada; navegador pendente)** | 23/11/2026 |
| **AC-06** | 3 Camadas + CRUD (Req. 1, 2) | `POST /tasks` autenticado com persistência no DynamoDB | **Produção API + DynamoDB (`smoke_api.py` 33/33 com conta real):** `POST /tasks` -> `201 Created`, persistido em `acadflow-tasks` e listado em `GET /tasks` | **Aceito** *(captura visual complementar no navegador)* | 23/11/2026 |
| **AC-07** | Persistência Real (Req. 1, 2) | `PATCH /tasks/{id}` e recarregar página (`F5`) | **API em produção aprovada** (`PATCH /tasks/{id}` `200 OK` persistido no DynamoDB via `smoke_api.py`); **pendente validação visual pós-`F5`** no navegador | **Parcial (API aprovada; navegador `F5` pendente)** | 23/11/2026 |
| **AC-08** | CRUD Completo (Req. 1, 2) | `DELETE /tasks/{id}` e confirmar ausência | **Produção API + DynamoDB (`smoke_api.py` 33/33 com conta real):** `DELETE /tasks/{id}` -> `204 No Content`, seguido de `GET /tasks/{id}` -> `404` | **Aceito** *(confirmação visual pós-`F5` complementar)* | 23/11/2026 |
| **AC-09** | Isolamento / Anti-IDOR (Req. 4) | `Usuário B` tenta listar ou executar `GET`/`PATCH`/`DELETE` em tarefa do `Usuário A` | **Produção API + DynamoDB com 2 contas reais Cognito (`smoke_api.py` 33/33):** `Usuário B` não vê a tarefa em `GET /tasks`, recebe **`404`** em `GET`/`PATCH`/`DELETE` com o ID do `Usuário A`, e `Usuário A` confirma integridade dos dados | **Aceito** | 23/11/2026 |
| **AC-10** | Validação de Negócios (Req. 1, 2) | `POST /tasks` sem `title`, `status` inválido ou com `ownerId` no body | **Produção API (`smoke_api.py` 33/33 com conta real):** payload inválido -> `400`; `ownerId` no body -> `400 VALIDATION_ERROR`, sem gravar no DynamoDB | **Aceito** | 23/11/2026 |
| **AC-11** | UI Responsiva + SPA Rewrite (Req. 1) | Testar em mobile (`375x812`), recarregar rotas e `/auth/callback` | **SPA Rewrite aprovado** (`200 OK` nas 5 rotas em produção); **pendente inspeção visual** em viewport mobile `375x812` no navegador | **Parcial (SPA aprovado; mobile navegador pendente)** | 23/11/2026 |
| **AC-12** | 3 Camadas + Apresentação (Req. 1, 5) | Explicar arquitetura publicada e ensaiar demo (5–8 min) | Infraestrutura e documentação prontas; **pendente ensaio presencial** para 27/11/2026 | **Pendente** | — |
| **AC-13** | Logout e Sessão (Req. 4) | Acionar Logout, validar limpeza de `sessionStorage`, `/logout` Cognito e reexigência de login | Coberto por teste unitário local; **pendente validação manual no navegador** em produção | **Pendente (navegador)** | — |
| **AC-14** | Comunicação REST Real (Req. 2) | Inspecionar DevTools Network durante uso real + CORS + CSP `Report-Only` | **API REST + CORS `204` + cabeçalhos de segurança aprovados** em produção; **pendente captura visual** do DevTools `Network` e conferência do `Console` (`CSP Report-Only`) | **Parcial (API/CORS aprovados; DevTools navegador pendente)** | 23/11/2026 |
| **AC-15** | Runtime Python 3.12 (Qualidade) | Executar pacote ZIP na AWS Lambda `python3.12` + suíte local em Python 3.12 | **Produção AWS Lambda `v1` (`python3.12`) + 60 Pytest Python `3.12.14` no Fedora** | **Aceito** | 23/11/2026 |

### Critérios Complementares P1 — Workspace Acadêmico (`/pages` + Tiptap)

| ID | Escopo | Cenário / Teste Reproduzível | Escopo Comprovado (API vs. Navegador) | Estado | Data |
|---|---|---|---|---|---|
| **AC-P1-01** | P1 — CRUD Páginas | `POST/GET/PATCH/DELETE /pages` autenticado + recarga (`F5`) | **API em produção aprovada** (`POST` `201`, `GET` `200`, `PATCH` `200`, `DELETE` `204`, `GET` `404` em `acadflow-pages` via `smoke_api.py` 33/33); **pendente verificação visual pós-`F5`** no navegador | **Parcial (API aprovada; navegador `F5` pendente)** | 23/11/2026 |
| **AC-P1-02** | P1 — Isolamento Páginas | `Usuário B` tenta listar ou executar `GET`/`PATCH`/`DELETE` em página do `Usuário A`; ID token e `ownerId` no body rejeitados | **Produção API + DynamoDB com 2 contas reais Cognito (`smoke_api.py` 33/33):** `Usuário B` não vê a página em `GET /pages`, recebe **`404`** em `GET`/`PATCH`/`DELETE`, `Usuário A` mantém página íntegra (`v2`), ID token rejeitado com **`403`** e `ownerId` no body rejeitado com **`400`** | **Aceito** | 23/11/2026 |
| **AC-P1-03** | P1 — Conflito de Salvamento | Enviar `PATCH /pages/{id}` com `expectedVersion` desatualizado (`409 CONFLICT`) | **Produção API + DynamoDB (`smoke_api.py` 33/33 com conta real):** `PATCH` com `expectedVersion=1` sobre página em `v2` rejeitado com **`409 CONFLICT`** sem sobrescrever versão mais nova | **Aceito** *(teste visual em 2 abas complementar)* | 23/11/2026 |
| **AC-P1-04** | P1 — Editor Tiptap Seguro | Editar títulos, parágrafos, listas, negrito, itálico, checklists e citações; auto-save e recarga `F5` | Allowlist ProseMirror ativa na Lambda `v1` (`SEC-04`); **pendente validação visual completa** do editor e auto-save no navegador + Console `CSP Report-Only` | **Pendente (navegador)** | — |
| **AC-P1-05** | P1 — Workspace Responsivo | Navegar via sidebar recolhível entre Dashboard, Páginas e Tarefas em desktop e mobile (`375x812`) | **Pendente validação visual manual** no navegador (desktop + mobile `375x812`) | **Pendente (navegador)** | — |

---

## 2. Registro de Testes Executados

### 23/11/2026 — Teste Real de Isolamento e Segurança em Produção com 2 Contas Cognito (`33/33 PASS`)
> **Tipo:** Teste real de API em produção (executado pelo aluno com 2 contas reais `CONFIRMED` sob seu controle em `acadflow-users`, contra `https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br`, sem exposição de tokens, senhas ou e-mails).

| Bloco Validado em Produção | Comando / Alvo | Comportamento Real Comprovado | Resultado |
|---|---|---|---|
| **Saúde pública e fronteira sem credencial** | `tests/e2e/smoke_api.py --api-url https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br` | `GET /health` -> `200`; `/tasks` e `/pages` sem token, com token inválido e com JWT expirado -> `401` | **7/7 PASS** |
| **Rejeição de ID token Cognito real** | `ACADFLOW_ID_TOKEN_A` em `GET /tasks` e `GET /pages` | Rejeitado na borda pelo JWT Authorizer do API Gateway (`scope=openid`) com **`HTTP 403`** | **2/2 PASS** |
| **Validação de entrada e anti-injeção `ownerId`** | `POST /tasks` inválido + `POST /tasks` e `POST /pages` com `ownerId` no body | Rejeitados com **`HTTP 400`** sem gravar no DynamoDB | **3/3 PASS** |
| **CRUD autenticado `/tasks` + Isolamento (`AC-05`–`AC-09`)** | `Usuário A` cria/lista/edita/exclui; `Usuário B` tenta listar e executar `GET`/`PATCH`/`DELETE` no ID do `Usuário A` | `201` / `200` / `200`; `Usuário B` não lista o registro (`200` sem ID alheio) e recebe **`404`** em `GET`/`PATCH`/`DELETE`; `Usuário A` confirma integridade (`200`), exclui (`204`) e confirma remoção (`404`) | **10/10 PASS** |
| **CRUD autenticado `/pages` + Conflito `409` + Isolamento (`AC-P1-01`–`03`)** | `Usuário A` cria/lista/edita (`v1->v2`)/testa `expectedVersion=1`; `Usuário B` tenta listar e executar `GET`/`PATCH`/`DELETE` no ID do `Usuário A` | `201` / `200` / `200`; conflito otimista **`409`**; `Usuário B` não lista a página e recebe **`404`** em `GET`/`PATCH`/`DELETE`; `Usuário A` confirma integridade (`v2`), exclui (`204`) e confirma remoção (`404`) | **11/11 PASS** |
| **Total da suíte real em produção** | **2 contas reais Cognito + API Gateway + Lambda `v1` + DynamoDB (`acadflow-tasks`, `acadflow-pages`)** | **Zero falhas; registros temporários de teste removidos ao final** | **33/33 PASS** |

### 23/11/2026 — Hardening Controlado em Produção (Etapas 1 a 4)
> **Escopo:** Execução sequencial das alterações autorizadas de segurança e privacidade (Lambda `acadflow-api` v1 com `SEC-04` + `SEC-02`, Amplify `customHeaders` com `CSP-Report-Only`, DynamoDB `DeletionProtectionEnabled=True` sem PITR, API Gateway throttling 20/40 + Access Logs mínimos com retenção de 14 dias e retenção de 14 dias na Lambda). Cognito, IAM, DNS e recursos de avaliações anteriores mantidos inalterados. Detalhes e rollbacks em [docs/AUDITORIA_SEGURANCA.md](AUDITORIA_SEGURANCA.md).

| Etapa | Alteração Aplicada na AWS | Validação Executada | Resultado |
|---|---|---|---|
| **Etapa 1 — Lambda `acadflow-api`** | Deploy `Version=1` (`CodeSha256: dlDX0MabbcRVYZ8R09KhN33AriYg3KLoHB4XIssi5AM=`) com allowlist ProseMirror/Tiptap (`SEC-04`) e 4 cabeçalhos de segurança (`SEC-02`) | Compatibilidade 2/2 páginas existentes + `/health` com 4 headers + 19 asserções reais Lambda/DynamoDB + `verify_prod_domains.py` (`18/18`) | **PASS** |
| **Etapa 2 — Amplify `acadflow-web`** | Ativado `customHeaders` ([infra/amplify_security_headers.yml](../infra/amplify_security_headers.yml)) com HSTS, `nosniff`, `DENY`, `Referrer-Policy`, `Permissions-Policy` e **`Content-Security-Policy-Report-Only`** | Inspeção ao vivo em `/`, `/login`, JS e CSS (6 headers presentes, CSP bloqueante `null`) + `verify_prod_domains.py` (`18/18`) | **PASS** *(validação visual CSP no navegador pendente)* |
| **Etapa 3 — DynamoDB** | `DeletionProtectionEnabled=True` em `acadflow-tasks` e `acadflow-pages` (`PITR: DISABLED`) | `describe_table` + CRUD real de registros individuais em ambas as tabelas via Lambda | **PASS** |
| **Etapa 4 — API Gateway + CloudWatch** | Throttling (`20 req/s`, burst `40`), retenção 14 dias em `/aws/lambda/acadflow-api`, criação de `/aws/apigateway/acadflow-http-api` (14 dias) e Access Logs JSON mínimos (6 metadados, zero PII/tokens) | `verify_prod_domains.py` (`18/18`, zero `429`) + inspeção de evento real no CloudWatch (`sensitiveDataDetected=false`, `unexpectedKeys=[]`) | **PASS** |

### 23/11/2026 — Publicação Controlada Frontend (`jobId=3`), Testes Locais e Auditoria no Fedora Linux
> **Escopo:** Publicação do frontend estabilizado (`jobId=3`, `/assets/index-BLG3afUM.js`), auditoria `npm audit`, testes unitários/smoke locais em Python `3.12.14` + Node `v26.12.1` e diagnósticos somente leitura na AWS.

| Tipo | Suíte / Verificação | Ambiente | Resultado |
|---|---|---|---|
| **Automatizado (Produção — Deploy Frontend)** | Amplify `dysbk8tmbj14k` (`main`, `jobId=3`, commit `3d704d9`, rollback salvo de `jobId=2`) + `verify_prod_domains.py` | Produção HTTPS | **18/18 PASS** |
| **Automatizado (Segurança Local)** | `cd apps/web && npm audit` após `vitest@^4.1.12` | Fedora 45 / Node `v26.12.1` | **0 vulnerabilities** |
| **Automatizado (Local — Backend)** | `services/api/.venv/bin/pytest services/api/tests -v` + `build_package.py` | Fedora 45 / **Python `3.12.14`** | **60/60 PASS** + ZIP 9 módulos |
| **Automatizado (Local — Smoke HTTP)** | `local_server.py` + `tests/e2e/smoke_api.py` (incluindo travas de host e tokens distintos) | Fedora 45 (in-memory) | **33/33 PASS** |
| **Automatizado (Local — Frontend)** | `cd apps/web && npm run test && npm run typecheck && npm run build` | Fedora 45 / Vitest `4.1.12` / Vite `6.4.6` | **16/16 PASS** + build OK |
| **Automatizado (AWS — Somente Leitura)** | `infra/check_aws_env.py --hosted-zone-id Z0906692126CHKWN9GQ2U --owner-filter enthonyaraujo` | Conta `****2503` (`us-east-1`) | **14/14 autorizado** |

### 22/11/2026 — Histórico de Provisionamento e Cutover na AWS (Passos A, B, C e D)
- **Passo B1–B3:** HTTP API `u0mxrf6mnk` (`8/8 PASS`), Lambda `python3.12` + DynamoDB real (`18/18 PASS`), CloudWatch + Cognito Hosted UI (`3/3 PASS`).
- **Passo C–D:** Amplify `dysbk8tmbj14k` + SPA Rewrite (`5/5 PASS`), domínio institucional do frontend (`AC-01`) e cutover oficial da API (`mqdslq`: `war28zsged` -> `u0mxrf6mnk`, `18/18 PASS`, API prévia preservada intacta).

---

## 3. Verificações Visuais Pendentes no Navegador (Produção HTTPS)

> Os testes reais de API (`33/33 PASS`) comprovaram integralmente a camada de negócios, autorização JWT, isolamento multiusuário e persistência no DynamoDB. Restam apenas as **validações visuais/interativas no navegador** em `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br` (com DevTools `Network` e `Console` abertos):

1. **Login PKCE + DevTools Network + Console `CSP Report-Only` (`AC-05`, `AC-14`):** entrar com `Usuário A`, verificar chamadas `200 OK` para `https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br` e confirmar ausência de erros auth/authz e de avisos `[Report Only]` da CSP no Console *(não promover CSP para bloqueante sem revisão)*.
2. **Persistência pós-`F5` em Tarefas e Páginas (`AC-07`, `AC-P1-01`, `AC-P1-04`):** criar/editar tarefa e página rica no editor Tiptap (títulos, negrito/itálico, lista, checklist, citação), aguardar auto-save (`Salvo (v2)`), pressionar `F5` e confirmar preservação integral.
3. **Responsividade Mobile + Sidebar (`AC-11`, `AC-P1-05`):** testar viewport `375x812` no DevTools, abrir/fechar menu drawer, navegar entre Dashboard, Tarefas e Páginas sem overflow horizontal e testar `F5` em `/tasks` e `/pages/<id>`.
4. **Logout (`AC-13`):** clicar em **Sair**, confirmar limpeza do `sessionStorage`, redirecionamento para `/logout` do Cognito e redirecionamento para `/login` ao tentar reabrir `/tasks`.

---

## 4. Checklist de Capturas para a Apresentação (27/11/2026)

> **Regra de privacidade:** ocultar/borrar sempre cabeçalhos `Authorization`, JWTs, e-mails pessoais sensíveis e IDs/credenciais de conta AWS.

1. **Arquitetura de três camadas (`AC-12`, `AC-15`):**
   - [ ] Diagrama de 3 camadas + capturas sanitizadas do console AWS mostrando Amplify (`acadflow-web`), API Gateway (`acadflow-http-api`), Lambda (`acadflow-api`, `python3.12`) e DynamoDB (`acadflow-tasks`, `acadflow-pages`).
2. **Comunicação REST entre frontend e API (`AC-14`):**
   - [ ] DevTools `Network` exibindo chamadas HTTPS JSON para `https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br` (`200`/`201`/`204`) e cabeçalhos `Cache-Control: no-store` / `X-Content-Type-Options: nosniff`, com `Authorization` oculto.
3. **Ambos os domínios institucionais HTTPS (`AC-01`, `AC-02`, `AC-11`, `AC-P1-05`):**
   - [ ] Aplicação em `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br` (barra de endereço + TLSv1.3) em desktop e mobile `375x812`.
   - [ ] `GET https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br/health` (`200 OK` em HTTPS).
4. **Autenticação Cognito (`AC-05`, `AC-13`):**
   - [ ] Fluxo Login -> Cognito Hosted UI (PKCE) -> Workspace autenticado -> Logout exigindo novo login.
5. **Autorização JWT e isolamento dos usuários (`AC-03`, `AC-04`, `AC-09`, `AC-P1-02`):**
   - [ ] Saída sanitizada de `tests/e2e/smoke_api.py` (**33/33 PASS** em produção) comprovando `401` sem token/inválido/expirado, **`403`** com ID token real, **`400`** com `ownerId` no body e **`404`** cruzado entre `Usuário B` e `Usuário A`.
6. **Persistência no DynamoDB (`AC-06`, `AC-07`, `AC-08`, `AC-P1-01`, `AC-P1-03`, `AC-P1-04`):**
   - [ ] Tarefa e página Tiptap preservadas após `F5`, conflito `409` e confirmação das tabelas `acadflow-tasks` / `acadflow-pages` com `DeletionProtectionEnabled` ativo.
7. **Prontidão final (27/11/2026):**
   - [ ] Rodar `verify_prod_domains.py` antes da aula, ensaiar a demonstração (5–8 min) e enviar submissão no SIGAA até 23h59.
