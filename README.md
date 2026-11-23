# AcadFlow — Workspace Acadêmico (Tarefas + Páginas e Anotações)

Projeto final individual da disciplina de **Sistemas Distribuídos — UFERSA** (apresentação e entrega: 27/11/2026).

## URLs Institucionais em Produção (HTTPS)
- **Aplicação Web (Camada 1):** `https://enthonyaraujo.grupo-03.sd.ufersa.dev.br`
- **API REST (Camadas 2 e 3):** `https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br`

## Requisitos Oficiais Atendidos
1. **Arquitetura de três camadas:** apresentação (`apps/web` no AWS Amplify), negócios (`services/api` em AWS Lambda Python 3.12 + API Gateway HTTP API) e dados (Amazon DynamoDB: `acadflow-tasks` e `acadflow-pages`).
2. **Comunicação via APIs baseadas em recursos (REST/JSON):** `/health`, `/tasks`, `/tasks/{id}`, `/pages`, `/pages/{id}`.
3. **Dois domínios institucionais HTTPS:** `enthonyaraujo.grupo-03.sd.ufersa.dev.br` e `api.enthonyaraujo.grupo-03.sd.ufersa.dev.br`.
4. **Autenticação e autorização:** Amazon Cognito (Authorization Code + PKCE via `oidc-client-ts`) + API Gateway HTTP API JWT Authorizer (`scope=openid`) + isolamento por proprietário (`sub` + `token_use == "access"`) na Lambda.

## Estrutura do Repositório

```text
/
├── apps/web/                         # Camada 1: React + TypeScript + Vite + Tiptap (Workspace, Páginas, Tarefas)
├── services/api/                     # Camada 2: AWS Lambda Python 3.12 + DynamoDB (/tasks e /pages) + pytest
├── infra/                            # Scripts multiplataforma Python (diagnóstico, deploy idempotente, cutover)
├── tests/e2e/                        # Testes automatizados HTTP contra API local e domínios de produção
├── docs/
│   ├── PLANO_PROJETO_FINAL.md        # Especificação base do projeto
│   ├── WORKSPACE_ACADFLOW.md         # Especificação da evolução P1 (Workspace + Tiptap + /pages)
│   ├── ARQUITETURA.md                # Decisões, contratos congelados e matriz real de permissões AWS
│   ├── IMPLANTACAO.md                # Passos reproduzíveis de deploy, SPA rewrite, DNS e rollback
│   └── EVIDENCIAS.md                 # Matriz central AC-01..AC-15 + AC-P1-01..05 e testes executados
├── .gitignore
├── .gitattributes
└── README.md
```

## Execução Local (Fedora Linux — Padrão Recomendado)

### Backend (`services/api`)
```bash
python3.12 -m venv services/api/.venv
source services/api/.venv/bin/activate
pip install -r services/api/requirements-dev.txt
pytest services/api/tests -v
python services/api/build_package.py
```

Para executar a API localmente em memória (apenas desenvolvimento, nunca implantado na AWS):
```bash
python services/api/local_server.py
```

### Frontend (`apps/web`)
```bash
cd apps/web
npm ci
npm run test
npm run build
```

*(No Windows PowerShell, use `npm.cmd` caso a `ExecutionPolicy` bloqueie `npm.ps1`, e ative o ambiente virtual com `.\services\api\.venv\Scripts\Activate.ps1`.)*

## Documentação
- [docs/PLANO_PROJETO_FINAL.md](docs/PLANO_PROJETO_FINAL.md)
- [docs/WORKSPACE_ACADFLOW.md](docs/WORKSPACE_ACADFLOW.md)
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md)
- [docs/IMPLANTACAO.md](docs/IMPLANTACAO.md)
- [docs/EVIDENCIAS.md](docs/EVIDENCIAS.md)
