/**
 * Agent Step Panel — renders the ReAct agent's reasoning / tool-call / result steps.
 */
import { useState } from "react";
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
} from "lucide-react";
import { Card, CardContent, Badge } from "@/components/ui";
import { useAgentStore } from "@/store";
import { cn } from "@/lib/utils";
import type { AgentStep } from "@/lib/agent";

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

function StepItem({ step, defaultExpanded }: { step: AgentStep; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
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
              <p className="text-blue-400 font-medium mb-1">Arguments:</p>
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono">
                {JSON.stringify(step.toolCall.arguments, null, 2)}
              </pre>
            </div>
          )}

          {/* Tool result */}
          {step.toolResult && (
            <div
              className={cn(
                "rounded p-2 max-h-48 overflow-y-auto",
                step.toolResult.isError ? "bg-red-500/10" : "bg-green-500/10",
              )}
            >
              <p
                className={cn(
                  "font-medium mb-1",
                  step.toolResult.isError ? "text-red-400" : "text-green-400",
                )}
              >
                {step.toolResult.isError ? "Error:" : "Output:"}
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono">
                {step.toolResult.content.map((c) => c.text).join("\n")}
              </pre>
            </div>
          )}
        </div>
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
