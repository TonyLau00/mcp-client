/**
 * Application state management using Zustand.
 */
import { create } from "zustand";
import type { McpTool, McpCallResult } from "@/lib/mcp-client";
import type { ChatMessage, ToolCall } from "@/lib/llm-service";

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

export const useChatStore = create<ChatState>((set, get) => ({
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
