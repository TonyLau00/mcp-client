/**
 * Tool call visualization component.
 */
import { Loader2, CheckCircle, XCircle, Wrench } from "lucide-react";
import { Card, CardContent, Badge } from "@/components/ui";
import { useChatStore, type PendingToolCall } from "@/store";
import { cn } from "@/lib/utils";

function ToolCallItem({ toolCall }: { toolCall: PendingToolCall }) {
  const { status, tool, result, error } = toolCall;

  return (
    <div
      className={cn(
        "rounded-md border p-3 text-sm",
        status === "running" && "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]",
        status === "complete" && "border-green-500/30 bg-green-500/10",
        status === "error" && "border-red-500/30 bg-red-500/10"
      )}
    >
      <div className="flex items-center gap-2">
        {status === "pending" && <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />}
        {status === "running" && <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--primary))]" />}
        {status === "complete" && <CheckCircle className="h-4 w-4 text-green-500" />}
        {status === "error" && <XCircle className="h-4 w-4 text-red-500" />}
        
        <span className="font-medium">{tool.name}</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {status}
        </Badge>
      </div>

      {/* Arguments */}
      <div className="mt-2 rounded bg-black/20 p-2 font-mono text-xs">
        <pre className="overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(tool.arguments, null, 2)}
        </pre>
      </div>

      {/* Result */}
      {status === "complete" && result && (
        <div className="mt-2 rounded bg-green-500/10 p-2">
          <p className="text-xs font-medium text-green-500 mb-1">Result:</p>
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs max-h-40">
            {result.content.map((c) => c.text).join("\n")}
          </pre>
        </div>
      )}

      {/* Error */}
      {status === "error" && error && (
        <div className="mt-2 rounded bg-red-500/10 p-2 text-xs text-red-500">
          {error}
        </div>
      )}
    </div>
  );
}

export function ToolCallPanel() {
  const { pendingToolCalls } = useChatStore();

  if (pendingToolCalls.length === 0) return null;

  return (
    <Card className="border-[hsl(var(--primary)/0.3)]">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="h-4 w-4 text-[hsl(var(--primary))]" />
          <span className="font-medium text-sm">Tool Calls</span>
        </div>
        <div className="space-y-2">
          {pendingToolCalls.map((tc) => (
            <ToolCallItem key={tc.id} toolCall={tc} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
