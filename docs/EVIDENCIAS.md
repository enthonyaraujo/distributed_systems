# Evidências e Matriz Central de Critérios de Aceitação — AcadFlow

> **Regra de integridade:** Nenhum critério que exige Cognito real, dois usuários reais, DynamoDB em fluxo ponta a ponta no navegador ou verificação manual em produção pode ser marcado como `Aceito` com base apenas em testes locais ou mocks. Registre sempre a diferença entre **testes automatizados** (locais e produção) e **validações manuais pendentes**, sem tokens, senhas ou chaves.

---

## 1. Matriz Central Única de Critérios de Aceitação (`AC-01` a `AC-15`)

| ID | Requisito Oficial (`docs/AVALIACAO.md`) | Cenário / Teste Reproduzível | Tipo de Validação | Ambiente Exigido | Estado | Data |
|---|---|---|---|---|---|---|
| **AC-01** | DNS da Aplicação (Req. 3) | Acessar `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br` | Automatizado (`verify_prod_domains.py`) + Manual (navegador) | Produção (DNS institucional) | **Aceito** (verificado em 22/11 e revalidado em 23/11 — `TLSv1.3` até 08/06/2027) | 23/11/2026 |
| **AC-02** | DNS da API (Req. 2, 3) | `GET https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br/health` | Automatizado (`verify_prod_domains.py`) | Produção (DNS institucional) | **Aceito** (`200 OK`, `TLSv1.3` até 03/06/2027, revalidado em 23/11) | 23/11/2026 |
| **AC-03** | Autorização API (Req. 4) | `GET /tasks` e `GET /pages` sem header `Authorization` | Automatizado (`verify_prod_domains.py`) | Produção (DNS institucional) | **Aceito** (`401` pelo API Gateway em `/tasks` e `/pages`, revalidado em 23/11) | 23/11/2026 |
| **AC-04** | Autorização API (Req. 4) | `GET /tasks` com token inválido, expirado ou **ID token** | Automatizado (inválido + Lambda real) + **Manual pendente (ID token real no Gateway)** | Produção (DNS institucional) | **Parcial** (inválido `401` verificado no DNS oficial; ID token `401` verificado na Lambda real; falta testar ID token Cognito real no DNS oficial via `ACADFLOW_ID_TOKEN_A`) | 23/11/2026 |
| **AC-05** | Autenticação + API (Req. 2, 4) | Login Cognito (PKCE) + `GET /tasks` com `access_token` válido | **Manual (navegador + `smoke_api.py` com token real)** | Produção (DNS institucional) | **Pendente** (testado localmente em memória; validar no DNS oficial com `Usuário A`) | — |
| **AC-06** | 3 Camadas + CRUD (Req. 1, 2) | `POST /tasks` autenticado | Automatizado (Lambda+DynamoDB real em 22/11) + **Manual pendente (fluxo HTTP/navegador no DNS oficial)** | Produção (AWS + DynamoDB) | **Pendente** (Lambda+DynamoDB validados via invoke; falta evidência via navegador/HTTP autenticado no DNS oficial) | — |
| **AC-07** | Persistência Real (Req. 1, 2) | `PATCH /tasks/{id}` e recarregar página (`F5`) | **Manual (navegador)** | Produção (AWS + DNS institucional) | **Pendente** | — |
| **AC-08** | CRUD Completo (Req. 1, 2) | `DELETE /tasks/{id}` e confirmar ausência após recarga | Automatizado (Lambda+DynamoDB real em 22/11) + **Manual pendente (fluxo HTTP/navegador)** | Produção (AWS + DynamoDB) | **Pendente** | — |
| **AC-09** | Isolamento / Anti-IDOR (Req. 4) | `Usuário B` tenta `GET`/`PATCH`/`DELETE` em tarefa do `Usuário A` | Automatizado (Lambda+DynamoDB real em 22/11) + **Manual pendente (2 contas Cognito reais via HTTP)** | Produção (AWS + 2 usuários reais) | **Pendente** (executar roteiro da Seção 4 com `ACADFLOW_TOKEN_A` e `ACADFLOW_TOKEN_B`) | — |
| **AC-10** | Validação de Negócios (Req. 1, 2) | `POST /tasks` sem `title`, `status` inválido ou com `ownerId` no body | Automatizado (unitário + Lambda real) + **Manual pendente via DNS oficial** | Produção (AWS) | **Pendente** (coberto por `smoke_api.py` na Seção 4) | — |
| **AC-11** | UI Responsiva + SPA Rewrite (Req. 1) | Testar em mobile (`375x812`), recarregar rotas e `/auth/callback` | Automatizado (SPA `200 OK` em 5 rotas) + **Manual pendente (viewport mobile `375x812`)** | Produção (DNS institucional) | **Parcial** (SPA rewrite `200 OK` revalidado em 23/11; falta inspeção visual mobile `375x812`) | 23/11/2026 |
| **AC-12** | 3 Camadas + Apresentação (Req. 1, 5) | Explicar arquitetura publicada e ensaiar demo (5–8 min) | **Manual (ensaio presencial)** | Produção / Presencial | **Pendente** (apresentação em 27/11/2026) | — |
| **AC-13** | Logout e Sessão (Req. 4) | Acionar Logout, validar limpeza de `sessionStorage`, `/logout` Cognito e reexigência de login | **Manual (navegador)** | Produção (DNS institucional) | **Pendente** | — |
| **AC-14** | Comunicação REST Real (Req. 2) | Inspecionar DevTools Network durante uso real | Automatizado (CORS `204` revalidado) + **Manual pendente (captura DevTools)** | Produção (DNS institucional) | **Parcial** (CORS institucional revalidado em 23/11; falta captura do DevTools autenticado) | 23/11/2026 |
| **AC-15** | Runtime Python 3.12 (Qualidade) | Executar pacote ZIP na AWS Lambda `python3.12` + suíte local em Python 3.12 | Automatizado (Lambda real 22/11 + Fedora Python `3.12.14` 23/11) | AWS Lambda (`python3.12`) + Fedora | **Aceito** (Lambda real validada em 22/11 + 39 testes e empacotamento validados em Python `3.12.14` no Fedora em 23/11) | 23/11/2026 |

