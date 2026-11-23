# AcadFlow — Plano de execução do projeto final de Sistemas Distribuídos

> **Documento-base para agentes de IA**  
> **Disciplina:** Sistemas Distribuídos — UFERSA  
> **Modalidade:** trabalho individual  
> **Data de referência:** 22/11/2026  
> **Apresentação e prazo de entrega:** 27/11/2026 (entrega até 23h59, horário local)  
> **Estado inicial:** planejamento; nenhuma implementação, publicação ou configuração da AWS é presumida como concluída.

---

## 1. Objetivo e regra principal

Construir, implantar e demonstrar uma aplicação web funcional que cumpra integralmente os requisitos explícitos do projeto final de Sistemas Distribuídos.

**Prioridade absoluta:** completar os requisitos avaliados, garantir que a aplicação esteja publicada e testada e preparar uma demonstração reproduzível até 27/11/2026. A aparência deve ser boa e responsiva, mas nunca deve atrasar autenticação, autorização, persistência, DNS ou implantação.

**Instrução aos agentes:** ler este documento antes de propor ou executar alterações. Não interpretar como concluída nenhuma etapa sem evidência verificável. Trabalhar primeiro no escopo mínimo; extras somente após o aceite integral.

### 1.1. Requisitos oficiais do professor (fonte: enunciado compartilhado)

O projeto final é **individual** e requer:

1. **Arquitetura de três camadas**: apresentação, negócios e dados.
2. **Comunicação entre componentes utilizando APIs**, em estilo arquitetônico baseado em recursos.
3. **DNS personalizado** para aplicação e API, nos formatos fornecidos:
   - Aplicação: `SEUNOME.grupo?.sd.ufersa.dev.br`
   - API: `api.SEUNOME.grupo?.sd.ufersa.dev.br`
4. **Autenticação de usuário e autorização de chamadas à API.**
5. **Apresentação funcional em sala ao docente em 27/11/2026.**
6. **Submissão até 27/11/2026 às 23h59.**

> O enunciado final **não determina** React, Lambda, DynamoDB, Docker, ECS, SQS, número de páginas ou tipo de aplicação. O uso dos serviços abaixo é nossa proposta de implementação, inspirada nas práticas anteriores da disciplina. Não afirmar que sejam exigências textuais do professor.

### 1.2. Relação com as avaliações anteriores

- Avaliação 02: React, REST API e Amplify.
- Avaliações 08, 10 e 11: implantação e DNS personalizado; persistência via AWS.
- Avaliação 12: API Gateway, Lambda e autorização.
- Avaliação 13: Cognito, JWT e testes autorizados/não autorizados.

**Reaproveitamento:** examinar recursos e código das avaliações anteriores antes de criar infraestrutura nova. Não presumir que laboratórios anteriores ainda estejam ativos. Verificar se o trabalho individual e o isolamento dos recursos estão preservados.

---

## 2. Produto aprovado para planejamento

**Nome provisório:** AcadFlow — Gerenciador de Atividades Acadêmicas.

**Problema resolvido:** estudantes precisam acompanhar tarefas, prioridades e prazos em um único lugar.

**Fluxo demonstrável:** o estudante faz login, cria uma atividade, consulta a lista, altera o status, edita ou exclui uma atividade; ao atualizar a página, os dados permanecem salvos. Uma chamada à API sem token válido é negada. Usuários diferentes não conseguem visualizar ou manipular tarefas uns dos outros.

### 2.1. Funcionalidades obrigatórias do nosso MVP (P0)

- Login por Cognito e logout.
- Rotas protegidas no frontend.
- Criar, listar, consultar, atualizar e excluir atividades (CRUD).
- Campos: título, descrição opcional, prazo opcional, prioridade e status.
- Persistência real na camada de dados.
- API REST pública na Internet, com endpoints de negócio protegidos por autenticação/autorização.
- Autorização por proprietário do registro, obtido do JWT validado.
- Interface responsiva e estados de carregamento, vazio e erro.
- Publicação dos **dois** DNS institucionais exigidos, com HTTPS.
- Demonstração de uma requisição sem credencial e outra com credencial válida, com seus respectivos códigos HTTP.

