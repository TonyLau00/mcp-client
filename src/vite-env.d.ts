/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MCP_SERVER_URL: string;
  readonly VITE_LLM_PROVIDER: "openai" | "claude" | "deepseek";
  readonly VITE_OPENAI_API_KEY: string;
  readonly VITE_CLAUDE_API_KEY: string;
  readonly VITE_DEEPSEEK_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
