/**
 * Main chat interface component — powered by the ReAct Agent loop.
 */
import { useCallback, useRef, useEffect } from "react";
import { useMcpStore, useChatStore, useUiStore, useAgentStore, useLlmStore } from "@/store";
import { getMcpClient } from "@/lib/mcp-client";
import { runAgent } from "@/lib/agent";
import type { ChatMessage as LlmChatMessage } from "@/lib/llm-service";
import { ChatMessage } from "./ChatMessage";
import { ChatInput, type ChatInputHandle } from "./ChatInput";
import { AgentStepPanel } from "./AgentStepPanel";
import { ToolExplorer } from "./ToolExplorer";
import { Card, CardContent, Badge } from "@/components/ui";
import { Bot, MessageSquare, Brain } from "lucide-react";

export function ChatInterface() {
  const { connected, serverUrl, tools } = useMcpStore();
  const {
    messages,
    isLoading,
    error,
    addMessage,
    updateMessage,
    setLoading,
    setError,
  } = useChatStore();
  const { showTransactionConfirmation } = useUiStore();
  const {
    steps: agentSteps,
    addStep,
    updateStep,
    clearSteps,
    setRunning,
    setIterations,
    setAbortController,
  } = useAgentStore();
  const { activeProvider, getProviderConfig } = useLlmStore();
  const activeProviderConfig = getProviderConfig(activeProvider);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);

  // Scroll to bottom when messages or agent steps change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentSteps]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!connected || tools.length === 0) {
        setError("Not connected to MCP server");
        return;
      }

      // Add user message
      addMessage({ role: "user", content });
      setLoading(true);
      setError(null);
      clearSteps();

      // Create abort controller for cancellation
      const abortController = new AbortController();
      setAbortController(abortController);
      setRunning(true);

      try {
        // Build message history for the agent
        const history: LlmChatMessage[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
          toolCalls: m.toolCalls,
          toolCallId: m.toolCallId,
          toolName: m.toolName,
          toolResult: m.toolResult,
        }));

        const client = getMcpClient(serverUrl);

        // Add a pending assistant message
        const assistantMsgId = addMessage({
          role: "assistant",
          content: "",
          pending: true,
        });

        // Run the ReAct agent loop
        const result = await runAgent(content, history, tools, {
          maxIterations: 10,
          signal: abortController.signal,
          callTool: async (name, args) => {
            const toolResult = await client.callTool(name, args);

            // Check if this is a transaction build result
            if (name === "build_unsigned_transfer" && !toolResult.isError) {
              try {
                const txData = JSON.parse(toolResult.content[0].text);
                if (txData.unsigned_transaction) {
                  showTransactionConfirmation({
                    id: `tx_${Date.now()}`,
                    type: args.token_type as "TRX" | "TRC20",
                    from: args.from_address as string,
                    to: args.to_address as string,
                    amount: args.amount as string,
                    tokenAddress: args.contract_address as string,
                    rawTransaction: txData.unsigned_transaction,
                  });
                }
              } catch {
                // Not JSON or no transaction field
              }
            }

            return toolResult;
          },
          onStep: (step) => {
            // Check if step already exists (update) or is new (add)
            const existing = useAgentStore.getState().steps.find((s) => s.id === step.id);
            if (existing) {
              updateStep(step);
            } else {
              addStep(step);
            }
          },
        });

        // Update assistant message with final answer
        updateMessage(assistantMsgId, {
          content: result.answer,
          pending: false,
        });

        setIterations(result.iterations);
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : "Failed to process message";
        setError(errMsg);
        addMessage({
          role: "assistant",
          content: `Sorry, I encountered an error: ${errMsg}`,
        });
      } finally {
        setLoading(false);
        setRunning(false);
        setAbortController(null);
      }
    },
    [
      connected,
      serverUrl,
      tools,
      messages,
      addMessage,
      updateMessage,
      setLoading,
      setError,
      showTransactionConfirmation,
      clearSteps,
      addStep,
      updateStep,
      setRunning,
      setIterations,
      setAbortController,
    ]
  );

  return (
    <div className="flex h-full gap-0">
      {/* Main chat area */}
      <Card className="flex h-full flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-[hsl(var(--border))] p-4">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-[hsl(var(--primary))]" />
            <h2 className="font-semibold">TRON Agent</h2>
            {connected ? (
              <Badge variant="success" className="ml-auto">
                <Brain className="h-3 w-3 mr-1" />
                {tools.length} tools · {activeProviderConfig.label} · {activeProviderConfig.model}
              </Badge>
            ) : (
              <Badge variant="destructive" className="ml-auto">
                Disconnected
              </Badge>
            )}
          </div>
        </div>

        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-[hsl(var(--muted-foreground))]">
            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
            <h3 className="font-medium mb-2">Start a conversation</h3>
            <p className="text-sm max-w-md">
              Ask me about TRON blockchain: check balances, analyze addresses,
              build transactions, or explore the transaction graph.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-[hsl(var(--accent))]"
                onClick={() =>
                  handleSendMessage(
                    "What's the balance of TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t?"
                  )
                }
              >
                Check USDT contract balance
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-[hsl(var(--accent))]"
                onClick={() =>
                  handleSendMessage("What are the current network parameters?")
                }
              >
                Network parameters
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-[hsl(var(--accent))]"
                onClick={() =>
                  handleSendMessage(
                    "Is address TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf safe?"
                  )
                }
              >
                Check address security
              </Badge>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {/* Agent Steps panel */}
            {agentSteps.length > 0 && <AgentStepPanel />}

            {/* Error display */}
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-500">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </CardContent>

      {/* Input */}
      <div className="border-t border-[hsl(var(--border))] p-4">
        <ChatInput
          ref={chatInputRef}
          onSend={handleSendMessage}
          disabled={!connected}
          loading={isLoading}
          placeholder={
            connected
              ? "Ask about TRON blockchain..."
              : "Connect to MCP server first..."
          }
        />
      </div>
      </Card>

      {/* Tool Explorer side panel */}
      <ToolExplorer
        onSelectPrompt={(prompt) => chatInputRef.current?.setInput(prompt)}
      />
    </div>
  );
}
