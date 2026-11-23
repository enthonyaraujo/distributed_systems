# AcadFlow — Evolução para Workspace Acadêmico (P1)

> **Data:** 22/11/2026  
> **Escopo:** Evolução funcional P1 inspirada na experiência do Notion, preservando integralmente os 4 requisitos obrigatórios da disciplina (**P0**), os contratos existentes de `/tasks` e a arquitetura de três camadas na AWS.

---

## 1. Visão Funcional do Novo AcadFlow

O AcadFlow evolui de um gerenciador simples de tarefas para um **workspace acadêmico unificado**, com identidade visual editorial própria (paleta acadêmica limpa em tons de ardósia, papel suave e índigo, sem copiar visualmente o Notion), reunindo:

1. **Dashboard Acadêmico Integrado (`/`):** visão consolidada de atividades e anotações do estudante autenticado, com resumos numéricos reais, atalhos rápidos (`+ Nova página`, `+ Nova atividade`), páginas recentes e atividades pendentes/em andamento.
2. **Páginas e Anotações (`/pages` e `/pages/:pageId`):** criação, renomeação, edição visual estruturada, salvamento confiável com detecção de conflitos e exclusão de páginas pessoais.
3. **Tarefas Acadêmicas (`/tasks`):** reaproveitamento direto dos componentes já validados (`TaskForm`, `TaskList`, `TasksApiClient`) integrados à navegação do workspace sem reescrever o CRUD existente.
4. **Navegação por Sidebar Responsiva:** barra lateral recolhível no desktop e gaveta deslizante (*drawer*) em dispositivos móveis, listando dinamicamente as páginas do usuário.

### Limites de Escopo (P2 — Fora do Escopo Atual)
Não serão implementados antes da entrega de 27/11/2026: colaboração em tempo real, compartilhamento entre usuários, upload de arquivos/imagens, hierarquia complexa de subpáginas, bancos de dados configuráveis, recursos de IA ou automações avançadas.

---

## 2. Arquitetura Ampliada (3 Camadas Preservadas)

```text
[Navegador (Desktop / Mobile)]
        |  HTTPS (https://<SEUNOME>.<grupo>.sd.ufersa.dev.br)
        v
[Camada 1 — Apresentação: React + TypeScript + Vite + Tiptap (AWS Amplify)]
        |  OIDC Authorization Code + PKCE (oidc-client-ts) <--> [Amazon Cognito]
        |  REST/JSON + Authorization: Bearer <access_token>
        v
[Amazon API Gateway HTTP API v2 (https://api.<SEUNOME>.<grupo>.sd.ufersa.dev.br)]
        |  JWT Authorizer em TODAS as rotas /tasks* e /pages* (apenas GET /health pública)
        v
[Camada 2 — Negócios: AWS Lambda Python 3.12 (acadflow_api.handler.lambda_handler)]
        |  Exige claims.sub não vazio + claims.token_use == "access"
        |  Validação estrita + controle de concorrência otimista (version)
        v
[Camada 3 — Dados: Amazon DynamoDB]
        ├── Tabela acadflow-tasks (PK: ownerId, SK: id)  [intacta]
        └── Tabela acadflow-pages (PK: ownerId, SK: id)  [nova]
```

### Decisão de Persistência DynamoDB
- **Tabela dedicada `acadflow-pages` (`PK = ownerId`, `SK = id`, `PAY_PER_REQUEST`)** em vez de misturar entidades na `acadflow-tasks`:
  - Garante **zero regressão** nas consultas `Query` já implementadas e testadas de `/tasks`.
  - Mantém o mesmo padrão de isolamento horizontal estrito por chave composta `(ownerId, id)` e **zero `Scan`**.
