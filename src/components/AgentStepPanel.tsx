/**
 * Agent Step Panel — renders the ReAct agent's reasoning / tool-call / result steps.
 */
import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Brain,
  Wrench,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
  Zap,
  Maximize2,
  Copy,
  Check,
  GitBranch,
} from "lucide-react";
import { Card, CardContent, Badge, Dialog, DialogHeader, DialogTitle } from "@/components/ui";
import { useAgentStore } from "@/store";
import { cn } from "@/lib/utils";
import type { AgentStep } from "@/lib/agent";
import { Neo4jGraphModal, tryExtractGraphData, type Neo4jGraphData } from "./Neo4jGraphModal";

function StepIcon({ step }: { step: AgentStep }) {
  switch (step.type) {
    case "thinking":
      return step.completedAt ? (
        <Brain className="h-4 w-4 text-purple-400" />
      ) : (
        <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
      );
    case "tool_call":
      return step.completedAt ? (
        <Wrench className="h-4 w-4 text-blue-400" />
      ) : (
        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
      );
    case "tool_result":
      return step.toolResult?.isError ? (
        <XCircle className="h-4 w-4 text-red-400" />
      ) : (
        <CheckCircle className="h-4 w-4 text-green-400" />
      );
    case "answer":
      return <Zap className="h-4 w-4 text-yellow-400" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-400" />;
  }
}

