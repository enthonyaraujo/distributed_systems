# Evidências e Matriz Central de Critérios de Aceitação — AcadFlow

> **Regra de integridade:** Nenhum critério que exige AWS, Cognito real, DynamoDB real ou DNS institucional pode ser marcado como `aceito` com base em testes locais ou mocks. Registre apenas evidências reais, sanitizadas e sem tokens, senhas ou chaves.

---

## 1. Matriz Central Única de Critérios de Aceitação (`AC-01` a `AC-15`)

| ID | Requisito Oficial | Cenário / Teste Reproduzível | Evidência Exigida | Ambiente Exigido | Estado | Data | Responsável |
|---|---|---|---|---|---|---|---|
| **AC-01** | DNS da Aplicação (Req. 3) | Acessar `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br` | Captura com barra de endereço institucional, HTTPS válido e aplicação carregada | Produção (DNS institucional) | **Aceito (22/11)** | 22/11/2026 | Infra / QA |
| **AC-02** | DNS da API (Req. 2, 3) | `GET https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br/health` | Status `200 OK`, HTTPS válido e payload JSON de saúde | Produção (DNS institucional) | **Aceito (22/11)** | 22/11/2026 | Infra / QA |
| **AC-03** | Autorização API (Req. 4) | `GET /tasks` sem header `Authorization` | Bloqueado (`401`) pelo API Gateway; output HTTP registrado | Produção (DNS institucional) | **Aceito (22/11)** | 22/11/2026 | Backend / QA |
| **AC-04** | Autorização API (Req. 4) | `GET /tasks` com token inválido, expirado ou **ID token** | Rejeitado (`401`/`403`) no Gateway e/ou Lambda (`token_use != "access"`) | Produção (DNS institucional) | Parcial (inválido `401` verificado no DNS oficial; ID token verificado na Lambda real; testar ID token Cognito no Gateway com conta real) | 22/11/2026 | Auth / QA |
| **AC-05** | Autenticação + API (Req. 2, 4) | Login Cognito (PKCE) + `GET /tasks` com `access_token` válido | Login funcional e resposta `200 OK` na rede real | Produção (DNS institucional) | Pendente | — | Frontend / Auth |
| **AC-06** | 3 Camadas + CRUD (Req. 1, 2) | `POST /tasks` autenticado | `201 Created` e item persistido na tabela DynamoDB | Produção (AWS + DynamoDB) | Pendente (unitário local pronto) | — | Backend / QA |
| **AC-07** | Persistência Real (Req. 1, 2) | `PATCH /tasks/{id}` e recarregar página (`F5`) | `200 OK` e estado mantido após recarga | Produção (AWS + DNS institucional) | Pendente | — | Frontend / QA |
| **AC-08** | CRUD Completo (Req. 1, 2) | `DELETE /tasks/{id}` | `204 No Content` e item ausente após consulta/recarga | Produção (AWS + DynamoDB) | Pendente (unitário local pronto) | — | Backend / QA |
| **AC-09** | Isolamento / Anti-IDOR (Req. 4) | Usuário B tenta `GET`/`PATCH`/`DELETE` em tarefa do Usuário A | `404` em todas as operações; item de A intacto | Produção (AWS + 2 usuários reais) | Pendente (unitário local pronto) | — | Backend / QA |
| **AC-10** | Validação de Negócios (Req. 1, 2) | `POST /tasks` sem `title`, `status` inválido ou com `ownerId` no body | `400 VALIDATION_ERROR` com JSON padrão, sem persistir | Produção (AWS) | Pendente (unitário local pronto) | — | Backend / QA |
| **AC-11** | UI Responsiva + SPA Rewrite (Req. 1) | Testar em mobile (`375x812`), recarregar rotas e `/auth/callback` | Sem overflow horizontal crítico e sem `404` SPA | Produção (DNS institucional) | Pendente | — | Frontend / QA |
| **AC-12** | 3 Camadas + Apresentação (Req. 1, 5) | Explicar arquitetura publicada e ensaiar demo (5–8 min) | Diagrama real + checklist de apresentação concluído | Produção / Presencial | Pendente | — | Coordenador |
| **AC-13** | Logout e Sessão (Req. 4) | Acionar Logout, validar limpeza local, redirecionamento `/logout` e comportamento de tokens | Rota protegida exige novo login; semântica de revogação documentada | Produção (DNS institucional) | Pendente | — | Frontend / Auth |
| **AC-14** | Comunicação REST Real (Req. 2) | Inspecionar DevTools Network durante uso real | Chamadas HTTPS reais frontend -> API com CORS restrito | Produção (DNS institucional) | Pendente | — | Frontend / QA |
| **AC-15** | Runtime Python 3.12 (Qualidade) | Executar pacote ZIP na AWS Lambda `python3.12` | Execução real validada sem erro de import/permissão e logs no CloudWatch | AWS Lambda (`python3.12`) | **Aceito (22/11)** | 22/11/2026 | Backend / Infra |

