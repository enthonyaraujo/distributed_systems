# Instruções Operacionais para Agentes — AcadFlow

Este repositório contém o projeto final individual da disciplina de **Sistemas Distribuídos — UFERSA** (entrega e apresentação: **27/11/2026**).

---

## REGRA ABSOLUTA — Enunciado Oficial (`docs/AVALIACAO.md`)

- O arquivo **`docs/AVALIACAO.md`** contém o enunciado oficial da avaliação fornecido pelo docente.
- **`docs/AVALIACAO.md` É ESTRITAMENTE SOMENTE LEITURA.**
- **PROIBIDO** alterar, reformatar, normalizar finais de linha, renomear, mover, sobrescrever ou excluir `docs/AVALIACAO.md` em qualquer circunstância.
- Utilize `docs/AVALIACAO.md` exclusivamente como referência para verificação de requisitos. Em caso de divergência entre qualquer documento técnico e `docs/AVALIACAO.md`, o enunciado oficial prevalece.

---

## Regras de Infraestrutura, Segurança e Versionamento

1. **Preservar produção AWS existente:**
   - Recursos ativos em `us-east-1`: DynamoDB (`acadflow-tasks`, `acadflow-pages`), Cognito (`acadflow-users` / `us-east-1_tKA6pURyD`), Lambda (`acadflow-api`, runtime `python3.12`), API Gateway HTTP API (`acadflow-http-api` / `u0mxrf6mnk`), AWS Amplify (`acadflow-web` / `dysbk8tmbj14k`) e domínios institucionais HTTPS (`enthonyaraujo.grupo-03.sd.ufersa.dev.br` e `api.enthonyaraujo.grupo-03.sd.ufersa.dev.br`).
   - **Nunca** executar deploy, recriar recursos AWS, alterar DNS (Route 53 / API Gateway Domain Mappings / Amplify Domains) ou excluir recursos sem autorização explícita do usuário.
   - **Nunca** modificar recursos de avaliações anteriores (`war28zsged`, `us-east-1_Klis7IMHv`, funções Lambda prévias ou registros DNS alheios ao AcadFlow).
2. **Segredos e arquivos locais proibidos no Git:**
   - **Nunca** commitar ou exibir credenciais AWS (`~/.aws/credentials`), tokens JWT, senhas, `apps/web/.env.local` ou `infra/deploy_state.json`.
   - Permissões locais recomendadas no Fedora: `~/.aws` (`700`) e `~/.aws/credentials` (`600`).
3. **Integridade de evidências (`docs/EVIDENCIAS.md`):**
   - Diferenciar explicitamente testes automatizados (locais e produção somente leitura) de validações manuais e critérios pendentes.
   - **Nunca** marcar como `Aceito` critérios que exijam Cognito real, DynamoDB real, dois usuários reais ou inspeção em navegador apenas com base em mocks ou testes locais.
   - **Nunca** inventar contas, e-mails fictícios não controlados ou credenciais para simular testes.
4. **Ambiente padrão (Fedora Linux):**
   - Backend e scripts `infra/` devem usar **Python 3.12** via `services/api/.venv` (espelhando o runtime `python3.12` da Lambda).
   - Antes de preparar commits, validar:
     - `services/api/.venv/bin/pytest services/api/tests -v`
     - `cd apps/web && npm run test && npm run typecheck && npm run build && npm audit`
5. **Controle Git:**
   - Não executar `git push`, `git merge` ou alterações destrutivas de histórico sem solicitação explícita.
