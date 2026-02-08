/**
 * Application configuration from environment variables.
 */
export const config = {
  mcpServerUrl: import.meta.env.VITE_MCP_SERVER_URL || "http://localhost:3100",
  llmProvider: (import.meta.env.VITE_LLM_PROVIDER || "openai") as
    | "openai"
    | "claude"
    | "deepseek",
  openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY || "",
  claudeApiKey: import.meta.env.VITE_CLAUDE_API_KEY || "",
  deepseekApiKey: import.meta.env.VITE_DEEPSEEK_API_KEY || "",
};
