# Evidências e Matriz Central de Critérios de Aceitação — AcadFlow

> **Regra de integridade:** Nenhum critério é marcado como `Aceito` com base em mocks ou testes locais isolados. Esta documentação separa explicitamente: (1) **evidências automatizadas verificadas pelo agente**, (2) **testes reais de API com duas contas Cognito (`33/33 PASS`)**, (3) **validações visuais executadas e aprovadas pelo usuário no Firefox (`V-01` a `V-08`)**, (4) **evidências de segurança/isolamento** e (5) **capturas de tela ainda pendentes de coleta para a apresentação**. Nenhum token, senha, e-mail ou dado pessoal é registrado.

---

## 1. Matriz Final dos 20 Critérios de Aceitação (19 Aceitos · 1 Pendente)

### Critérios Principais P0 (`AC-01` a `AC-15`)

| ID | Requisito Oficial (`docs/AVALIACAO.md`) | Cenário / Teste Reproduzível | Fonte da Evidência | Estado | Data |
|---|---|---|---|---|---|
| **AC-01** | DNS da Aplicação (Req. 3) | Acessar `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br` | Automatizado (`verify_prod_domains.py` 18/18, `TLSv1.3` até 08/06/2027) + Manual navegador (`V-01`) | **Aceito** | 23/11/2026 |
| **AC-02** | DNS da API (Req. 2, 3) | `GET https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br/health` | Automatizado (`verify_prod_domains.py` + `smoke_api.py`: `200 OK`, `TLSv1.3` até 03/06/2027) | **Aceito** | 23/11/2026 |
| **AC-03** | Autorização API (Req. 4) | `GET /tasks` e `GET /pages` sem header `Authorization` | Automatizado (`verify_prod_domains.py` + `smoke_api.py`: `401` pelo API Gateway) | **Aceito** | 23/11/2026 |
| **AC-04** | Autorização API (Req. 4) | `GET /tasks` e `GET /pages` com token inválido, expirado e **ID token Cognito real** | Teste real API produção (`smoke_api.py` 33/33): inválido `401`, expirado `401`, **ID token real rejeitado com `403`** no API Gateway + defesa `401` na Lambda | **Aceito** | 23/11/2026 |
| **AC-05** | Autenticação + API (Req. 2, 4) | Login Cognito (PKCE) + `GET /tasks` com `access_token` válido | Teste real API produção (`smoke_api.py` `200 OK`) + Validação visual Firefox (`V-01`, `V-08`) | **Aceito** | 23/11/2026 |
| **AC-06** | 3 Camadas + CRUD (Req. 1, 2) | `POST /tasks` autenticado com persistência no DynamoDB | Teste real API produção (`smoke_api.py` `201 Created` em `acadflow-tasks`) + Validação visual Firefox (`V-02`) | **Aceito** | 23/11/2026 |
| **AC-07** | Persistência Real (Req. 1, 2) | `PATCH /tasks/{id}` e recarregar página (`F5`) | Teste real API produção (`smoke_api.py` `200 OK`) + Validação visual Firefox pós-`F5` (`V-02`) | **Aceito** | 23/11/2026 |
| **AC-08** | CRUD Completo (Req. 1, 2) | `DELETE /tasks/{id}` e confirmar ausência após recarga | Teste real API produção (`smoke_api.py` `204` -> `GET` `404`) + Validação visual Firefox pós-`F5` (`V-02`) | **Aceito** | 23/11/2026 |
| **AC-09** | Isolamento / Anti-IDOR (Req. 4) | `Usuário B` tenta listar ou executar `GET`/`PATCH`/`DELETE` em tarefa do `Usuário A` | Teste real API produção com **2 contas reais Cognito** (`smoke_api.py` 33/33): `Usuário B` não lista item alheio, recebe **`404`** em `GET`/`PATCH`/`DELETE`, `Usuário A` mantém dados íntegros | **Aceito** | 23/11/2026 |
| **AC-10** | Validação de Negócios (Req. 1, 2) | `POST /tasks` inválido ou com `ownerId` no body | Teste real API produção (`smoke_api.py` 33/33): `400 VALIDATION_ERROR` sem persistir | **Aceito** | 23/11/2026 |
| **AC-11** | UI Responsiva + SPA Rewrite (Req. 1) | Testar mobile (`375 × 812`), recarregar rotas e `/auth/callback` | Automatizado (SPA `200 OK` nas 5 rotas) + Validação visual Firefox (`V-01`, `V-05`) | **Aceito** | 23/11/2026 |
| **AC-12** | 3 Camadas + Apresentação e Entrega | Apresentar arquitetura publicada em sala (27/11/2026) e submeter no SIGAA (até 23h59) | Infraestrutura, documentação e roteiro prontos; **aguardando realização presencial e submissão no SIGAA** | **Pendente** | — |
| **AC-13** | Logout e Sessão (Req. 4) | Acionar Logout, limpar `sessionStorage`, `/logout` Cognito e bloquear rotas protegidas | Unitário local (`oidcConfig`) + Validação visual Firefox em produção (`V-07`) | **Aceito** | 23/11/2026 |
| **AC-14** | Comunicação REST Real (Req. 2) | Inspecionar DevTools Network durante uso real + CORS + `CSP Report-Only` | Automatizado (CORS `204` + 4 headers API + 6 headers Amplify) + Validação visual Firefox (`V-08`) | **Aceito** | 23/11/2026 |
| **AC-15** | Runtime Python 3.12 (Qualidade) | Executar pacote ZIP na AWS Lambda `python3.12` + suíte local em Python 3.12 | Produção AWS Lambda `v1` (`python3.12`) + 60 Pytest Python `3.12.14` | **Aceito** | 23/11/2026 |

