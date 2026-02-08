/**
 * Transaction graph visualization using react-force-graph-2d.
 */
import { useRef, useCallback, useMemo } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui";
import { GitBranch, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui";

interface GraphNode {
  id: string;
  type: "address" | "transaction";
  label?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

interface TransactionGraphProps {
  centerAddress: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  depth: number;
  onNodeClick?: (node: GraphNode) => void;
}

export function TransactionGraph({
  centerAddress,
  nodes,
  edges,
  depth,
  onNodeClick,
}: TransactionGraphProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<ForceGraphMethods>(null as any);

  const graphData = useMemo(() => {
    // Create node objects with colors
    const nodeMap = new Map<string, GraphNode & { color: string; val: number }>();
    
    nodes.forEach((node) => {
      const isCenter = node.id === centerAddress;
      nodeMap.set(node.id, {
        ...node,
        color:
          isCenter
            ? "#3b82f6" // Primary blue for center
            : node.type === "address"
            ? "#22c55e" // Green for addresses
            : "#f59e0b", // Amber for transactions
        val: isCenter ? 3 : 1,
      });
    });

    // Create link objects
    const links = edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
      color:
        edge.type === "SENT"
          ? "rgba(239, 68, 68, 0.5)" // Red for sent
          : "rgba(34, 197, 94, 0.5)", // Green for received
    }));

    return {
      nodes: Array.from(nodeMap.values()),
      links,
    };
  }, [nodes, edges, centerAddress]);

  const handleZoomIn = useCallback(() => {
    graphRef.current?.zoom(1.5, 400);
  }, []);

  const handleZoomOut = useCallback(() => {
    graphRef.current?.zoom(0.5, 400);
  }, []);

  const handleCenter = useCallback(() => {
    graphRef.current?.centerAt(0, 0, 400);
    graphRef.current?.zoom(1, 400);
  }, []);

  const nodeLabel = useCallback((node: GraphNode & { color: string; val: number }) => {
    const shortId = node.id.length > 12
      ? `${node.id.slice(0, 6)}...${node.id.slice(-4)}`
      : node.id;
    return `${node.type === "address" ? "📍" : "📄"} ${shortId}`;
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4" />
            Transaction Graph
          </CardTitle>
          <div className="flex items-center gap-1">
            <Badge variant="secondary">Depth: {depth}</Badge>
            <Badge variant="outline">{nodes.length} nodes</Badge>
            <Badge variant="outline">{edges.length} edges</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative">
        {/* Controls */}
        <div className="absolute right-6 top-2 z-10 flex gap-1">
          <Button variant="ghost" size="icon" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleCenter}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Graph */}
        <div className="h-[400px] rounded-lg bg-[hsl(var(--muted))] overflow-hidden">
          <ForceGraph2D
            ref={graphRef as any}
            graphData={graphData}
            nodeLabel={nodeLabel}
            nodeColor="color"
            nodeVal="val"
            linkColor="color"
            linkDirectionalArrowLength={3}
            linkDirectionalArrowRelPos={1}
            onNodeClick={(node) => onNodeClick?.(node as GraphNode)}
            cooldownTicks={100}
            backgroundColor="transparent"
          />
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-[hsl(var(--muted-foreground))]">
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-[#3b82f6]" />
            Center Address
          </div>
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-[#22c55e]" />
            Address
          </div>
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-[#f59e0b]" />
            Transaction
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