### 2.2. Funcionalidades opcionais (P1 — apenas após P0)

- Filtro por status e prioridade, ordenação por prazo.
- Contadores no dashboard: pendentes, em andamento e concluídas.
- Indicadores de tarefas próximas do vencimento.
- Melhorias visuais e acessibilidade adicionais.

### 2.3. Fora do escopo inicial (P2 / não implementar sem autorização)

Chat, notificações por e-mail, calendário externo, aplicativo móvel nativo, pagamento, IA embutida, múltiplos perfis administrativos, anexos, multiplayer, Docker/ECS/SQS e funcionalidades colaborativas. Evitar expandir o produto somente para exibir mais serviços AWS.

---

## 3. Arquitetura de referência

```text
[Navegador do usuário]
          |
          | HTTPS
          v
[React + Vite hospedados no AWS Amplify]         CAMADA 1: apresentação
          |
          | REST/JSON + Authorization: Bearer <access_token>
          v
[Amazon API Gateway HTTP API]
          |      \
          |       \--> [JWT authorizer integrado ao Cognito User Pool]
          v
[AWS Lambda (Python)]                           CAMADA 2: negócios
          |
          | AWS SDK / IAM role de execução
          v
[Amazon DynamoDB]                               CAMADA 3: dados
```

**Observações:**

- API Gateway é a porta de entrada, **não substitui** a camada de negócios. A lógica de negócio fica nas funções Lambda.
- Cognito é o provedor de identidade, não a base de atividades.
- A identidade do proprietário **sempre** deve ser inferida das claims confiáveis do JWT verificado no API Gateway. Nunca confiar no `ownerId` enviado pelo cliente.
- O navegador nunca recebe credenciais permanentes da AWS nem acessa diretamente o DynamoDB.
- Domínio institucional, certificado TLS e permissões AWS são dependências de implantação, a verificar imediatamente.

### 3.1. Tecnologias escolhidas

| Componente | Escolha inicial | Motivo |
|---|---|---|
| Frontend | React + TypeScript + Vite | Interface enxuta e manutenção simples |
| Hospedagem | AWS Amplify Hosting | Deploy estático e integração de domínio |
| Backend | AWS Lambda + Python | Baixo esforço operacional |
| API | API Gateway **HTTP API** | REST e autorização JWT integrada |
| Identidade | Cognito User Pool | Login web e tokens JWT |
| Dados | DynamoDB | Persistência gerenciada sem servidor próprio |
| Infraestrutura | Scripts/arquivos declarativos, se viáveis no Learner Lab | Reprodutibilidade |
| Testes | Testes unitários + testes HTTP de integração | Evidência objetiva de funcionamento |

As escolhas podem ser ajustadas se o **Learner Lab** proibir um serviço, recurso, operação IAM ou tipo de implantação. Toda substituição deve manter os quatro requisitos oficiais, ser documentada e aprovada pelo agente coordenador/usuário.

### 3.2. DNS e nomes

As duas URLs devem ser configuradas a partir das informações reais da disciplina:

```text
APP_URL=https://<seu-nome>.<grupo>.sd.ufersa.dev.br
API_URL=https://api.<seu-nome>.<grupo>.sd.ufersa.dev.br
```

Não inventar o número do grupo, a grafia do nome DNS, a zona administrada, o certificado ou as credenciais. Confirmar com o usuário/professor como os registros são alterados. **O endereço padrão do Amplify/API Gateway serve apenas para desenvolvimento e testes, não substitui o DNS exigido.**

**Dependências externas:** verificar registro CNAME/alias conforme o provedor, validação do certificado e mapeamento do domínio para API e app. A posse ou o controle da zona DNS pode exigir atuação do professor/administrador.

---

## 4. Contratos e modelo de dados

