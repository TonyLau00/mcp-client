# mcp-client

A React-based web interface for interacting with the TRON blockchain through a **ReAct (Reasoning + Acting) AI agent**. Connects to an MCP server via SSE, supports **7 LLM providers** with runtime switching, and includes **client-side wallet integration** for signing and broadcasting transactions.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    mcp-client (SPA)                      │
│                                                         │
│  ┌─────────┐  ┌───────────┐  ┌─────────────────────┐   │
│  │ ChatUI  │  │ ReAct     │  │ LLM Service          │   │
│  │         │──│ Agent     │──│ (7 providers)         │──▶ LLM APIs
│  │         │  │ Loop      │  │ OpenAI/Claude/Gemini/ │   │
│  │         │  │           │  │ DeepSeek/Ollama/...   │   │
│  └────┬────┘  └─────┬─────┘  └─────────────────────┘   │
│       │             │                                    │
│  ┌────▼────┐  ┌─────▼─────┐  ┌─────────────────────┐   │
│  │ Wallet  │  │ MCP SSE   │  │ Graph Viz            │   │
│  │ Connect │  │ Client    │──│ (force-graph-2d)     │   │
│  │ TronLink│  │           │  │ Neo4j Modal          │   │
│  └─────────┘  └─────┬─────┘  └─────────────────────┘   │
│                      │                                   │
└──────────────────────┼───────────────────────────────────┘
                       │ SSE
                       ▼
              tron-mcp-server (:3100)
```

## Features

### AI Agent
- **ReAct loop** — multi-step reasoning with tool calling
- **7 LLM providers** — OpenAI, Claude, DeepSeek, Gemini, Ollama (local), OpenRouter, Custom (OpenAI-compatible)
- **Runtime switching** — change LLM provider/model without reload
- **Dynamic system prompt** — auto-injects wallet address and network context
- **Streaming step display** — shows thinking → tool calls → observations → answer in real-time

### Blockchain Tools (via MCP)
- Account balance & resource queries
- Transaction status & decoded input data
- Address graph analysis & risk scoring
- Contract ABI, verification, source code
- Fund flow analysis
- Build unsigned TRX/TRC20 transfers (network-aware)

### Wallet Integration
- **TronLink** browser extension support
- **Private key** mode (for testing)
- **Network selector** — Mainnet / Nile / Shasta / Custom RPC
- **Client-side signing** — transactions are signed locally, never on the server
- **Transaction cards** — inline sign & broadcast UI in chat

### UI
- **Markdown rendering** with code highlighting
- **Neo4j graph modal** — interactive force-directed graph visualization
- **Tool explorer** side panel — browse all available MCP tools
- **Agent step panel** — expandable reasoning trace
- **Dark theme** with Tailwind CSS 4

## Prerequisites

- **Node.js** ≥ 20
- **tron-mcp-server** running on port 3100 (SSE mode)
- At least one **LLM API key** (DeepSeek, OpenAI, Claude, etc.) or local **Ollama**

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```dotenv
# MCP Server
VITE_MCP_SERVER_URL=http://localhost:3100

# Default LLM provider
VITE_LLM_PROVIDER=deepseek

# DeepSeek (recommended — cheapest with good tool calling)
VITE_DEEPSEEK_API_KEY=your-key
VITE_DEEPSEEK_BASE_URL=https://api.deepseek.com
VITE_DEEPSEEK_MODEL=deepseek-chat

# OpenAI
VITE_OPENAI_API_KEY=your-key
VITE_OPENAI_MODEL=gpt-4o

# Claude
VITE_CLAUDE_API_KEY=your-key
VITE_CLAUDE_MODEL=claude-sonnet-4-20250514

# Gemini
VITE_GEMINI_API_KEY=your-key
VITE_GEMINI_MODEL=gemini-2.0-flash

# Ollama (local)
VITE_OLLAMA_BASE_URL=http://localhost:11434
VITE_OLLAMA_MODEL=qwen2.5:14b

# OpenRouter
VITE_OPENROUTER_API_KEY=your-key
VITE_OPENROUTER_MODEL=anthropic/claude-sonnet-4

