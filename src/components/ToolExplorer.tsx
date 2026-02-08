/**
 * Tool Explorer panel — lists available MCP tools with descriptions.
 * Users can:
 *  • Click "Prompt" to auto-fill a test prompt in the chat input.
 *  • Click "Run" to directly call the tool with test arguments and see the result.
 */
import { useState, useCallback } from "react";
import { useMcpStore } from "@/store";
import { getMcpClient, type McpCallResult } from "@/lib/mcp-client";
import { Badge } from "@/components/ui";
import {
  Wrench,
  ChevronRight,
  ChevronDown,
  Play,
  MessageSquare,
  Search,
  PanelRightClose,
  PanelRightOpen,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
} from "lucide-react";

// ─── Test fixtures: prompt text + direct call arguments ─────────

interface ToolTestCase {
  prompt: string;
  args: Record<string, unknown>;
}

const TOOL_TESTS: Record<string, ToolTestCase> = {
  get_account_info: {
    prompt:
      "Check the account info for address TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    args: { address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" },
  },
  get_transaction_status: {
    prompt:
      "What is the status of transaction 8c458265e890ce3259423ff6bb50b182136ee6a99b848ec5935a27fae2039b71?",
    args: {
      tx_hash:
        "8c458265e890ce3259423ff6bb50b182136ee6a99b848ec5935a27fae2039b71",
    },
  },
  get_network_parameters: {
    prompt: "Show me the current TRON network parameters",
    args: {},
  },
  check_address_security: {
    prompt:
      "Is address TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf safe to interact with?",
    args: { address: "TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf" },
  },
  build_unsigned_transfer: {
    prompt:
      "Build an unsigned TRX transfer of 1 TRX from TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf to TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    args: {
      from_address: "TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf",
      to_address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      amount: "1",
      token_type: "TRX",
    },
  },
  analyze_address_graph: {
    prompt:
      "Analyze the transaction graph around address TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t with 2 hops",
    args: { address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", depth: 2 },
  },
  get_address_risk_score: {
    prompt:
      "Evaluate the risk score of address TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf",
    args: { address: "TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf" },
  },
  get_address_flow_analysis: {
    prompt:
      "Analyze the fund flow for address TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    args: { address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", depth: 2 },
  },
  get_contract_callers: {
    prompt:
      "Who are the top callers of contract TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t?",
    args: { address: "TPfEpfiAPRfydrf4SNLTP5KYw2Pxs2eGfC", limit: 10 },
  },
  get_contract_methods: {
    prompt:
      "Show function-call statistics for contract TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    args: { address: "TQFEyGNzHZAJmebJUvsoZvJghHm2yNhXAD" },
  },
  get_address_contracts: {
    prompt:
      "Which smart contracts has address TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf interacted with?",
    args: { address: "TQFEyGNzHZAJmebJUvsoZvJghHm2yNhXAD" },
  },
};

function fallbackTest(toolName: string): ToolTestCase {
  return {
    prompt: `Use the ${toolName} tool to help me with an example query`,
    args: {},
  };
}

// ─── Categorisation ─────────────────────────────────────────────

function categorise(name: string): string {
  if (
    ["get_account_info", "get_transaction_status", "get_network_parameters", "build_unsigned_transfer"].includes(name)
  )
    return "Core";
  if (
    ["check_address_security", "get_address_risk_score", "analyze_address_graph", "get_address_flow_analysis"].includes(name)
  )
    return "Analysis";
  if (
    ["get_contract_callers", "get_contract_methods", "get_address_contracts"].includes(name)
  )
    return "Contract";
  return "Other";
}

const CATEGORY_ORDER = ["Core", "Analysis", "Contract", "Other"];

// ─── Per-tool run result state ──────────────────────────────────

interface RunState {
  status: "idle" | "running" | "success" | "error";
  result?: McpCallResult;
  error?: string;
  elapsedMs?: number;
}

// ─── Component ──────────────────────────────────────────────────

interface ToolExplorerProps {
  onSelectPrompt: (prompt: string) => void;
}

