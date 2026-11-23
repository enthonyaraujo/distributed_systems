# Auditoria Profissional de Frontend, UI/UX e Design System — AcadFlow

> **Escopo e contexto de versão:** Esta auditoria avalia o estado atual do frontend local (`apps/web/`) na branch **`feat/shopeers-redesign`** (baseada no commit estável `eae92ae`). A produção publicada na AWS Amplify (`main`) permanece intocada, nenhuma alteração de código/dependência foi aplicada nesta etapa, e `docs/AVALIACAO.md` segue integralmente preservado.
>
> **Modo de superfície (`impeccable`):** **Operate** (workspace acadêmico de produtividade com tarefas, páginas e editor rico Tiptap) + **Persuade/Entry** leve na tela de autenticação (`LoginPage`).

---

## 0. Inventário de Skills Verificadas e Consulta ao Segundo Cérebro

### 0.1 Skills verificadas e utilizadas

| Skill | Disponibilidade | Caminho verificado | Papel nesta auditoria |
|---|---|---|---|
| `frontend-design` | Instalada | `~/.gemini/config/skills/frontend-design/SKILL.md` | Direção visual, especificidade de produto e detecção de *template chrome* ("AI tells") |
| `ui-ux-pro-max` | Instalada + CLI Python executada | `~/.gemini/config/skills/ui-ux-pro-max/SKILL.md` | Execução de `scripts/search.py` (`--design-system`, `--domain ux`, `--stack react`) e prioridades WCAG/Touch/Layout |
| `design-taste-frontend` | Instalada | `~/.gemini/config/skills/design-taste-frontend/SKILL.md` | Disciplina visual (*equal edges*, uma ação principal por tela, zero elementos cortados/sobrepostos) |
| `impeccable` | Instalada + CLI executada | `~/.gemini/config/skills/impeccable/SKILL.md` | `impeccable context`, `impeccable detect` (36 arquivos), rubrica de auditoria (`/20`), Nielsen (`/40`), carga cognitiva e personas (`audit.md`, `operate.md`, `critique-rubric.md`) |
| `web-design-guidelines` | Instalada | `~/.gemini/config/skills/web-design-guidelines/references/command.md` | Revisão linha a linha de acessibilidade, foco, formulários, tipografia, URL state, i18n e anti-padrões |
| `vercel-react-best-practices` | Instalada | `~/.gemini/config/skills/vercel-react-best-practices/SKILL.md` | Auditoria de bundle (`bundle-dynamic-imports`), re-renders (`rerender-memo`), iterações JS (`js-combine-iterations`) e lazy-loading |
| `ui-review` (complementar) | Instalada | `~/.gemini/antigravity-cli/skills/ui-review/SKILL.md` | Conformidade de tokens, espaçamento, coerência por eixo (*one choice per axis*) |
| `ui-a11y` (complementar) | Instalada | `~/.gemini/antigravity-cli/skills/ui-a11y/SKILL.md` | Revisão WCAG 2.2 AA (Perceivable, Operable, Understandable, Robust) |
| `ui-states` (complementar) | Instalada | `~/.gemini/antigravity-cli/skills/ui-states/SKILL.md` | Auditoria dos estados esquecidos (primeiro uso, vazio, carregando, erro, offline, conteúdo longo, sucesso) |

### 0.2 Conhecimento recuperado do Segundo Cérebro (Obsidian + Graphify)

- **Graphify global (`/home/enthony/GitHub/Obsidian/graphify-out/graph.json`):** `321` nós e `368` arestas consultados; Graphify local (`distributed_systems/graphify-out/graph.json`) não inicializado neste repositório.
- **Hub técnico de Frontend (`/home/enthony/GitHub/Obsidian/05-tech/frontend/`):** todas as 7 notas especializadas foram consultadas:
  - `skills-frontend.md` — matriz oficial de skills (`impeccable` + `web-design-guidelines` para auditar/polir; `vercel-react-best-practices` para React; `ui-ux-pro-max` para paleta/tipografia).
  - `referencias-design.md` e `bibliotecas-componentes.md` — catálogo aprovado (`Dribbble`, `Awwwards`, `Mobbin`, `Refero`, `shadcn/ui`, `21st.dev`, `Aceternity UI`, `Magic UI`) com regra explícita de não instalar dependências sem justificativa e conferir peso de animação, `prefers-reduced-motion` e acessibilidade.
  - `principios-ui-ux-acessibilidade.md` — uma ação primária por tela, contraste mínimo 4,5:1 / 3:1, todos os estados projetados, alvos de toque ≥ 24×24 px (ideal 44 px), confirmação apenas em ações destrutivas.
  - `fluxo-redesign.md` — fluxo incremental (inventariar → diagnosticar → direção → tokens → componentes → telas → validar em navegador real).
  - `react-typescript-responsividade.md` — derivar estado em vez de duplicar, lazy-load de componentes pesados, testar em `360`, `768`, `1280` px e zoom `200%`.

---

## 1. Diagnóstico Geral

### 1.1 Arquitetura e Stack Verificadas (`apps/web/`)

| Camada | Implementação atual | Observação técnica |
|---|---|---|
| Framework UI | React `19.3.1` + React DOM `19.3.1` + TypeScript `5.9.3` | Strict mode ativo; 18/18 testes Vitest PASS; 0 vulnerabilidades `npm audit` |
| Roteamento | React Router `7.18.6` (`BrowserRouter`) | 6 rotas importadas estaticamente em `App.tsx` (sem `React.lazy`) |
| Editor Rico | `@tiptap/react` + `starter-kit` + `task-list` + `task-item` + `placeholder` (`3.35.0`) | Carregado no bundle inicial mesmo para usuários que apenas abrem `/login` ou `/` |
| Autenticação | `oidc-client-ts` `3.5.0` (Amazon Cognito PKCE) | `AuthContext.tsx` e `oidcConfig.ts` sólidos e validados em produção |
| Estilos | CSS puro centralizado (`apps/web/src/styles.css`, `2741` linhas) | `41,13 kB` (`7,75 kB` gzip); zero fontes externas (100% compatível com CSP do Amplify) |
| Bundle JS | Chunk único `dist/assets/index-*.js` = **`810,09 kB`** (`249,06 kB` gzip) | **Alerta do Vite (> 500 kB):** impacto direto em redes móveis lentas |
| Ícones | SVG inline autoral (`Icons.tsx`, 27 ícones + `AcadFlowMark`) + emojis nativos como ícones de página | Zero dependências extras; 5 hex hardcoded em `AcadFlowMark` |
| Código legado | `apps/web/src/pages/DashboardPage.tsx` (`204` linhas) | Não referenciado por `App.tsx` nem por testes (código morto mantido no repositório) |

### 1.2 Audit Health Score (`impeccable/audit.md`)

| # | Dimensão | Nota (0–4) | Principal achado verificado |
|---|---|---|---|
| 1 | **Acessibilidade (A11y)** | **2/4** | Falhas matemáticas de contraste WCAG AA (`--af-ink-subtle` `4.00–4.49:1`) e SC 1.4.11 (`1.58:1` em bordas de input, `2.74:1` no ícone warning); sem *skip link*, sem `Escape`/focus-trap no drawer, uso de `window.confirm`/`window.prompt`, global `0.01ms` em `prefers-reduced-motion` |
| 2 | **Performance** | **2/4** | Bundle JS monolítico de `810 kB` (Tiptap + ProseMirror no chunk inicial); objetos de contexto sem `useMemo` em `WorkspaceContext` e `AuthContext`; 8 `.filter()` sequenciais no Dashboard |
| 3 | **Theming & Design System** | **2/4** | Boa base de tokens `--af-*`, mas 33 hex hardcoded fora de `:root` + 5 em `Icons.tsx`, 6 `style={{}}` inline, ausência de suporte a tema escuro e inconsistência de *template chrome* |
| 4 | **Design Responsivo** | **2/4** | **Overflow real em `1920px`** nos cartões de `PagesIndexPage` (botão `Excluir` vaza para o cartão vizinho); quebra de pill em `360px`; botão `Atualizar` de 720px em `768px`; CTA primário duplicado no mobile; `<input>` truncando títulos longos no Editor mobile |
| 5 | **Integridade de Implementação** | **3/4** | Fluxos críticos (Cognito, CRUD, 409, auto-save) bem protegidos, mas há inconsistência no estado de carregamento do Dashboard (`… (2/6)`), confusão de estado *First-Use* vs *Concluído* e *AI tells* recorrentes |
| **Total** | | **11/20** | **Acceptable — Necessita correções estruturais antes de publicação em produção** |

### 1.3 Avaliação Heurística de Nielsen (`impeccable/critique-rubric.md`)

| # | Heurística | Nota (0–4) | Achado principal |
|---|---|---|---|
| 1 | Visibilidade do status do sistema | **2** | Bom `save-pill` no Editor, mas ausência de confirmação/toast ao criar, editar ou excluir tarefas/páginas; estado de carregamento inconsistente no Dashboard (`… (2/6)`) |
| 2 | Correspondência sistema / mundo real | **3** | Linguagem acadêmica clara; apenas vazamento leve de jargão técnico na tela de login (`PKCE`, `HTTP 409`, `OAuth 2.0`) e `v4` sem legenda explícita |
| 3 | Controle e liberdade do usuário | **2** | Sem `Escape` no drawer mobile, sem *Desfazer* após exclusões, uso de `window.confirm`/`window.prompt` bloqueantes |
| 4 | Consistência e padrões | **2** | Em `TasksPage`, status aparece duplicado (badge + `<select>`); em `DashboardPage` vazio há 3 botões primários simultâneos; no mobile há 2 botões `+ Página` simultâneos |
| 5 | Prevenção de erros | **3** | Ótimo `beforeunload`, validação client-side e bloqueio em `409`; falta foco automático no primeiro campo inválido e associação `aria-describedby` |
| 6 | Reconhecimento em vez de memorização | **3** | Sidebar e breadcrumb dão contexto claro; falta legenda/tooltip nos filtros e busca textual em Tarefas e Páginas |
| 7 | Flexibilidade e eficiência | **1** | Sem atalhos de teclado (`Ctrl+S` no editor, `/` para busca, `N` para nova tarefa), sem sincronização de filtros na URL (`?status=`), sem busca/ordenação |
| 8 | Design estético e minimalista | **3** | Evolução visual expressiva na branch `feat/shopeers-redesign`, porém ainda carrega *template chrome* repetitivo (eyebrows ALL-CAPS, setas `→`, middle dots `·`) |
| 9 | Recuperação de erros | **3** | Boas mensagens com botão *Tentar novamente* e recuperação de `409`; falta estado *Offline* (`navigator.onLine`) e erros inline próximos ao campo |
| 10 | Ajuda e documentação | **2** | Sem dicas contextuais discretas (ex.: atalhos Markdown do Tiptap ou explicação de auto-save) |
| **Total** | | **24/40** | **Acceptable (60%) — Base visual promissora com lacunas relevantes de ergonomia, a11y e performance** |