### 4.1. Modelo lógico `Task`

```json
{
  "id": "uuid",
  "title": "Entregar trabalho de SD",
  "description": "Preparar apresentação e testar deploy",
  "dueDate": "2026-11-27",
  "priority": "high",
  "status": "pending",
  "createdAt": "2026-11-22T18:00:00Z",
  "updatedAt": "2026-11-22T18:00:00Z"
}
```

- `id`: UUID gerado no servidor.
- `title`: obrigatório, tamanho validado (por exemplo, 1–120 caracteres).
- `description`: opcional, tamanho limitado (por exemplo, até 1.000 caracteres).
- `dueDate`: opcional, `YYYY-MM-DD`, validado como data.
- `priority`: `low`, `medium` ou `high`.
- `status`: `pending`, `in_progress` ou `done`.
- `createdAt` e `updatedAt`: gerados pelo servidor em UTC.
- `ownerId`: **persistido internamente no banco**, mas não aceito como fonte de autoridade enviada pelo cliente.

**Sugestão DynamoDB:** tabela `acadflow-tasks`, chave de partição `ownerId` e chave de ordenação `id`. Todas as consultas e alterações devem utilizar `ownerId` autenticado; utilizar `Query` em vez de `Scan` indiscriminado. Não confiar somente na filtragem do frontend.

### 4.2. Endpoints HTTP previstos

| Método | Rota | Proteção | Comportamento esperado |
|---|---|---|---|
| `GET` | `/health` | Pública | Saúde básica da API, sem informação sensível |
| `GET` | `/tasks` | JWT | Lista somente as tarefas do usuário |
| `POST` | `/tasks` | JWT | Cria uma tarefa para o usuário autenticado; `201` |
| `GET` | `/tasks/{id}` | JWT | Consulta tarefa de propriedade do usuário |
| `PATCH` | `/tasks/{id}` | JWT | Atualiza campos permitidos |
| `DELETE` | `/tasks/{id}` | JWT | Exclui tarefa própria; `204` |

**Comportamento de erros:** `400` para payload inválido, `401` para ausência/invalidade de token quando aplicável, `403` para acesso proibido quando aplicável, `404` para recurso inexistente/não pertencente ao usuário, `500` apenas para falhas inesperadas. A implementação deve registrar o comportamento efetivo do gateway e não forçar um código diferente apenas para imitar avaliações anteriores.

**Observação de segurança:** preferir `404` para recurso de outro usuário, evitando expor sua existência. Especificar JSON consistente para respostas e erros, por exemplo `{"error":{"code":"VALIDATION_ERROR","message":"..."}}`. Não vazar stack traces.

### 4.3. Autenticação e autorização

- Cognito User Pool com login por e-mail.
- Frontend web como **cliente público**, sem segredo de cliente embutido.
- Priorizar **Authorization Code + PKCE** para o login. O `implicit flow` foi pedido na Avaliação 13, **não** no enunciado final; não reutilizá-lo automaticamente.
- Frontend anexa `Authorization: Bearer <access_token>` nas chamadas protegidas.
- Configurar o JWT authorizer do HTTP API com `issuer` do User Pool, `audience` do app client e origem `Authorization`.
- Validar o contrato real de JWT: verificar assinatura, expiração, emissor/audience no gateway; exigir token apropriado às chamadas (access token, não ID token). Checar claims/escopos conforme configuração adotada; não presumir que todo JWT válido dá acesso a tudo.
- Usar `sub` das claims verificadas para identificar o usuário nas Lambdas, além de garantir pertencimento do recurso.
- Habilitar CORS **somente** para origens autorizadas, métodos e cabeçalhos necessários. Configurar URLs temporárias de teste explicitamente, se utilizadas.
- Não incluir tokens, senhas, segredos, matrícula real ou dados pessoais em logs públicos, capturas desnecessárias ou commits.
- Para a demo, utilizar contas de teste e dados fictícios.

