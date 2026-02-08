/**
 * LLM Service - Handles AI interactions with tool calling.
 *
 * Supports: OpenAI, Claude, DeepSeek, Gemini, Ollama, OpenRouter, Custom (OpenAI-compatible)
 *
 * Provider routing:
 *   - openai, deepseek, ollama, openrouter, custom → OpenAI chat/completions format
 *   - claude → Anthropic messages format
 *   - gemini → Google Generative Language API format
 */
import { config, getActiveProvider, type ProviderConfig, type LlmProvider } from "@/config";
import type { McpTool, McpCallResult } from "./mcp-client";

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  /** Tool calls requested by the assistant (on assistant messages) */
  toolCalls?: ToolCall[];
  /** The tool_call_id this message is responding to (on tool messages) */
  toolCallId?: string;
  /** Tool name for this tool result (on tool messages) */
  toolName?: string;
  toolResult?: McpCallResult;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmResponse {
  content: string;
  toolCalls?: ToolCall[];
}

// ─── Tool Schema Converters ─────────────────────────────────────

/** OpenAI / DeepSeek / Ollama / OpenRouter / Custom compatible format */
function mcpToolsToOpenAiFunctions(tools: McpTool[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

/** Anthropic Claude format */
function mcpToolsToClaudeTools(tools: McpTool[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

/** Google Gemini format */
function mcpToolsToGeminiTools(tools: McpTool[]) {
  return [
    {
      function_declarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      })),
    },
  ];
}

// ─── System Prompt ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a TRON blockchain assistant agent with access to specialized tools for querying blockchain data.

## Agent Behaviour
You follow the ReAct (Reasoning + Acting) pattern:
1. **Think** about the user's question and decide what information you need.
2. **Act** by calling one or more tools to gather data.
3. **Observe** the tool results and decide if you have enough information.
4. **Repeat** steps 1-3 if more data is needed.
5. **Answer** when you have sufficient information.

## Tool Usage Guidelines
- You can call MULTIPLE tools in a single turn if the data is independent.
- If a tool returns an error, try an alternative approach or explain the limitation.
- When building transactions, ALWAYS remind users to review and sign locally.
- For risk analysis, clearly explain risk factors and severity levels.
- Present numerical data clearly (format TRX amounts, use appropriate units).
- Use get_transaction_raw_data for detailed MongoDB data (internal txs, contract input data).
- Use get_transaction_status for quick TronGrid API lookups.

## Available Capabilities
- Query account info (TRX balance, energy, bandwidth, TRC20 tokens)
- Check transaction status and full raw data (including internal transactions)
- Get network parameters (energy/bandwidth prices)
- Analyze address security and risk scores
- Build unsigned transfer transactions (user must sign locally)
- Analyze address transaction graphs and fund flows
- Query contract callers, methods, and interactions

Remember: You CANNOT sign or broadcast transactions. Only build unsigned transactions for user review.`;

// ─── OpenAI-Compatible Provider ─────────────────────────────────
// Works for: openai, deepseek, ollama, openrouter, custom

async function callOpenAICompatible(
  messages: ChatMessage[],
  tools: McpTool[],
  provider: ProviderConfig,
  providerKey: LlmProvider,
): Promise<LlmResponse> {
  if (provider.requiresKey && !provider.apiKey) {
    throw new Error(`${provider.label} API key not configured`);
  }

  // Format messages for OpenAI-compatible API
  const formattedMessages: Record<string, unknown>[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];
  for (const m of messages) {
    if (m.role === "assistant" && m.toolCalls?.length) {
      // Assistant message that requested tool calls
      formattedMessages.push({
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      });
    } else if (m.role === "tool") {
      // Tool result message — must have tool_call_id
      formattedMessages.push({
        role: "tool",
        content: m.content,
        tool_call_id: m.toolCallId || "",
      });
    } else {
      formattedMessages.push({
        role: m.role,
        content: m.content,
      });
    }
  }

  // Build URL: some providers use /v1/chat/completions, Ollama uses /api/chat
  let url: string;
  if (providerKey === "ollama") {
    url = `${provider.baseUrl}/api/chat`;
  } else {
    // Ensure baseUrl ends with /v1 then append /chat/completions
    const base = provider.baseUrl.replace(/\/+$/, "");
    url = base.endsWith("/v1")
      ? `${base}/chat/completions`
      : `${base}/v1/chat/completions`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (provider.apiKey) {
    headers["Authorization"] = `Bearer ${provider.apiKey}`;
  }
  // OpenRouter requires extra headers
  if (providerKey === "openrouter") {
    headers["HTTP-Referer"] = window.location.origin;
    headers["X-Title"] = "TRON MCP Agent";
  }

  // Build body — Ollama uses slightly different payload
  const body: Record<string, unknown> = {
    model: provider.model,
    messages: formattedMessages,
  };
  if (tools.length > 0) {
    if (providerKey === "ollama") {
      body.tools = mcpToolsToOpenAiFunctions(tools);
    } else {
      body.tools = mcpToolsToOpenAiFunctions(tools);
      body.tool_choice = "auto";
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${provider.label} API error (${response.status}): ${error}`);
  }

  const data = await response.json();

  // Ollama returns slightly different structure
  if (providerKey === "ollama") {
    return parseOllamaResponse(data);
  }

  return parseOpenAIResponse(data);
}

