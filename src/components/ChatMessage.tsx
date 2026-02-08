/**
 * Chat message component with full Markdown rendering.
 */
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, AlertCircle, Copy, Check } from "lucide-react";
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

        {/* Render: user messages as plain text, assistant messages as markdown */}
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownContent content={message.content} />
        )}

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

// ─── Markdown renderer ──────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  if (!content) return null;

  return (
    <div className="markdown-body prose prose-sm dark:prose-invert max-w-none text-sm
                    prose-headings:mt-3 prose-headings:mb-1 prose-headings:font-semibold
                    prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
                    prose-p:my-1.5 prose-p:leading-relaxed
                    prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
                    prose-table:my-2 prose-th:px-3 prose-th:py-1.5 prose-td:px-3 prose-td:py-1.5
                    prose-hr:my-3
                    prose-blockquote:my-2 prose-blockquote:border-[hsl(var(--primary)/0.5)]
                    prose-a:text-[hsl(var(--primary))] prose-a:no-underline hover:prose-a:underline
                    prose-strong:font-semibold">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code blocks with copy button
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isBlock = !!match || (typeof children === "string" && children.includes("\n"));

            if (isBlock) {
              return (
                <CodeBlock language={match?.[1] || ""}>
                  {String(children).replace(/\n$/, "")}
                </CodeBlock>
              );
            }
            // Inline code
            return (
              <code
                className="rounded bg-black/20 px-1.5 py-0.5 text-xs font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },
          // Wrap pre to avoid double-nesting
          pre({ children }) {
            return <>{children}</>;
          },
          // Tables with nice styling
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2 rounded border border-[hsl(var(--border))]">
                <table className="min-w-full text-xs">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-[hsl(var(--muted))]">{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="px-3 py-1.5 text-left text-xs font-medium border-b border-[hsl(var(--border))]">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-3 py-1.5 text-xs border-b border-[hsl(var(--border)/0.5)]">
                {children}
              </td>
            );
          },
          // External links open in new tab
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ─── Code block with copy-to-clipboard ──────────────────────────

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-2 rounded-lg bg-black/30 overflow-hidden">
      {/* Language label + copy button */}
      <div className="flex items-center justify-between px-3 py-1 bg-black/20 text-[10px] text-[hsl(var(--muted-foreground))]">
        <span>{language || "text"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity
                     hover:text-[hsl(var(--foreground))]"
          title="Copy code"
        >
          {copied ? (
            <><Check className="h-3 w-3" /> Copied</>
          ) : (
            <><Copy className="h-3 w-3" /> Copy</>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}