### 1.4 Carga Cognitiva e Red Flags por Persona

- **Carga Cognitiva (`critique-rubric.md`):** **3/8 falhas** (carga moderada) — competição entre múltiplos CTAs primários no mobile e no estado vazio, status duplicado nos cartões de tarefa (badge + dropdown) e formulário completo empurrando todas as tarefas abaixo da dobra em tablet/mobile (`768px` e `360px`).
- **Alex (Power User):** Não encontra `Ctrl+S` no editor, não pode buscar tarefas/páginas nem compartilhar URL filtrada (`?status=in_progress`), e é interrompido por `window.prompt()`/`window.confirm()` nativos do navegador.
- **Jordan (Primeiro Acesso):** Ao abrir o Dashboard vazio (`audit-dashboard-empty-1440.png`), lê *"Todas as atividades em dia"* mesmo sem ter criado nenhuma tarefa, e vê 3 botões azuis primários competindo pela primeira ação.
- **Sam (Teclado / Leitor de Tela / Baixa Visão):** Não há *skip link* para pular a sidebar a cada troca de página; abrir o drawer mobile não move o foco nem fecha com `Escape`; textos com `--af-ink-subtle` (`4.00–4.49:1`) e bordas de inputs (`1.58:1`) ficam abaixo dos limiares WCAG 2.2 AA.
- **Riley (Stress Tester):** Em `1920px`, os cartões de `PagesIndexPage` vazam o botão `Excluir` sobre o cartão vizinho; ao recarregar dados no Dashboard com lista já populada, o painel mistura `…` com `(2/6)` stale; sem tratamento visual de perda de conexão (*Offline*).
- **Casey (Mobile com uma mão):** Precisa baixar um bundle JS de `810 kB` no primeiro acesso; alvos de toque de `31–34 px` (`.icon-btn`, `.btn-logout-icon`, `.toolbar-btn`, `.icon-choice`) abaixo do ideal de `44×44 px`; no editor em `360px`, o título longo é cortado horizontalmente dentro de um `<input>` de linha única.

### 1.5 Pontos Fortes a Preservar

1. **Contratos e resiliência de dados intactos:** auto-save com `editSeqRef` + `expectedVersion`, bloqueio reativo de edição no `409 Conflict` e `beforeunload`.
2. **Segurança e CSP exemplares:** zero fontes externas/CDNs, zero armazenamento local de senhas, 0 vulnerabilidades em `npm audit`.
3. **Coerência de identidade na branch `feat/shopeers-redesign`:** boa evolução hierárquica em relação à `main`, ícones SVG próprios sem dependências pesadas e zero dados fictícios no Dashboard.

---

## 2. Auditoria por Página e Superfície

### 2.1 Shell e Navegação (`WorkspaceLayout.tsx`)
- **O que funciona:** Sidebar clara elevada sobre canvas `#F0F2F5`, contadores ao vivo em Tarefas/Páginas, recolhimento no desktop e drawer funcional no mobile.
- **Problemas encontrados:**
  1. Ausência de *skip link* (`<a href="#main-content">`) antes da `<aside>`.
  2. Drawer mobile sem tecla `Escape`, sem *focus trap*, sem restauração de foco ao fechar e sem `overscroll-behavior: contain`.
  3. Botões de alternância (recolher sidebar e abrir menu mobile) sem `aria-expanded` e `aria-controls`.
  4. Botão `+ Página` na `mobile-topbar` duplica o CTA primário `+ Nova página` logo abaixo nas telas de Dashboard e Páginas.
  5. `.icon-btn` e `.btn-logout-icon` têm `32×32 px` (abaixo de `44×44 px` no mobile).
  6. `.workspace-content` fixo em `max-width: 1240px` centralizado gera duas faixas mortas de `~202 px` em monitores `1920px` (evidência: `audit-dashboard-1920.png`).

### 2.2 Dashboard Acadêmico (`WorkspaceDashboardPage.tsx`)
- **O que funciona:** Layout bento estruturado, 4 KPIs legíveis com `tabular-nums`, barra segmentada 100% derivada de `tasks`.
- **Problemas encontrados:**
  1. **Estado de carregamento inconsistente (`audit-dashboard-loading-1440.png`):** com `loadingTasks=true`, KPIs mostram `…`, mas a barra de progresso continua exibindo `(2/6)` e o cartão escuro exibe `2 / 1 / 1` em vez de skeletons coerentes.
  2. **Estado vazio / primeiro uso ambíguo (`audit-dashboard-empty-1440.png`):** 3 botões primários azuis simultâneos; cartão *Próximo foco* afirma *"Todas as atividades em dia"* mesmo com `totalTasks === 0`; card *Tarefas pendentes* usa pill (`Sem urgências pendentes`) enquanto os demais usam texto simples.
  3. **Quebra de pill em `360px` (`audit-dashboard-360.png`):** `"33% das atividades"` quebra em duas linhas dentro de `.stat-pill` (`border-radius: 999px`).
  4. **Performance:** 8 varreduras `.filter()` separadas em `tasks` a cada render (`WorkspaceDashboardPage.tsx:33-59`).
  5. **Template chrome:** eyebrow ALL-CAPS (`VISÃO GERAL DO WORKSPACE`), setas `→` em links e `style={{ marginBottom: 0 }}` inline.

### 2.3 Tarefas Acadêmicas (`TasksPage.tsx`, `TaskForm.tsx`, `TaskList.tsx`)
- **O que funciona:** Bancada em 2 colunas no desktop `1440px`/`1920px`, validação sem limpar formulário em caso de erro, destaque visual ao editar.
- **Problemas encontrados:**
  1. **Tablet `768px` (`audit-tasks-768.png`):** `.header-actions .btn { flex: 1 }` estica o botão único `Atualizar` para `~720 px` de largura; além disso, o formulário completo ocupa toda a primeira dobra antes de qualquer tarefa aparecer.
  2. **Redundância visual em `TaskList.tsx` (`audit-tasks-1920.png`):** cada cartão exibe badge de status no topo **e** `<select>` de status logo abaixo; tarefas concluídas ainda mantêm badge vermelho gritante `Prioridade Alta`.
  3. **Diálogo nativo bloqueante (`TasksPage.tsx:76`):** `window.confirm(...)` quebra a linguagem visual e a acessibilidade; sem feedback visual (toast/live region) após criar, editar ou excluir.
  4. **Formulário (`TaskForm.tsx`):** inputs sem `name` e `autoComplete="off"`, erro de validação exibido apenas ao final do formulário sem `aria-invalid`/`aria-describedby` no campo `#task-title` e sem foco automático no erro.
  5. **Estado de filtro fora da URL (`TasksPage.tsx:26`):** `statusFilter` vive apenas em `useState`, perdendo-se ao recarregar ou compartilhar link; ausência de campo de busca ou ordenação por prazo.

### 2.4 Páginas e Anotações (`PagesIndexPage.tsx`)
- **O que funciona:** Grade limpa em `1440px` e `360px`, tratamento de conflito `409` ao renomear.
- **Problemas encontrados:**
  1. **BUG CRÍTICO DE OVERFLOW EM `1920px` (`audit-pages-1920.png`):** `.pages-grid` (`minmax(280px, 1fr)`) forma 4 colunas de `~282 px`; o rodapé `Abrir → + Renomear + Excluir` excede a largura interna do cartão e **o botão `Excluir` vaza fisicamente por cima do cartão vizinho**.
  2. **Interação obsoleta (`PagesIndexPage.tsx:55,94`):** renomear usa `window.prompt()` e excluir usa `window.confirm()`, oferecendo experiência áspera em desktop e inconsistente em mobile.
  3. **Ausência de busca/ordenação** quando o estudante acumula dezenas de páginas ao longo do semestre.
  4. **CTA duplicado em `360px` (`audit-pages-360.png`):** `+ Página` na topbar + `+ Nova página` imediatamente abaixo.

### 2.5 Editor Tiptap (`PageEditorPage.tsx`, `RichTextEditor.tsx`)
- **O que funciona:** Papel editorial limpo, checklists Tiptap funcionais com tachado, proteção sólida contra `409` e `beforeunload`.
- **Problemas encontrados:**
  1. **Título truncado no mobile (`audit-editor-360.png`):** `#page-title-input` é `<input type="text">` de linha única; títulos acadêmicos médios ficam cortados (`Sistemas Distribuídos — Ar`), impedindo leitura completa sem rolar horizontalmente dentro do campo.
  2. **Breadcrumb excessivamente truncado em `1920px` (`audit-editor-1920.png`):** `.truncate { max-width: 280px }` corta o título mesmo havendo `> 300 px` livres na topbar.
  3. **Alvos de toque pequenos no mobile (`styles.css:2043,2715`):** `.toolbar-btn` (`min-height: 32px`) e `.icon-choice` (`31×31 px` em `<= 420px`) ficam abaixo da recomendação ergonômica de `44×44 px`.
  4. **Ausência de atalho `Ctrl+S` / `Cmd+S`** para salvamento imediato e uso de `window.confirm()` na exclusão.
  5. **Impacto no bundle:** `@tiptap/*` + `prosemirror-*` carregados de forma síncrona na abertura de qualquer rota.