- **Limites de tamanho de documento:** o DynamoDB impõe limite rígido de 400 KB por item. O AcadFlow aplica limite de **100 KB (102.400 bytes UTF-8)** ao JSON estruturado `content` de cada página (margem ampla para metadados e textos acadêmicos extensos, evitando erros inesperados de tamanho e custo excessivo de WCU/RCU).
- **Formato do conteúdo rico e segurança (anti-XSS):**
  - Persistido exclusivamente como **JSON estruturado ProseMirror/Tiptap** (`{"type": "doc", "content": [...]}`), **nunca** como HTML bruto.
  - O backend valida estrutura raiz (`type == "doc"`), profundidade máxima de aninhamento (20 níveis, contra DoS de recursão) e limite de bytes UTF-8 (100 KB).
  - O frontend renderiza exclusivamente via schema controlado do **Tiptap** (sem `dangerouslySetInnerHTML`), eliminando vetores comuns de XSS armazenado.
- **Conflitos de salvamento (Concorrência Otimista):**
  - Cada página mantém um inteiro monotônico `version` (inicia em `1`, incrementa em cada `PATCH`).
  - O `PATCH /pages/{id}` aceita `expectedVersion` opcional; no DynamoDB a `ConditionExpression` exige `attribute_exists(ownerId) AND attribute_exists(id) AND #version = :expectedVersion`.
  - Em caso de alteração concorrente por outra aba/sessão, a API responde **`409 CONFLICT`** (`VERSION_CONFLICT`) e o editor orienta o usuário a recarregar a versão mais recente sem sobrescrever silenciosamente os dados. Se o recurso pertencer a outro usuário ou não existir, continua retornando **`404 PAGE_NOT_FOUND`**.

---

## 3. Modelo de Dados `Page`

### Resumo retornado em `GET /pages` (otimizado para a Sidebar e Dashboard)
```json
{
  "id": "uuid",
  "title": "Resumo — Sistemas Distribuídos",
  "icon": "📄",
  "version": 3,
  "createdAt": "2026-11-22T18:00:00Z",
  "updatedAt": "2026-11-22T19:15:00Z"
}
```

### Documento completo retornado em `POST /pages`, `GET /pages/{id}` e `PATCH /pages/{id}`
```json
{
  "id": "uuid",
  "title": "Resumo — Sistemas Distribuídos",
  "icon": "📄",
  "content": {
    "type": "doc",
    "content": [
      {
        "type": "heading",
        "attrs": { "level": 2 },
        "content": [{ "type": "text", "text": "Requisitos do Projeto Final" }]
      },
      {
        "type": "paragraph",
        "content": [{ "type": "text", "text": "Arquitetura em 3 camadas na AWS." }]
      }
    ]
  },
  "version": 1,
  "createdAt": "2026-11-22T18:00:00Z",
  "updatedAt": "2026-11-22T18:00:00Z"
}
```

**Regras de validação:**
- `title`: obrigatório no `POST`, string 1–120 caracteres após `strip()`.
- `icon`: opcional (default `"📄"`), string até 8 caracteres.
- `content`: opcional no `POST` (default documento vazio ProseMirror `{"type": "doc", "content": [{"type": "paragraph"}]}`), objeto JSON com `type == "doc"`, `content` lista, profundidade <= 20, tamanho serializado <= 102.400 bytes UTF-8.
- `expectedVersion`: opcional no `PATCH`, inteiro positivo (`>= 1`).
- Campos proibidos/desconhecidos (`ownerId`, `id`, `version`, `createdAt`, `updatedAt`) no payload: rejeitados com `400 VALIDATION_ERROR`.

---

## 4. Endpoints REST de Páginas

| Método | Rota | Proteção | Status de Sucesso | Comportamento |
|---|---|---|---|---|
| `GET` | `/pages` | JWT Access Token | `200 OK` | `{"items": [PageSummary, ...]}` ordenadas por `updatedAt` desc |
| `POST` | `/pages` | JWT Access Token | `201 Created` | Cria página com `ownerId = sub`, `version = 1` |
| `GET` | `/pages/{id}` | JWT Access Token | `200 OK` | Retorna `Page` completa ou `404` se inexistente/outro usuário |
| `PATCH` | `/pages/{id}` | JWT Access Token | `200 OK` | Atualiza `title`/`icon`/`content`, incrementa `version`; `409` se `expectedVersion` divergir; `404` se inexistente/outro usuário |
| `DELETE` | `/pages/{id}` | JWT Access Token | `204 No Content` | Remove página própria ou `404` se inexistente/outro usuário |

