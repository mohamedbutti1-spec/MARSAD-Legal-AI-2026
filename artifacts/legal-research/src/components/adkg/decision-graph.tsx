/**
 * Phase 58 — ADKG SVG Knowledge Graph Visualizer
 * Radial layout: central decision node at center, connected nodes around it.
 * No external graph library — pure SVG + React.
 */
import React, { useMemo } from 'react';
import { useT } from '@/lib/user-context';

interface GraphNode {
  id: string;
  type: string;
  label: string;
  labelAr: string;
  status?: string;
  authorityClass?: string;
  linkType?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  label: string;
}

interface DecisionGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  centralId: number;
}

const NODE_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  decision:          { fill: '#1e3a5f', stroke: '#0f172a', text: '#ffffff' },
  decision_linked:   { fill: '#3b82f6', stroke: '#1e40af', text: '#ffffff' },
  kb_document:       { fill: '#059669', stroke: '#065f46', text: '#ffffff' },
  legal_source:      { fill: '#0891b2', stroke: '#0e7490', text: '#ffffff' },
  research_project:  { fill: '#7c3aed', stroke: '#5b21b6', text: '#ffffff' },
  research_item:     { fill: '#a855f7', stroke: '#7e22ce', text: '#ffffff' },
  adkg_decision:     { fill: '#3b82f6', stroke: '#1e40af', text: '#ffffff' },
  external:          { fill: '#6b7280', stroke: '#374151', text: '#ffffff' },
  default:           { fill: '#94a3b8', stroke: '#64748b', text: '#1e293b' },
};

const STATUS_ACCENT: Record<string, string> = {
  draft: '#94a3b8', issued: '#22c55e', challenged: '#f59e0b',
  suspended: '#ef4444', amended: '#a855f7', revoked: '#dc2626',
  annulled: '#7f1d1d', executed: '#3b82f6',
};

const AUTH_ACCENT: Record<string, string> = {
  binding: '#059669', persuasive: '#3b82f6', non_binding: '#94a3b8',
};

const LINK_TYPE_LABELS: Record<string, string> = {
  legislation: 'تشريع', exec_regulation: 'لائحة تنفيذية', cabinet_decision: 'قرار مجلس',
  ministerial_decision: 'قرار وزاري', case_law: 'قضاء', legal_principle: 'مبدأ',
  legal_opinion: 'رأي قانوني', research_project: 'مشروع بحثي', other_decision: 'قرار آخر', other: 'أخرى',
};

const EDGE_STROKE: Record<string, string> = {
  binding: '#059669', persuasive: '#3b82f6', non_binding: '#9ca3af',
};

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

export function DecisionGraph({ nodes, edges, centralId }: DecisionGraphProps) {
  const t = useT();

  const W = 720, H = 520;
  const cx = W / 2, cy = H / 2;
  const centralNodeId = `d:${centralId}`;

  // Separate central from peripheral nodes
  const peripheralNodes = nodes.filter((n) => n.id !== centralNodeId);

  // Radial layout
  const nodePositions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    pos[centralNodeId] = { x: cx, y: cy };
    const total = peripheralNodes.length;
    const R = Math.min(200, 80 + total * 15);
    peripheralNodes.forEach((n, i) => {
      const angle = (i / Math.max(total, 1)) * 2 * Math.PI - Math.PI / 2;
      pos[n.id] = { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
    });
    return pos;
  }, [nodes, centralId]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground border rounded-lg bg-muted/20">
        {t('لا توجد روابط بعد', 'No connections yet — add links or graph edges to see the graph')}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-slate-50 overflow-hidden">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxHeight: 520, display: 'block' }}>
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, i) => {
          const sp = nodePositions[edge.source];
          const tp = nodePositions[edge.target];
          if (!sp || !tp) return null;
          const mx = (sp.x + tp.x) / 2;
          const my = (sp.y + tp.y) / 2;
          const strokeColor = AUTH_ACCENT[edge.type] ?? EDGE_STROKE[edge.type] ?? '#cbd5e1';
          return (
            <g key={i}>
              <line
                x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y}
                stroke={strokeColor} strokeWidth={1.5} strokeDasharray={edge.type === 'non_binding' ? '4,3' : undefined}
                markerEnd="url(#arrow)" opacity={0.65}
              />
              <text x={mx} y={my - 4} textAnchor="middle" fontSize={9} fill="#64748b">
                {truncate(LINK_TYPE_LABELS[edge.type] ?? edge.label, 12)}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const pos = nodePositions[node.id];
          if (!pos) return null;
          const isCentral = node.id === centralNodeId;
          const r = isCentral ? 42 : 32;
          const typeKey = isCentral ? 'decision' : (node.type in NODE_COLORS ? node.type : 'default');
          const colors = NODE_COLORS[typeKey] ?? NODE_COLORS.default;
          const accentStroke = node.status ? STATUS_ACCENT[node.status] : node.authorityClass ? AUTH_ACCENT[node.authorityClass] : colors.stroke;

          return (
            <g key={node.id}>
              <circle
                cx={pos.x} cy={pos.y} r={r}
                fill={colors.fill} stroke={accentStroke} strokeWidth={isCentral ? 4 : 2}
                filter={isCentral ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' : undefined}
              />
              {node.linkType && (
                <text x={pos.x} y={pos.y - r - 4} textAnchor="middle" fontSize={8} fill="#6b7280">
                  {LINK_TYPE_LABELS[node.linkType] ?? node.linkType}
                </text>
              )}
              <text x={pos.x} y={pos.y + 1} textAnchor="middle" fontSize={isCentral ? 10 : 8} fill={colors.text} fontWeight={isCentral ? 'bold' : 'normal'}>
                {truncate(node.labelAr || node.label, isCentral ? 14 : 10)}
              </text>
              {node.status && (
                <circle cx={pos.x + r - 6} cy={pos.y - r + 6} r={5} fill={STATUS_ACCENT[node.status] ?? '#94a3b8'} stroke="white" strokeWidth={1.5} />
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 p-3 border-t text-xs text-muted-foreground">
        {[
          { color: '#1e3a5f', label: t('القرار المحوري', 'Central Decision') },
          { color: '#3b82f6', label: t('قرار مرتبط', 'Linked Decision') },
          { color: '#059669', label: t('وثيقة قانونية', 'Legal Document') },
          { color: '#7c3aed', label: t('مشروع بحثي', 'Research Project') },
          { color: '#6b7280', label: t('مرجع خارجي', 'External Ref') },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