### 4.4. Variáveis de configuração (exemplo, valores não preenchidos)

Frontend (`.env.example`):

```dotenv
VITE_API_URL=https://api.<seu-nome>.<grupo>.sd.ufersa.dev.br
VITE_COGNITO_REGION=<aws-region>
VITE_COGNITO_USER_POOL_ID=<user-pool-id>
VITE_COGNITO_CLIENT_ID=<client-id-publico>
VITE_COGNITO_DOMAIN=<dominio-de-login>
VITE_APP_URL=https://<seu-nome>.<grupo>.sd.ufersa.dev.br
```

Backend/infra (variáveis do ambiente Lambda, não segredos em Git):

```dotenv
TASKS_TABLE=<nome-da-tabela>
AWS_REGION=<regiao>
```

> Valores `VITE_*` são incluídos no bundle público: não inserir segredo neles. O AWS SDK na Lambda deve usar a role de execução, sem chaves estáticas.

---

## 5. Estrutura recomendada do repositório

```text
/
├── apps/
│   └── web/                  # React + TypeScript + Vite
│       ├── src/
│       └── .env.example
├── services/
│   └── api/                  # Lambda Python, regras e testes
│       ├── src/
│       ├── tests/
│       └── requirements.txt
├── infra/                    # Scripts/manifests e documentação de provisionamento
├── docs/
│   ├── PLANO_PROJETO_FINAL.md
│   ├── ARQUITETURA.md        # Elaborar após decisões confirmadas
│   ├── IMPLANTACAO.md        # Passos reais reproduzíveis
│   └── EVIDENCIAS.md         # Links e checklist de capturas
├── artifacts/                # Evidências sem credenciais, se necessário
├── .gitignore
└── README.md
```

**Regra:** adaptar à estrutura real se o repositório já existir. Não reorganizar ou apagar arquivos preexistentes sem necessidade. Não criar documentos vazios só para cumprir a árvore proposta.

---

## 6. Ordem de execução e dependências

### Fase 0 — Diagnóstico de ambiente (**bloqueante**, iniciar em 22/11)

- [ ] Localizar o repositório e verificar situação do Git (`git status`, branches, arquivos existentes).
- [ ] Identificar qual conta AWS/Learner Lab será usada, sua região e prazo de validade da sessão.
- [ ] Conferir serviços realmente disponíveis: Amplify, API Gateway HTTP API, Lambda, Cognito, DynamoDB e ACM.
- [ ] Conferir permissões IAM; verificar se há `LabRole` ou role equivalente autorizada.
- [ ] Identificar infraestrutura das avaliações anteriores que **pode** ser reutilizada legalmente e sem conflitos.
- [ ] Confirmar `SEUNOME`, o **grupo** e quem administra `sd.ufersa.dev.br`.
- [ ] Confirmar como gerar/validar certificados e registros DNS para os dois subdomínios.
- [ ] Registrar bloqueios, restrições de custo e substituições aprovadas.

**Saída:** `docs/ARQUITETURA.md` com decisões reais, matriz de permissões e registro de bloqueios. Se o DNS depender de terceiros, iniciar a solicitação **nesta fase**.

### Fase 1 — Contratos, backend e dados (meta: 23/11)

- [ ] Congelar o contrato dos endpoints e o modelo `Task`.
- [ ] Implementar validação, serialização e tratamento de erros.
- [ ] Criar acesso ao DynamoDB usando `ownerId` obtido do contexto autorizado.
- [ ] Implantar Lambda e API Gateway com `/health` e rotas de negócio.
- [ ] Testar criação, consulta, edição e exclusão com dados persistidos.
- [ ] Adicionar testes unitários para regras e isolamento entre usuários.

### Fase 2 — Identidade e autorização (meta: 24/11)