### Critérios Complementares P1 — Workspace Acadêmico (`/pages` + Tiptap)

| ID | Escopo | Cenário / Teste Reproduzível | Fonte da Evidência | Estado | Data |
|---|---|---|---|---|---|
| **AC-P1-01** | P1 — CRUD Páginas | `POST/GET/PATCH/DELETE /pages` autenticado + recarga (`F5`) | Teste real API produção (`smoke_api.py` 33/33 em `acadflow-pages`) + Validação visual Firefox (`V-03`) | **Aceito** | 23/11/2026 |
| **AC-P1-02** | P1 — Isolamento Páginas | `Usuário B` tenta listar ou executar `GET`/`PATCH`/`DELETE` em página do `Usuário A`; ID token e `ownerId` no body rejeitados | Teste real API produção com **2 contas reais Cognito** (`smoke_api.py` 33/33): `404` cruzado, integridade `Usuário A` preservada, ID token `403`, `ownerId` `400` | **Aceito** | 23/11/2026 |
| **AC-P1-03** | P1 — Conflito de Salvamento | `PATCH /pages/{id}` com `expectedVersion` obsoleto (`409 CONFLICT`) | Teste real API produção (`smoke_api.py` `409`) + Validação visual Firefox em 2 abas (`V-04`) | **Aceito** | 23/11/2026 |
| **AC-P1-04** | P1 — Editor Tiptap Seguro | Formatação, checklists, citações, auto-save e recarga `F5` sem XSS | Allowlist ProseMirror ativa na Lambda `v1` (`SEC-04`) + Validação visual Firefox (`V-03`, `V-08`) | **Aceito** | 23/11/2026 |
| **AC-P1-05** | P1 — Workspace Responsivo | Navegar via sidebar recolhível/drawer entre Dashboard, Páginas e Tarefas (desktop e mobile `375 × 812`) | Validação visual Firefox em produção (`V-05`, `V-06`) | **Aceito** | 23/11/2026 |

---

## 2. Evidências Separadas por Tipo

### 2.1. Validações Visuais Manuais em Produção (Informadas pelo Usuário — Firefox, 23/11/2026)
> Executadas pessoalmente pelo autor no navegador **Firefox** contra `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br`, utilizando contas próprias e dados de demonstração.

