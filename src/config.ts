/**
 * Application configuration from environment variables.
 *
 * Supports multiple LLM providers with configurable base URLs, models, and API keys.
 * Provider can be switched at runtime via the LLM settings store.
 */

export type LlmProvider =
  | "openai"
  | "claude"
  | "deepseek"
  | "gemini"
  | "ollama"
  | "openrouter"
  | "custom";

export interface ProviderConfig {
  /** Display name for UI */
  label: string;
  /** API key (empty string = not configured / not required) */
  apiKey: string;
  /** Base URL for the API */
  baseUrl: string;
  /** Model identifier */
  model: string;
  /** Whether the provider requires an API key */
  requiresKey: boolean;
  /** API format: openai-compatible | claude | gemini */
  apiFormat: "openai" | "claude" | "gemini";
}

export interface AppConfig {
  mcpServerUrl: string;
  llmProvider: LlmProvider;
  providers: Record<LlmProvider, ProviderConfig>;
}

export const config: AppConfig = {
  mcpServerUrl: import.meta.env.VITE_MCP_SERVER_URL || "http://localhost:3100",

  llmProvider: (import.meta.env.VITE_LLM_PROVIDER || "deepseek") as LlmProvider,

  providers: {
    openai: {
      label: "OpenAI",
      apiKey: import.meta.env.VITE_OPENAI_API_KEY || "",
      baseUrl: import.meta.env.VITE_OPENAI_BASE_URL || "https://api.openai.com/v1",
      model: import.meta.env.VITE_OPENAI_MODEL || "gpt-4o",
      requiresKey: true,
      apiFormat: "openai",
    },
    claude: {
      label: "Anthropic Claude",
      apiKey: import.meta.env.VITE_CLAUDE_API_KEY || "",
      baseUrl: import.meta.env.VITE_CLAUDE_BASE_URL || "https://api.anthropic.com",
      model: import.meta.env.VITE_CLAUDE_MODEL || "claude-sonnet-4-20250514",
      requiresKey: true,
      apiFormat: "claude",
    },
    deepseek: {
      label: "DeepSeek",
      apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY || "",
      baseUrl: import.meta.env.VITE_DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      model: import.meta.env.VITE_DEEPSEEK_MODEL || "deepseek-chat",
      requiresKey: true,
      apiFormat: "openai",
    },
    gemini: {
      label: "Google Gemini",
      apiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
      baseUrl: import.meta.env.VITE_GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta",
      model: import.meta.env.VITE_GEMINI_MODEL || "gemini-2.0-flash",
      requiresKey: true,
      apiFormat: "gemini",
    },
    ollama: {
      label: "Ollama (Local)",
      apiKey: "",
      baseUrl: import.meta.env.VITE_OLLAMA_BASE_URL || "http://localhost:11434",
      model: import.meta.env.VITE_OLLAMA_MODEL || "qwen2.5:14b",
      requiresKey: false,
      apiFormat: "openai",
    },
    openrouter: {
      label: "OpenRouter",
      apiKey: import.meta.env.VITE_OPENROUTER_API_KEY || "",
      baseUrl: import.meta.env.VITE_OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      model: import.meta.env.VITE_OPENROUTER_MODEL || "anthropic/claude-sonnet-4",
      requiresKey: true,
      apiFormat: "openai",
    },
    custom: {
      label: "Custom (OpenAI-Compatible)",
      apiKey: import.meta.env.VITE_CUSTOM_API_KEY || "",
      baseUrl: import.meta.env.VITE_CUSTOM_BASE_URL || "http://localhost:8000/v1",
      model: import.meta.env.VITE_CUSTOM_MODEL || "default",
      requiresKey: false,
      apiFormat: "openai",
    },
  },
};

/** Helper: get the active provider config (respects runtime override) */
export function getActiveProvider(): ProviderConfig {
  return config.providers[config.llmProvider];
}

/** All provider keys for iteration */
export const ALL_PROVIDERS: LlmProvider[] = [
  "openai",
  "claude",
  "deepseek",
  "gemini",
  "ollama",
  "openrouter",
  "custom",
];