### Critérios Complementares P1 — Workspace Acadêmico (`/pages` + Tiptap)

| ID | Escopo | Cenário / Teste Reproduzível | Tipo de Validação | Ambiente Exigido | Estado | Data |
|---|---|---|---|---|---|---|
| **AC-P1-01** | P1 — CRUD Páginas | `POST/GET/PATCH/DELETE /pages` autenticado + recarga (`F5`) | Automatizado (Lambda+DynamoDB 22/11) + **Manual pendente (captura formal)** | Produção (AWS + DynamoDB) | **Pendente** (validado informalmente no navegador em 22/11; registrar evidência formal na Seção 4) | — |
| **AC-P1-02** | P1 — Isolamento Páginas | `Usuário B` tenta `GET/PATCH/DELETE /pages/{id}` do `Usuário A`; ID token (`401`) e `ownerId` no body (`400`) rejeitados | Automatizado (Lambda real 22/11) + **Manual pendente (2 contas reais via HTTP)** | Produção (AWS + 2 usuários reais) | **Pendente** (coberto por `smoke_api.py` na Seção 4) | — |
| **AC-P1-03** | P1 — Conflito de Salvamento | Enviar `PATCH /pages/{id}` com `expectedVersion` desatualizado (`409 CONFLICT`) | Automatizado (unitário + Lambda real + `smoke_api.py`) + **Manual pendente (2 abas/HTTP DNS oficial)** | Produção (AWS) | **Pendente** | — |
| **AC-P1-04** | P1 — Editor Tiptap Seguro | Editar títulos, parágrafos, listas, negrito, itálico, checklists e citações; salvar e recarregar | **Manual (navegador)** | Produção (DNS institucional) | **Pendente** | — |
| **AC-P1-05** | P1 — Workspace Responsivo | Navegar via sidebar recolhível entre Dashboard, Páginas e Tarefas em desktop e mobile (`375x812`) | **Manual (navegador)** | Produção (DNS institucional) | **Pendente** | — |

---

## 2. Registro de Testes Automatizados

### 23/11/2026 — Estabilização, Segurança e Validação no Fedora Linux (Python 3.12.14 + Node v26.12.1)
> **Escopo:** Testes automatizados locais + auditoria de segurança + verificação somente leitura dos domínios institucionais em produção. Nenhum recurso AWS foi modificado e nenhuma implantação foi executada.