export function ToolExplorer({ onSelectPrompt }: ToolExplorerProps) {
  const { tools, connected, serverUrl } = useMcpStore();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [runStates, setRunStates] = useState<Record<string, RunState>>({});
  const [copiedTool, setCopiedTool] = useState<string | null>(null);

  const updateRun = useCallback(
    (name: string, patch: Partial<RunState>) =>
      setRunStates((prev) => ({
        ...prev,
        [name]: { ...prev[name], ...patch } as RunState,
      })),
    [],
  );

  const handleRun = useCallback(
    async (toolName: string) => {
      const testCase = TOOL_TESTS[toolName] ?? fallbackTest(toolName);
      updateRun(toolName, { status: "running", result: undefined, error: undefined });

      const t0 = performance.now();
      try {
        const client = getMcpClient(serverUrl);
        const result = await client.callTool(toolName, testCase.args);
        const elapsedMs = Math.round(performance.now() - t0);
        updateRun(toolName, {
          status: result.isError ? "error" : "success",
          result,
          elapsedMs,
          error: result.isError ? result.content.map((c) => c.text).join("\n") : undefined,
        });
      } catch (err) {
        const elapsedMs = Math.round(performance.now() - t0);
        updateRun(toolName, {
          status: "error",
          elapsedMs,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [serverUrl, updateRun],
  );

  const handleCopyResult = useCallback(
    (toolName: string) => {
      const rs = runStates[toolName];
      if (!rs?.result) return;
      const text = rs.result.content.map((c) => c.text).join("\n");
      navigator.clipboard.writeText(text);
      setCopiedTool(toolName);
      setTimeout(() => setCopiedTool(null), 1500);
    },
    [runStates],
  );

  if (!connected || tools.length === 0) return null;

  // Group + filter
  const grouped = new Map<string, typeof tools>();
  for (const t of tools) {
    const cat = categorise(t.name);
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(t);
  }
  const lf = filter.toLowerCase();
  const match = (t: (typeof tools)[0]) =>
    !filter || t.name.toLowerCase().includes(lf) || t.description.toLowerCase().includes(lf);

  return (
    <div
      className={`flex flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-all duration-200 ${
        collapsed ? "w-10" : "w-80"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] p-2">
        {!collapsed && (
          <>
            <Wrench className="h-4 w-4 text-[hsl(var(--primary))]" />
            <span className="text-sm font-semibold flex-1">Tools</span>
            <Badge variant="secondary" className="text-xs">
              {tools.length}
            </Badge>
          </>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 rounded hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))]"
          title={collapsed ? "Expand tool panel" : "Collapse tool panel"}
        >
          {collapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
        </button>
      </div>

      {collapsed ? (
        <div className="flex flex-col items-center pt-3">
          <Wrench className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter tools..."
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-1.5 pl-7 pr-2 text-xs placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              />
            </div>
          </div>

          {/* Tool list */}
          <div className="flex-1 overflow-y-auto px-1 pb-2">
            {CATEGORY_ORDER.map((cat) => {
              const catTools = grouped.get(cat)?.filter(match);
              if (!catTools || catTools.length === 0) return null;
              return (
                <div key={cat} className="mb-2">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    {cat}
                  </div>
                  {catTools.map((tool) => {
                    const isExpanded = expandedTool === tool.name;
                    const rs = runStates[tool.name] ?? { status: "idle" };
                    const testCase = TOOL_TESTS[tool.name] ?? fallbackTest(tool.name);

                    return (
                      <div key={tool.name} className="rounded-md mx-1">
                        {/* Tool name row */}
                        <button
                          onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[hsl(var(--accent))] transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
                          ) : (
                            <ChevronRight className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
                          )}
                          <span className="truncate font-mono text-[11px] flex-1">{tool.name}</span>
                          {/* Status dot */}
                          {rs.status === "success" && <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />}
                          {rs.status === "error" && <XCircle className="h-3 w-3 text-red-500 shrink-0" />}
                          {rs.status === "running" && <Loader2 className="h-3 w-3 animate-spin text-[hsl(var(--primary))] shrink-0" />}
                        </button>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="mx-2 mb-1 space-y-2 rounded-md bg-[hsl(var(--accent)/.5)] p-2">
                            {/* Description */}
                            <p className="text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                              {tool.description}
                            </p>

                            {/* Test arguments preview */}
                            {Object.keys(testCase.args).length > 0 && (
                              <div className="rounded bg-[hsl(var(--background))] p-1.5">
                                <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] mb-1">
                                  Test Arguments
                                </p>
                                <pre className="text-[10px] leading-snug text-[hsl(var(--foreground))] whitespace-pre-wrap break-all">
                                  {JSON.stringify(testCase.args, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleRun(tool.name)}
                                disabled={rs.status === "running"}
                                className="flex items-center gap-1.5 rounded-md bg-[hsl(var(--primary))] px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                              >
                                {rs.status === "running" ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                                Run
                              </button>
                              <button
                                onClick={() => {
                                  onSelectPrompt(testCase.prompt);
                                }}
                                className="flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-2.5 py-1 text-[11px] font-medium hover:bg-[hsl(var(--accent))] transition-colors"
                              >
                                <MessageSquare className="h-3 w-3" />
                                Prompt
                              </button>
                            </div>

                            {/* Result / error display */}
                            {rs.status === "success" && rs.result && (
                              <div className="rounded bg-[hsl(var(--background))] p-1.5 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-semibold text-green-500">
                                    ✓ Success ({rs.elapsedMs}ms)
                                  </span>
                                  <button
                                    onClick={() => handleCopyResult(tool.name)}
                                    className="p-0.5 rounded hover:bg-[hsl(var(--accent))]"
                                    title="Copy result"
                                  >
                                    {copiedTool === tool.name ? (
                                      <Check className="h-3 w-3 text-green-500" />
                                    ) : (
                                      <Copy className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                                    )}
                                  </button>
                                </div>
                                <pre className="text-[10px] leading-snug text-[hsl(var(--foreground))] whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                                  {rs.result.content
                                    .map((c) => {
                                      try {
                                        return JSON.stringify(JSON.parse(c.text), null, 2);
                                      } catch {
                                        return c.text;
                                      }
                                    })
                                    .join("\n")}
                                </pre>
                              </div>
                            )}

                            {rs.status === "error" && (
                              <div className="rounded bg-red-500/10 border border-red-500/30 p-1.5">
                                <span className="text-[10px] font-semibold text-red-500">
                                  ✗ Error ({rs.elapsedMs}ms)
                                </span>
                                <pre className="text-[10px] leading-snug text-red-400 whitespace-pre-wrap break-all mt-1 max-h-32 overflow-y-auto">
                                  {rs.error}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
