/**
 * Application state management using Zustand.
 */
import { create } from "zustand";
import type { McpTool, McpCallResult } from "@/lib/mcp-client";
import type { ChatMessage, ToolCall } from "@/lib/llm-service";
import type { AgentStep } from "@/lib/agent";
import { config, ALL_PROVIDERS, type LlmProvider, type ProviderConfig } from "@/config";

// ─── MCP Store ──────────────────────────────────────────────────

interface McpState {
  serverUrl: string;
  connected: boolean;
  connecting: boolean;
  tools: McpTool[];
  error: string | null;

  setServerUrl: (url: string) => void;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setTools: (tools: McpTool[]) => void;
  setError: (error: string | null) => void;
}

export const useMcpStore = create<McpState>((set) => ({
  serverUrl: "http://localhost:3100",
  connected: false,
  connecting: false,
  tools: [],
  error: null,

  setServerUrl: (url) => set({ serverUrl: url }),
  setConnected: (connected) => set({ connected }),
  setConnecting: (connecting) => set({ connecting }),
  setTools: (tools) => set({ tools }),
  setError: (error) => set({ error }),
}));

// ─── Chat Store ─────────────────────────────────────────────────

export interface ExtendedChatMessage extends ChatMessage {
  id: string;
  timestamp: number;
  pending?: boolean;
}

export interface PendingToolCall {
  id: string;
  tool: ToolCall;
  status: "pending" | "running" | "complete" | "error";
  result?: McpCallResult;
  error?: string;
}

interface ChatState {
  messages: ExtendedChatMessage[];
  pendingToolCalls: PendingToolCall[];
  isLoading: boolean;
  error: string | null;

  addMessage: (message: Omit<ExtendedChatMessage, "id" | "timestamp">) => string;
  updateMessage: (id: string, updates: Partial<ExtendedChatMessage>) => void;
  addToolCall: (toolCall: ToolCall) => void;
  updateToolCall: (id: string, updates: Partial<PendingToolCall>) => void;
  clearToolCalls: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  pendingToolCalls: [],
  isLoading: false,
  error: null,

  addMessage: (message) => {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const newMessage: ExtendedChatMessage = {
      ...message,
      id,
      timestamp: Date.now(),
    };
    set((state) => ({ messages: [...state.messages, newMessage] }));
    return id;
  },

  updateMessage: (id, updates) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    }));
  },

  addToolCall: (toolCall) => {
    set((state) => ({
      pendingToolCalls: [
        ...state.pendingToolCalls,
        { id: toolCall.id, tool: toolCall, status: "pending" },
      ],
    }));
  },

  updateToolCall: (id, updates) => {
    set((state) => ({
      pendingToolCalls: state.pendingToolCalls.map((tc) =>
        tc.id === id ? { ...tc, ...updates } : tc
      ),
    }));
  },

  clearToolCalls: () => {
    set({ pendingToolCalls: [] });
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearMessages: () => set({ messages: [], pendingToolCalls: [], error: null }),
}));

// ─── Agent Store ────────────────────────────────────────────────

interface AgentState {
  /** Whether the agent is currently running */
  running: boolean;
  /** Current agent steps (for the latest run) */
  steps: AgentStep[];
  /** Total iterations in current run */
  iterations: number;
  /** AbortController for cancelling the current run */
  abortController: AbortController | null;

  setRunning: (running: boolean) => void;
  addStep: (step: AgentStep) => void;
  updateStep: (step: AgentStep) => void;
  setIterations: (iterations: number) => void;
  setAbortController: (controller: AbortController | null) => void;
  clearSteps: () => void;
  cancelRun: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  running: false,
  steps: [],
  iterations: 0,
  abortController: null,

  setRunning: (running) => set({ running }),

  addStep: (step) => {
    set((state) => ({ steps: [...state.steps, step] }));
  },

  updateStep: (step) => {
    set((state) => ({
      steps: state.steps.map((s) => (s.id === step.id ? step : s)),
    }));
  },

  setIterations: (iterations) => set({ iterations }),

  setAbortController: (abortController) => set({ abortController }),