| ID | Cenário Validado pelo Usuário | Critérios Cobertos | Resultado |
|---|---|---|---|
| **V-01** | Login Cognito com PKCE, callback limpo e proteção de rotas | `AC-01`, `AC-05`, `AC-11` | **Aprovado** |
| **V-02** | CRUD de tarefas e persistência após `F5` | `AC-06`, `AC-07`, `AC-08` | **Aprovado** |
| **V-03** | Editor Tiptap, formatação, checklists, auto-save e persistência pós-`F5` | `AC-P1-01`, `AC-P1-04` | **Aprovado** |
| **V-04** | Conflito de edição HTTP `409` ao editar a mesma página em duas abas | `AC-P1-03` | **Aprovado** |
| **V-05** | Responsividade mobile em `375 × 812 px` e recarga SPA | `AC-11`, `AC-P1-05` | **Aprovado** |
| **V-06** | Sidebar recolhível (desktop), drawer (mobile) e navegação Dashboard/Tarefas/Páginas | `AC-P1-05` | **Aprovado** |
| **V-07** | Logout, limpeza da sessão e bloqueio de rotas protegidas | `AC-13` | **Aprovado** |
| **V-08** | Comunicação REST no DevTools e ausência de problemas observados com `CSP Report-Only` | `AC-14`, `SEC-02` | **Aprovado** |

### 2.2. Testes Reais de API em Produção com 2 Contas Cognito (`33/33 PASS` — 23/11/2026)
> Executados manualmente pelo autor via `tests/e2e/smoke_api.py --api-url https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br` com duas contas reais `CONFIRMED` em `acadflow-users` (sem exposição de tokens, senhas ou e-mails).

| Bloco Validado | Comportamento Real Comprovado | Resultado |
|---|---|---|
| Saúde pública e fronteira sem credencial | `/health` `200`; `/tasks` e `/pages` sem token, inválido e expirado -> `401` | **7/7 PASS** |
| Rejeição de ID token Cognito real | `GET /tasks` e `GET /pages` com `id_token` rejeitados no API Gateway (`scope=openid`) com **`HTTP 403`** | **2/2 PASS** |
| Validação de entrada e anti-injeção `ownerId` | Payload inválido e `ownerId` no body rejeitados com **`HTTP 400`** | **3/3 PASS** |
| CRUD `/tasks` + Isolamento (`AC-05`–`AC-09`) | `201`/`200`/`200`; `Usuário B` não lista e recebe **`404`** em `GET`/`PATCH`/`DELETE`; `Usuário A` confirma integridade, exclui (`204`) -> `404` | **10/10 PASS** |
| CRUD `/pages` + Conflito `409` + Isolamento (`AC-P1-01`–`03`) | `201`/`200`/`200`; conflito otimista **`409`**; `Usuário B` não lista e recebe **`404`** em `GET`/`PATCH`/`DELETE`; `Usuário A` mantém `v2` íntegra, exclui (`204`) -> `404` | **11/11 PASS** |
| **Total da suíte real em produção** | **Zero falhas; registros temporários excluídos ao final** | **33/33 PASS** |

### 2.3. Evidências Automatizadas e de Segurança Verificadas pelo Agente (23/11/2026)

| Categoria | Verificação / Escopo | Resultado |
|---|---|---|
| **Domínios de Produção (`verify_prod_domains.py`)** | TLSv1.3 em ambos os domínios, 5 rotas SPA `200`, bundle oficial `/assets/index-BLG3afUM.js`, `/health` `200`, `401` em `/tasks` e `/pages`, CORS `204`, Cognito Hosted UI `200` | **18/18 PASS** |
| **Hardening AWS (Etapas 1–4)** | Lambda `v1` (`SEC-04` allowlist + `SEC-02` 4 headers, 2/2 páginas existentes compatíveis, 19/19 asserções reais); Amplify `customHeaders` com `CSP-Report-Only`; DynamoDB `DeletionProtectionEnabled=True` (sem PITR); API Gateway throttling `20/40` + Access Logs mínimos `/aws/apigateway/acadflow-http-api` (14 dias, zero PII/tokens); retenção Lambda 14 dias | **PASS** (detalhes em [docs/AUDITORIA_SEGURANCA.md](AUDITORIA_SEGURANCA.md)) |
| **Backend local (`pytest` Python `3.12.14`)** | `services/api/tests` + `build_package.py` + `smoke_api.py` local (`33/33`) | **60/60 PASS** + ZIP 9 módulos |
| **Frontend local (`vitest` / `tsc` / `vite` / `npm audit`)** | `apps/web` com `vitest@4.1.12` | **16/16 PASS** · build OK · **0 vulnerabilities** |
| **Diagnóstico AWS somente leitura (`check_aws_env.py`)** | Conta `****2503`, `us-east-1`, Hosted Zone `Z0906692126CHKWN9GQ2U` | **14/14 autorizado** |

