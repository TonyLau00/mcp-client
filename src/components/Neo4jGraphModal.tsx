/**
 * Neo4j Graph Viewer Modal — renders nodes + edges from tron-graph as an
 * interactive force-directed graph inside a full-screen Dialog.
 *
 * Used by AgentStepPanel to visualize `analyze_address_graph` results.
 */
import { useRef, useCallback, useMemo, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  Badge,
  Button,
} from "@/components/ui";
import { ZoomIn, ZoomOut, Maximize2, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types matching tron-graph Neo4j output ─────────────────────

export interface Neo4jNode {
  id: string;
  node_type: string; // "account" | "contract"
}

export interface Neo4jEdge {
  from: string;
  to: string;
  rel_type: string; // "SENT" | "RECEIVED_BY" | "CALLED" | "DEPLOYED"
  method?: string;
  selector?: string;
}

export interface Neo4jGraphData {
  center?: string;
  nodes: Neo4jNode[];
  edges: Neo4jEdge[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: Neo4jGraphData;
  title?: string;
}

// ─── Colour palette ─────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  account: "#22c55e",  // green
  contract: "#a855f7", // purple
  unknown: "#6b7280",  // gray
};

const EDGE_COLORS: Record<string, string> = {
  SENT: "rgba(239, 68, 68, 0.6)",         // red
  RECEIVED_BY: "rgba(34, 197, 94, 0.6)",  // green
  CALLED: "rgba(168, 85, 247, 0.6)",      // purple
  DEPLOYED: "rgba(59, 130, 246, 0.6)",    // blue
};

const CENTER_COLOR = "#3b82f6"; // bright blue

// ─── Component ──────────────────────────────────────────────────

export function Neo4jGraphModal({ open, onClose, data, title }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<ForceGraphMethods>(null as any);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const center = data.center;

  // Build force-graph data
  const graphData = useMemo(() => {
    const seenIds = new Set<string>();
    const fgNodes = data.nodes.map((n) => {
      seenIds.add(n.id);
      const isCenter = n.id === center;
      return {
        id: n.id,
        nodeType: n.node_type,
        color: isCenter ? CENTER_COLOR : (NODE_COLORS[n.node_type] ?? NODE_COLORS.unknown),
        val: isCenter ? 4 : 1.5,
      };
    });

    // Edges may reference nodes not in the nodes list — add them
    for (const e of data.edges) {
      for (const addr of [e.from, e.to]) {
        if (!seenIds.has(addr)) {
          seenIds.add(addr);
          fgNodes.push({
            id: addr,
            nodeType: "unknown",
            color: NODE_COLORS.unknown,
            val: 1,
          });
        }
      }
    }

    const fgLinks = data.edges.map((e) => ({
      source: e.from,
      target: e.to,
      relType: e.rel_type,
      method: e.method,
      color: EDGE_COLORS[e.rel_type] ?? "rgba(100,100,100,0.4)",
    }));

    return { nodes: fgNodes, links: fgLinks };
  }, [data, center]);

  const handleZoomIn = useCallback(() => graphRef.current?.zoom(1.5, 400), []);
  const handleZoomOut = useCallback(() => graphRef.current?.zoom(0.67, 400), []);
  const handleCenter = useCallback(() => {
    graphRef.current?.centerAt(0, 0, 400);
    graphRef.current?.zoom(1, 400);
  }, []);

  const shortAddr = (addr: string) =>
    addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeLabel = useCallback((node: any) => {
    const icon = node.nodeType === "contract" ? "📜" : "📍";
    return `${icon} ${node.id}\n(${node.nodeType})`;
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkLabel = useCallback((link: any) => {
    let label = link.relType;
    if (link.method) label += ` (${link.method})`;
    return label;
  }, []);

  // Custom node canvas render with text label
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x as number;
    const y = node.y as number;
    const isCenter = node.id === center;
    const isHovered = node.id === hoveredNode;
    const radius = isCenter ? 6 : 4;

    // Glow ring for center / hovered
    if (isCenter || isHovered) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 2, 0, 2 * Math.PI);
      ctx.fillStyle = isCenter ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.1)";
      ctx.fill();
    }

    // Circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();

    // Contract nodes get a diamond marker
    if (node.nodeType === "contract") {
      ctx.strokeStyle = "rgba(168,85,247,0.7)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Label — only show when zoomed enough
    if (globalScale > 0.8) {
      const label = shortAddr(node.id);
      const fontSize = Math.max(10 / globalScale, 3);
      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(label, x, y + radius + 2);
    }
  }, [center, hoveredNode]);

  const accountCount = data.nodes.filter((n) => n.node_type === "account").length;
  const contractCount = data.nodes.filter((n) => n.node_type === "contract").length;

  return (
    <Dialog open={open} onClose={onClose} className="max-w-6xl w-full">
      <DialogHeader>
        <div className="flex items-center gap-2 pr-8">
          <GitBranch className="h-4 w-4 text-blue-400" />
          <DialogTitle>{title || "Graph Visualization"}</DialogTitle>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs">
            {data.nodes.length} nodes
          </Badge>
          <Badge variant="outline" className="text-xs">
            {data.edges.length} edges
          </Badge>
          {accountCount > 0 && (
            <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
              {accountCount} account{accountCount > 1 ? "s" : ""}
            </Badge>
          )}
          {contractCount > 0 && (
            <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
              {contractCount} contract{contractCount > 1 ? "s" : ""}
            </Badge>
          )}
          {center && (
            <Badge variant="secondary" className="text-xs font-mono">
              center: {shortAddr(center)}
            </Badge>
          )}
        </div>
      </DialogHeader>

      {/* Graph canvas */}
      <div className="relative rounded-lg overflow-hidden bg-[hsl(var(--muted))]" style={{ height: "55vh" }}>
        {/* Zoom controls */}
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
          <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-8 w-8 bg-black/30 hover:bg-black/50">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-8 w-8 bg-black/30 hover:bg-black/50">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleCenter} className="h-8 w-8 bg-black/30 hover:bg-black/50">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        <ForceGraph2D
          ref={graphRef as any}
          graphData={graphData}
          nodeLabel={nodeLabel}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={(node: any, color, ctx) => {
            const x = node.x as number;
            const y = node.y as number;
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          linkColor="color"
          linkLabel={linkLabel}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          linkWidth={1.5}
          linkCurvature={0.15}
          onNodeHover={(node) => setHoveredNode(node ? (node as any).id : null)}
          cooldownTicks={150}
          backgroundColor="transparent"
          width={undefined}
        />
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
        {/* Node types */}
        {center && (
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full" style={{ background: CENTER_COLOR }} />
            Center
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full" style={{ background: NODE_COLORS.account }} />
          Account
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-full" style={{ background: NODE_COLORS.contract }} />
          Contract
        </span>

        <span className="text-[hsl(var(--muted-foreground))]/40">|</span>

        {/* Edge types */}
        {Object.entries(EDGE_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1">
            <span className={cn("h-0.5 w-4 rounded")} style={{ background: color }} />
            {type}
          </span>
        ))}
      </div>
    </Dialog>
  );
}

// ─── Helper: try to extract graph data from a tool result text ──

/**
 * Attempts to parse graph data from a tool result string.
 * Returns the graph data if found, or null.
 * Supports both `analyze_address_graph` (has `graph.nodes` + `graph.edges`)
 * and any other JSON that has top-level `nodes` + `edges`.
 */
export function tryExtractGraphData(text: string): Neo4jGraphData | null {
  try {
    const parsed = JSON.parse(text);

    // analyze_address_graph format: { address, graph: { nodes, edges } }
    if (parsed.graph?.nodes && parsed.graph?.edges && Array.isArray(parsed.graph.nodes)) {
      return {
        center: parsed.address || parsed.center,
        nodes: parsed.graph.nodes,
        edges: parsed.graph.edges,
      };
    }

    // Flat format: { nodes, edges }
    if (parsed.nodes && parsed.edges && Array.isArray(parsed.nodes)) {
      return {
        center: parsed.address || parsed.center,
        nodes: parsed.nodes,
        edges: parsed.edges,
      };
    }
  } catch {
    // not JSON or doesn't have graph data
  }
  return null;
}
