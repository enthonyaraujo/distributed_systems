# Configuração do Ambiente de Desenvolvimento — Fedora Linux

Este guia descreve como clonar, configurar, testar e continuar o desenvolvimento do **AcadFlow** em **Fedora Linux**, preservando integralmente a infraestrutura já provisionada na AWS (`us-east-1`).

> **Importante:** A migração para o Fedora altera apenas a estação de desenvolvimento local. A infraestrutura em produção (`acadflow-tasks`, `acadflow-pages`, `acadflow-users`, `acadflow-api`, `acadflow-http-api`, `acadflow-web` e os dois domínios institucionais HTTPS) permanece ativa e inalterada.

---

## O que vem pelo Git vs. o que precisa ser refeito no Fedora

| Vem automaticamente no `git clone` | Precisa ser configurado localmente no Fedora |
|---|---|
| Todo o código-fonte (`apps/web/`, `services/api/`) | Instalação de Git, Node.js/npm, Python 3.12 e AWS CLI |
| Scripts de infraestrutura (`infra/`) e testes (`tests/e2e/`) | Chave SSH (ou autenticação segura) para o GitHub |
| Documentação completa (`docs/`, `README.md`) | Ambiente virtual Python (`services/api/.venv`) e `node_modules` |
| Templates seguros (`apps/web/.env.example`, `package-lock.json`, `requirements-dev.txt`) | Arquivo local `apps/web/.env.local` (ignorado pelo Git) |
| Padronização de finais de linha (`.gitattributes` LF) | Credenciais temporárias do AWS Learner Lab em `~/.aws/credentials` (nunca versionadas) |

---

## 1. Instalação das dependências no Fedora

Atualize os pacotes e instale Git, Node.js (com npm), Python 3.12 e AWS CLI v2:

```bash
sudo dnf update -y
sudo dnf install -y git nodejs npm python3.12 python3.12-pip awscli2
```

> Caso o repositório da sua versão do Fedora já forneça `python3` na versão 3.12, você pode usar `python3` diretamente; caso o padrão seja 3.13+, use `python3.12` explicitamente para espelhar o runtime **`python3.12`** da AWS Lambda (`acadflow-api`).

Verifique as versões instaladas:

```bash
git --version
node -v
npm -v
python3.12 --version
aws --version
```

**Versões recomendadas:**
- Git >= 2.40
- Node.js >= 20 LTS (e npm >= 10)
- Python **3.12.x** (mesmo runtime da AWS Lambda `acadflow-api`)
- AWS CLI v2 (opcional para inspeções rápidas; os scripts em `infra/` usam `boto3`)

---

## 2. Configurar autenticação segura com o GitHub (SSH)

1. Configure seu nome e e-mail do Git:
   ```bash
   git config --global user.name "Seu Nome"
   git config --global user.email "seu-email@exemplo.com"
   ```
2. Gere uma chave SSH Ed25519 (se ainda não possuir):
   ```bash
   ssh-keygen -t ed25519 -C "fedora-acadflow"
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519
   cat ~/.ssh/id_ed25519.pub
   ```
3. Copie a chave pública exibida e adicione em **GitHub -> Settings -> SSH and GPG keys -> New SSH key**.
4. Teste a conexão:
   ```bash
   ssh -T git@github.com
   ```

*(Alternativa: instalar `gh` via `sudo dnf install -y gh` e autenticar com `gh auth login`.)*

---

## 3. Clonar o repositório

Via SSH (recomendado):
```bash
git clone git@github.com:enthonyaraujo/distributed_systems.git
cd distributed_systems
```

Ou via HTTPS:
```bash
git clone https://github.com/enthonyaraujo/distributed_systems.git
cd distributed_systems
```

Confirme a branch principal:
```bash
git branch -a
git status
```

---

## 4. Configurar Python 3.12 em ambiente virtual (Backend e Infra)

```bash
python3.12 -m venv services/api/.venv
source services/api/.venv/bin/activate
python -m pip install --upgrade pip
pip install -r services/api/requirements-dev.txt
```

Para desativar o ambiente virtual quando terminar:
```bash
deactivate
```

