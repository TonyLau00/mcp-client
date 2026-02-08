/**
 * Tool Explorer panel — lists available MCP tools with descriptions.
 * Click a tool to auto-fill a test prompt in the chat input.
 */
import { useState } from "react";
import { useMcpStore } from "@/store";
import { Badge } from "@/components/ui";
import {
  Wrench,
  ChevronRight,
  ChevronDown,
  Play,
  Search,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

/** Map tool names to sample test prompts. */
const TOOL_TEST_PROMPTS: Record<string, string> = {
  get_account_info:
    "Check the account info for address TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  get_transaction_status:
    "What is the status of transaction 0000000000000000000000000000000000000000000000000000000000000000?",
  get_network_parameters: "Show me the current TRON network parameters",
  check_address_security:
    "Is address TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf safe to interact with?",
  build_unsigned_transfer:
    "Build an unsigned TRX transfer of 1 TRX from TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf to TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  analyze_address_graph:
    "Analyze the transaction graph around address TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t with 2 hops",
  get_address_risk_score:
    "Evaluate the risk score of address TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf",
  get_address_flow_analysis:
    "Analyze the fund flow for address TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  get_contract_callers:
    "Who are the top callers of contract TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t?",
  get_contract_methods:
    "Show function-call statistics for contract TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  get_address_contracts:
    "Which smart contracts has address TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf interacted with?",
};

/** Fallback prompt when a tool has no predefined sample. */
function fallbackPrompt(toolName: string): string {
  return `Use the ${toolName} tool to help me with an example query`;
}

/** Categorise tools for display. */
function categorise(name: string): string {
  if (
    [
      "get_account_info",
      "get_transaction_status",
      "get_network_parameters",
      "build_unsigned_transfer",
    ].includes(name)
  )
    return "Core";
  if (
    [
      "check_address_security",
      "get_address_risk_score",
      "analyze_address_graph",
      "get_address_flow_analysis",
    ].includes(name)
  )
    return "Analysis";
  if (
    [
      "get_contract_callers",
      "get_contract_methods",
      "get_address_contracts",
    ].includes(name)
  )
    return "Contract";
  return "Other";
}

const CATEGORY_ORDER = ["Core", "Analysis", "Contract", "Other"];

interface ToolExplorerProps {
  /** Callback to set the chat input text. */
  onSelectPrompt: (prompt: string) => void;
}

export function ToolExplorer({ onSelectPrompt }: ToolExplorerProps) {
  const { tools, connected } = useMcpStore();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  if (!connected || tools.length === 0) return null;

  // Group tools by category
  const grouped = new Map<string, typeof tools>();
  for (const t of tools) {
    const cat = categorise(t.name);
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(t);
  }

  // Filter
  const lowerFilter = filter.toLowerCase();
  const matchesTool = (t: (typeof tools)[0]) =>
    !filter ||
    t.name.toLowerCase().includes(lowerFilter) ||
    t.description.toLowerCase().includes(lowerFilter);

  return (
    <div
      className={`flex flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-all duration-200 ${
        collapsed ? "w-10" : "w-72"
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
          {collapsed ? (
            <PanelRightOpen className="h-4 w-4" />
          ) : (
            <PanelRightClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {collapsed ? (
        /* Collapsed: just show the wrench icon */
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
              const catTools = grouped.get(cat)?.filter(matchesTool);
              if (!catTools || catTools.length === 0) return null;

              return (
                <div key={cat} className="mb-2">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    {cat}
                  </div>
                  {catTools.map((tool) => {
                    const isExpanded = expandedTool === tool.name;
                    return (
                      <div
                        key={tool.name}
                        className="rounded-md mx-1"
                      >
                        {/* Tool name row */}
                        <button
                          onClick={() =>
                            setExpandedTool(isExpanded ? null : tool.name)
                          }
                          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[hsl(var(--accent))] transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
                          ) : (
                            <ChevronRight className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
                          )}
                          <span className="truncate font-mono text-[11px]">
                            {tool.name}
                          </span>
                        </button>

                        {/* Expanded: description + test button */}
                        {isExpanded && (
                          <div className="mx-2 mb-1 rounded-md bg-[hsl(var(--accent)/.5)] p-2">
                            <p className="text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                              {tool.description}
                            </p>
                            <button
                              onClick={() => {
                                const prompt =
                                  TOOL_TEST_PROMPTS[tool.name] ??
                                  fallbackPrompt(tool.name);
                                onSelectPrompt(prompt);
                              }}
                              className="mt-2 flex items-center gap-1.5 rounded-md bg-[hsl(var(--primary))] px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 transition-opacity"
                            >
                              <Play className="h-3 w-3" />
                              Test
                            </button>
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
