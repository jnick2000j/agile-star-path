import { useMemo } from "react";
import ReactFlow, { Background, Controls, MarkerType, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";

export interface GraphCI {
  id: string;
  name: string;
  reference_number?: string | null;
  ci_type_label?: string | null;
  color?: string | null;
  health_state?: string | null;
}

export interface GraphRel {
  source_ci_id: string;
  target_ci_id: string;
  relationship_type: string;
}

interface Props {
  rootId: string;
  cis: GraphCI[];
  relationships: GraphRel[];
  onSelect?: (id: string) => void;
}

const HEALTH_BORDER: Record<string, string> = {
  operational: "hsl(var(--success))",
  degraded: "hsl(var(--warning))",
  partial_outage: "hsl(var(--warning))",
  major_outage: "hsl(var(--destructive))",
  unknown: "hsl(var(--border))",
};

export function CIRelationshipGraph({ rootId, cis, relationships, onSelect }: Props) {
  const { nodes, edges } = useMemo(() => {
    // Layered layout: BFS depth from root
    const byId = new Map(cis.map((c) => [c.id, c]));
    const adj = new Map<string, Set<string>>();
    relationships.forEach((r) => {
      if (!adj.has(r.source_ci_id)) adj.set(r.source_ci_id, new Set());
      if (!adj.has(r.target_ci_id)) adj.set(r.target_ci_id, new Set());
      adj.get(r.source_ci_id)!.add(r.target_ci_id);
      adj.get(r.target_ci_id)!.add(r.source_ci_id);
    });
    const depth = new Map<string, number>();
    depth.set(rootId, 0);
    const queue = [rootId];
    while (queue.length) {
      const cur = queue.shift()!;
      const d = depth.get(cur)!;
      for (const n of adj.get(cur) ?? []) {
        if (!depth.has(n)) {
          depth.set(n, d + 1);
          queue.push(n);
        }
      }
    }
    const layers = new Map<number, string[]>();
    cis.forEach((c) => {
      const d = depth.get(c.id) ?? 1;
      if (!layers.has(d)) layers.set(d, []);
      layers.get(d)!.push(c.id);
    });
    const nodes: Node[] = [];
    Array.from(layers.entries()).sort((a, b) => a[0] - b[0]).forEach(([d, ids]) => {
      ids.forEach((id, idx) => {
        const ci = byId.get(id);
        if (!ci) return;
        const border = HEALTH_BORDER[ci.health_state ?? "unknown"];
        const isRoot = id === rootId;
        nodes.push({
          id,
          position: { x: d * 240, y: idx * 90 - (ids.length - 1) * 45 },
          data: {
            label: (
              <div className="text-left">
                <div className="text-xs text-muted-foreground">{ci.reference_number}</div>
                <div className="text-sm font-semibold truncate max-w-[160px]">{ci.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{ci.ci_type_label}</div>
              </div>
            ),
          },
          style: {
            background: "hsl(var(--card))",
            color: "hsl(var(--foreground))",
            border: `2px solid ${border}`,
            borderRadius: 8,
            padding: 8,
            width: 180,
            boxShadow: isRoot ? "0 0 0 3px hsl(var(--primary) / 0.3)" : undefined,
          },
        });
      });
    });
    const edges: Edge[] = relationships.map((r, i) => ({
      id: `${r.source_ci_id}-${r.target_ci_id}-${i}`,
      source: r.source_ci_id,
      target: r.target_ci_id,
      label: r.relationship_type.replace(/_/g, " "),
      labelStyle: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
      style: { stroke: "hsl(var(--border))" },
      markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--muted-foreground))" },
    }));
    return { nodes, edges };
  }, [cis, relationships, rootId]);

  return (
    <div className="h-[500px] w-full rounded-lg border bg-muted/20">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable
        onNodeClick={(_, n) => onSelect?.(n.id)}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="hsl(var(--border))" gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