### Critérios Complementares P1 — Workspace Acadêmico (`/pages` + Tiptap)

| ID | Escopo | Cenário / Teste Reproduzível | Evidência Exigida | Ambiente Exigido | Estado | Data | Responsável |
|---|---|---|---|---|---|---|---|
| **AC-P1-01** | P1 — CRUD Páginas | `POST/GET/PATCH/DELETE /pages` autenticado + recarga | Persistência real na tabela DynamoDB `acadflow-pages` | Produção (AWS + DynamoDB) | Pendente | — | Backend / QA |
| **AC-P1-02** | P1 — Isolamento Páginas | Usuário B tenta `GET/PATCH/DELETE /pages/{id}` do Usuário A; ID token e `ownerId` no body rejeitados | `404` cruzado, `401` ID token, `400` `ownerId` no body | Produção (AWS + 2 usuários) | Pendente | — | Backend / QA |
| **AC-P1-03** | P1 — Conflito de Salvamento | Enviar `PATCH /pages/{id}` com `expectedVersion` desatualizado | `409 CONFLICT` (`VERSION_CONFLICT`) sem sobrescrever versão mais nova | Produção (AWS) | Pendente | — | Backend / Frontend |
| **AC-P1-04** | P1 — Editor Tiptap Seguro | Editar títulos, parágrafos, listas, negrito, itálico, checklists e citações; salvar e recarregar | JSON ProseMirror preservado e renderizado sem HTML bruto/XSS | Produção (DNS institucional) | Pendente | — | Frontend / QA |
| **AC-P1-05** | P1 — Workspace Responsivo | Navegar via sidebar recolhível entre Dashboard, Páginas e Tarefas em desktop e mobile (`375x812`) | Zero regressão em `/tasks` e zero overflow horizontal crítico | Produção (DNS institucional) | Pendente | — | Frontend / QA |

---

## 2. Registro de Testes Executados

### 22/11/2026 — Verificação Local (Sem Recursos AWS)
> **Nota de integridade:** Os testes abaixo validam apenas o código local e contratos em memória. Nenhum critério `AC-01`..`AC-15` que exige AWS/Cognito/DynamoDB/DNS institucional foi marcado como concluído.