- [ ] Provisionar ou reutilizar um User Pool Cognito e configurar cliente web.
- [ ] Definir URL de callback/logout, incluindo URL temporária durante desenvolvimento e URL definitiva.
- [ ] Implementar login, callback, estado autenticado e logout.
- [ ] Configurar proteção JWT em **todas** as rotas de `/tasks`.
- [ ] Testar credenciais ausentes, token inválido/expirado, token válido e tentativa de acesso ao dado de outro usuário.
- [ ] Garantir que o backend não confie em `ownerId` do body/query.

### Fase 3 — Frontend e integração (meta: 25/11)

- [ ] Implementar login/callback e navegação protegida.
- [ ] Criar lista de tarefas, formulário de criação/edição e atualização de status.
- [ ] Implementar cliente HTTP tipado, com cabeçalho `Authorization` e tratamento de 401/403.
- [ ] Criar estados de carregamento, erro e lista vazia.
- [ ] Testar integração ponta a ponta e persistência após recarga.
- [ ] Implantar o frontend no Amplify e testar por URL padrão.

### Fase 4 — DNS, qualidade e documentação (meta: 26/11)

- [ ] Configurar certificado HTTPS, domínio da aplicação e domínio da API.
- [ ] Confirmar resolução de ambos os nomes e acesso por HTTPS sem erro de certificado.
- [ ] Ajustar callback, logout, CORS e URL base para os domínios finais.
- [ ] Validar frontend, backend, banco e autenticação **nos domínios exigidos**, não só em localhost.
- [ ] Testar versão mobile e desktop; revisar estados de erro e logs.
- [ ] Documentar arquitetura real, decisões, comandos e sequência de implantação.
- [ ] Preparar capturas com URL visível e evidências de autenticação autorizada/não autorizada.
- [ ] Fazer ensaio de demonstração; preparar plano de contingência se a rede do local falhar.

### Fase 5 — Apresentação e entrega (27/11)

- [ ] Executar smoke test na aplicação publicada antes da aula.
- [ ] Apresentar arquitetura e os quatro requisitos oficiais.
- [ ] Demonstrar login, CRUD, persistência, rejeição sem token e acesso autorizado.
- [ ] Demonstrar os **dois DNS oficiais** e HTTPS.
- [ ] Fazer a submissão conforme instrução do SIGAA/professor antes de 23h59.
- [ ] Guardar evidências e confirmar o envio.

---

## 7. Organização de agentes de IA e Regras de Colaboração

(Ver também revisões obrigatórias em `REVISAO_IMPLEMENTATION_PLAN.md` na raiz do repositório.)

---

## 8. Critérios de aceite e evidências

| ID | Teste reproduzível | Resultado esperado |
|---|---|---|
| AC-01 | Acessar URL institucional do frontend | Página carrega em HTTPS |
| AC-02 | Acessar URL institucional da API | Responde em HTTPS conforme rota testada |
| AC-03 | Tentar acessar tarefas sem token | Gateway bloqueia (`401` ou resposta aplicável devidamente registrada) |
| AC-04 | Chamar endpoint com token inválido/expirado | Solicitação rejeitada |
| AC-05 | Fazer login e listar tarefas próprias | `200` e dados coerentes |
| AC-06 | Criar tarefa autenticada | `201` e item persistido |
| AC-07 | Atualizar tarefa e recarregar frontend | Alteração permanece no banco |
| AC-08 | Excluir tarefa | Item não aparece mais; `204` na exclusão |
| AC-09 | Usuário B tentar acessar ID de tarefa do usuário A | Acesso ao dado negado / não encontrado |
| AC-10 | Enviar título ausente e status inválido | `400`, sem gravação inválida |
| AC-11 | Abrir aplicação em viewport móvel | Interface utilizável sem overflow crítico |
| AC-12 | Apresentar arquitetura de 3 camadas | Explicação corresponde aos recursos publicados |

> **Fonte dos requisitos acadêmicos:** enunciado da atividade “Avaliação - Projeto final”, compartilhado pelo aluno. **Fonte das escolhas técnicas:** planejamento desta implementação. Quando houver divergência, o enunciado do professor prevalece.
