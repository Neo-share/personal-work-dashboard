import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Select, Spin } from 'antd';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { trpc } from '../lib/trpc';

const nodeColors: Record<string, string> = {
  requirement: '#2563eb',
  repository: '#059669',
  person: '#6366f1',
  milestone: '#d97706',
};

function layoutNodes(
  graphNodes: Array<{ id: string; type: string; label: string }>,
): Node[] {
  const grouped = {
    requirement: graphNodes.filter((node) => node.type === 'requirement'),
    repository: graphNodes.filter((node) => node.type === 'repository'),
    person: graphNodes.filter((node) => node.type === 'person'),
    milestone: graphNodes.filter((node) => node.type === 'milestone'),
  };

  const nodes: Node[] = [];
  let y = 0;

  for (const [type, items] of Object.entries(grouped)) {
    items.forEach((item, index) => {
      nodes.push({
        id: item.id,
        position: { x: index * 220, y },
        data: { label: item.label },
        style: {
          background: nodeColors[type] ?? '#666',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          padding: 8,
          minWidth: 120,
          textAlign: 'center',
        },
      });
    });
    y += 120;
  }

  return nodes;
}

export default function GraphPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requirementId = searchParams.get('requirementId');
  const requirementsQuery = trpc.requirements.list.useQuery();
  const graphQuery = trpc.graph.get.useQuery({
    requirementId: requirementId ? Number(requirementId) : undefined,
  });

  const { nodes, edges } = useMemo(() => {
    if (!graphQuery.data) {
      return { nodes: [], edges: [] };
    }

    const flowNodes = layoutNodes(graphQuery.data.nodes);
    const flowEdges: Edge[] = graphQuery.data.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: true,
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [graphQuery.data]);

  if (graphQuery.isLoading) {
    return <Spin size="large" />;
  }

  return (
    <div>
      <div className="list-row">
        <div>
          <h2 className="page-title">关系图谱</h2>
          <p className="page-desc">查看任务关联的仓库、里程碑与协作联系人。</p>
        </div>
        <Select
          allowClear
          placeholder="选择任务聚焦视图"
          style={{ width: 280 }}
          value={requirementId ? Number(requirementId) : undefined}
          options={(requirementsQuery.data ?? []).map((item) => ({
            value: item.id,
            label: item.name,
          }))}
          onChange={(value) => {
            if (value) {
              setSearchParams({ requirementId: String(value) });
            } else {
              setSearchParams({});
            }
          }}
        />
      </div>

      <div className="content-card graph-panel">
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <MiniMap />
          <Controls />
          <Background gap={16} />
        </ReactFlow>
      </div>

      <div className="content-card">
        <h3 className="section-title">节点说明</h3>
        <div className="tag-list">
          <span className="graph-legend requirement">任务</span>
          <span className="graph-legend repository">仓库</span>
          <span className="graph-legend person">人员</span>
          <span className="graph-legend milestone">里程碑</span>
        </div>
        <div className="empty-hint" style={{ marginTop: 12 }}>
          可从 <Link to="/requirements">任务列表</Link> 或对话助手进入某个任务的关系图。
        </div>
      </div>
    </div>
  );
}