function parseOpenAIResponse(data: Record<string, unknown>): LlmResponse {
  const choices = data.choices as Array<{
    message: {
      content: string | null;
      tool_calls?: Array<{
        id: string;
        function: { name: string; arguments: string };
      }>;
    };
  }>;
  const message = choices[0].message;

  const result: LlmResponse = {
    content: message.content || "",
  };

  if (message.tool_calls?.length) {
    result.toolCalls = message.tool_calls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));
  }

  return result;
}

function parseOllamaResponse(data: Record<string, unknown>): LlmResponse {
  const message = data.message as {
    content: string;
    tool_calls?: Array<{
      function: { name: string; arguments: Record<string, unknown> };
    }>;
  };

  const result: LlmResponse = {
    content: message.content || "",
  };

  if (message.tool_calls?.length) {
    result.toolCalls = message.tool_calls.map((tc, i) => ({
      id: `ollama_tc_${Date.now()}_${i}`,
      name: tc.function.name,
      arguments:
        typeof tc.function.arguments === "string"
          ? JSON.parse(tc.function.arguments)
          : tc.function.arguments,
    }));
  }

  return result;
}

// ─── Anthropic Claude ───────────────────────────────────────────

async function callClaude(
  messages: ChatMessage[],
  tools: McpTool[],
  provider: ProviderConfig,
): Promise<LlmResponse> {
  if (!provider.apiKey) {
    throw new Error("Claude API key not configured");
  }

  const formattedMessages: Array<{ role: string; content: unknown }> = [];
  for (const m of messages) {
    if (m.role === "system") continue; // system is passed separately
    if (m.role === "assistant" && m.toolCalls?.length) {
      // Assistant with tool_use blocks
      const content: unknown[] = [];
      if (m.content) content.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls) {
        content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments });
      }
      formattedMessages.push({ role: "assistant", content });
    } else if (m.role === "tool") {
      // Tool result block
      formattedMessages.push({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: m.toolCallId || "",
          content: m.content,
        }],
      });
    } else {
      formattedMessages.push({ role: m.role, content: m.content });
    }
  }

  const baseUrl = provider.baseUrl.replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2024-01-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: formattedMessages,
      ...(tools.length > 0 && { tools: mcpToolsToClaudeTools(tools) }),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const result: LlmResponse = { content: "" };

  for (const block of data.content) {
    if (block.type === "text") {
      result.content += block.text;
    } else if (block.type === "tool_use") {
      if (!result.toolCalls) result.toolCalls = [];
      result.toolCalls.push({
        id: block.id,
        name: block.name,
        arguments: block.input,
      });
    }
  }

  return result;
}

// ─── Google Gemini ──────────────────────────────────────────────

async function callGemini(
  messages: ChatMessage[],
  tools: McpTool[],
  provider: ProviderConfig,
): Promise<LlmResponse> {
  if (!provider.apiKey) {
    throw new Error("Gemini API key not configured");
  }

  // Convert chat messages to Gemini format
  const contents: Array<{ role: string; parts: unknown[] }> = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "assistant" && m.toolCalls?.length) {
      const parts: unknown[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.toolCalls) {
        parts.push({ functionCall: { name: tc.name, args: tc.arguments } });
      }
      contents.push({ role: "model", parts });
    } else if (m.role === "tool") {
      contents.push({
        role: "function",
        parts: [{ functionResponse: { name: m.toolName || "", response: { content: m.content } } }],
      });
    } else {
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    }
  }

  const baseUrl = provider.baseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/models/${provider.model}:generateContent?key=${provider.apiKey}`;

  const body: Record<string, unknown> = {
    contents,
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
  };
  if (tools.length > 0) {
    body.tools = mcpToolsToGeminiTools(tools);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const result: LlmResponse = { content: "" };

  const candidate = data.candidates?.[0];
  if (!candidate) return result;

  for (const part of candidate.content?.parts || []) {
    if (part.text) {
      result.content += part.text;
    } else if (part.functionCall) {
      if (!result.toolCalls) result.toolCalls = [];
      result.toolCalls.push({
        id: `gemini_tc_${Date.now()}_${result.toolCalls.length}`,
        name: part.functionCall.name,
        arguments: part.functionCall.args || {},
      });
    }
  }

  return result;
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Call the configured LLM provider.
 * The active provider is read from config.llmProvider (can be changed at runtime).
 */
export async function callLlm(
  messages: ChatMessage[],
  tools: McpTool[],
): Promise<LlmResponse> {
  const providerKey = config.llmProvider;
  const provider = getActiveProvider();

  switch (provider.apiFormat) {
    case "openai":
      return callOpenAICompatible(messages, tools, provider, providerKey);
    case "claude":
      return callClaude(messages, tools, provider);
    case "gemini":
      return callGemini(messages, tools, provider);
    default:
      throw new Error(`Unknown API format: ${provider.apiFormat}`);
  }
}