### 2.4. Histórico de Provisionamento e Cutover na AWS (22/11/2026)
- **Passos A–D:** Provisionamento de `acadflow-tasks`, `acadflow-pages`, `acadflow-users`, `acadflow-api`, `acadflow-http-api` (`8/8`), Lambda+DynamoDB (`18/18`), CloudWatch+Cognito (`3/3`), Amplify `dysbk8tmbj14k` + SPA Rewrite (`5/5`), domínio institucional do frontend e cutover da API (`mqdslq`: `war28zsged` -> `u0mxrf6mnk`, `18/18`, API prévia preservada intacta).

---

## 3. Situação das Capturas de Tela (Existentes vs. Ainda Necessárias)

> **Transparência:** Nenhuma captura de tela (`.png`/`.jpg`) foi salva no repositório até o momento. As capturas abaixo devem ser coletadas localmente pelo aluno em pasta offline/PDF (fora do Git) para compor o pacote de entrega e o plano de contingência da apresentação, **sempre ocultando `Authorization`, JWTs, e-mails pessoais sensíveis, senhas e IDs/credenciais de conta AWS**:

- [ ] **01 — Arquitetura em 3 camadas (`AC-12`, `AC-15`):** diagrama real + capturas sanitizadas do Console AWS (Amplify `acadflow-web`, API Gateway `acadflow-http-api`, Lambda `acadflow-api` `python3.12`, DynamoDB `acadflow-tasks`/`acadflow-pages`).
- [ ] **02 — Comunicação REST (`AC-14`):** DevTools `Network` mostrando chamadas HTTPS JSON para `https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br` (`200`/`201`/`204`) e cabeçalhos `Cache-Control: no-store` / `X-Content-Type-Options: nosniff` (valor de `Authorization` borrado).
- [ ] **03 — Domínios institucionais HTTPS (`AC-01`, `AC-02`, `AC-11`, `AC-P1-05`):** aplicação em `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br` (desktop e mobile `375 × 812`) + `GET https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br/health` (`200 OK`) com cadeado `TLSv1.3`.
- [ ] **04 — Autenticação Cognito (`AC-05`, `AC-13`):** Login -> Cognito Hosted UI (PKCE) -> Workspace autenticado -> Logout exigindo novo login.
- [ ] **05 — Autorização JWT e isolamento (`AC-03`, `AC-04`, `AC-09`, `AC-P1-02`):** `401` sem token, `403` com ID token e saída sanitizada dos **33/33 PASS** de `tests/e2e/smoke_api.py` (isolamento `404` entre `Usuário B` e `Usuário A`).
- [ ] **06 — Persistência DynamoDB (`AC-06`–`AC-08`, `AC-P1-01`, `AC-P1-03`, `AC-P1-04`):** tarefa e página Tiptap após `F5`, banner de conflito `409` em 2 abas e tabelas com `DeletionProtectionEnabled` ativo.

---

## 4. Roteiro Final da Apresentação Presencial (27/11/2026 — ~6 minutos)

### Preparação 15 minutos antes da aula
1. Executar `services/api/.venv/bin/python tests/e2e/verify_prod_domains.py` confirmando `18/18 PASS`.
2. Deixar abertos: (a) Firefox em `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br` com DevTools (`Network`), (b) terminal limpo para `curl` em `/health` e `/tasks`, (c) PDF/pasta offline com as 6 capturas sanitizadas de contingência.

### Sequência Cronometrada (~6 min)