| Suíte | Comando | Ambiente | Resultado |
|---|---|---|---|
| Backend unitário (`services/api`) | `.\services\api\.venv\Scripts\pytest.exe services/api/tests -v` | Windows / Python 3.15.2 (pendente validar em Python 3.12) | **24 passed** (validação, JWT `token_use=="access"` + `sub` + `exp`, CRUD, rejeição de `ownerId`, anti-IDOR `404`, `DynamoDBTaskRepository` via `Query` + chaves compostas) |
| Empacotamento Lambda | `python services/api/build_package.py` | Local | **OK** — gerou `services/api/dist/acadflow-api.zip` (6 arquivos `acadflow_api/*.py`, handler `acadflow_api.handler.lambda_handler`) |
| Smoke HTTP local (`smoke_api.py` -> `local_server.py`) | `smoke_api.run_suite('http://127.0.0.1:18081')` | Local (in-memory dev server) | **14/14 checks PASS** (`/health` 200, sem token 401, inválido 401, ID token 401, payload inválido 400, `ownerId` 400, CRUD 201/200/204, cross-user 404) |
| Dry-run Infraestrutura (`infra/provision_stack.py`) | `python infra/provision_stack.py --region REGION_PENDING --app-origin https://SEUNOME.grupo.sd.ufersa.dev.br` | Local (zero chamadas AWS) | **OK** — plano JSON impresso, nenhum recurso AWS alterado |
| Frontend unitário (`apps/web`) | `npm.cmd run test` | Node v26.13.0 / Vitest 3.2.7 | **8 passed** (3 arquivos: `tasksApi`, `oidcConfig` PKCE/logout/revoke, `validation`) |
| Frontend typecheck + build | `npm.cmd run build` | TypeScript 5.8 + Vite 6.4.6 | **PASS** — `tsc -b && vite build` concluído em 851ms (zero erros) |

### 22/11/2026 — Verificação Local Pós-Evolução P1 (Workspace + `/pages` + Tiptap)
> **Nota de integridade:** Testes locais validam regressão P0 + evolução P1 em memória/build local. Todos os critérios `AC-01`..`AC-15` e `AC-P1-01`..`AC-P1-05` que dependem de AWS/Cognito/DynamoDB/DNS institucional permanecem **Pendente** até implantação real.

| Suíte | Comando | Ambiente | Resultado |
|---|---|---|---|
| Backend regressão P0 + P1 (`services/api`) | `.\services\api\.venv\Scripts\pytest.exe services/api/tests -v` | Windows / Python 3.15.2 (pendente validar em Python 3.12) | **39 passed in 0.36s** (24 P0 + 15 P1: `/pages` CRUD, limite 100 KB, profundidade <= 20, `Decimal` version, `token_use=="access"`, conflito `409`, anti-IDOR `404`, `DynamoDBPageRepository`) |
| Empacotamento Lambda | `python services/api/build_package.py` | Local | **OK** — `services/api/dist/acadflow-api.zip` (9 módulos `acadflow_api/*.py`) |
| Smoke HTTP local (`/tasks` + `/pages`) | `smoke_api.run_suite('http://127.0.0.1:18082')` | Local (in-memory dev server) | **26/26 checks PASS** (14 P0 + 12 P1 incluindo `409` conflito de versão e `404` cruzado em `/pages`) |
| Dry-run Infraestrutura (`infra/provision_stack.py`) | `python infra/provision_stack.py --region REGION_PENDING --app-origin https://SEUNOME.grupo.sd.ufersa.dev.br` | Local (zero chamadas AWS) | **OK** — inclui `acadflow-tasks`, `acadflow-pages`, `PAGES_TABLE` e rotas `/pages*` |
| Frontend regressão P0 + P1 (`apps/web`) | `npm.cmd run test` | Node v26.13.0 / Vitest 3.2.7 | **13 passed** (5 arquivos: `tasksApi`, `pagesApi` incluindo `409`, `oidcConfig`, `validation`, `pageValidation`) |
| Frontend typecheck + build (com Tiptap) | `npm.cmd run build` | TypeScript 5.8 + Vite 6.4.6 | **PASS** — `tsc -b && vite build` concluído em 2.28s (zero erros) |

### 22/11/2026 — Testes Reais na AWS (Passos A, B e D — URLs Temporárias + Python 3.12 + DynamoDB)
> **Nota de integridade:** Os testes abaixo foram executados contra recursos reais na AWS (`us-east-1`, conta `****2503`). Critérios que exigem login real de usuários Cognito controlados pelo usuário (`AC-05`, `AC-07`, `AC-09` via HTTP com JWTs reais, `AC-13`) e cutover do domínio `api.enthonyaraujo.grupo-03.sd.ufersa.dev.br` (`AC-02`, `AC-14`) permanecem **Pendente** até as próximas etapas autorizadas.