### 2.6 Login, Callback e Rota Protegida (`LoginPage.tsx`, `CallbackPage.tsx`, `ProtectedRoute.tsx`)
- **O que funciona:** Composição split moderna no desktop, preservação total do fluxo Cognito PKCE, alertas claros de sessão expirada.
- **Problemas encontrados:**
  1. **Hierarquia mobile `360px` (`audit-login-360.png`):** o banner escuro superior ocupa ~42% da altura antes do CTA, e o texto do botão quebra em `Entrar com Amazon Cognito\n(PKCE)` com a seta desalinhada visualmente.
  2. **Jargão técnico voltado ao usuário final:** termos como `OAuth 2.0`, `PKCE`, `HTTP 409` e `API Gateway` aparecem na vitrine principal de login; úteis para a banca de Sistemas Distribuídos, mas pesados como copy principal de produto (melhor posicioná-los como selo discreto de arquitetura).
  3. **Spinners sob `prefers-reduced-motion`:** a regra global `animation-duration: 0.01ms !important` paralisa visualmente o `.spinner` em `LoginPage`/`CallbackPage`/`ProtectedRoute` sem oferecer estado alternativo estático legível.

---

## 3. Evidências Reais

### 3.1 Capturas Multi-Viewport Produzidas em Firefox Headless

Todas as 17 capturas abaixo foram geradas a partir do código real da branch `feat/shopeers-redesign` em Firefox headless (com dados locais representativos em `scratch/`, sem bypass do Cognito e sem tráfego AWS):

| Viewport | Telas / Estados capturados | Localização das capturas |
|---|---|---|
| **Desktop `1920 × 1080`** | Dashboard, Tarefas, Páginas *(evidencia overflow)*, Editor, Login | [audit-dashboard-1920.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-dashboard-1920.png), [audit-tasks-1920.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-tasks-1920.png), [audit-pages-1920.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-pages-1920.png), [audit-editor-1920.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-editor-1920.png), [audit-login-1920.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-login-1920.png) |
| **Desktop `1440 × 900`** | Dashboard (normal, vazio, carregando), Tarefas (vazio) | [audit-dashboard-1440.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-dashboard-1440.png), [audit-dashboard-empty-1440.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-dashboard-empty-1440.png), [audit-dashboard-loading-1440.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-dashboard-loading-1440.png), [audit-tasks-empty-1440.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-tasks-empty-1440.png) |
| **Tablet `768 × 1024`** | Dashboard, Tarefas *(evidencia botão Atualizar 720px)* | [audit-dashboard-768.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-dashboard-768.png), [audit-tasks-768.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-tasks-768.png) |
| **Mobile `390 × 844`** | Dashboard | [audit-dashboard-390.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-dashboard-390.png) |
| **Mobile `360 × 800`** | Dashboard *(quebra de pill)*, Tarefas, Páginas, Editor *(título cortado)*, Login | [audit-dashboard-360.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-dashboard-360.png), [audit-tasks-360.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-tasks-360.png), [audit-pages-360.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-pages-360.png), [audit-editor-360.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-editor-360.png), [audit-login-360.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-login-360.png) |

**Limitações registradas com transparência:**
- `impeccable detect` em modo estático (regex) varreu `36` arquivos (`exit 0`, sem primários de regex), mas o modo URL/Puppeteer falhou porque não há Chrome/Chromium/Edge instalado neste Fedora (`No Chrome, Chromium, Edge, or Brave installation found`).
- Interações autenticadas em tempo real (login Cognito PKCE, salvamento 409 com duas abas e gestos de toque em dispositivo físico) não foram executadas nesta etapa de auditoria estática/headless.

### 3.2 Auditoria Matemática de Contraste (WCAG 2.2)

| Par de cores (`styles.css`) | Razão medida | Texto normal (≥ 4,5:1) | UI / Texto grande (≥ 3,0:1) |
|---|---:|---|---|
| `--af-ink` (`#0b0d17`) / `--af-surface` (`#ffffff`) | `19.37:1` | PASS | PASS |
| `--af-ink-muted` (`#566075`) / `--af-surface` (`#ffffff`) | `6.31:1` | PASS | PASS |
| `--af-primary` (`#0a24e9`) / `--af-primary-soft` (`#eef1ff`) | `7.64:1` | PASS | PASS |
| `--af-success` (`#356e3e`) / `--af-success-soft` (`#edf6ee`) | `5.51:1` | PASS | PASS |
| `--af-warning` (`#8f4f05`) / `--af-warning-soft` (`#fff6e6`) | `5.95:1` | PASS | PASS |
| `--af-danger` (`#b42318`) / `--af-danger-soft` (`#fef2f2`) | `6.01:1` | PASS | PASS |
| **`--af-ink-subtle` (`#6e778c`) / `--af-surface` (`#ffffff`)** | **`4.49:1`** | **FAIL** | PASS |
| **`--af-ink-subtle` (`#6e778c`) / `--af-surface-subtle` (`#f7f8fb`)** | **`4.23:1`** | **FAIL** | PASS |
| **`--af-ink-subtle` (`#6e778c`) / `--af-canvas` (`#f0f2f5`)** | **`4.00:1`** | **FAIL** | PASS |
| **`--af-warning-accent` (`#d98218`) / `--af-warning-soft` (`#fff6e6`)** | **`2.74:1`** | FAIL | **FAIL (SC 1.4.11)** |
| **`--af-border-strong` (`#caced6`) / `--af-surface` (`#ffffff`) (inputs)** | **`1.58:1`** | — | **FAIL (SC 1.4.11)** |

### 3.3 Resumo Técnico no Formato `web-design-guidelines` (`file:line`)

```text
## apps/web/index.html
apps/web/index.html:4 - faltam <meta name="theme-color">, <meta name="description"> e <link rel="icon">

## apps/web/src/App.tsx
apps/web/src/App.tsx:6-11 - páginas e editor Tiptap importados estaticamente (chunk único 810 kB; usar React.lazy + Suspense)

## apps/web/src/components/WorkspaceLayout.tsx
apps/web/src/components/WorkspaceLayout.tsx:46 - falta skip link ("Pular para o conteúdo principal") para #main-content
apps/web/src/components/WorkspaceLayout.tsx:86 - botão de recolher sidebar sem aria-expanded / aria-controls
apps/web/src/components/WorkspaceLayout.tsx:266 - botão de abrir menu mobile sem aria-expanded / aria-controls; drawer sem handler Escape e sem gestão de foco
apps/web/src/components/WorkspaceLayout.tsx:201,212 - "..." → "…"

## apps/web/src/components/TaskForm.tsx
apps/web/src/components/TaskForm.tsx:107-172 - inputs sem atributo name e autoComplete="off"
apps/web/src/components/TaskForm.tsx:177 - erro de validação não associado ao campo via aria-describedby / aria-invalid nem foca o campo inválido
apps/web/src/components/TaskForm.tsx:190 - "Salvando..." → "Salvando…"

## apps/web/src/pages/TasksPage.tsx
apps/web/src/pages/TasksPage.tsx:26 - statusFilter só em useState (sincronizar com URLSearchParams)
apps/web/src/pages/TasksPage.tsx:76 - window.confirm bloqueante; sem feedback de sucesso (aria-live) após mutação

## apps/web/src/pages/PagesIndexPage.tsx
apps/web/src/pages/PagesIndexPage.tsx:55,94 - window.prompt e window.confirm bloqueantes (substituir por edição inline e <dialog>)

## apps/web/src/pages/PageEditorPage.tsx
apps/web/src/pages/PageEditorPage.tsx:224 - window.confirm bloqueante
apps/web/src/pages/PageEditorPage.tsx:380 - <input type="text"> corta títulos longos em 360px (usar textarea auto-resize)
apps/web/src/pages/PageEditorPage.tsx:248,272,386 - "..." → "…"

## apps/web/src/utils/formatters.ts
apps/web/src/utils/formatters.ts:3-16 - meses hardcoded em array (substituir por Intl.DateTimeFormat("pt-BR"))

## apps/web/src/styles.css
apps/web/src/styles.css:35,44,25 - falhas de contraste WCAG AA (--af-ink-subtle 4.00–4.49:1, --af-warning-accent 2.74:1, --af-border-strong em inputs 1.58:1)
apps/web/src/styles.css:1752 - .pages-grid minmax(280px, 1fr) causa overflow do botão Excluir em 1920px
apps/web/src/styles.css:241,557,753,2043,2715 - alvos de toque < 44x44px em controles interativos
apps/web/src/styles.css:2525 - falta overscroll-behavior: contain no drawer mobile e env(safe-area-inset-*)
apps/web/src/styles.css:2733 - global animation-duration: 0.01ms !important paralisa spinner de carregamento sem fallback
apps/web/src/styles.css:725 - falta touch-action: manipulation em botões/controles interativos
```

---

## 4. Catálogo Classificado de Melhorias (Categorias A, B, C e D)

### Categoria A — Críticas (Usabilidade, Acessibilidade, Responsividade e Integridade)

#### `CRIT-01` — Overflow horizontal dos cartões de Página em `1920px` (sobreposição de botões)
1. **Localização exata:** `apps/web/src/styles.css:1750-1830` e `apps/web/src/pages/PagesIndexPage.tsx:194-217`.
2. **Descrição do problema:** A grade `.pages-grid` (`repeat(auto-fill, minmax(280px, 1fr))`) acomoda 4 colunas em `1920px`, deixando apenas `~242 px` internos por cartão — insuficiente para `Abrir →`, `Renomear` e `Excluir` na mesma linha sem `flex-wrap`.
3. **Evidência visual/técnica:** Captura [audit-pages-1920.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-pages-1920.png) comprova o botão `Excluir` vazando para fora da borda direita dos 4 cartões.
4. **Impacto sobre o usuário:** Interface quebrada em monitores Full HD (resolução mais comum em notebooks/monitores de apresentação), com risco de clique acidental em `Excluir` do cartão vizinho.
5. **Solução recomendada:** Aumentar o mínimo da coluna para `minmax(320px, 1fr)` (ou usar `flex-wrap: wrap` + botões compactos de ícone com tooltip/rótulo ou menu de ações no canto superior do cartão), mantendo o cartão inteiro clicável via link sem duplicar `Abrir →`.
6. **Skill/Referência:** `design-taste-frontend` (regra *equal edges* / `[spill]`), `impeccable/audit.md` (Responsive).
7. **Prioridade / Complexidade:** **P0 (Bloqueante)** · Complexidade **Baixa**.

