"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, Handle, Position,
  type Node, type Edge, type NodeProps,
  BackgroundVariant, ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Dagre from "@dagrejs/dagre";

// ── Types
export type NodeStatus = "idle" | "active" | "waiting" | "error";
export type Category = "data_source" | "ai" | "strategy" | "risk" | "portfolio" | "discovery" | "notification" | "engine";

export interface WorkflowNodeData {
  label: string;
  category: Category;
  status: NodeStatus;
  nodeId: string;
  [key: string]: unknown;
}

export interface WorkflowConfig {
  buildNodes: () => Node<WorkflowNodeData>[];
  buildEdges: () => Edge[];
  deriveStatus: (nodeId: string, liveData: any) => NodeStatus;
  getTooltip: (nodeId: string, liveData: any) => { label: string; value: string }[];
}

// ── Category colors (same as CryptoWorkflow)
export const CATEGORY_COLORS: Record<Category, string> = {
  data_source: "#3b82f6",
  ai: "#a855f7",
  strategy: "#f59e0b",
  risk: "#ef4444",
  portfolio: "#22c55e",
  discovery: "#06b6d4",
  notification: "#f97316",
  engine: "#8b5cf6",
};

export const CATEGORY_BG: Record<Category, string> = {
  data_source: "rgba(59,130,246,0.08)",
  ai: "rgba(168,85,247,0.08)",
  strategy: "rgba(245,158,11,0.08)",
  risk: "rgba(239,68,68,0.08)",
  portfolio: "rgba(34,197,94,0.08)",
  discovery: "rgba(6,182,212,0.08)",
  notification: "rgba(249,115,22,0.08)",
  engine: "rgba(139,92,246,0.08)",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  data_source: "Data Source",
  ai: "AI",
  strategy: "Strategy",
  risk: "Risk",
  portfolio: "Portfolio",
  discovery: "Discovery",
  notification: "Notification",
  engine: "Engine",
};

const STATUS_STYLES: Record<NodeStatus, { bg: string; text: string; label: string }> = {
  idle: { bg: "bg-white/10", text: "text-white/50", label: "Idle" },
  active: { bg: "bg-green-500/20", text: "text-green-300 animate-pulse", label: "Active" },
  waiting: { bg: "bg-amber-500/20", text: "text-amber-300", label: "Waiting" },
  error: { bg: "bg-red-500/20", text: "text-red-300", label: "Error" },
};

// ── Helper to create nodes
export function makeNode(id: string, label: string, category: Category): Node<WorkflowNodeData> {
  return {
    id,
    type: "workflowNode",
    position: { x: 0, y: 0 },
    data: { label, category, status: "idle", nodeId: id },
  };
}

// ── Helper to create edges
export function makeEdge(id: string, source: string, target: string, cat: Category, dashed = false): Edge {
  return {
    id,
    source,
    target,
    animated: true,
    style: {
      stroke: CATEGORY_COLORS[cat],
      strokeDasharray: dashed ? "5 5" : undefined,
    },
  };
}

// ── Dagre layout
const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;

function layoutNodes(nodes: Node<WorkflowNodeData>[], edges: Edge[]): Node<WorkflowNodeData>[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 35, ranksep: 80, marginx: 20, marginy: 20 });
  for (const node of nodes) g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const edge of edges) g.setEdge(edge.source, edge.target);
  Dagre.layout(g);
  return nodes.map((node) => {
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } };
  });
}

