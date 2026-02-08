/**
 * LLM Service - Handles AI interactions with tool calling.
 *
 * Supports: OpenAI, Claude, DeepSeek
 */
import { config } from "@/config";
import type { McpTool, McpCallResult } from "./mcp-client";

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCall?: {
    name: string;
    arguments: Record<string, unknown>;
  };
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

/**
 * Convert MCP tools to OpenAI function format.
 */
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

/**
 * Convert MCP tools to Claude tool format.
 */
function mcpToolsToClaudeTools(tools: McpTool[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

/**
 * System prompt for the TRON assistant.
 */
const SYSTEM_PROMPT = `You are a TRON blockchain assistant with access to specialized tools for querying blockchain data.

Available capabilities:
- Query account information (TRX balance, energy, bandwidth, TRC20 tokens)
- Check transaction status and details
- Get network parameters (energy price, bandwidth price)
- Analyze address security and risk scores
- Build unsigned transfer transactions (user must sign locally)
- Analyze address transaction graphs
- Perform fund flow analysis

Guidelines:
1. Always use the appropriate tools to get accurate blockchain data - never make up data.
2. When building transactions, ALWAYS remind users that they need to review and sign transactions locally.
3. For risk analysis, clearly explain the risk factors and severity levels.
4. Present numerical data clearly (format TRX amounts, use appropriate units).
5. If a tool returns an error, explain it to the user and suggest alternatives.

Remember: You cannot sign or broadcast transactions. You can only build unsigned transactions for users to review.`;

/**
 * Call OpenAI API with tool support.
 */
async function callOpenAI(
  messages: ChatMessage[],
  tools: McpTool[]
): Promise<LlmResponse> {
  const apiKey = config.openaiApiKey;
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const formattedMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map((m) => ({
      role: m.role === "tool" ? "tool" : m.role,
      content: m.content,
      ...(m.toolCall && { tool_call_id: m.toolCall.name }),
    })),
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4-turbo-preview",
      messages: formattedMessages,
      tools: mcpToolsToOpenAiFunctions(tools),
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const choice = data.choices[0];
  const message = choice.message;

  const result: LlmResponse = {
    content: message.content || "",
  };

  if (message.tool_calls?.length > 0) {
    result.toolCalls = message.tool_calls.map(
      (tc: { id: string; function: { name: string; arguments: string } }) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })
    );
  }

  return result;
}

/**
 * Call Claude API with tool support.
 */
async function callClaude(
  messages: ChatMessage[],
  tools: McpTool[]
): Promise<LlmResponse> {
  const apiKey = config.claudeApiKey;
  if (!apiKey) {
    throw new Error("Claude API key not configured");
  }

  const formattedMessages = messages.map((m) => ({
    role: m.role === "system" ? "user" : m.role === "tool" ? "user" : m.role,
    content:
      m.role === "tool"
        ? `Tool result for ${m.toolCall?.name}:\n${m.content}`
        : m.content,
  }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2024-01-01",
    },
    body: JSON.stringify({
      model: "claude-3-opus-20240229",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: formattedMessages,
      tools: mcpToolsToClaudeTools(tools),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${error}`);
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

/**
 * Call DeepSeek API with tool support.
 */
async function callDeepSeek(
  messages: ChatMessage[],
  tools: McpTool[]
): Promise<LlmResponse> {
  const apiKey = config.deepseekApiKey;
  if (!apiKey) {
    throw new Error("DeepSeek API key not configured");
  }

  const formattedMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map((m) => ({
      role: m.role === "tool" ? "tool" : m.role,
      content: m.content,
    })),
  ];

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: formattedMessages,
      tools: mcpToolsToOpenAiFunctions(tools),
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${error}`);
  }

  const data = await response.json();
  const choice = data.choices[0];
  const message = choice.message;

  const result: LlmResponse = {
    content: message.content || "",
  };

  if (message.tool_calls?.length > 0) {
    result.toolCalls = message.tool_calls.map(
      (tc: { id: string; function: { name: string; arguments: string } }) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })
    );
  }

  return result;
}

/**
 * Call the configured LLM provider.
 */
export async function callLlm(
  messages: ChatMessage[],
  tools: McpTool[]
): Promise<LlmResponse> {
  switch (config.llmProvider) {
    case "openai":
      return callOpenAI(messages, tools);
    case "claude":
      return callClaude(messages, tools);
    case "deepseek":
      return callDeepSeek(messages, tools);
    default:
      throw new Error(`Unknown LLM provider: ${config.llmProvider}`);
  }
}
