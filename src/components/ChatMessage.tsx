/**
 * Chat message component.
 */
import { Bot, User, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExtendedChatMessage } from "@/store";

interface ChatMessageProps {
  message: ExtendedChatMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isError = message.role === "tool" && message.toolResult?.isError;

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0",
          isUser
            ? "bg-[hsl(var(--primary))]"
            : "bg-[hsl(var(--secondary))]"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-[hsl(var(--primary-foreground))]" />
        ) : (
          <Bot className="h-4 w-4 text-[hsl(var(--secondary-foreground))]" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-2",
          isUser
            ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
            : "bg-[hsl(var(--muted))]",
          isError && "border border-red-500/30 bg-red-500/10"
        )}
      >
        {isError && (
          <div className="flex items-center gap-2 text-red-500 text-xs mb-1">
            <AlertCircle className="h-3 w-3" />
            Error
          </div>
        )}
        
        {/* Render message content - handle code blocks */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {renderContent(message.content)}
        </div>

        {/* Pending indicator */}
        {message.pending && (
          <div className="flex items-center gap-1 mt-2">
            <div className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
            <div className="h-1.5 w-1.5 rounded-full bg-current animate-pulse delay-150" />
            <div className="h-1.5 w-1.5 rounded-full bg-current animate-pulse delay-300" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Render message content with code block support.
 */
function renderContent(content: string) {
  // Simple markdown-like parsing for code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);
  
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      // Code block
      const lines = part.slice(3, -3).split("\n");
      const language = lines[0]?.trim() || "";
      const code = lines.slice(language ? 1 : 0).join("\n");
      
      return (
        <pre
          key={i}
          className="rounded bg-black/30 p-3 overflow-x-auto text-xs font-mono my-2"
        >
          <code>{code}</code>
        </pre>
      );
    }
    
    // Regular text - handle inline code
    return (
      <span key={i}>
        {part.split(/(`[^`]+`)/g).map((segment, j) => {
          if (segment.startsWith("`") && segment.endsWith("`")) {
            return (
              <code
                key={j}
                className="rounded bg-black/20 px-1 py-0.5 text-xs font-mono"
              >
                {segment.slice(1, -1)}
              </code>
            );
          }
          return segment;
        })}
      </span>
    );
  });
}