#### `CRIT-02` — Falhas matemáticas de contraste WCAG 2.2 AA e SC 1.4.11
1. **Localização exata:** `apps/web/src/styles.css:25,35,44` (`--af-border-strong`, `--af-ink-subtle`, `--af-warning-accent`).
2. **Descrição do problema:** `--af-ink-subtle` (`#6e778c`) atinge apenas `4.49:1` no branco, `4.23:1` em `#f7f8fb` e `4.00:1` no canvas; `--af-warning-accent` (`#d98218`) em `#fff6e6` atinge `2.74:1`; bordas de inputs (`#caced6`) sobre branco atingem `1.58:1` (abaixo de `3.0:1` para componentes de formulário).
3. **Evidência visual/técnica:** Cálculo WCAG 2.2 na Seção 3.2.
4. **Impacto sobre o usuário:** Dificuldade de leitura de rótulos de seção, placeholders, ícone de pendentes e fronteiras de campos para usuários com baixa visão ou telas em salas de aula iluminadas (como na apresentação de 27/11).
5. **Solução recomendada:** Ajustar `--af-ink-subtle` para `#596275` (`6.10:1` em branco), `--af-warning-accent` para `#b46509` (`3.86:1` em `#fff6e6`), e introduzir token dedicado `--af-input-border: #8c95a6` (`3.03:1` em branco) separado das divisórias decorativas (`--af-border: #dce0e8`).
6. **Skill/Referência:** `ui-a11y`, `ui-ux-pro-max` (§1 Accessibility), `impeccable/audit.md`, Obsidian `principios-ui-ux-acessibilidade.md`.
7. **Prioridade / Complexidade:** **P1 (Maior)** · Complexidade **Baixa**.

#### `CRIT-03` — Navegação por teclado incompleta: sem *skip link*, sem `Escape` e sem gestão de foco no drawer mobile
1. **Localização exata:** `apps/web/src/components/WorkspaceLayout.tsx:46-289` e `apps/web/src/styles.css:2514-2548`.
2. **Descrição do problema:** Falta *skip link* para `<main id="main-content">`; o drawer mobile não fecha com `Escape`, não move foco ao abrir, não devolve foco ao botão disparador ao fechar e os botões de toggle não expõem `aria-expanded` / `aria-controls`.
3. **Evidência visual/técnica:** Inspeção direta de `WorkspaceLayout.tsx:86,266` — nenhum listener `keydown` ou atributo `aria-expanded` existe.
4. **Impacto sobre o usuário:** Usuários de teclado/leitores de tela precisam tabular por todos os links e páginas da sidebar em cada rota e ficam desorientados ao abrir o menu mobile.
5. **Solução recomendada:** Inserir `<a className="skip-link" href="#main-content">Pular para o conteúdo principal</a>`, adicionar `id="main-content"` e `tabIndex={-1}` no `<main>`, gerenciar `Escape` + foco inicial/retorno no drawer e declarar `aria-expanded` + `aria-controls`.
6. **Skill/Referência:** `web-design-guidelines` (Accessibility/Focus), `ui-ux-pro-max` (`--domain ux`: dialog focus), `ui-a11y`.
7. **Prioridade / Complexidade:** **P1 (Maior)** · Complexidade **Média**.

#### `CRIT-04` — Diálogos nativos bloqueantes (`window.confirm` e `window.prompt`) em ações críticas
1. **Localização exata:** `TasksPage.tsx:76`, `PagesIndexPage.tsx:55,94`, `PageEditorPage.tsx:224`.
2. **Descrição do problema:** Exclusões de tarefas/páginas e renomeação de páginas interrompem o fluxo com popups nativos do navegador (`window.confirm` / `window.prompt`).
3. **Evidência visual/técnica:** Varredura estática (4 ocorrências ativas no fluxo principal).
4. **Impacto sobre o usuário:** Quebra completa da identidade visual, experiência ruim no mobile, impossibilidade de validar comprimento/erro em tempo real ao renomear e bloqueio da thread principal.
5. **Solução recomendada:** Criar um componente leve `<ConfirmDialog>` usando HTML nativo `<dialog>` (focus-trap, `Escape` e backdrop nativos, zero dependências!) para exclusões destrutivas, e edição inline no título do cartão para renomear páginas.
6. **Skill/Referência:** `impeccable/operate.md` (use `<dialog>` / inline first), `web-design-guidelines` (Navigation & State), `Mobbin`/`Refero`.
7. **Prioridade / Complexidade:** **P1 (Maior)** · Complexidade **Média**.

#### `CRIT-05` — Estado de carregamento inconsistente no Dashboard (`… (2/6)`) e conflito de *First-Use* vs *Concluído*
1. **Localização exata:** `apps/web/src/pages/WorkspaceDashboardPage.tsx:136-352`.
2. **Descrição do problema:** Quando `loadingTasks` é `true`, os KPIs exibem `…` mas o painel de progresso e o cartão *Próximo foco* continuam exibindo números reais/stale (`2/6`, `Alta: 2`); quando `tasks.length === 0`, o cartão escuro afirma *"Todas as atividades em dia"* mesmo no primeiro acesso.
3. **Evidência visual/técnica:** Capturas [audit-dashboard-loading-1440.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-dashboard-loading-1440.png) e [audit-dashboard-empty-1440.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-dashboard-empty-1440.png).
4. **Impacto sobre o usuário:** Dados contraditórios durante re-fetch geram desconfiança; usuários novos recebem feedback enganoso ("tudo em dia") em vez de orientação de primeiro passo.
5. **Solução recomendada:** Renderizar *skeletons* estruturais durante `loadingTasks`/`loadingPages` em todos os blocos dependentes (KPIs, barra, foco e listas), e distinguir explicitamente `totalTasks === 0` (*"Comece registrando sua primeira atividade"*) de `totalTasks > 0 && openTasks.length === 0` (*"Todas as atividades em dia"*).
6. **Skill/Referência:** `ui-states` (First use vs Empty vs Loading), `impeccable/operate.md` (skeletons over spinners).
7. **Prioridade / Complexidade:** **P1 (Maior)** · Complexidade **Baixa**.

#### `CRIT-06` — Alvos de toque abaixo de `44×44 px` no mobile e ausência de `touch-action` / `safe-area`
1. **Localização exata:** `apps/web/src/styles.css:241-242,557-558,753,1739,1968-1969,2043,2715-2716`.
2. **Descrição do problema:** Botões de ícone (`.icon-btn`, `.btn-logout-icon` = `32px`), `.btn-sm` (`34px`), `.toolbar-btn` (`32px`) e `.icon-choice` (`31px` em `<=420px`) ficam abaixo de `44×44 px` no mobile; faltam `touch-action: manipulation`, `overscroll-behavior: contain` no drawer e `env(safe-area-inset-*)`.
3. **Evidência visual/técnica:** Varredura CSS (Seção 3.3) e capturas `audit-editor-360.png` / `audit-dashboard-360.png`.
4. **Impacto sobre o usuário:** Erros de toque frequentes em telas pequenas, atraso de zoom por duplo toque e rolagem acidental do fundo atrás do drawer.
5. **Solução recomendada:** Em `@media (pointer: coarse)` / `@media (max-width: 768px)`, elevar alvos interativos para `min-height: 44px; min-width: 44px` com `gap >= 8px`; adicionar `touch-action: manipulation` em botões/links e `overscroll-behavior: contain` + `env(safe-area-inset-*)` na topbar e no drawer.
6. **Skill/Referência:** `ui-ux-pro-max` (§2 Touch & Interaction), `ui-a11y`, `web-design-guidelines` (Touch & Safe Areas).
7. **Prioridade / Complexidade:** **P1 (Maior)** · Complexidade **Baixa**.

#### `CRIT-07` — `prefers-reduced-motion` global `0.01ms` destrói feedback de carregamento
1. **Localização exata:** `apps/web/src/styles.css:2730-2741`.
2. **Descrição do problema:** A regra universal `*, *::before, *::after { animation-duration: 0.01ms !important; }` congela o `.spinner` sem oferecer alternativa visual de pulso/opacidade ou texto estático diferenciado.
3. **Evidência visual/técnica:** `styles.css:2734-2736`.
4. **Impacto sobre o usuário:** Pessoas com preferência de movimento reduzido veem um arco azul congelado que parece erro de renderização ou página travada.
5. **Solução recomendada:** Desabilitar transições de movimento/deslocamento seletivamente e, sob `prefers-reduced-motion: reduce`, substituir `.spinner` giratório por um indicador estático de reticências ou opacidade sutil (combinado com skeletons estáticos).
6. **Skill/Referência:** `impeccable/audit.md` (§1 Motion sensitivity), `web-design-guidelines`.
7. **Prioridade / Complexidade:** **P1 (Maior)** · Complexidade **Baixa**.

---

### Categoria B — Alto Impacto (Layout, Navegação, Organização e UX)

#### `HIGH-01` — Duplicidade de ação primária no mobile e no estado vazio do Dashboard
1. **Localização exata:** `WorkspaceLayout.tsx:274-281`, `WorkspaceDashboardPage.tsx:108-120,400-410,480-484`, `PagesIndexPage.tsx:127-135`.
2. **Descrição do problema:** No mobile (`360px`/`390px`), a topbar exibe um botão primário azul `+ Página` e logo abaixo o cabeçalho exibe outro botão primário azul `+ Nova página`. No Dashboard vazio, 3 botões azuis primários competem simultaneamente.
3. **Evidência visual/técnica:** [audit-dashboard-360.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-dashboard-360.png), [audit-pages-360.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-pages-360.png), [audit-dashboard-empty-1440.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-dashboard-empty-1440.png).
4. **Impacto sobre o usuário:** Dilui a hierarquia visual e aumenta a carga cognitiva ("qual botão devo clicar?").
5. **Solução recomendada:** Manter apenas 1 CTA primário (`btn-primary`) por viewport: na `mobile-topbar`, usar um botão compacto discreto (`btn-secondary` ou ícone `+`) e rebaixar botões de empty-state inline para `btn-secondary` quando o cabeçalho já destacar a ação principal.
6. **Skill/Referência:** Obsidian `principios-ui-ux-acessibilidade.md`, `design-taste-frontend` (`action-repeat`).
7. **Prioridade / Complexidade:** **P1 (Maior)** · Complexidade **Baixa**.