| Tipo | Suíte / Verificação | Comando | Ambiente | Resultado |
|---|---|---|---|---|
| **Automatizado (Segurança)** | Auditoria npm após correção de `vitest` (`^3.1.2` -> `^4.1.12`) | `cd apps/web && npm audit` | Fedora 45 / Node `v26.12.1` / npm `11.20.0` | **0 vulnerabilities** (resolvidas 2 críticas em `tinypool` e 1 moderada em `@vitest/mocker`/`vitest`; zero pacotes de produção eram afetados) |
| **Automatizado (Local)** | Backend regressão P0 + P1 (`services/api`) | `services/api/.venv/bin/pytest services/api/tests -v` | Fedora 45 / **Python `3.12.14`** / pytest `9.2.0` | **39 passed** — compatibilidade nativa com runtime Lambda `python3.12` validada |
| **Automatizado (Local)** | Compilação sintática Python 3.12 + Empacotamento ZIP | `python -m compileall -q services/api/src infra tests` + `python services/api/build_package.py` | Fedora 45 / Python `3.12.14` | **PASS** — `services/api/dist/acadflow-api.zip` gerado com 9 módulos puros `acadflow_api/*.py` |
| **Automatizado (Local)** | Smoke HTTP local (`/tasks` + `/pages`) | `local_server.py` + `tests/e2e/smoke_api.py` | Fedora 45 / Python `3.12.14` (in-memory) | **26/26 PASS** (`/health`, `401`, `400`, CRUD `/tasks` e `/pages`, `409`, anti-IDOR `404`) |
| **Automatizado (Local)** | Frontend unitário (Vitest 4.1.12) | `cd apps/web && npm run test` | Fedora 45 / Vitest `4.1.12` | **16 passed** (6 arquivos: `tasksApi`, `pagesApi`, `oidcConfig`, `validation`, `pageValidation`, `autosaveState`) |
| **Automatizado (Local)** | Frontend typecheck + build de produção | `cd apps/web && npm run typecheck && npm run build` | Fedora 45 / TypeScript `5.8.3` + Vite `6.4.6` | **PASS** — zero erros de tipagem e bundle gerado em `apps/web/dist/` |
| **Automatizado (Produção — Somente Leitura)** | Verificação dos 2 domínios institucionais HTTPS | `services/api/.venv/bin/python tests/e2e/verify_prod_domains.py` | Produção HTTPS (`enthonyaraujo.grupo-03.sd.ufersa.dev.br` + `api.enthonyaraujo.grupo-03.sd.ufersa.dev.br`) | **18/18 PASS** (TLSv1.3, 5 rotas SPA `200`, bundle oficial, `/health` `200`, `/tasks` e `/pages` `401`, CORS `204`, Cognito Hosted UI `200`) |
| **Automatizado (AWS — Somente Leitura)** | Diagnóstico completo de conta e recursos AWS | `services/api/.venv/bin/python infra/check_aws_env.py --hosted-zone-id Z0906692126CHKWN9GQ2U --owner-filter enthonyaraujo` | Fedora 45 (`~/.aws` `700` / `credentials` `600`, conta `****2503`, `us-east-1`) | **14/14 autorizado** — confirmados ativos: DynamoDB (`acadflow-tasks`, `acadflow-pages`), Lambda (`acadflow-api`, `python3.12`), HTTP API (`u0mxrf6mnk`), Cognito (`us-east-1_tKA6pURyD`), Amplify (`dysbk8tmbj14k`), ACM (`ISSUED`) e Route 53 (`Z0906692126CHKWN9GQ2U`); recursos prévios preservados intactos (lembrar que credenciais do Learner Lab expiram a cada ~4h) |

### 22/11/2026 — Histórico de Testes Reais na AWS (Passos A, B, C e D)
> Evidências executadas contra a conta AWS Learner Lab (`****2503`, `us-east-1`) durante provisionamento e cutover.

| Tipo | Suíte / Alvo Real | Ambiente | Resultado |
|---|---|---|---|
| **Automatizado (AWS)** | Passo B1 — HTTP API HTTPS (`u0mxrf6mnk`) via `aws_step_b_verify.py` | API Gateway HTTP API (`us-east-1`) | **8/8 PASS** |
| **Automatizado (AWS)** | Passo B2 — `lambda:Invoke` em `acadflow-api` (`python3.12`) + DynamoDB real (`acadflow-tasks` e `acadflow-pages`) | AWS Lambda `python3.12` + DynamoDB | **18/18 PASS** (rejeição `token_use` ausente/ID token `401`; `ownerId` `400`; CRUD `/tasks` e `/pages`; `409`; anti-IDOR `404`; itens de teste limpos) |
| **Automatizado (AWS)** | Passo B3 — CloudWatch Logs + Cognito Hosted UI | CloudWatch + Cognito (`us-east-1`) | **3/3 PASS** |
| **Automatizado (Produção)** | Passo D — Amplify Hosting + SPA Rewrite + Domínio Frontend (`AC-01`) | Amplify `dysbk8tmbj14k` + HTTPS institucional | **5/5 PASS** + acesso autenticado validado no navegador pelo aluno |
| **Automatizado (Produção)** | Passo C — Cutover Oficial da API (`mqdslq`: `war28zsged` -> `u0mxrf6mnk`) + `verify_prod_domains.py` (`AC-02`, `AC-03`) | Ambos os domínios HTTPS institucionais | **18/18 PASS** (`war28zsged` preservada intacta) |