> **Contratos preservados:** nenhum endpoint ou campo de `/health` e `/tasks*` foi alterado.

---

## 5. Organização dos Componentes React (`apps/web/src/`)

- `types/page.ts` — interfaces `PageSummary`, `Page`, `ProseMirrorDoc`, `CreatePageInput`, `UpdatePageInput`.
- `api/pagesApi.ts` — cliente HTTP tipado (`PagesApiClient`) reutilizando `ApiClientError`, `AuthSessionExpiredError` e adicionando `PageConflictError` (`409`).
- `utils/pageValidation.ts` — validação local de título, ícone e tamanho máximo de conteúdo.
- `components/WorkspaceLayout.tsx` — shell principal com sidebar recolhível/responsiva, navegação (`Dashboard`, `Tarefas`, `Páginas`), criação rápida de página e controles de sessão/logout.
- `components/RichTextEditor.tsx` — wrapper controlado do **Tiptap** (`StarterKit` + `TaskList` + `TaskItem` + `Placeholder`) com barra de ferramentas limpa (H1/H2/H3, Negrito, Itálico, Lista com marcadores, Lista numerada, Checklist, Citação).
- `pages/WorkspaceDashboardPage.tsx` — Dashboard integrado com contadores reais de tarefas e páginas, atalhos rápidos, páginas recentes e atividades ativas.
- `pages/TasksPage.tsx` — integração do CRUD existente (`TaskForm` + `TaskList`) dentro do workspace sem duplicação.
- `pages/PagesIndexPage.tsx` e `pages/PageEditorPage.tsx` — gestão de páginas, edição inline de título/ícone, auto-save com debounce + botão salvar manual, indicador de estado de salvamento, tratamento de conflito `409` e exclusão com confirmação.

---

## 6. Estratégia de Integração do Tiptap

- **Bibliotecas selecionadas:** `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/extension-placeholder`.
- **Sincronização segura:** o editor recebe `initialContent` chaveado por `page.id + reloadCounter` para evitar sobrescrever o cursor do usuário durante auto-save e garantir recarga limpa ao trocar de página ou resolver um conflito `409`.
- **Salvamento confiável:** debounce de 1,5s após alterações + botão explícito **Salvar agora**, enviando `expectedVersion` para proteger contra sobrescrita silenciosa.

---

## 7. Testes, Critérios de Aceitação e Impacto no Cronograma

### Critérios de Aceitação P1 (Complementares aos `AC-01`–`AC-15` de P0)
- **AC-P1-01:** CRUD de `/pages` autenticado com persistência real no DynamoDB `acadflow-pages`.
- **AC-P1-02:** Isolamento multiusuário em `/pages/{id}` (`GET`/`PATCH`/`DELETE` cruzados retornam `404`) e rejeição de `ownerId` no payload (`400`) e ID token (`401`).
- **AC-P1-03:** Detecção de conflito de salvamento (`expectedVersion` divergente -> `409 CONFLICT`).
- **AC-P1-04:** Editor Tiptap salva e recarrega títulos, parágrafos, listas, negrito, itálico, checklists e citações sem XSS.
- **AC-P1-05:** Sidebar recolhível/responsiva (desktop + mobile `375x812`) navegando entre Dashboard, Páginas e Tarefas sem quebrar nenhuma funcionalidade de `/tasks`.

### Impacto no Cronograma e Riscos
- **Impacto em P0:** mínimo/controlado — todo o trabalho local de P1 ocorre em 22/11 sem alterar `/tasks` nem atrasar o desbloqueio de DNS/AWS.
- **Impacto em AWS (quando autorizado):** acrescenta 1 tabela DynamoDB (`acadflow-pages`, `PAY_PER_REQUEST`), 1 variável de ambiente na Lambda (`PAGES_TABLE`) e 5 rotas `/pages*` no mesmo HTTP API Gateway (sem novos serviços AWS nem novos custos fixos).
- **Risco principal:** tempo de entrega (27/11). Mitigação: caso haja qualquer atraso em DNS/Cognito/Amplify, congelar imediatamente refinamentos visuais de P1 e priorizar 100% os 4 requisitos oficiais de P0.