#### `HIGH-02` — Layout de `TasksPage` em tablet/mobile (`768px` e `360px`) empurra toda a lista abaixo da dobra e estica `Atualizar`
1. **Localização exata:** `apps/web/src/styles.css:2562-2568` e `apps/web/src/pages/TasksPage.tsx:114-160`.
2. **Descrição do problema:** Em `768px`, `.header-actions .btn { flex: 1 }` transforma o único botão `Atualizar` em uma barra de `720 px`; além disso, o formulário aberto ocupa toda a altura da tela antes de mostrar a lista de tarefas.
3. **Evidência visual/técnica:** [audit-tasks-768.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-tasks-768.png) e [audit-tasks-360.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-tasks-360.png).
4. **Impacto sobre o usuário:** Quem abre Tarefas no celular ou tablet para consultar prazos ou marcar algo como concluído precisa rolar uma tela inteira de formulário vazio.
5. **Solução recomendada:** Em `< 1180px`, exibir botão `+ Nova atividade` no cabeçalho (colapsável via *progressive disclosure*, abrindo automaticamente quando `editingTask !== null` ou `tasks.length === 0`) e restringir `flex: 1` apenas quando houver 2+ botões em `.header-actions` em `<= 520px`.
6. **Skill/Referência:** `impeccable/critique-rubric.md` (Progressive disclosure), `Mobbin` (mobile task apps).
7. **Prioridade / Complexidade:** **P1 (Maior)** · Complexidade **Média**.

#### `HIGH-03` — Título da página truncado em linha única no Editor mobile e no breadcrumb desktop
1. **Localização exata:** `apps/web/src/pages/PageEditorPage.tsx:287,378-390` e `apps/web/src/styles.css:1875-1882`.
2. **Descrição do problema:** `#page-title-input` usa `<input type="text">` (não quebra linha em `360px`); `.truncate` tem `max-width: 280px` fixo mesmo em telas `1920px`.
3. **Evidência visual/técnica:** [audit-editor-360.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-editor-360.png) e [audit-editor-1920.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-editor-1920.png).
4. **Impacto sobre o usuário:** Impossível ler títulos acadêmicos completos no celular; desperdício de espaço no breadcrumb em telas largas.
5. **Solução recomendada:** Converter `#page-title-input` em `<textarea rows={1}>` com ajuste automático de altura (impedindo `Enter` de inserir quebra de linha e movendo o foco ao editor) e trocar `.truncate { max-width: 280px }` por `min-width: 0; flex: 1` na `.editor-breadcrumb`.
6. **Skill/Referência:** `Notion` (editor UX), `web-design-guidelines` (Content Handling).
7. **Prioridade / Complexidade:** **P1 (Maior)** · Complexidade **Baixa**.

#### `HIGH-04` — Redundância visual e ruído nos cartões de tarefa (`TaskList.tsx`)
1. **Localização exata:** `apps/web/src/components/TaskList.tsx:41-101`.
2. **Descrição do problema:** Cada cartão mostra simultaneamente uma faixa lateral colorida, um badge de status no topo e um `<select>` de status no rodapé; tarefas concluídas mantêm o badge vermelho `Prioridade Alta` com o mesmo peso de urgências abertas.
3. **Evidência visual/técnica:** [audit-tasks-1920.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-tasks-1920.png).
4. **Impacto sobre o usuário:** Poluição visual em listas com muitas tarefas e dificuldade de distinguir visualmente urgências ativas de itens já finalizados.
5. **Solução recomendada:** Remover o badge estático redundante de status (mantendo a faixa lateral + `<select>` estilizado como pill interativa de status) e suavizar/dessaturar o badge de prioridade quando `task.status === "done"`.
6. **Skill/Referência:** `ui-review` (§8: *Status color = severity, not decoration*), `Linear` / `Refero`.
7. **Prioridade / Complexidade:** **P2 (Menor/Alto ganho visual)** · Complexidade **Baixa**.

