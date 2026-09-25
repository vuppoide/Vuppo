# 🛡️ VUPPO Backend API (Node.js + Express)

Backend RESTful desenvolvido com Node.js e Express para gerenciar autenticação, planos, créditos e auditoria de segurança de código estático da plataforma **VUPPO**.

---

## 🚀 Como Iniciar

### 1. Instalar dependências
```bash
cd server
npm install
```

### 2. Configurar variáveis de ambiente
Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

### 3. Rodar o servidor
Modo de produção:
```bash
npm start
```

Modo de desenvolvimento (com auto-reload):
```bash
npm run dev
```

O servidor estará disponível em `http://localhost:4000`.

---

## 📌 Rotas Disponíveis

### Healthcheck
- `GET /api/health` - Verifica o status do backend.

### Autenticação & Usuário (`/api/auth`)
- `POST /api/auth/signup` - Criação de conta (`name`, `email`, `password`).
- `POST /api/auth/signup/code` - Solicita código OTP de confirmação de e-mail.
- `POST /api/auth/signup/verify` - Valida o código OTP recebido.
- `POST /api/auth/login` - Autentica o usuário e retorna o `token`.
- `POST /api/auth/logout` - Invalida a sessão ativa (*Bearer Token*).
- `GET /api/auth/me` - Retorna os dados do usuário autenticado e consumo atual (*Bearer Token*).
- `GET /api/auth/plans` - Lista os planos disponíveis (Free, Pro, Team).
- `GET /api/auth/usage` - Consulta o uso de créditos e histórico do ciclo atual (*Bearer Token*).
- `POST /api/auth/plan` - Altera o plano do usuário (`planId`) (*Bearer Token*).

### Auditoria de Segurança (`/api/scan`)
- `POST /api/scan/audit` - Realiza a varredura em snippets ou lista de arquivos (autenticação opcional para registrar créditos e histórico).
  - Body: `{ files: [{ filename: "arquivo.js", content: "..." }] }` ou `{ filename: "teste.js", content: "..." }`.
- `GET /api/scan/rules` - Retorna as regras de segurança ativas no auditor.
- `GET /api/scan/history` - Retorna os relatórios salvos do usuário autenticado (*Bearer Token*).

### Chat com IA agêntica (`/api/chat`)
- `POST /api/chat` - Conversa com a IA, que pode **ler e agir no projeto aberto igual um agente** (estilo Cline).
  - Body: `{ messages: [{ role: "user"|"assistant"|"system", content: "..." }], projectPath: "C:\\caminho\\do\\projeto" }`.
  - Resposta: `{ reply: "...", model: "...", steps: [...], pendingApproval?: { actionId, tool, description, args } }`.
  - Ferramentas automáticas (executam na hora): `ler_arquivo`, `listar_pasta`, `buscar_no_codigo`, `auditar_arquivo`.
  - Ferramentas com aprovação: `editar_arquivo`, `executar_comando` — retornam `pendingApproval`; confirme em `POST /api/chat/action`.
  - Respostas vêm em **markdown** (títulos, listas, `código`, blocos ```) e o chat renderiza formatado.
- `POST /api/chat/action` - Aprova ou recusa uma ação proposta pela IA.
  - Body: `{ actionId: "act_...", approved: true|false }`.
  - Resposta: `{ reply: "...", model: "...", steps: [...], actionResult: "executada"|"recusada" }`.
  - A chave da OpenRouter fica **somente no backend**, nas variáveis `OPENROUTER_API_KEY` e `OPENROUTER_MODEL` do `.env` (nunca no frontend).
  - Se o modelo principal (`OPENROUTER_MODEL`) estiver com rate limit, a OpenRouter faz failover automático para os modelos de `OPENROUTER_MODEL_FALLBACKS`; o campo `model` da resposta indica qual modelo respondeu.

---

## 📁 Estrutura de Pastas

```
server/
├── src/
│   ├── controllers/
│   │   ├── authController.js
│   │   └── scanController.js
│   ├── middlewares/
│   │   ├── authMiddleware.js
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── scanRoutes.js
│   ├── services/
│   │   ├── authHelpers.js
│   │   ├── authService.js
│   │   ├── scannerService.js
│   │   └── storageService.js
│   └── server.js
├── data/             # Armazenamento de dados local JSON
├── .env.example
├── package.json
└── README.md
```