function StepLabel({ step }: { step: AgentStep }) {
  switch (step.type) {
    case "thinking":
      return <span className="text-purple-300">Thinking</span>;
    case "tool_call":
      return (
        <span className="text-blue-300">
          Call: <span className="font-mono">{step.toolCall?.name}</span>
        </span>
      );
    case "tool_result":
      return (
        <span className={step.toolResult?.isError ? "text-red-300" : "text-green-300"}>
          Result: <span className="font-mono">{step.toolName}</span>
        </span>
      );
    case "answer":
      return <span className="text-yellow-300">Final Answer</span>;
    case "error":
      return <span className="text-red-300">Error</span>;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Full-result detail modal ────────────────────────────────────

function ToolDetailModal({
  open,
  onClose,
  title,
  content,
  isError,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
  isError?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Try to format as pretty JSON for readability
  let formatted = content;
  try {
    const parsed = JSON.parse(content);
    formatted = JSON.stringify(parsed, null, 2);
  } catch {
    // not JSON — keep original
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-5xl w-full">
      <DialogHeader>
        <div className="flex items-center gap-2 pr-8">
          <Wrench className={cn("h-4 w-4", isError ? "text-red-400" : "text-blue-400")} />
          <DialogTitle>{title}</DialogTitle>
        </div>
      </DialogHeader>

      <div className="relative">
        <button
          onClick={handleCopy}
          className={cn(
            "absolute top-2 right-2 z-10 p-1.5 rounded transition-colors",
            "bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent))]",
          )}
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-400" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          )}
        </button>

        <pre
          className={cn(
            "rounded p-4 pr-12 text-xs font-mono whitespace-pre-wrap break-words",
            "max-h-[65vh] overflow-auto",
            isError
              ? "bg-red-500/10 text-red-300"
              : "bg-black/30 text-[hsl(var(--foreground))]",
          )}
        >
          {formatted}
        </pre>
      </div>
    </Dialog>
  );
}

function StepItem({ step, defaultExpanded }: { step: AgentStep; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const [detailView, setDetailView] = useState<{
    title: string;
    content: string;
    isError?: boolean;
  } | null>(null);
  const [graphView, setGraphView] = useState<{ data: Neo4jGraphData; title: string } | null>(null);

  // Detect graph data in tool result
  const graphDataInResult = useMemo(() => {
    if (step.type !== "tool_result" || step.toolResult?.isError) return null;
    const text = step.toolResult?.content.map((c) => c.text).join("\n") ?? "";
    return tryExtractGraphData(text);
  }, [step]);

  const duration =
    step.completedAt && step.startedAt
      ? step.completedAt - step.startedAt
      : null;

  const hasContent =
    step.content ||
    step.toolCall ||
    step.toolResult;

  return (
    <div
      className={cn(
        "border-l-2 pl-3 py-1",
        step.type === "thinking" && "border-purple-500/40",
        step.type === "tool_call" && "border-blue-500/40",
        step.type === "tool_result" && (step.toolResult?.isError ? "border-red-500/40" : "border-green-500/40"),
        step.type === "answer" && "border-yellow-500/40",
        step.type === "error" && "border-red-500/40",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 text-sm cursor-pointer select-none",
          hasContent ? "hover:opacity-80" : "cursor-default",
        )}
        onClick={() => hasContent && setExpanded(!expanded)}
      >
        <StepIcon step={step} />
        <StepLabel step={step} />

        {duration !== null && (
          <span className="ml-auto flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
            <Clock className="h-3 w-3" />
            {formatDuration(duration)}
          </span>
        )}

        {hasContent && (
          <span className="text-[hsl(var(--muted-foreground))]">
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
        )}
      </div>

      {expanded && hasContent && (
        <div className="mt-1 ml-6 text-xs">
          {/* Thinking / Error: plain text */}
          {step.content && (step.type === "thinking" || step.type === "error") && (
            <div className="rounded bg-black/20 p-2 whitespace-pre-wrap text-[hsl(var(--muted-foreground))]">
              {step.content.length > 500
                ? step.content.slice(0, 500) + "…"
                : step.content}
            </div>
          )}

          {/* Answer: full markdown rendering */}
          {step.content && step.type === "answer" && (
            <div className="rounded bg-black/20 p-2 prose prose-sm dark:prose-invert max-w-none text-xs
                          prose-headings:mt-2 prose-headings:mb-1 prose-headings:text-sm
                          prose-p:my-1 prose-p:leading-relaxed
                          prose-ul:my-1 prose-ol:my-1 prose-li:my-0
                          prose-pre:my-1 prose-pre:bg-black/30 prose-pre:text-xs
                          prose-code:text-xs prose-code:bg-black/20 prose-code:px-1 prose-code:rounded
                          prose-table:my-1 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1
                          prose-a:text-[hsl(var(--primary))]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {step.content.length > 2000
                  ? step.content.slice(0, 2000) + "\n\n…(truncated)"
                  : step.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Tool call arguments */}
          {step.toolCall && (
            <div className="rounded bg-blue-500/10 p-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-blue-400 font-medium">Arguments:</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailView({
                      title: `${step.toolCall!.name} — Arguments`,
                      content: JSON.stringify(step.toolCall!.arguments, null, 2),
                    });
                  }}
                  className="p-1 rounded hover:bg-blue-500/20 transition-colors"
                  title="View full content"
                >
                  <Maximize2 className="h-3 w-3 text-blue-400" />
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                {JSON.stringify(step.toolCall.arguments, null, 2)}
              </pre>
            </div>
          )}

          {/* Tool result */}
          {step.toolResult && (
            <div
              className={cn(
                "rounded p-2",
                step.toolResult.isError ? "bg-red-500/10" : "bg-green-500/10",
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <p
                  className={cn(
                    "font-medium",
                    step.toolResult.isError ? "text-red-400" : "text-green-400",
                  )}
                >
                  {step.toolResult.isError ? "Error:" : "Output:"}
                </p>
                <div className="flex items-center gap-1">
                  {/* Graph visualization button — shown when result has graph data */}
                  {graphDataInResult && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setGraphView({
                          data: graphDataInResult,
                          title: `${step.toolName || "Tool"} — Graph`,
                        });
                      }}
                      className="p-1 rounded hover:bg-blue-500/20 transition-colors flex items-center gap-1"
                      title="Visualize graph"
                    >
                      <GitBranch className="h-3 w-3 text-blue-400" />
                      <span className="text-[10px] text-blue-400">Graph</span>
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailView({
                        title: `${step.toolName || "Tool"} — Result`,
                        content: step.toolResult!.content.map((c) => c.text).join("\n"),
                        isError: step.toolResult!.isError,
                      });
                    }}
                    className={cn(
                      "p-1 rounded transition-colors",
                      step.toolResult.isError
                        ? "hover:bg-red-500/20"
                        : "hover:bg-green-500/20",
                    )}
                    title="View full result"
                  >
                    <Maximize2
                      className={cn(
                        "h-3 w-3",
                        step.toolResult.isError ? "text-red-400" : "text-green-400",
                      )}
                    />
                  </button>
                </div>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                {step.toolResult.content.map((c) => c.text).join("\n")}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Detail modal for full tool content */}
      {detailView && (
        <ToolDetailModal
          open
          onClose={() => setDetailView(null)}
          title={detailView.title}
          content={detailView.content}
          isError={detailView.isError}
        />
      )}

      {/* Graph visualization modal */}
      {graphView && (
        <Neo4jGraphModal
          open
          onClose={() => setGraphView(null)}
          data={graphView.data}
          title={graphView.title}
        />
      )}
    </div>
  );
}

export function AgentStepPanel() {
  const { steps, running, iterations, cancelRun } = useAgentStore();

  if (steps.length === 0) return null;

  // Group steps by iteration
  const iterationGroups = new Map<number, AgentStep[]>();
  for (const step of steps) {
    const group = iterationGroups.get(step.iteration) ?? [];
    group.push(step);
    iterationGroups.set(step.iteration, group);
  }

  const toolCallCount = steps.filter((s) => s.type === "tool_call").length;
  const errorCount = steps.filter(
    (s) => s.type === "error" || (s.type === "tool_result" && s.toolResult?.isError),
  ).length;

  return (
    <Card className="border-purple-500/30 bg-[hsl(var(--card))]">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-purple-400" />
          <span className="font-medium text-sm">Agent Reasoning</span>

          <div className="ml-auto flex items-center gap-2">
            {running && (
              <Badge
                variant="outline"
                className="text-xs cursor-pointer hover:bg-red-500/20 border-red-500/30 text-red-400"
                onClick={cancelRun}
              >
                Cancel
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {iterations > 0 ? `${iterations} iteration${iterations > 1 ? "s" : ""}` : "running"}
            </Badge>
            {toolCallCount > 0 && (
              <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                {toolCallCount} tool call{toolCallCount > 1 ? "s" : ""}
              </Badge>
            )}
            {errorCount > 0 && (
              <Badge variant="outline" className="text-xs border-red-500/30 text-red-400">
                {errorCount} error{errorCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>

        {/* Steps grouped by iteration */}
        <div className="space-y-1">
          {[...iterationGroups.entries()].map(([iter, groupSteps]) => (
            <div key={iter} className="space-y-1">
              {iterationGroups.size > 1 && (
                <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] mt-2 first:mt-0">
                  Iteration {iter + 1}
                </div>
              )}
              {groupSteps.map((step) => (
                <StepItem
                  key={step.id}
                  step={step}
                  defaultExpanded={step.type === "error"}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Running indicator */}
        {running && (
          <div className="flex items-center gap-2 mt-3 text-xs text-[hsl(var(--muted-foreground))]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Agent is thinking...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