---

## 3. Estabilizações Locais Preparadas (23/11/2026)

> **Importante:** As correções locais abaixo já estão validadas por testes e build no Fedora, mas **ainda não foram implantadas no AWS Amplify** (nenhum deploy foi executado sem autorização). Caso deseje publicá-las antes da apresentação de 27/11, será necessário renovar o Learner Lab e autorizar um novo deploy do frontend.

1. **Dependências (`apps/web/package.json`):** `vitest` atualizado de `^3.1.2` para `^4.1.12` (`npm audit` zerado; compatível com `vite@6` e Node 20+).
2. **Estabilidade do auto-save (`PageEditorPage.tsx` + `utils/autosaveState.ts`):** bloqueio de `PATCH` concorrente (evita `409` auto-infligido ao clicar **Salvar** durante debounce), preservação de edições digitadas durante salvamento em voo, proteção contra troca rápida de página e alerta `beforeunload` com alterações não salvas.
3. **Bloqueio efetivo em conflito `409` (`RichTextEditor.tsx` + `PageEditorPage.tsx`):** `editor.setEditable(!disabled)` sincronizado reativamente + bloqueio do campo de título e ícones até o usuário clicar em **Recarregar página**.
4. **Preservação de formulário em erro (`TaskForm.tsx` / `TasksPage.tsx`):** só limpa os campos após confirmação de sucesso da API.
5. **Renomeação segura de páginas (`PagesIndexPage.tsx`):** valida título antes da chamada e atualiza a lista automaticamente em caso de `409`.

---

## 4. Roteiro de Validação Final com 2 Contas Reais (Sem Inventar Credenciais)

> Utilize **duas contas reais controladas por você** no Cognito User Pool `acadflow-users` (`us-east-1_tKA6pURyD`), por exemplo dois endereços de e-mail próprios distintos (`Usuário A` e `Usuário B`). **Nunca** salve tokens em arquivos do repositório nem os exiba em capturas de tela.

### Etapa 1 — Validação Manual no Navegador (Produção HTTPS)
1. **Login e Dashboard (`AC-01`, `AC-05`, `AC-14`):**
   - Abra uma janela normal em `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br` com DevTools (`Network` aberto).
   - Faça login com o **`Usuário A`** via Amazon Cognito (PKCE).
   - Confirme no `Network` chamadas HTTPS para `https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br/tasks` e `/pages` com `200 OK` e cabeçalho `Authorization: Bearer ...`.
2. **CRUD de Tarefas + Persistência (`AC-06`, `AC-07`, `AC-08`):**
   - Crie uma tarefa (`POST /tasks` -> `201`), altere o status (`PATCH /tasks/{id}` -> `200`), pressione **`F5`** e confirme que a alteração permanece salva no DynamoDB.
   - Exclua uma tarefa de teste (`DELETE /tasks/{id}` -> `204`) e confirme ausência após **`F5`**.