---

## 5. Instalar dependências do Frontend (`apps/web`)

```bash
cd apps/web
npm ci
cd ..
```

*(Diferente do Windows PowerShell, no Fedora usa-se `npm` diretamente — não `npm.cmd`.)*

---

## 6. Criar arquivo `.env.local` do Frontend a partir do exemplo

```bash
cp apps/web/.env.example apps/web/.env.local
```

Edite `apps/web/.env.local` com os valores **públicos** do ambiente desejado (desenvolvimento local contra `local_server.py` ou contra a API institucional em `https://api.enthonyaraujo.grupo-03.sd.ufersa.dev.br`).

> **Nunca** insira segredos, chaves AWS ou `client_secret` em arquivos `.env*` e **nunca** force o commit de `.env.local` (já protegido pelo `.gitignore`).

---

## 7. Executar todos os testes automatizados

### Backend (Pytest em Python 3.12)
```bash
source services/api/.venv/bin/activate
pytest services/api/tests -v
```

### Empacotamento do ZIP da Lambda
```bash
python services/api/build_package.py
```
Gera `services/api/dist/acadflow-api.zip` (ignorado pelo `.gitignore`).

### Frontend (Vitest + TypeScript)
```bash
cd apps/web
npm run test
npm run typecheck
cd ..
```

---

## 8. Executar Backend e Frontend localmente

### Terminal 1 — Backend local em memória (apenas desenvolvimento)
```bash
source services/api/.venv/bin/activate
python services/api/local_server.py --host 127.0.0.1 --port 8000
```

### Terminal 2 — Frontend Vite (dev server na porta 5173)
```bash
cd apps/web
npm run dev
```
Acesse `http://localhost:5173`.

---

## 9. Compilar o Frontend para produção

```bash
cd apps/web
npm run build
cd ..
```
O bundle estático é gerado em `apps/web/dist/` (ignorado pelo `.gitignore`).

---

## 10. Configurar credenciais temporárias do AWS Learner Lab (com segurança)

As credenciais do AWS Academy Learner Lab expiram ao fim de cada sessão (~4h) e **jamais** devem entrar no repositório.

1. Crie o diretório `~/.aws` com permissão restrita:
   ```bash
   mkdir -p ~/.aws
   chmod 700 ~/.aws
   ```
2. Copie o bloco `[default]` exibido em **AWS Academy -> AWS Details -> AWS CLI** para `~/.aws/credentials`:
   ```bash
   nano ~/.aws/credentials
   chmod 600 ~/.aws/credentials
   ```
3. Opcionalmente configure a região padrão em `~/.aws/config`:
   ```ini
   [default]
   region = us-east-1
   output = json
   ```
4. Valide o acesso somente leitura (sem alterar nenhum recurso):
   ```bash
   source services/api/.venv/bin/activate
   python infra/check_aws_env.py --hosted-zone-id Z0906692126CHKWN9GQ2U --owner-filter enthonyaraujo
   python tests/e2e/verify_prod_domains.py
   ```

---

## 11. Fluxo diário de desenvolvimento e envio ao GitHub

```bash
git pull origin main
# faça suas alterações e rode os testes (pytest + npm run test + npm run build)
git status
git add <arquivos>
git commit -m "feat: descrição objetiva da alteração"
git push origin main
```

---

## 12. Diferenças Windows vs. Fedora Linux no Projeto

| Aspecto | Windows (anterior) | Fedora Linux (novo padrão) |
|---|---|---|
| Execução do npm | `npm.cmd` (ExecutionPolicy bloqueia `npm.ps1`) | `npm` diretamente |
| Ativação do venv | `.\services\api\.venv\Scripts\Activate.ps1` | `source services/api/.venv/bin/activate` |
| Python local | Python 3.15.2 (diferente do runtime Lambda 3.12) | **Python 3.12** nativo via `dnf` (idêntico à Lambda!) |
| Finais de linha | CRLF por padrão | LF padronizado via `.gitattributes` |
| Scripts `infra/` e `tests/` | Python multiplataforma (`pathlib`) | Funcionam identicamente sem alterações |