| Suíte | Comando / Alvo Real | Ambiente | Resultado |
|---|---|---|---|
| Passo B1 — HTTP API HTTPS (`u0mxrf6mnk`) | `tests/e2e/aws_step_b_verify.py` contra `https://u0mxrf6mnk.execute-api.us-east-1.amazonaws.com` | AWS API Gateway HTTP API (`us-east-1`) | **8/8 PASS** (`/health` 200; `/tasks` e `/pages` sem token e token inválido -> 401; CORS libera Amplify temp e domínio institucional, bloqueia origem não autorizada) |
| Passo B2 — Lambda `python3.12` + DynamoDB real | `lambda:Invoke` em `acadflow-api` gravando em `acadflow-tasks` e `acadflow-pages` | AWS Lambda `python3.12` + DynamoDB (`us-east-1`) | **18/18 PASS** (rejeição `token_use` ausente/ID token 401; rejeição `ownerId` 400; CRUD real `/tasks` + anti-IDOR 404; CRUD real `/pages` com AST Tiptap + conversão recursiva `Decimal->int` corrigida + conflito otimista `409` + anti-IDOR 404; itens de teste limpos) |
| Passo B3 — CloudWatch Logs + Cognito Hosted UI | `/aws/lambda/acadflow-api` + `https://acadflow-enthony-sd.auth.us-east-1.amazoncognito.com/oauth2/authorize` | AWS CloudWatch + Cognito (`us-east-1`) | **3/3 PASS** (log group ativo; Hosted UI responde `200` aceitando callbacks da URL Amplify temporária e de `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br/auth/callback`) |
| Passo D — Amplify Hosting + SPA Rewrite | `GET /`, `/login`, `/auth/callback`, `/tasks`, `/pages/demo-id` em `https://main.dysbk8tmbj14k.amplifyapp.com` | AWS Amplify (`dysbk8tmbj14k`) | **5/5 PASS** (`200 OK` com HTML do AcadFlow em todas as rotas SPA, zero `404`) |
| Passo D — Domínio Institucional Frontend (`AC-01`) | `status=AVAILABLE` + `GET /`, `/login`, `/auth/callback`, `/tasks`, `/pages/demo-id` em `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br` + teste real no navegador (cadastro/verificação por e-mail Cognito PKCE + criação/salvamento até v5 de páginas no DynamoDB) | Produção (HTTPS institucional) | **5/5 PASS** + validado no navegador pelo usuário (`AC-01` concluído) |
| Passo C — Cutover Oficial da API (`AC-02`, `AC-03`) | `infra/cutover_api_domain.py` (`mqdslq`: `war28zsged` -> `u0mxrf6mnk`) + `tests/e2e/verify_prod_domains.py` + Amplify `jobId=2` | Produção (Ambos os DNS institucionais HTTPS) | **18/18 PASS** — TLSv1.3 em ambos os domínios; bundle ao vivo `/assets/index-VM4fkVPj.js` confirmado apontando exclusivamente para `https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br`; `/health` 200; `/tasks` e `/pages` sem token/inválido 401; CORS 204 para origem institucional; `war28zsged` preservado intacto |

---

## 3. Checklist de Capturas para a Apresentação (27/11/2026)

- [ ] Frontend carregado no domínio institucional HTTPS (`AC-01`, `AC-11`)
- [ ] `GET /health` no domínio institucional da API em HTTPS (`AC-02`)
- [ ] Chamada `GET /tasks` sem token (`401`) e com ID token/inválido (`401`/`403`) (`AC-03`, `AC-04`)
- [ ] Chamada `GET /tasks` com `access_token` válido (`200`), com token redigido/oculto (`AC-05`)
- [ ] CRUD completo + persistência após recarga (`AC-06`, `AC-07`, `AC-08`)
- [ ] Isolamento entre Usuário A e Usuário B (`404`) (`AC-09`)
- [ ] Recursos reais no console AWS (Amplify, API Gateway, Lambda, DynamoDB, Cognito) sem credenciais expostas (`AC-12`, `AC-15`)