3. **Páginas, Editor Tiptap e Auto-save (`AC-P1-01`, `AC-P1-03`, `AC-P1-04`):**
   - Crie uma página, adicione título (`H2`), texto em **negrito**/*itálico*, lista, checklist e citação; aguarde o indicador mudar para `Salvo (v2)` (ou clique em **Salvar**), pressione **`F5`** e confirme preservação integral do conteúdo.
   - *(Conflito `409`)* Abra a mesma página em uma segunda aba do `Usuário A`, salve uma edição na Aba 1 e tente salvar na Aba 2 -> confirme alerta `409` e recuperação via **Recarregar página**.
4. **Responsividade Mobile + SPA Rewrite (`AC-11`, `AC-P1-05`):**
   - No DevTools, ative viewport **`375x812`**, navegue pelo menu drawer entre Dashboard, Tarefas e Páginas, verifique ausência de overflow horizontal e pressione **`F5`** em `/tasks` e `/pages/<id>` (deve retornar `200`, nunca `404`).
5. **Logout (`AC-13`):**
   - Clique em **Sair**, confirme limpeza do `sessionStorage`, redirecionamento ao `/logout` do Cognito e redirecionamento para `/login` ao tentar acessar `/tasks`.

### Etapa 2 — Prova Automatizada de Isolamento entre 2 Contas Reais (`AC-04`, `AC-05`–`AC-10`, `AC-P1-01`–`AC-P1-03`)
Com o `Usuário A` autenticado em uma janela normal e o `Usuário B` em uma janela anônima em `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br`:

1. Extraia os tokens temporários da sessão do navegador (`Application -> Session Storage -> oidc.user:...`) **apenas para variáveis de ambiente em memória no terminal** (use espaço antes de `export` ou `read -s` para evitar gravar no histórico do shell):
   ```bash
   read -rs -p "Access Token Usuário A: " ACADFLOW_TOKEN_A; echo
   read -rs -p "ID Token Usuário A: " ACADFLOW_ID_TOKEN_A; echo
   read -rs -p "Access Token Usuário B: " ACADFLOW_TOKEN_B; echo
   export ACADFLOW_TOKEN_A ACADFLOW_ID_TOKEN_A ACADFLOW_TOKEN_B
   ```
2. Execute a suíte sanitizada [tests/e2e/smoke_api.py](../tests/e2e/smoke_api.py) contra o domínio oficial da API (o script **nunca imprime tokens** e remove os itens de teste ao final):
   ```bash
   services/api/.venv/bin/python tests/e2e/smoke_api.py \
     --api-url https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br
   ```
3. Limpe imediatamente as variáveis da sessão ao concluir:
   ```bash
   unset ACADFLOW_TOKEN_A ACADFLOW_ID_TOKEN_A ACADFLOW_TOKEN_B
   ```
4. **Critérios comprovados por esta execução (26/26 PASS):**
   - `AC-02` (`/health` `200`), `AC-03` (sem token `401`), `AC-04` (token inválido `401` + **ID token real rejeitado com `401`/`403`**),
   - `AC-05`/`AC-06`/`AC-07`/`AC-08`/`AC-10` (CRUD completo + validação `400` + rejeição de `ownerId` `400`),
   - **`AC-09` e `AC-P1-02`** (`Usuário B` recebe **`404`** ao tentar `GET`, `PATCH` ou `DELETE` em tarefa ou página pertencente ao `Usuário A`),
   - `AC-P1-01` e `AC-P1-03` (CRUD `/pages` + conflito otimista `409`).

---

## 5. Checklist de Capturas e Preparação para a Apresentação (27/11/2026)

- [ ] Executar Etapa 1 e Etapa 2 da Seção 4 com 2 contas reais e atualizar os estados `Pendente` -> `Aceito` nesta tabela.
- [ ] Captura do frontend carregado no domínio institucional HTTPS em desktop e mobile `375x812` (`AC-01`, `AC-11`, `AC-P1-05`).
- [ ] Captura de `GET /health` (`200`) e `GET /tasks` sem token (`401`) / com ID token (`401`/`403`) no domínio institucional da API (`AC-02`, `AC-03`, `AC-04`).
- [ ] Captura do DevTools Network autenticado (`200`/`201`/`204`) com cabeçalho `Authorization` oculto/redigido (`AC-05`, `AC-14`).
- [ ] Captura do CRUD de tarefas e páginas após recarga `F5` (`AC-06`, `AC-07`, `AC-08`, `AC-P1-01`, `AC-P1-04`).
- [ ] Saída sanitizada do `smoke_api.py` comprovando isolamento `404` entre `Usuário A` e `Usuário B` (`AC-09`, `AC-P1-02`, `AC-P1-03`).
- [ ] Captura do fluxo de Logout exigindo nova autenticação (`AC-13`).
- [ ] Captura dos recursos reais no console AWS (Amplify, API Gateway, Lambda `python3.12`, DynamoDB `acadflow-tasks`/`acadflow-pages`, Cognito) sem credenciais expostas (`AC-12`, `AC-15`).
- [ ] Conferir no dia 27/11 (antes da aula) se a sessão do Learner Lab precisa estar ativa apenas para abrir o console AWS (a aplicação publicada no Amplify/API Gateway/Lambda/DynamoDB/Cognito funciona independentemente da CLI local, mas verificar `verify_prod_domains.py` 15 min antes da apresentação!).
- [ ] Confirmar formato de entrega no SIGAA antes de 27/11/2026 às 23h59.