// ── Hover Tooltip
function HoverTooltip({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-[300px] bg-gray-900/95 border border-white/10 backdrop-blur-md rounded-xl shadow-2xl p-3 pointer-events-none">
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            {item.label && <span className="text-white/40 shrink-0 min-w-[90px]">{item.label}</span>}
            <span className="text-white/80 break-all">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Custom Workflow Node
function WorkflowNodeComponent({ data }: NodeProps<Node<WorkflowNodeData>>) {
  const [hovered, setHovered] = useState(false);
  const color = CATEGORY_COLORS[data.category];
  const bg = CATEGORY_BG[data.category];
  const badge = STATUS_STYLES[data.status];
  const tooltipItems = (data as any)._tooltipItems as { label: string; value: string }[] | undefined;

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Handle type="target" position={Position.Top} className="!bg-white/30 !border-white/40 !w-2.5 !h-2.5" />
      <div
        className="rounded-lg shadow-lg backdrop-blur-sm border border-white/10 transition-all hover:border-white/20"
        style={{ background: bg, borderLeft: `3px solid ${color}`, minWidth: NODE_WIDTH }}
      >
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white truncate">{data.label}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium whitespace-nowrap ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="rounded-full px-2 py-0.5 text-[0.55rem] font-medium uppercase tracking-wider"
              style={{ color, background: `${color}20` }}>
              {CATEGORY_LABELS[data.category]}
            </span>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white/30 !border-white/40 !w-2.5 !h-2.5" />
      {hovered && tooltipItems && <HoverTooltip items={tooltipItems} />}
    </div>
  );
}

const nodeTypes = { workflowNode: WorkflowNodeComponent };

// ── Legend
function Legend({ categories }: { categories?: Category[] }) {
  const cats = categories || (Object.keys(CATEGORY_LABELS) as Category[]);
  return (
    <div className="absolute top-4 right-4 z-10 bg-gray-900/90 border border-white/10 backdrop-blur-md rounded-xl p-3 shadow-lg">
      <div className="text-[0.65rem] text-white/40 uppercase tracking-wider mb-2 font-medium">Categories</div>
      <div className="space-y-1.5">
        {cats.filter(c => CATEGORY_LABELS[c]).map((cat) => (
          <div key={cat} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ background: CATEGORY_COLORS[cat] }} />
            <span className="text-xs text-white/60">{CATEGORY_LABELS[cat]}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-white/5 mt-2 pt-2">
        <div className="text-[0.65rem] text-white/40 uppercase tracking-wider mb-1.5 font-medium">Status</div>
        <div className="space-y-1">
          {(Object.entries(STATUS_STYLES) as [NodeStatus, typeof STATUS_STYLES.idle][]).map(([key, s]) => (
            <div key={key} className="flex items-center gap-2">
              <span className={`rounded-full px-1.5 py-0.5 text-[0.5rem] font-medium ${s.bg} ${s.text}`}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Workflow DAG Component
interface WorkflowDAGProps {
  config: WorkflowConfig;
  liveData: any;
  engineOnline: boolean;
  height?: number;
  categories?: Category[];
}

function WorkflowDAGInner({ config, liveData, engineOnline, height = 700, categories }: WorkflowDAGProps) {
  const initialNodes = useMemo(() => config.buildNodes(), [config]);
  const initialEdges = useMemo(() => config.buildEdges(), [config]);
  const laidOutNodes = useMemo(() => layoutNodes(initialNodes, initialEdges), [initialNodes, initialEdges]);

  const nodesWithStatus = useMemo(() => {
    return laidOutNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        status: engineOnline ? config.deriveStatus(node.id, liveData) : "idle" as NodeStatus,
        _tooltipItems: config.getTooltip(node.id, liveData),
      },
    }));
  }, [laidOutNodes, liveData, engineOnline, config]);

  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithStatus);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  useMemo(() => { setNodes(nodesWithStatus); }, [nodesWithStatus, setNodes]);

  const onInit = useCallback((instance: any) => {
    setTimeout(() => instance.fitView({ padding: 0.1 }), 100);
  }, []);

  return (
    <div className={`relative w-full rounded-xl border border-white/5 overflow-hidden bg-black/20`} style={{ height }}>
      <Legend categories={categories} />
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes} onInit={onInit}
        fitView minZoom={0.2} maxZoom={1.5}
        nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.03)" />
        <Controls showInteractive={false}
          className="!bg-gray-900/80 !border-white/10 !rounded-lg [&>button]:!bg-transparent [&>button]:!border-white/5 [&>button]:!text-white/50 [&>button:hover]:!bg-white/10"
        />
        <MiniMap
          nodeColor={(n: any) => CATEGORY_COLORS[n.data?.category as Category] || "#888"}
          maskColor="rgba(0,0,0,0.7)"
          className="!bg-gray-900/80 !border-white/10 !rounded-lg"
        />
      </ReactFlow>
    </div>
  );
}

export default function WorkflowDAG(props: WorkflowDAGProps) {
  return (
    <ReactFlowProvider>
      <WorkflowDAGInner {...props} />
    </ReactFlowProvider>
  );
}