# Custom (OpenAI-compatible)
VITE_CUSTOM_BASE_URL=http://localhost:8000/v1
VITE_CUSTOM_MODEL=default
```

### 3. Run

```bash
# Development
npm run dev
# → http://localhost:5173

# Production build
npm run build
# → dist/ (static files, serve with nginx)
```

## Production Deployment

Build static files and serve with Nginx:

```bash
npm run build
```

Nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/mcp-client/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy MCP SSE server
    location /mcp/ {
        proxy_pass http://127.0.0.1:3100/;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;              # Required for SSE
        proxy_cache off;
        proxy_read_timeout 86400s;
    }
}
```

## Project Structure

```
mcp-client/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env.example
├── index.html
└── src/
    ├── main.tsx                    # React entry point
    ├── App.tsx                     # Root component — auto-connects MCP
    ├── config.ts                   # LLM provider configuration (7 providers)
    ├── index.css                   # Tailwind CSS imports
    ├── components/
    │   ├── ChatInterface.tsx       # Main chat UI + agent orchestration
    │   ├── ChatInput.tsx           # Message input with send button
    │   ├── ChatMessage.tsx         # Message bubble with markdown rendering
    │   ├── AgentStepPanel.tsx      # ReAct step trace display
    │   ├── ToolCallPanel.tsx       # Tool invocation details
    │   ├── ToolExplorer.tsx        # Side panel — browse MCP tools
    │   ├── ConnectionSettings.tsx  # MCP server connection config
    │   ├── LlmSettings.tsx         # LLM provider/model selector
    │   ├── WalletConnect.tsx       # Wallet connection + network selector
    │   ├── TransactionCard.tsx     # Inline sign & broadcast card
    │   ├── TransactionConfirmDialog.tsx
    │   ├── TransactionGraph.tsx    # Force-directed graph visualization
    │   ├── Neo4jGraphModal.tsx     # Full-screen graph modal
    │   ├── AddressInfoPanel.tsx    # Address details panel
    │   ├── RiskWarning.tsx         # Risk score warning display
    │   └── ui/                     # Shared UI primitives
    │       ├── Badge.tsx
    │       ├── Button.tsx
    │       ├── Card.tsx
    │       ├── Dialog.tsx
    │       └── Input.tsx
    ├── lib/
    │   ├── agent.ts               # ReAct agent loop
    │   ├── llm-service.ts         # Multi-provider LLM service
    │   ├── mcp-client.ts          # MCP SSE client wrapper
    │   ├── tron-wallet.ts         # TronLink / private key wallet
    │   └── utils.ts               # Helpers (truncateAddress, cn, etc.)
    └── store/
        └── index.ts               # Zustand stores (MCP, Chat, Agent, LLM, Wallet, UI)
```

## State Management

Six Zustand stores:

| Store | Purpose |
|-------|---------|
| `useMcpStore` | MCP connection state, available tools |
| `useChatStore` | Chat messages, pending tool calls |
| `useAgentStore` | Agent steps, running state |
| `useLlmStore` | Active provider, model, all provider configs |
| `useWalletStore` | Wallet mode, address, network, pending transactions |
| `useUiStore` | Theme, panel visibility |

## Usage Examples

1. **Check address balance**:
   > "What's the balance of TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t?"

2. **Analyze address risk**:
   > "Is address TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf safe to interact with?"

3. **Build a transfer**:
   > "Send 100 TRX to TAddr..."  _(auto-uses connected wallet as sender)_

4. **Explore transaction graph**:
   > "Show me the transaction network around address TXyz... with 2 hops"

5. **Inspect a contract**:
   > "What does the contract TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf do?"

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | React 19 |
| Build Tool | Vite 7 |
| Language | TypeScript ~5.9 |
| Styling | Tailwind CSS 4 |
| State | Zustand 5 |
| Graphs | react-force-graph-2d |
| Markdown | react-markdown + remark-gfm |
| Icons | Lucide React |
| Blockchain | TronWeb ^6.2.0 |
| MCP | @modelcontextprotocol/sdk ^1.26.0 |
| Data Fetching | @tanstack/react-query 5 |

## License

MIT