  clearSteps: () => set({ steps: [], iterations: 0 }),

  cancelRun: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ running: false, abortController: null });
    }
  },
}));

// ─── LLM Store ──────────────────────────────────────────────────

interface LlmState {
  /** Currently active provider key */
  activeProvider: LlmProvider;
  /** Runtime overrides for provider configs (persisted in localStorage) */
  providerOverrides: Partial<Record<LlmProvider, Partial<ProviderConfig>>>;

  /** Switch the active provider */
  setActiveProvider: (provider: LlmProvider) => void;
  /** Update a provider's config at runtime (apiKey, baseUrl, model) */
  updateProvider: (provider: LlmProvider, updates: Partial<ProviderConfig>) => void;
  /** Get the effective config for a provider (env defaults + runtime overrides) */
  getProviderConfig: (provider: LlmProvider) => ProviderConfig;
  /** Get all available providers */
  getAllProviders: () => LlmProvider[];
}

/** Load persisted overrides from localStorage */
function loadPersistedOverrides(): Partial<Record<LlmProvider, Partial<ProviderConfig>>> {
  try {
    const stored = localStorage.getItem("llm-provider-overrides");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/** Load persisted active provider from localStorage */
function loadPersistedProvider(): LlmProvider {
  try {
    const stored = localStorage.getItem("llm-active-provider");
    if (stored && ALL_PROVIDERS.includes(stored as LlmProvider)) {
      return stored as LlmProvider;
    }
  } catch { /* ignore */ }
  return config.llmProvider;
}

export const useLlmStore = create<LlmState>((set, get) => ({
  activeProvider: loadPersistedProvider(),
  providerOverrides: loadPersistedOverrides(),

  setActiveProvider: (provider) => {
    // Also update the global config so llm-service picks it up
    config.llmProvider = provider;
    localStorage.setItem("llm-active-provider", provider);
    set({ activeProvider: provider });
  },

  updateProvider: (provider, updates) => {
    set((state) => {
      const newOverrides = {
        ...state.providerOverrides,
        [provider]: { ...state.providerOverrides[provider], ...updates },
      };
      // Persist to localStorage
      localStorage.setItem("llm-provider-overrides", JSON.stringify(newOverrides));
      // Apply overrides to global config
      const base = config.providers[provider];
      const merged = { ...base, ...newOverrides[provider] };
      config.providers[provider] = merged as ProviderConfig;
      return { providerOverrides: newOverrides };
    });
  },

  getProviderConfig: (provider) => {
    const base = config.providers[provider];
    const overrides = get().providerOverrides[provider] || {};
    return { ...base, ...overrides } as ProviderConfig;
  },

  getAllProviders: () => ALL_PROVIDERS,
}));

// Apply persisted overrides to global config on load
(function applyPersistedOverrides() {
  const overrides = loadPersistedOverrides();
  for (const key of ALL_PROVIDERS) {
    if (overrides[key]) {
      config.providers[key] = { ...config.providers[key], ...overrides[key] } as ProviderConfig;
    }
  }
  config.llmProvider = loadPersistedProvider();
})();

// ─── UI Store ───────────────────────────────────────────────────

interface TransactionConfirmation {
  id: string;
  type: "TRX" | "TRC20";
  from: string;
  to: string;
  amount: string;
  tokenAddress?: string;
  rawTransaction: unknown;
}

interface UiState {
  theme: "light" | "dark";
  sidebarOpen: boolean;
  transactionConfirmation: TransactionConfirmation | null;

  setTheme: (theme: "light" | "dark") => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  showTransactionConfirmation: (tx: TransactionConfirmation) => void;
  hideTransactionConfirmation: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: "dark",
  sidebarOpen: true,
  transactionConfirmation: null,

  setTheme: (theme) => {
    set({ theme });
    document.documentElement.classList.toggle("dark", theme === "dark");
  },
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  showTransactionConfirmation: (tx) => set({ transactionConfirmation: tx }),
  hideTransactionConfirmation: () => set({ transactionConfirmation: null }),
}));

// Initialize theme
if (typeof window !== "undefined") {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", prefersDark);
}
