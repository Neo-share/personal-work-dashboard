import type { NavigationAction, Requirement } from '@project-manager/shared';
import { listPeople } from './people-service.js';
import { listRequirements } from './requirement-service.js';

interface AssistantResult {
  reply: string;
  action?: NavigationAction;
}

function getWeekReleaseRange(): { releaseFrom: string; releaseTo: string } {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const format = (date: Date) => date.toISOString().slice(0, 10);
  return { releaseFrom: format(monday), releaseTo: format(sunday) };
}

function matchRequirementByText(text: string, requirements: Requirement[]): Requirement | undefined {
  const normalized = text.toLowerCase();
  return requirements.find((item) => normalized.includes(item.name.toLowerCase()));
}

export function resolveAssistantIntent(message: string): AssistantResult {
  const text = message.trim();
  const requirements = listRequirements();

  if (/驾驶舱|工作台|首页|看板|个人驾驶舱|个人工作台/.test(text)) {
    return {
      reply: '已打开个人驾驶舱，可以查看进行中的工作项、脏仓库和阻塞项。',
      action: { type: 'openWorkbench' },
    };
  }

  if (/扫描|仓库扫描/.test(text)) {
    return {
      reply: '已为你打开扫描中心，可以扫描 CodeLab 工作区下的 Git 仓库。',
      action: { type: 'openScanCenter' },
    };
  }

  if (/关系图|图谱|上下游/.test(text)) {
    const requirement = matchRequirementByText(text, requirements);
    if (requirement) {
      return {
        reply: `已为你打开「${requirement.name}」的关系图谱。`,
        action: {
          type: 'openGraph',
          payload: { requirementId: requirement.id },
        },
      };
    }
    return {
      reply: '已打开任务关系总览图谱。',
      action: { type: 'openGraph' },
    };
  }

  if (/打开|查看|进入/.test(text) && /详情/.test(text)) {
    const requirement = matchRequirementByText(text, requirements);
    if (requirement) {
      return {
        reply: `已定位到任务「${requirement.name}」，正在打开详情页。`,
        action: {
          type: 'openRequirementDetail',
          payload: { requirementId: requirement.id },
        },
      };
    }
  }

  if (/风险|阻塞/.test(text)) {
    const risky = requirements.filter((item) => item.risk || item.blockers);
    return {
      reply:
        risky.length > 0
          ? `当前有 ${risky.length} 个任务存在阻塞或风险：${risky.map((item) => item.name).join('、')}。`
          : '当前没有标记阻塞或风险的任务。',
      action: {
        type: 'filterRequirements',
        payload: { riskOnly: true },
      },
    };
  }

  if (/还没提测|未提测/.test(text)) {
    const pendingTest = listRequirements({ beforeTesting: true });
    return {
      reply:
        pendingTest.length > 0
          ? `当前有 ${pendingTest.length} 个任务尚未进入提测阶段。`
          : '当前没有处于提测前阶段的任务。',
      action: {
        type: 'filterRequirements',
        payload: { beforeTesting: true },
      },
    };
  }

  if (/本周.*上线|计划上线/.test(text)) {
    const range = getWeekReleaseRange();
    const upcoming = listRequirements({
      releaseFrom: range.releaseFrom,
      releaseTo: range.releaseTo,
    });
    return {
      reply:
        upcoming.length > 0
          ? `本周计划上线 ${upcoming.length} 个任务：${upcoming.map((item) => item.name).join('、')}。`
          : '本周没有计划上线的任务。',
      action: {
        type: 'filterRequirements',
        payload: {
          releaseFrom: range.releaseFrom,
          releaseTo: range.releaseTo,
        },
      },
    };
  }

  const people = listPeople();
  const matchedPerson = people.find((person) => text.includes(person.name));
  if (matchedPerson && /验收|参与|负责|人员|谁/.test(text)) {
    const related = listRequirements({ personId: matchedPerson.id });
    return {
      reply:
        related.length > 0
          ? `与 ${matchedPerson.name} 相关的任务有 ${related.length} 个：${related.map((item) => item.name).join('、')}。`
          : `当前没有与 ${matchedPerson.name} 关联的任务。`,
      action: {
        type: 'filterRequirements',
        payload: { personId: matchedPerson.id },
      },
    };
  }

  if (/提测|上线|开发中|并行/.test(text)) {
    const repoMatch = text.match(/([a-z0-9-]+)/i);
    if (repoMatch) {
      return {
        reply: `已筛选与 ${repoMatch[1]} 相关的任务，请到任务列表查看。`,
        action: {
          type: 'filterRequirements',
          payload: { keyword: repoMatch[1] },
        },
      };
    }
  }

  const directRequirement = matchRequirementByText(text, requirements);
  if (directRequirement) {
    return {
      reply: `找到任务「${directRequirement.name}」，状态为 ${directRequirement.status}。`,
      action: {
        type: 'openRequirementDetail',
        payload: { requirementId: directRequirement.id },
      },
    };
  }

  if (/任务|需求/.test(text)) {
    return {
      reply: `当前共有 ${requirements.length} 个任务。你可以说“打开某某任务详情”或“查看阻塞项”。`,
      action: { type: 'filterRequirements' },
    };
  }

  return {
    reply:
      '我可以帮你打开任务详情、查看阻塞项、打开关系图谱或进入扫描中心。例如：“打开新增会员权益页任务详情”。',
  };
}
