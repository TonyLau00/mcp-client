# TRON MCP Client

A React-based frontend for interacting with the TRON blockchain through the MCP (Model Context Protocol) server.

## Features

- **AI Chat Interface**: Natural language interactions with LLM (OpenAI/Claude/DeepSeek)
- **MCP Tool Integration**: Automatic tool discovery and invocation
- **Transaction Graph Visualization**: Interactive force-directed graph using react-force-graph-2d
- **Address Info Panel**: Balance, energy, bandwidth, TRC20 tokens
- **Risk Warning System**: Visual alerts for suspicious addresses
- **Transaction Builder**: Create unsigned transactions with confirmation dialog

## Prerequisites

- Node.js 20.19+ or 22.12+
- Running `tron-mcp-server` (default: http://localhost:3100)
- LLM API key (OpenAI, Claude, or DeepSeek)

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your LLM API key:
   ```env
   VITE_MCP_SERVER_URL=http://localhost:3100
   VITE_LLM_PROVIDER=openai  # or claude, deepseek
   VITE_OPENAI_API_KEY=sk-your-api-key
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```
   
   Open http://localhost:5173

## Architecture

```
src/
├── components/           # React components
│   ├── ui/              # Reusable UI components (Button, Card, Dialog, etc.)
│   ├── ChatInterface.tsx    # Main chat UI
│   ├── ConnectionSettings.tsx # MCP server config
│   ├── ToolCallPanel.tsx    # Tool execution visualization
│   ├── TransactionGraph.tsx # Force-directed graph
│   ├── AddressInfoPanel.tsx # Address details display
│   └── RiskWarning.tsx      # Risk alert banner
├── lib/
│   ├── mcp-client.ts    # MCP SSE client
│   ├── llm-service.ts   # LLM API integration
│   └── utils.ts         # Utility functions
├── store/
│   └── index.ts         # Zustand state management
├── config.ts            # Environment configuration
└── App.tsx              # Root component
```

## Available MCP Tools

The client auto-discovers tools from the MCP server:

| Tool | Description |
|------|-------------|
| `get_account_info` | Query TRX balance, bandwidth, energy, TRC20 tokens |
| `get_transaction_status` | Check transaction confirmation status |
| `get_network_parameters` | Get energy/bandwidth prices, block info |
| `check_address_security` | Analyze address risk with tags |
| `build_unsigned_transfer` | Create unsigned TRX/TRC20 transfer |
| `analyze_address_graph` | Get transaction network graph |
| `get_address_risk_score` | Compute risk score from graph analysis |
| `get_address_flow_analysis` | Analyze fund flow patterns |

## Scripts

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

## Tech Stack

- **React 19** + TypeScript
- **Vite 7** - Build tool
- **Tailwind CSS 4** - Styling
- **Zustand** - State management
- **react-force-graph-2d** - Graph visualization
- **@modelcontextprotocol/sdk** - MCP client
- **Lucide React** - Icons

## Usage Examples

1. **Check address balance**:
   > "What's the balance of TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t?"

2. **Analyze address risk**:
   > "Is address TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf safe to interact with?"

3. **Build a transfer**:
   > "Build a transaction to send 100 TRX from TAddr1... to TAddr2..."

4. **Explore transaction graph**:
   > "Show me the transaction network around address TXyz... with 2 hops"

## Security Notes

- **Never share private keys** - This app only builds unsigned transactions
- **Review transactions** - Always verify transaction details before signing
- **Risk warnings** - Pay attention to flagged addresses
- **Local signing** - Sign transactions using TronLink or TronWeb locally
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
