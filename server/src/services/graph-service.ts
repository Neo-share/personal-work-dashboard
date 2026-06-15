import type { GraphNode, RequirementGraph } from '@project-manager/shared';
import { getDb } from '../db/index.js';
import { getRequirementDetail } from './requirement-service.js';

export function getRequirementGraph(requirementId?: number): RequirementGraph {
  if (requirementId) {
    return buildSingleRequirementGraph(requirementId);
  }
  return buildOverviewGraph();
}

function buildSingleRequirementGraph(requirementId: number): RequirementGraph {
  const detail = getRequirementDetail(requirementId);
  if (!detail) {
    return { requirementId, nodes: [], edges: [] };
  }

  const nodes: GraphNode[] = [
    {
      id: `req-${detail.id}`,
      type: 'requirement',
      label: detail.name,
      meta: { status: detail.status, priority: detail.priority },
    },
  ];
  const edges: RequirementGraph['edges'] = [];

  for (const repo of detail.repositories) {
    nodes.push({
      id: `repo-${repo.repositoryId}`,
      type: 'repository',
      label: repo.repository.name,
      meta: { branch: repo.branch, status: repo.status },
    });
    edges.push({
      id: `edge-req-repo-${repo.id}`,
      source: `req-${detail.id}`,
      target: `repo-${repo.repositoryId}`,
      label: repo.responsibility || '关联仓库',
    });
  }

  for (const person of detail.people) {
    nodes.push({
      id: `person-${person.personId}`,
      type: 'person',
      label: person.person.name,
      meta: {
        direction: person.direction,
        roleType: person.roleType,
        status: person.status,
      },
    });
    edges.push({
      id: `edge-req-person-${person.id}`,
      source: `req-${detail.id}`,
      target: `person-${person.personId}`,
      label: person.direction === 'upstream' ? '上游开发' : '下游交付',
    });
  }

  for (const milestone of detail.milestones) {
    nodes.push({
      id: `milestone-${milestone.id}`,
      type: 'milestone',
      label: milestone.name,
      meta: { status: milestone.status, targetDate: milestone.targetDate },
    });
    edges.push({
      id: `edge-req-milestone-${milestone.id}`,
      source: `req-${detail.id}`,
      target: `milestone-${milestone.id}`,
      label: '里程碑',
    });
  }

  return { requirementId, nodes, edges };
}

function buildOverviewGraph(): RequirementGraph {
  const db = getDb();
  const requirements = db
    .prepare('SELECT id, name, status FROM requirements ORDER BY updated_at DESC')
    .all() as Array<{ id: number; name: string; status: string }>;

  const nodes: GraphNode[] = [];
  const edges: RequirementGraph['edges'] = [];

  for (const requirement of requirements) {
    nodes.push({
      id: `req-${requirement.id}`,
      type: 'requirement',
      label: requirement.name,
      meta: { status: requirement.status },
    });

    const repos = db
      .prepare(
        `SELECT rr.id, r.id as repository_id, r.name
         FROM requirement_repositories rr
         JOIN repositories r ON r.id = rr.repository_id
         WHERE rr.requirement_id = ?`,
      )
      .all(requirement.id) as Array<{
      id: number;
      repository_id: number;
      name: string;
    }>;

    for (const repo of repos) {
      const repoNodeId = `repo-${repo.repository_id}`;
      if (!nodes.some((node) => node.id === repoNodeId)) {
        nodes.push({
          id: repoNodeId,
          type: 'repository',
          label: repo.name,
        });
      }
      edges.push({
        id: `edge-overview-repo-${repo.id}`,
        source: `req-${requirement.id}`,
        target: repoNodeId,
        label: '关联仓库',
      });
    }
  }

  return { requirementId: null, nodes, edges };
}
