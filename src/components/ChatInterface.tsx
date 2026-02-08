/**
 * Main chat interface component.
 */
import { useCallback, useRef, useEffect } from "react";
import { useMcpStore, useChatStore, useUiStore } from "@/store";
import { getMcpClient } from "@/lib/mcp-client";
import { callLlm, type ChatMessage as LlmChatMessage } from "@/lib/llm-service";
import { ChatMessage } from "./ChatMessage";
import { ChatInput, type ChatInputHandle } from "./ChatInput";
import { ToolCallPanel } from "./ToolCallPanel";
import { ToolExplorer } from "./ToolExplorer";
import { Card, CardContent, Badge } from "@/components/ui";
import { Bot, MessageSquare } from "lucide-react";

export function ChatInterface() {
  const { connected, serverUrl, tools } = useMcpStore();
  const {
    messages,
    pendingToolCalls,
    isLoading,
    error,
    addMessage,
    updateMessage,
    addToolCall,
    updateToolCall,
    clearToolCalls,
    setLoading,
    setError,
  } = useChatStore();
  const { showTransactionConfirmation } = useUiStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingToolCalls]);

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
      clearToolCalls();

      try {
        // Build message history for LLM
        const llmMessages: LlmChatMessage[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
          toolCall: m.toolCall,
          toolResult: m.toolResult,
        }));
        llmMessages.push({ role: "user", content });

        // Call LLM
        const response = await callLlm(llmMessages, tools);

        // Handle tool calls if any
        if (response.toolCalls && response.toolCalls.length > 0) {
          // Add pending indicator for assistant
          const assistantMsgId = addMessage({
            role: "assistant",
            content: response.content || "Let me check that for you...",
            pending: true,
          });

          // Process tool calls sequentially
          const toolResults: string[] = [];
          
          for (const toolCall of response.toolCalls) {
            addToolCall(toolCall);
            updateToolCall(toolCall.id, { status: "running" });

            try {
              const client = getMcpClient(serverUrl);
              const result = await client.callTool(
                toolCall.name,
                toolCall.arguments
              );

              updateToolCall(toolCall.id, { status: "complete", result });

              // Check if this is a transaction build result
              if (
                toolCall.name === "build_unsigned_transfer" &&
                !result.isError
              ) {
                try {
                  const txData = JSON.parse(result.content[0].text);
                  if (txData.transaction) {
                    showTransactionConfirmation({
                      id: toolCall.id,
                      type: toolCall.arguments.token_type as "TRX" | "TRC20",
                      from: toolCall.arguments.from_address as string,
                      to: toolCall.arguments.to_address as string,
                      amount: toolCall.arguments.amount as string,
                      tokenAddress: toolCall.arguments.contract_address as string,
                      rawTransaction: txData.transaction,
                    });
                  }
                } catch {
                  // Not JSON or no transaction field
                }
              }

              toolResults.push(
                `Tool "${toolCall.name}" result:\n${result.content
                  .map((c) => c.text)
                  .join("\n")}`
              );
            } catch (err) {
              const errMsg =
                err instanceof Error ? err.message : "Tool call failed";
              updateToolCall(toolCall.id, { status: "error", error: errMsg });
              toolResults.push(`Tool "${toolCall.name}" error: ${errMsg}`);
            }
          }

          // Call LLM again with tool results
          const finalMessages: LlmChatMessage[] = [
            ...llmMessages,
            {
              role: "assistant",
              content: response.content || "",
            },
            {
              role: "tool",
              content: toolResults.join("\n\n"),
            },
          ];

          const finalResponse = await callLlm(finalMessages, tools);

          // Update assistant message with final response
          updateMessage(assistantMsgId, {
            content: finalResponse.content,
            pending: false,
          });
        } else {
          // No tool calls, just add the response
          addMessage({
            role: "assistant",
            content: response.content,
          });
        }
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
      }
    },
    [
      connected,
      serverUrl,
      tools,
      messages,
      addMessage,
      updateMessage,
      addToolCall,
      updateToolCall,
      clearToolCalls,
      setLoading,
      setError,
      showTransactionConfirmation,
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
            <h2 className="font-semibold">TRON Assistant</h2>
            {connected ? (
              <Badge variant="success" className="ml-auto">
                {tools.length} tools available
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

            {/* Tool calls panel */}
            {pendingToolCalls.length > 0 && <ToolCallPanel />}

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