| Tempo | Bloco | Requisitos Cobertos | Demonstração Prática |
|---|---|---|---|
| **0:00 – 0:55** | **1. Arquitetura em 3 Camadas e Domínios Institucionais** | Req. 1 e Req. 3 | Mostrar o diagrama real: Camada 1 (`React/TS/Vite/Tiptap` no AWS Amplify em `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br`), Camada 2 (`API Gateway HTTP API` em `https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br` + `AWS Lambda Python 3.12`) e Camada 3 (`DynamoDB`: `acadflow-tasks`, `acadflow-pages`), exibindo o certificado `TLSv1.3`. |
| **0:55 – 1:45** | **2. Comunicação REST e Bloqueio Anônimo** | Req. 2 e Req. 4 | No terminal: `curl -i https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br/health` (`200 OK` + cabeçalhos de segurança) e `curl -i https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br/tasks` (`401 Unauthorized` bloqueado no API Gateway). |
| **1:45 – 2:40** | **3. Autenticação Cognito (PKCE) e DevTools** | Req. 2 e Req. 4 | Clicar em **Entrar com Amazon Cognito (PKCE)**, autenticar com a conta de demonstração e exibir no DevTools `Network` as chamadas reais `GET /tasks` e `GET /pages` (`200 OK`) com `Authorization: Bearer ...` (sem expor o valor do token). |
| **2:40 – 4:10** | **4. Demonstração Visual + Persistência no DynamoDB** | Req. 1 e Req. 2 | Em **Tarefas**: criar (`POST` `201`), atualizar status (`PATCH` `200`), pressionar **`F5`** (persistência real em `acadflow-tasks`) e excluir tarefa de demo (`DELETE` `204`). Em **Páginas**: editar título/checklist no Tiptap, aguardar **`Salvo (v2)`** (auto-save) e pressionar **`F5`** (persistência em `acadflow-pages` com JSON ProseMirror validado no servidor). |
| **4:10 – 5:10** | **5. Autorização JWT, Isolamento e Hardening** | Req. 4 | Explicar a defesa em profundidade: JWT Authorizer rejeita ID tokens (`403` por `scope=openid`), Lambda exige `sub` + `token_use=="access"` e DynamoDB isola por `(ownerId=sub, id)` retornando `404` para dados alheios — evidenciado pelos **33/33 PASS** com 2 contas Cognito reais. Citar throttling (`20/40`), Access Logs mínimos (14 dias, sem PII), headers de segurança e `DeletionProtection`. |
| **5:10 – 6:00** | **6. Responsividade Mobile + Logout** | Req. 1 e Req. 4 | Exibir mobile `375 × 812` no DevTools (drawer da sidebar), clicar em **Sair** (limpeza `sessionStorage` + `/logout` Cognito) e tentar acessar `/tasks` comprovando redirecionamento para `/login`. |

### Plano de Contingência (Oscilação ou Queda de Rede na Sala)
1. **Wi-Fi instável:** rotear 4G/5G do celular apenas para os domínios HTTPS do AcadFlow (< 1 MB de tráfego na demonstração).
2. **Sem internet na sala:** apresentar o **PDF/pasta offline com as 6 capturas sanitizadas** da Seção 3 (evidenciando ambos os domínios HTTPS, DevTools Network, persistência pós-`F5`, console AWS e a saída `33/33 PASS` de `smoke_api.py`). Caso necessário exibir a interface interativa offline, iniciar `python services/api/local_server.py` + `npm run dev` informando **explicitamente ao docente** que se trata de contingência local enquanto as capturas comprovam a publicação real.
3. **Sessão do Learner Lab:** a aplicação publicada continua no ar independentemente da expiração da CLI local; renove a sessão do Learner Lab antes da aula apenas se desejar abrir o Console AWS ao vivo.

---

## 5. Checklist Final de Submissão no SIGAA (Prazo: 27/11/2026 às 23h59)

- [ ] Coletar e revisar as 6 capturas sanitizadas (zero tokens, senhas, e-mails privados ou IDs de conta AWS).
- [ ] Conferir o formato exato de submissão exigido no SIGAA (link do repositório GitHub, URLs institucionais HTTPS e/ou relatório/PDF).
- [ ] Garantir que todos os commits finais aprovados foram enviados para `origin/main` (sem `.env.local`, sem `deploy_state.json`, sem credenciais e com `docs/AVALIACAO.md` intocado).
- [ ] Executar `verify_prod_domains.py` no dia **27/11/2026** antes da apresentação presencial.
- [ ] Realizar a apresentação presencial ao docente em **27/11/2026** e confirmar o comprovante de envio no SIGAA antes de **23h59** (somente então marcar `AC-12` como `Aceito`).