#### `HIGH-05` — Ausência de feedback de sucesso (toasts), estado Offline e validação inline acessível em formulários
1. **Localização exata:** `TaskForm.tsx:96-184`, `TasksPage.tsx:28-100`, `PagesIndexPage.tsx:44-110`.
2. **Descrição do problema:** Criar, atualizar ou excluir uma atividade/página não dispara confirmação visual (`aria-live="polite"`); erros de validação no `TaskForm` ficam desconectados do campo inválido (`aria-describedby`, `aria-invalid`, foco); não há aviso quando o navegador perde conectividade (`offline`).
3. **Evidência visual/técnica:** Inspeção direta de `TaskForm.tsx` e `TasksPage.tsx`.
4. **Impacto sobre o usuário:** Incerteza após salvar alterações (especialmente em listas longas ou sob filtros ativos) e confusão caso a internet caia durante edição.
5. **Solução recomendada:** Adicionar um banner discreto de conectividade (`online`/`offline` events), uma região `aria-live="polite"` de toast não bloqueante (com duração curta e dispensável) e erros de formulário diretamente abaixo do campo com `aria-invalid` + `aria-describedby` + foco automático no erro.
6. **Skill/Referência:** `ui-states` (Success, Validation, Offline), `web-design-guidelines` (Forms), `impeccable/critique-rubric.md` (Heurística #1 e #9).
7. **Prioridade / Complexidade:** **P1 (Maior)** · Complexidade **Média**.

#### `HIGH-06` — Busca rápida, ordenação e persistência de filtros na URL
1. **Localização exata:** `TasksPage.tsx:26`, `PagesIndexPage.tsx:19`.
2. **Descrição do problema:** `statusFilter` em Tarefas não sincroniza com `useSearchParams()` (`?status=pending`); nem Tarefas nem Páginas oferecem busca client-side por título ou ordenação por prazo/atualização (operações 100% locais sobre dados já carregados, sem alterar a API).
3. **Evidência visual/técnica:** Inspeção de `TasksPage.tsx` e `PagesIndexPage.tsx`.
4. **Impacto sobre o usuário:** Com 15+ páginas ou tarefas no semestre, o usuário precisa varrer toda a lista manualmente; recarregar a página perde o filtro ativo.
5. **Solução recomendada:** Sincronizar `statusFilter` com `useSearchParams()`, adicionar filtro de busca local instantâneo (com `useDeferredValue`) em Tarefas e Páginas, e ordenação por prazo em Tarefas — tudo 100% client-side, preservando contratos REST.
6. **Skill/Referência:** `web-design-guidelines` (Navigation & State: URL reflects state), `vercel-react-best-practices` (`rerender-use-deferred-value`), `Refero`.
7. **Prioridade / Complexidade:** **P2 (Menor/Alto ganho UX)** · Complexidade **Baixa**.

#### `HIGH-07` — Aproveitamento espacial em monitores `1920px` e quebra de pill em `360px`
1. **Localização exata:** `apps/web/src/styles.css:107,1184-1193` (`--af-content-max: 1240px`, `.stat-pill`).
2. **Descrição do problema:** Em `1920px`, o conteúdo centralizado de `1240px` deixa `~202 px` vazios dos dois lados (desconectando-se visualmente da sidebar); em `360px`, `.stat-pill` quebra `"33% das atividades"` em 2 linhas dentro de um pill arredondado.
3. **Evidência visual/técnica:** [audit-dashboard-1920.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-dashboard-1920.png) e [audit-dashboard-360.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-dashboard-360.png).
4. **Impacto sobre o usuário:** Sensação de espaço desperdiçado em telas Full HD e deformação estética dos cartões KPI em celulares compactos.
5. **Solução recomendada:** Elevar `--af-content-max` para `1380px` (mantendo o papel do Editor focado em `900px` para preservar linha de leitura ≤ 75ch) e aplicar `white-space: nowrap` + texto conciso (`33% em curso` / `33% do total`) em `.stat-pill`.
6. **Skill/Referência:** `ui-ux-pro-max` (`badge chip label wraps`), `impeccable/operate.md`.
7. **Prioridade / Complexidade:** **P2 (Menor)** · Complexidade **Baixa**.

---

### Categoria C — Refinamento (Tipografia, Microinterações, Copy e Acabamento)

#### `REF-01` — Remoção de *template chrome* ("AI tells") e refinamento da voz do produto
1. **Localização exata:** `WorkspaceDashboardPage.tsx:99,115,375,453`, `TasksPage.tsx:107`, `PagesIndexPage.tsx:119`, `LoginPage.tsx:38,108,139`.
2. **Descrição do problema:** Todas as páginas repetem o mesmo padrão de *eyebrow* rastreado em CAIXA ALTA (`VISÃO GERAL DO WORKSPACE`, `GESTÃO DE ENTREGAS`, `BASE DE CONHECIMENTO`), setas `→` em links/botões e strings com *middle dots* (`·`). Na tela de login, termos técnicos (`PKCE`, `OAuth 2.0`, `HTTP 409`) competem com a proposta de valor acadêmica.
3. **Evidência visual/técnica:** Capturas desktop e critério explícito de `frontend-design/SKILL.md:43`.
4. **Impacto sobre o usuário:** Faz o produto parecer um template genérico gerado por IA em vez de um workspace acadêmico autoral e direto.
5. **Solução recomendada:** Remover os eyebrows ALL-CAPS redundantes (deixando o título `h1` respirar com hierarquia tipográfica limpa), usar `text-wrap: balance` em títulos, remover setas decorativas redundantes dos botões e mover a menção técnica (`Cognito PKCE · 3 camadas`) para um rodapé discreto no login.
6. **Skill/Referência:** `frontend-design`, `impeccable/operate.md`, `web-design-guidelines` (`text-wrap: balance`).
7. **Prioridade / Complexidade:** **P2 (Refinamento)** · Complexidade **Baixa**.

#### `REF-02` — Substituir reticências ASCII (`...`) por caractere tipográfico (`…`) e adicionar `Intl.DateTimeFormat`
1. **Localização exata:** 21 ocorrências em `ProtectedRoute.tsx`, `RichTextEditor.tsx`, `TaskForm.tsx`, `WorkspaceLayout.tsx`, `CallbackPage.tsx`, `LoginPage.tsx`, `PageEditorPage.tsx`, `PagesIndexPage.tsx`, `TasksPage.tsx`, `WorkspaceDashboardPage.tsx`; e `apps/web/src/utils/formatters.ts:3-35`.
2. **Descrição do problema:** Mensagens de carregamento e placeholders usam três pontos (`...`) em vez de `…`; `formatShortDate` usa array manual `MONTHS_SHORT_PT` em vez de `Intl.DateTimeFormat("pt-BR")`.
3. **Evidência visual/técnica:** Varredura estática (Seção 3.3).
4. **Impacto sobre o usuário:** Menor polimento tipográfico e formatação menos idiomática/manutenível.
5. **Solução recomendada:** Padronizar `…` nos estados de carregamento/placeholders e usar `new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })` (instância hoisted no módulo, mantendo os testes de `formatters.test.ts`).
6. **Skill/Referência:** `web-design-guidelines` (Typography & Locale/i18n).
7. **Prioridade / Complexidade:** **P3 (Polimento)** · Complexidade **Baixa**.

#### `REF-03` — Eliminar os 33 hex hardcoded fora de `:root` e os 6 `style={{}}` inline
1. **Localização exata:** `styles.css` (33 ocorrências, ex.: linhas `813,814,867,1155,1313-1383,1668,2164,2271`), `Icons.tsx:44-64`, `PageEditorPage.tsx:260`, `TasksPage.tsx:159`, `WorkspaceDashboardPage.tsx:235`.
2. **Descrição do problema:** Cores de gradiente, hover de botões, cards concluídos, blocos de código e do cartão escuro *Próximo foco* estão escritas como hex literais fora de `:root`, dificultando manutenção e impedindo um futuro modo escuro limpo.
3. **Evidência visual/técnica:** Varredura estática (Seção 3.3).
4. **Impacto sobre o usuário:** Risco de deriva visual entre telas e maior custo para introduzir dark mode.
5. **Solução recomendada:** Promover todas as cores semânticas (incluindo `--af-hero-from`, `--af-hero-to`, `--af-on-hero`, `--af-code-bg`, `--af-danger-hover`) para tokens em `:root` e trocar os `style={{}}` de layout por classes utilitárias semânticas (mantendo apenas `width` dinâmico da barra de progresso).
6. **Skill/Referência:** `impeccable/audit.md` (§3 Theming), `ui-review` (§1 Design Token Compliance).
7. **Prioridade / Complexidade:** **P2 (Refinamento)** · Complexidade **Baixa**.

#### `REF-04` — Metadados ausentes no `index.html` (favicon, `theme-color`, `description`)
1. **Localização exata:** `apps/web/index.html:1-12`.
2. **Descrição do problema:** A página não possui favicon SVG próprio (`AcadFlowMark`), `<meta name="theme-color" content="#f0f2f5">`, nem `<meta name="description">`.
3. **Evidência visual/técnica:** Leitura direta de `apps/web/index.html`.
4. **Impacto sobre o usuário:** Aba do navegador sem identidade visual (ícone genérico) e barra de endereço mobile sem integração de cor.
5. **Solução recomendada:** Adicionar `public/favicon.svg` (100% compatível com CSP `'self'`), `<meta name="theme-color" content="#f0f2f5">` e `<meta name="description">`.
6. **Skill/Referência:** `web-design-guidelines` (Dark Mode & Theming), `design-taste-frontend` (`page-meta`).
7. **Prioridade / Complexidade:** **P3 (Polimento)** · Complexidade **Baixa**.

#### `REF-05` — Atalho de teclado `Ctrl+S` / `Cmd+S` no Editor Tiptap e indicação discreta de Markdown
1. **Localização exata:** `apps/web/src/pages/PageEditorPage.tsx:180-210`.
2. **Descrição do problema:** Usuários habituados a editores pressionam `Ctrl+S` para salvar imediatamente — hoje o navegador abre o diálogo "Salvar página HTML".
3. **Evidência visual/técnica:** Ausência de listener `keydown` para `(ctrlKey || metaKey) && key === "s"`.
4. **Impacto sobre o usuário:** Fricção frequente em uso prolongado de edição de notas.
5. **Solução recomendada:** Interceptar `Ctrl+S`/`Cmd+S` apenas dentro de `PageEditorPage` (chamando `persistDraft()` quando não houver conflito `409`) e exibir `title="Salvar (Ctrl+S)"` no botão.
6. **Skill/Referência:** `impeccable/critique-rubric.md` (Heurística #7 / Persona Alex).
7. **Prioridade / Complexidade:** **P2 (Refinamento)** · Complexidade **Baixa**.

#### `REF-06` — Alinhamento do banner mobile de Login em `360px`
1. **Localização exata:** `apps/web/src/pages/LoginPage.tsx:31-145` e `apps/web/src/styles.css:2500-2728`.
2. **Descrição do problema:** Em `360px`, o showcase escuro superior consome quase metade da tela e o rótulo longo do botão quebra em 2 linhas com a seta deslocada.
3. **Evidência visual/técnica:** [audit-login-360.png](file:///home/enthony/.gemini/antigravity-cli/brain/0d068686-65bb-4892-a7a0-12e495619643/scratch/audit-shots/audit-login-360.png).
4. **Impacto sobre o usuário:** Menor equilíbrio visual na primeira impressão mobile.
5. **Solução recomendada:** Compactar o cabeçalho escuro abaixo de `640px` e ajustar o rótulo/espaçamento do CTA (`Entrar com Amazon Cognito`, mantendo menção `PKCE` na nota de segurança imediatamente abaixo) para caber em 1 linha limpa mesmo em `360px`.
6. **Skill/Referência:** `design-taste-frontend`, `impeccable/adapt.md`.
7. **Prioridade / Complexidade:** **P2 (Refinamento)** · Complexidade **Baixa**.

---

### Categoria D — Arquitetura (Performance, Manutenção e Componentização)

#### `ARCH-01` — Code-splitting por rota (`React.lazy` + `Suspense`) para reduzir o bundle inicial de `810 kB`
1. **Localização exata:** `apps/web/src/App.tsx:1-39` e `apps/web/vite.config.ts`.
2. **Descrição do problema:** Todas as páginas — especialmente `PageEditorPage` que importa `@tiptap/react`, `StarterKit`, `TaskList`, `TaskItem`, `Placeholder` e todo o ecossistema `prosemirror-*` — são empacotadas no único chunk `dist/assets/index-*.js` (`810,09 kB` / `249,06 kB` gzip).
3. **Evidência visual/técnica:** Aviso explícito do Vite no build (`(!) Some chunks are larger than 500 kB after minification`).
4. **Impacto sobre o usuário:** Tempo de carregamento inicial e parse de JS desnecessariamente altos na tela de Login, Dashboard e Tarefas (onde o Tiptap nem é utilizado).
5. **Solução recomendada:** Aplicar `React.lazy()` em `PageEditorPage` (e nas demais páginas de rota) envoltas em `<Suspense fallback={<PageSkeleton />}>`, além de `manualChunks` leve em `vite.config.ts` separando `tiptap` e `oidc-client-ts`. Ganho estimado: redução de ~45–55% do JS inicial em `/login` e `/`.
6. **Skill/Referência:** `vercel-react-best-practices` (`bundle-dynamic-imports` — CRITICAL), `ui-ux-pro-max` (`--stack react`: Lazy load components), Obsidian `react-typescript-responsividade.md`.
7. **Prioridade / Complexidade:** **P1 (Maior)** · Complexidade **Baixa**.

#### `ARCH-02` — Memoização dos objetos de contexto em `WorkspaceContext` e `AuthContext`
1. **Localização exata:** `apps/web/src/context/WorkspaceContext.tsx:144-165` e `apps/web/src/auth/AuthContext.tsx:145-160`.
2. **Descrição do problema:** O objeto `value` passado ao `.Provider` é recriado a cada render sem `useMemo`, forçando re-renderização de todos os consumidores sempre que o provider re-renderiza. Adicionalmente, misturar `tasks` e `pages` no mesmo contexto faz edições de uma página re-renderizarem consumidores exclusivos de tarefas.
3. **Evidência visual/técnica:** Leitura direta de `WorkspaceContext.tsx:144-165` e `AuthContext.tsx:145-160`.
4. **Impacto sobre o usuário:** Re-renders extras na sidebar e listas durante salvamentos automáticos frequentes no editor.
5. **Solução recomendada:** Envolver `value` em `useMemo` em ambos os providers (e, em fase posterior, avaliar separar `TasksContext` de `PagesContext` caso o volume de itens cresça).
6. **Skill/Referência:** `vercel-react-best-practices` (`rerender-memo`), Obsidian `react-typescript-responsividade.md`.
7. **Prioridade / Complexidade:** **P2 (Arquitetura)** · Complexidade **Baixa**.

#### `ARCH-03` — Combinar iterações redundantes em `WorkspaceDashboardPage` e `TasksPage`
1. **Localização exata:** `apps/web/src/pages/WorkspaceDashboardPage.tsx:33-64` e `apps/web/src/pages/TasksPage.tsx:100-103`.
2. **Descrição do problema:** `WorkspaceDashboardPage` executa 8 chamadas `.filter()` encadeadas + `.sort()` sobre `tasks` a cada renderização sem `useMemo`.
3. **Evidência visual/técnica:** Leitura direta de `WorkspaceDashboardPage.tsx:33-64`.
4. **Impacto sobre o usuário:** Desperdício de CPU em re-renders frequentes e menor clareza de lógica derivada.
5. **Solução recomendada:** Consolidar em um único `useMemo` de uma única passagem (`for` loop ou `reduce`) retornando todas as contagens (`pending`, `inProgress`, `done`, `highPending`, `openHigh/Medium/Low`, `nextDueTask`).
6. **Skill/Referência:** `vercel-react-best-practices` (`js-combine-iterations`, `js-min-max-loop`).
7. **Prioridade / Complexidade:** **P3 (Arquitetura)** · Complexidade **Baixa**.

#### `ARCH-04` — Modularização de `apps/web/src/styles.css` (`2741` linhas em arquivo monolítico)
1. **Localização exata:** `apps/web/src/styles.css:1-2741`.
2. **Descrição do problema:** Todos os tokens, primitivos, shell, 6 páginas e media queries vivem em um único arquivo CSS de `2741` linhas (com regras `!important` em `.document-title-input` e `.desktop-only`).
3. **Evidência visual/técnica:** `wc -l apps/web/src/styles.css` = `2741`.
4. **Impacto sobre o usuário:** Indireto — aumenta risco de colisões de especificidade e dificulta manutenção futura.
5. **Solução recomendada:** Dividir em módulos CSS importados por `main.tsx` (`styles/tokens.css`, `styles/base.css`, `styles/components.css`, `styles/layout.css`, `styles/pages.css`) e eliminar os `!important` desnecessários via ordem limpa de cascata.
6. **Skill/Referência:** `frontend-design` (CSS specificity hygiene), `impeccable/document.md`.
7. **Prioridade / Complexidade:** **P2 (Arquitetura)** · Complexidade **Média**.

#### `ARCH-05` — Remoção ou arquivamento do código morto `DashboardPage.tsx` e do CSS legado `.app-shell`
1. **Localização exata:** `apps/web/src/pages/DashboardPage.tsx` (`204` linhas) e `apps/web/src/styles.css:2447-2473`.
2. **Descrição do problema:** A tela antiga da fase P0 (`DashboardPage.tsx`) não é mais usada por nenhuma rota nem teste, mas permanece sendo verificada pelo `tsc` e mantendo regras CSS legadas.
3. **Evidência visual/técnica:** Varredura de referências na Seção 3 (`DashboardPage: referenced in []`).
4. **Impacto sobre o usuário:** Nenhum direto; reduz ruído de manutenção e confusão sobre qual dashboard é o ativo.
5. **Solução recomendada:** Confirmar com o usuário e remover `DashboardPage.tsx` + classes `.app-shell`/`.topbar`/`.user-bar` obsoletas.
6. **Skill/Referência:** `impeccable/distill.md`, boas práticas de manutenção.
7. **Prioridade / Complexidade:** **P3 (Arquitetura)** · Complexidade **Baixa**.

#### `ARCH-06` — Extração de primitivos reutilizáveis de UI (`ConfirmDialog`, `ToastRegion`, `Skeleton`, `EmptyState`, `Badge`)
1. **Localização exata:** Padrões repetidos em `WorkspaceDashboardPage.tsx`, `TasksPage.tsx`, `PagesIndexPage.tsx`, `PageEditorPage.tsx`.
2. **Descrição do problema:** Alertas de erro com botão de retry, estados vazios, loading spinners e badges são reescritos manualmente em cada página.
3. **Evidência visual/técnica:** Duplicação do bloco `.alert.alert-error.error-row` em 4 páginas distintas.
4. **Impacto sobre o usuário:** Pequenas divergências de espaçamento, textos de botões (*Recarregar* vs *Tentar novamente*) e inconsistência de feedback.
5. **Solução recomendada:** Extrair 4 componentes pequenos em `apps/web/src/components/ui/`: `AlertBanner.tsx`, `ConfirmDialog.tsx`, `EmptyState.tsx` e `Skeleton.tsx` (zero novas dependências npm).
6. **Skill/Referência:** `impeccable/extract.md`, `ui-review`, Obsidian `fluxo-redesign.md`.
7. **Prioridade / Complexidade:** **P2 (Arquitetura)** · Complexidade **Média**.

---

## 5. Propostas de Redesign e Comparativo de Alternativas

### 5.1 Direção Visual Recomendada (Evolução do Design System em Modo *Operate*)

A base visual criada em `feat/shopeers-redesign` já acertou o posicionamento geral (canvas `#F0F2F5`, superfícies brancas elevadas, azul cobalto `#0A24E9`, marinho `#29315D`, verde `#5C9764`), mas precisa evoluir de **"bonito no caminho feliz desktop"** para **"rigorosamente profissional em todas as resoluções, estados e critérios WCAG 2.2 AA"**:

- **Paleta corrigida para AA/SC 1.4.11:** manter o DNA cobalto/marinho/verde, escurecendo `--af-ink-subtle` (`#596275`), `--af-warning-accent` (`#b46509`) e criando `--af-input-border` (`#8c95a6`) para bordas de controles interativos; tokenizar 100% das cores escuras para destravar tema escuro opcional no futuro.
- **Voz limpa sem *AI tells*:** remover eyebrows ALL-CAPS repetitivos, manter 1 ação primária por tela, substituir `window.confirm`/`prompt` por `<dialog>` + edição inline, usar skeletons reais e toasts sutis de confirmação.
- **Ergonomia responsiva real:** corrigir overflow de `PagesIndexPage` em `1920px`, recolher o formulário de tarefas em `< 1180px`, transformar título do editor em `textarea` auto-expansível, elevar touch targets mobile para `44×44 px` e sincronizar filtros com a URL.

### 5.2 Comparativo das 3 Alternativas de Evolução

| Critério | **Alternativa 1 (Recomendada): Evolução Cirúrgica em CSS Modular + Primitivos Próprios** | **Alternativa 2: Migração para Tailwind CSS v4 + shadcn/ui (Radix UI)** | **Alternativa 3: Redesign Expressivo com Magic UI / Aceternity UI / Motion** |
|---|---|---|---|
| **Escopo técnico** | Refatorar `styles.css` em módulos, corrigir A11y/overflow/estados, criar `<dialog>` + skeletons + toasts, aplicar `React.lazy` | Instalar Tailwind v4 + `@radix-ui/*` + `lucide-react`; reescrever 12 telas com componentes shadcn | Adicionar Framer Motion + blocos animados de Aceternity/Magic UI |
| **Vantagens** | Zero novas dependências; `npm audit` = 0; 100% compatível com CSP; risco mínimo antes de 27/11/2026; entrega rápida e previsível | Ecossistema líder de mercado; acessibilidade Radix pronta para menus/modais/popovers complexos; fácil escalabilidade pós-disciplina | Forte impacto visual em vitrines/landing pages |
| **Desvantagens** | Primitivos como `<dialog>` e toast precisam ser mantidos manualmente (~150 linhas) | Migração completa de `2741` linhas de CSS + risco de regressão visual/CSP + novas dependências para auditar | **Inadequada para modo Operate:** aumenta bundle, prejudica performance/bateria, viola `impeccable/operate.md` e risco elevado de regressões de acessibilidade |
| **Adequação ao AcadFlow** | **Excelente (curto e médio prazo)** | **Boa (ideal para v2 pós-apresentação)** | **Não recomendada** (usar inspiração apenas pontual na tela de login, via CSS puro) |

---

## 6. Matriz de Priorização (Impacto × Esforço × Risco)

| ID | Melhoria | Prioridade | Impacto | Esforço | Risco de regressão |
|---|---|---|---|---|---|
| `CRIT-01` | Corrigir overflow de `PagesIndexPage` em `1920px` | **P0** | Altíssimo | Baixo | Muito baixo |
| `CRIT-02` | Corrigir contrastes WCAG 2.2 AA e SC 1.4.11 | **P1** | Alto | Baixo | Muito baixo |
| `CRIT-03` | *Skip link*, `Escape`, gestão de foco e `aria-expanded` | **P1** | Alto | Médio | Baixo |
| `CRIT-05` | Skeletons consistentes e estado *First-Use* vs *Concluído* | **P1** | Alto | Baixo | Muito baixo |
| `CRIT-06` | Alvos `44×44 px` mobile, `touch-action`, `overscroll-behavior`, `safe-area` | **P1** | Alto | Baixo | Muito baixo |
| `CRIT-07` | Fallback acessível de carregamento sob `prefers-reduced-motion` | **P1** | Médio-Alto | Baixo | Muito baixo |
| `ARCH-01` | `React.lazy` + `Suspense` + `manualChunks` (bundle `810 kB` → ~`380 kB` inicial) | **P1** | Alto | Baixo | Baixo |
| `CRIT-04` | Substituir `window.confirm`/`window.prompt` por `<dialog>` + edição inline | **P1** | Alto | Médio | Baixo-Médio |
| `HIGH-01` | Eliminar CTAs primários duplicados (mobile e empty state) | **P1** | Médio-Alto | Baixo | Muito baixo |
| `HIGH-02` | Formulário colapsável em `< 1180px` e fix do botão `Atualizar` em `768px` | **P1** | Alto | Médio | Baixo |
| `HIGH-03` | Título `<textarea>` auto-resize no Editor e breadcrumb fluido | **P1** | Médio-Alto | Baixo | Baixo |
| `HIGH-05` | Toasts (`aria-live`), aviso Offline e validação inline com `aria-describedby` | **P1** | Alto | Médio | Baixo |
| `HIGH-04` | Remover duplicação de status em `TaskList` e suavizar concluídas | **P2** | Médio | Baixo | Muito baixo |
| `HIGH-06` | Filtros na URL (`useSearchParams`) + busca client-side | **P2** | Médio-Alto | Baixo | Baixo |
| `HIGH-07` | `--af-content-max: 1380px` e fix da pill em `360px` | **P2** | Médio | Baixo | Muito baixo |
| `REF-01` / `REF-03` | Remover *AI tells*, tokenizar 33 hex e remover `style={{}}` inline | **P2** | Médio | Baixo-Médio | Muito baixo |
| `REF-05` / `REF-06` | Atalho `Ctrl+S` no Editor e compactação mobile do Login (`360px`) | **P2** | Médio | Baixo | Muito baixo |
| `ARCH-02` / `ARCH-04` / `ARCH-06` | `useMemo` contextos, modularizar CSS e extrair primitivos `components/ui/` | **P2** | Médio | Médio | Baixo |
| `REF-02` / `REF-04` / `ARCH-03` / `ARCH-05` | `…`, `Intl.DateTimeFormat`, favicon/meta, single-pass memo, limpar `DashboardPage.tsx` | **P3** | Baixo-Médio | Baixo | Muito baixo |

---

## 7. Plano de Implementação Incremental (Próxima Etapa — Após Aprovação)

### Onda 1 — Correções Bloqueantes, Responsividade e WCAG 2.2 AA (~1 sessão curta)
- Corrigir `CRIT-01` (overflow `1920px` em `PagesIndexPage`), `HIGH-07` (pill `360px` + `1380px` max-width) e `HIGH-01` (CTAs duplicados).
- Corrigir `CRIT-02` (tokens de contraste WCAG AA / SC 1.4.11), `CRIT-06` (`44×44 px` mobile + `touch-action` + `overscroll-behavior` + `safe-area`) e `CRIT-07` (`prefers-reduced-motion`).
- Implementar `CRIT-03` (*skip link*, `Escape`, foco no drawer, `aria-expanded`/`aria-controls`).
- **Gate:** recapturar Firefox em `1920`, `1440`, `768`, `390`, `360` px e confirmar 0 overflows e 100% PASS na tabela de contraste.

### Onda 2 — Performance React e Estados Completos de Produto
- Implementar `ARCH-01` (`React.lazy` + `Suspense` + `manualChunks` no Vite) e validar redução real do chunk inicial.
- Implementar `ARCH-02` (`useMemo` nos providers) e `ARCH-03` (single-pass stats no Dashboard).
- Implementar `CRIT-05` (skeletons coerentes + estado *First-Use* distinto) e `HIGH-05` (toast `aria-live`, banner offline, validação inline com `aria-describedby` e foco no erro).
- Implementar `CRIT-04` (`ConfirmDialog` nativo em `<dialog>` + renomeação inline de página).

### Onda 3 — Ergonomia de Fluxo e Polimento Visual
- Implementar `HIGH-02` (formulário de tarefas colapsável em tablet/mobile + fix do `Atualizar` em `768px`).
- Implementar `HIGH-03` (título `textarea` auto-resize no editor + breadcrumb fluido) e `REF-05` (`Ctrl+S`).
- Implementar `HIGH-04` (cartões de tarefa sem status duplicado) e `HIGH-06` (`useSearchParams` + busca local).
- Aplicar `REF-01`, `REF-02`, `REF-03`, `REF-04`, `REF-06` (remover *AI tells*, tokenizar hex restantes, `Intl.DateTimeFormat`, favicon/meta, login `360px`).

### Onda 4 — Modularização CSS, Limpeza e Regressão Final
- Executar `ARCH-04` (modularizar `styles.css`), `ARCH-05` (remover `DashboardPage.tsx` com autorização) e `ARCH-06` (primitivos `components/ui/`).
- Rodar `vitest` + `tsc --noEmit` + `vite build` + `npm audit` + `pytest` (backend) + nova bateria de capturas Firefox (`1920/1440/768/390/360`) + validação interativa do usuário com Cognito real e conflito `HTTP 409`.

---

## 8. Referências Profissionais Recomendadas (com Justificativa de Adequação)

| Fonte / Biblioteca | Adequação ao AcadFlow | Como aproveitar (e limites) |
|---|---|---|
| **[Refero](https://refero.design/)** | **Alta (Principal)** | Melhor biblioteca para padrões reais de **dashboards SaaS, filtros de listas, estados vazios e editores web**; consultar antes da Onda 2/3 para cartões de tarefas compactos e barras de filtro. |
| **[Mobbin](https://mobbin.com/)** | **Alta (Principal)** | Ideal para fluxos ponta a ponta (primeiro acesso vs lista concluída, formulários mobile colapsáveis, confirmação destrutiva com `<dialog>` e toasts). |
| **[shadcn/ui](https://ui.shadcn.com/)** | **Alta (Referência de UX/A11y ou v2)** | Referência-ouro em acessibilidade de `Dialog`, `Sidebar`, `Tabs`, `Skeleton` e `Toast` (Radix UI); no curto prazo, replicar os contratos ARIA/teclado em CSS puro para manter 0 novas dependências; excelente candidato para evolução pós-entrega. |
| **[Dribbble](https://dribbble.com/)** | **Média (Estética)** | Útil para ritmo espacial, uso contido de cor e contraste (como a direção Shopeers adotada), sempre filtrando peças que sacrificam contraste WCAG ou densidade real por estética de portfólio. |
| **[21st.dev](https://21st.dev/)** | **Baixa-Média (Pontual)** | Bom para pesquisar micro-interações específicas (ex.: abas segmentadas ou cartões KPI), mas cada snippet comunitário exige auditoria manual de a11y e adaptação fora de Tailwind. |
| **[Awwwards](https://www.awwwards.com/)** | **Baixa (Apenas inspiração de Login)** | Focado em sites *Persuade/Experience*; não copiar coreografias de scroll para um workspace *Operate*, aproveitando apenas princípios de composição e tipografia para a tela de entrada. |
| **[Magic UI](https://magicui.design/)** | **Baixa (Muito contida)** | Animações úteis apenas em efeitos sutis de vitrine; dispensável no núcleo de produtividade do AcadFlow por adicionar dependência de animação (`motion`) sem ganho funcional. |
| **[Aceternity UI](https://ui.aceternity.com/)** | **Não recomendada** | Efeitos 3D/canvas pesados degradam desempenho, bateria e acessibilidade em dashboards usados continuamente; contraria `impeccable/operate.md` e `Obsidian/05-tech/frontend/bibliotecas-componentes.md`. |

---

## 9. Registro de Execução — Alternativa 1 (Ondas 1 a 4 Concluídas)

Implementação concluída integralmente na branch `feat/shopeers-redesign` (sem alterações no backend, Cognito, contratos REST, infraestrutura AWS ou `docs/AVALIACAO.md`, e sem `commit`/`push`/`merge`):

- **Onda 1 (P0/P1 — Bugs visuais, WCAG 2.2 AA e A11y):**
  - `CRIT-01`: overflow em `1920px` de `PagesIndexPage` eliminado (`minmax(320px, 1fr)` + rodapé limpo sem `Abrir →` redundante).
  - `CRIT-02`: **12/12 pares WCAG 2.2 PASS** (`--af-ink-subtle` `6.12:1` no branco / `5.46:1` no canvas; `--af-warning-accent` `4.07:1`; `--af-input-border` `3.17:1`).
  - `CRIT-03`: *skip link* (`#main-content`), `Escape`, gestão/restauração de foco e `aria-expanded`/`aria-controls` implementados em `WorkspaceLayout.tsx`.
  - `CRIT-06` / `CRIT-07`: alvos `>= 44×44 px` no mobile, `touch-action: manipulation`, `overscroll-behavior: contain`, `env(safe-area-inset-*)` e `prefers-reduced-motion` seletivo preservando o indicador visual de carregamento.
- **Onda 2 (Performance React e Estados Completos):**
  - `ARCH-01`: `React.lazy()` + `Suspense` em todas as rotas + `manualChunks` (`editor-tiptap`, `auth-oidc`, `vendor-react`) em `vite.config.ts`. Bundle inicial em `/login` caiu de **`810,09 kB`** (`249,06 kB` gzip) para **`369,02 kB`** (`112,80 kB` gzip — **-54,5%**), com `editor-tiptap` (`410,37 kB` / `131,28 kB` gzip) carregado sob demanda e **zero avisos `> 500 kB`** do Vite.
  - `ARCH-02` / `ARCH-03`: `useMemo` nos providers `AuthContext` e `WorkspaceContext`; agregação single-pass `O(n)` via `computeDashboardMetrics()`.
  - `CRIT-04` / `CRIT-05` / `HIGH-05`: `ConfirmDialog` nativo em `<dialog>`, renomeação inline de página em `PagesIndexPage`, skeletons estruturais em Dashboard/Tarefas/Páginas/Editor, estado *First-Use* distinto de *Concluídas*, `ToastProvider` (`aria-live="polite"`), `OfflineBanner` e validação inline com `aria-invalid`/`aria-describedby` e foco automático no campo em `TaskForm`.
- **Onda 3 (Fluxos e Polimento Visual):**
  - `HIGH-01..04` / `HIGH-06..07`: eliminação de CTAs primários duplicados no mobile/empty-state; formulário colapsável em `< 1180px` e botão `Atualizar` corrigido em `768px`; `<textarea>` auto-resize no título do editor e breadcrumb fluido; remoção de status duplicado em `TaskList`; filtros sincronizados na URL (`?status=`) + busca local (`useDeferredValue`) + ordenação; `--af-content-max: 1380px` e pill sem quebra em `360px`.
  - `REF-01..06`: remoção de eyebrows ALL-CAPS, setas decorativas e faixas laterais de cartão; `0` hex hardcoded fora de `tokens.css`; `0` reticências ASCII (`...`); `Intl.DateTimeFormat("pt-BR")`; `public/favicon.svg` + metas em `index.html`; atalho `Ctrl+S`/`Cmd+S` no editor; botão único de login em 1 linha a `360px`.
- **Onda 4 (Modularização, Limpeza e Regressão):**
  - `ARCH-04..06`: `styles.css` modularizado em 5 arquivos (`tokens.css`, `base.css`, `components.css`, `layout.css`, `pages.css` — 0 seletores duplicados); primitivos reutilizáveis em `components/ui/`; remoção do código legado não utilizado `DashboardPage.tsx`.
  - **Verificação automatizada pós-ondas:** Vitest **19/19 PASS** (`7/7` arquivos), `tsc -b --noEmit` **PASS**, `vite build` **PASS** (`1.55s`), `npm audit` **0 vulnerabilidades**, `impeccable detect` (`apps/web/src` + `index.html`) **`[]` (exit 0)**, Pytest backend **60/60 PASS**, `docs/AVALIACAO.md` inalterado e **17/17 capturas pós-ondas verificadas em Firefox headless** (`1920`, `1440`, `768`, `390`, `360` px).

