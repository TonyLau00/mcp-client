/**
 * React Agent — ReAct (Reasoning + Acting) loop for the TRON assistant.
 *
 * The agent repeatedly calls the LLM, executes any tool calls, feeds results
 * back, and continues until the LLM produces a final text response with no
 * further tool calls.  A configurable maxIterations cap prevents run-away loops.
 *
 * Architecture:
 *   User message → LLM → [tool_calls?] → execute tools → LLM → ... → final answer
 *
 * All intermediate steps (thoughts, tool invocations, observations) are emitted
 * via an `onStep` callback so the UI can render them in real-time.
 */
import { callLlm, type ChatMessage, type LlmResponse, type ToolCall, type WalletContext } from "./llm-service";
import type { McpTool, McpCallResult } from "./mcp-client";

// ─── Types ──────────────────────────────────────────────────────

export type AgentStepType = "thinking" | "tool_call" | "tool_result" | "answer" | "error";

export interface AgentStep {
  id: string;
  type: AgentStepType;
  /** For thinking / answer / error */
  content?: string;
  /** For tool_call */
  toolCall?: ToolCall;
  /** For tool_result */
  toolResult?: McpCallResult;
  toolName?: string;
  /** Timing */
  startedAt: number;
  completedAt?: number;
  /** Iteration index (0-based) */
  iteration: number;
}

export interface AgentRunResult {
  /** The final text answer from the LLM */
  answer: string;
  /** All steps taken during the run */
  steps: AgentStep[];
  /** Total iterations of the ReAct loop */
  iterations: number;
  /** Total run time in ms */
  durationMs: number;
}

export interface AgentRunOptions {
  /** Maximum ReAct loop iterations (default: 10) */
  maxIterations?: number;
  /** Callback fired for each step (for streaming UI updates) */
  onStep?: (step: AgentStep) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Function to call a tool via MCP client */
  callTool: (name: string, args: Record<string, unknown>) => Promise<McpCallResult>;
  /** Wallet context for system prompt injection */
  walletContext?: WalletContext;
}

// ─── Helpers ────────────────────────────────────────────────────

let stepCounter = 0;
function makeStepId(): string {
  return `step_${Date.now()}_${++stepCounter}`;
}

/**
 * Format tool results into a message the LLM can understand.
 * Uses structured format so the LLM can correlate results with specific tool calls.
 */
function formatToolResults(
  _toolCalls: ToolCall[],
  results: { name: string; result: McpCallResult; error?: string }[],
): string {
  return results
    .map((r) => {
      if (r.error) {
        return `[Tool "${r.name}" ERROR]\n${r.error}`;
      }
      const text = r.result.content.map((c) => c.text).join("\n");
      return `[Tool "${r.name}" result]\n${text}`;
    })
    .join("\n\n");
}

// ─── Agent Core ─────────────────────────────────────────────────

/**
 * Run the ReAct agent loop.
 *
 * @param userMessage  The user's input message
 * @param history      Previous conversation history
 * @param tools        Available MCP tools
 * @param options      Execution options (callTool, onStep, etc.)
 */
export async function runAgent(
  userMessage: string,
  history: ChatMessage[],
  tools: McpTool[],
  options: AgentRunOptions,
): Promise<AgentRunResult> {
  const {
    maxIterations = 10,
    onStep,
    signal,
    callTool,
    walletContext,
  } = options;

  const steps: AgentStep[] = [];
  const startTime = Date.now();
  let iteration = 0;

  // Build the running conversation for the LLM.
  // We start with the existing history + the new user message.
  const conversation: ChatMessage[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  while (iteration < maxIterations) {
    // ── Check cancellation ──
    if (signal?.aborted) {
      const errorStep: AgentStep = {
        id: makeStepId(),
        type: "error",
        content: "Agent run was cancelled.",
        startedAt: Date.now(),
        completedAt: Date.now(),
        iteration,
      };
      steps.push(errorStep);
      onStep?.(errorStep);
      break;
    }

    // ── Step 1: Call LLM ──
    const thinkingStep: AgentStep = {
      id: makeStepId(),
      type: "thinking",
      content: iteration === 0 ? "Analyzing your request..." : "Processing tool results...",
      startedAt: Date.now(),
      iteration,
    };
    steps.push(thinkingStep);
    onStep?.(thinkingStep);

    let llmResponse: LlmResponse;
    try {
      llmResponse = await callLlm(conversation, tools, walletContext);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errorStep: AgentStep = {
        id: makeStepId(),
        type: "error",
        content: `LLM call failed: ${errMsg}`,
        startedAt: Date.now(),
        completedAt: Date.now(),
        iteration,
      };
      steps.push(errorStep);
      onStep?.(errorStep);

      // Update thinking step completion
      thinkingStep.completedAt = Date.now();
      onStep?.(thinkingStep);

      return {
        answer: `Sorry, I encountered an error: ${errMsg}`,
        steps,
        iterations: iteration + 1,
        durationMs: Date.now() - startTime,
      };
    }

    // Update thinking step
    thinkingStep.completedAt = Date.now();
    thinkingStep.content = llmResponse.content || (llmResponse.toolCalls?.length ? "Deciding which tools to use..." : "Done thinking.");
    onStep?.(thinkingStep);

    // ── Step 2: Check if LLM wants to call tools ──
    if (!llmResponse.toolCalls || llmResponse.toolCalls.length === 0) {
      // No tool calls → this is the final answer
      const answerStep: AgentStep = {
        id: makeStepId(),
        type: "answer",
        content: llmResponse.content,
        startedAt: Date.now(),
        completedAt: Date.now(),
        iteration,
      };
      steps.push(answerStep);
      onStep?.(answerStep);

      return {
        answer: llmResponse.content,
        steps,
        iterations: iteration + 1,
        durationMs: Date.now() - startTime,
      };
    }

    // ── Step 3: Execute tool calls ──
    // Add assistant's partial response (with tool call intent) to conversation
    if (llmResponse.content) {
      conversation.push({ role: "assistant", content: llmResponse.content });
    }

    const toolResults: { id: string; name: string; result: McpCallResult; error?: string }[] = [];

    for (const tc of llmResponse.toolCalls) {
      // Emit tool_call step
      const toolCallStep: AgentStep = {
        id: makeStepId(),
        type: "tool_call",
        toolCall: tc,
        startedAt: Date.now(),
        iteration,
      };
      steps.push(toolCallStep);
      onStep?.(toolCallStep);

      // Execute the tool
      try {
        const result = await callTool(tc.name, tc.arguments);
        toolCallStep.completedAt = Date.now();
        onStep?.(toolCallStep);

        // Emit tool_result step
        const toolResultStep: AgentStep = {
          id: makeStepId(),
          type: "tool_result",
          toolName: tc.name,
          toolResult: result,
          startedAt: toolCallStep.completedAt,
          completedAt: Date.now(),
          iteration,
        };
        steps.push(toolResultStep);
        onStep?.(toolResultStep);

        toolResults.push({ id: tc.id, name: tc.name, result });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        toolCallStep.completedAt = Date.now();
        onStep?.(toolCallStep);

        const errorResult: McpCallResult = {
          content: [{ type: "text", text: errMsg }],
          isError: true,
        };

        const toolResultStep: AgentStep = {
          id: makeStepId(),
          type: "tool_result",
          toolName: tc.name,
          toolResult: errorResult,
          startedAt: toolCallStep.completedAt!,
          completedAt: Date.now(),
          iteration,
        };
        steps.push(toolResultStep);
        onStep?.(toolResultStep);

        toolResults.push({ id: tc.id, name: tc.name, result: errorResult, error: errMsg });
      }
    }

    // ── Step 4: Feed tool results back to conversation ──
    // Push assistant message with toolCalls (required by OpenAI-compatible APIs)
    conversation.push({
      role: "assistant",
      content: llmResponse.content || "",
      toolCalls: llmResponse.toolCalls,
    });
    // Push one tool result message per tool call (each with toolCallId)
    for (const tr of toolResults) {
      const tc = llmResponse.toolCalls!.find((t) => t.name === tr.name && t.id === tr.id);
      conversation.push({
        role: "tool",
        content: tr.error
          ? `Error: ${tr.error}`
          : tr.result.content.map((c) => c.text).join("\n"),
        toolCallId: tc?.id || tr.id,
        toolName: tr.name,
      });
    }

    iteration++;
  }

  // Max iterations reached
  if (iteration >= maxIterations) {
    const maxIterStep: AgentStep = {
      id: makeStepId(),
      type: "error",
      content: `Reached maximum iterations (${maxIterations}). Providing best answer so far.`,
      startedAt: Date.now(),
      completedAt: Date.now(),
      iteration,
    };
    steps.push(maxIterStep);
    onStep?.(maxIterStep);

    // One more LLM call to summarize
    try {
      conversation.push({
        role: "user",
        content: "Please summarize the information gathered so far and provide a final answer.",
      });
      const finalResponse = await callLlm(conversation, tools);
      return {
        answer: finalResponse.content || "I ran out of iterations. Here's what I found so far.",
        steps,
        iterations: iteration,
        durationMs: Date.now() - startTime,
      };
    } catch {
      return {
        answer: "I reached the maximum number of reasoning steps. Please try again with a simpler query.",
        steps,
        iterations: iteration,
        durationMs: Date.now() - startTime,
      };
    }
  }

  return {
    answer: "Agent loop ended unexpectedly.",
    steps,
    iterations: iteration,
    durationMs: Date.now() - startTime,
  };
}
