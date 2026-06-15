import type {
  Requirement,
  RequirementStatus,
  WeeklyReport,
  WeeklyReportItem,
  WeeklyReportSectionKey,
  WeeklyReportSections,
  WorkDomain,
} from '@project-manager/shared';
import { getReportWeekRange } from '@project-manager/shared';
import { getDb } from '../db/index.js';
import { listRequirements } from './requirement-service.js';

/** 周报状态 → 进展分组 */
const STATUS_TO_SECTION: Partial<Record<RequirementStatus, WeeklyReportSectionKey>> = {
  released: 'completed',
  testing: 'testing',
  integrating: 'testing',
  developing: 'developing',
  pending_review: 'developing',
  pending_release: 'developing',
};

const SECTION_LABELS: Record<WeeklyReportSectionKey, string> = {
  completed: '已完成',
  testing: '测试中',
  developing: '开发中',
};

function mapRequirement(row: Record<string, unknown>): Requirement {
  return {
    id: row.id as number,
    name: row.name as string,
    domain: row.domain as Requirement['domain'],
    status: row.status as RequirementStatus,
    priority: row.priority as Requirement['priority'],
    targetVersion: (row.target_version as string | null) ?? null,
    plannedReleaseAt: (row.planned_release_at as string | null) ?? null,
    actualReleaseAt: (row.actual_release_at as string | null) ?? null,
    risk: (row.risk as string | null) ?? null,
    blockers: (row.blockers as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function isFeishuUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('feishu.cn') || lower.includes('larksuite.com') || lower.includes('feishu.net');
}

/** 解析需求关联的飞书文档链接（优先 type=doc） */
export function resolveRequirementDocUrl(requirementId: number): string | null {
  const db = getDb();
  const rows = db
    .prepare('SELECT type, url FROM links WHERE requirement_id = ?')
    .all(requirementId) as Array<{ type: string; url: string }>;

  const ranked = rows
    .filter((item) => item.url?.trim())
    .sort((a, b) => {
      const score = (item: { type: string; url: string }) => {
        if (item.type === 'doc') return 0;
        if (item.type === 'feishu') return 1;
        if (isFeishuUrl(item.url)) return 2;
        return 3;
      };
      return score(a) - score(b);
    });

  const feishuLink = ranked.find((item) => isFeishuUrl(item.url) || item.type === 'doc' || item.type === 'feishu');
  return feishuLink?.url ?? null;
}

function formatRequirementLine(name: string, url?: string | null): string {
  if (url) {
    return `[需求] [${name}](${url})`;
  }
  return `[需求]${name}`;
}

function createEmptySections(): WeeklyReportSections {
  return { completed: [], testing: [], developing: [] };
}

function addRequirementItem(
  sections: WeeklyReportSections,
  section: WeeklyReportSectionKey,
  item: WeeklyReportItem,
): void {
  if (sections[section].some((entry) => entry.requirementId === item.requirementId)) return;
  sections[section].push(item);
}

/** 本周内有状态变更的需求（取区间内最后一次变更后的状态） */
function getRequirementsWithStatusChanges(
  weekStart: string,
  weekEnd: string,
  domain: WorkDomain,
): Array<{ requirement: Requirement; effectiveStatus: RequirementStatus }> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT h.requirement_id, h.new_status, h.changed_at, r.*
       FROM requirement_status_history h
       JOIN requirements r ON r.id = h.requirement_id
       WHERE h.changed_at >= ? AND h.changed_at <= ? AND r.domain = ?
       ORDER BY h.changed_at ASC`,
    )
    .all(weekStart, weekEnd, domain) as Array<Record<string, unknown>>;

  const latestByRequirement = new Map<
    number,
    { requirement: Requirement; effectiveStatus: RequirementStatus }
  >();

  for (const row of rows) {
    const requirement = mapRequirement(row);
    latestByRequirement.set(requirement.id, {
      requirement,
      effectiveStatus: row.new_status as RequirementStatus,
    });
  }

  return [...latestByRequirement.values()];
}

/** 本周有更新但无状态历史记录的需求（兼容历史数据） */
function getRequirementsUpdatedInWeek(
  weekStart: string,
  weekEnd: string,
  excludeIds: Set<number>,
  domain: WorkDomain,
): Array<{ requirement: Requirement; effectiveStatus: RequirementStatus }> {
  return listRequirements({ domain })
    .filter((item) => {
      if (excludeIds.has(item.id)) return false;
      const updated = Date.parse(item.updatedAt);
      return updated >= Date.parse(weekStart) && updated <= Date.parse(weekEnd);
    })
    .map((requirement) => ({ requirement, effectiveStatus: requirement.status }));
}

function collectRiskLines(
  requirements: Requirement[],
  weekStart: string,
  weekEnd: string,
): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const req of requirements) {
    const touched =
      Date.parse(req.updatedAt) >= Date.parse(weekStart) &&
      Date.parse(req.updatedAt) <= Date.parse(weekEnd);
    if (!touched && !['developing', 'integrating', 'testing', 'pending_release'].includes(req.status)) {
      continue;
    }
    if (req.risk) {
      const url = resolveRequirementDocUrl(req.id);
      const line = url
        ? `[需求] [${req.name}](${url})：${req.risk}`
        : `[需求]${req.name}：${req.risk}`;
      if (!seen.has(line)) {
        seen.add(line);
        lines.push(line);
      }
    }
    if (req.blockers) {
      const url = resolveRequirementDocUrl(req.id);
      const line = url
        ? `[需求] [${req.name}](${url})：阻塞 - ${req.blockers}`
        : `[需求]${req.name}：阻塞 - ${req.blockers}`;
      if (!seen.has(line)) {
        seen.add(line);
        lines.push(line);
      }
    }
  }

  return lines;
}

function renderReportContent(sections: WeeklyReportSections, risks: string[]): string {
  const lines: string[] = ['本周工作进展'];

  const sectionOrder: WeeklyReportSectionKey[] = ['completed', 'testing', 'developing'];
  for (const key of sectionOrder) {
    lines.push(`${SECTION_LABELS[key]}：`);
    if (sections[key].length === 0) {
      lines.push('');
    } else {
      for (const item of sections[key]) {
        lines.push(item.text);
      }
    }
  }

  lines.push('下周工作安排', '', '本周经手生产BUG', '', '风险和问题点');
  if (risks.length > 0) {
    lines.push(...risks);
  }

  return lines.join('\n');
}

function appendRequirementToSections(
  sections: WeeklyReportSections,
  requirement: Requirement,
  effectiveStatus: RequirementStatus,
): void {
  const section = STATUS_TO_SECTION[effectiveStatus];
  if (!section) return;
  const docUrl = resolveRequirementDocUrl(requirement.id);
  addRequirementItem(sections, section, {
    type: 'requirement',
    text: formatRequirementLine(requirement.name, docUrl),
    requirementId: requirement.id,
    url: docUrl ?? undefined,
  });
}

export function generateWeeklyReport(input?: {
  weekStart?: string;
  weekEnd?: string;
  domain?: WorkDomain;
}): WeeklyReport {
  const domain = input?.domain ?? 'dev';
  const range =
    input?.weekStart && input?.weekEnd
      ? { start: input.weekStart, end: input.weekEnd }
      : getReportWeekRange();
  const { start: weekStart, end: weekEnd } = range;

  const sections = createEmptySections();
  const coveredRequirementIds = new Set<number>();
  const allTouchedRequirements: Requirement[] = [];

  const statusChanges = getRequirementsWithStatusChanges(weekStart, weekEnd, domain);
  for (const { requirement, effectiveStatus } of statusChanges) {
    coveredRequirementIds.add(requirement.id);
    allTouchedRequirements.push(requirement);
    appendRequirementToSections(sections, requirement, effectiveStatus);
  }

  const updatedFallback = getRequirementsUpdatedInWeek(weekStart, weekEnd, coveredRequirementIds, domain);
  for (const { requirement, effectiveStatus } of updatedFallback) {
    allTouchedRequirements.push(requirement);
    appendRequirementToSections(sections, requirement, effectiveStatus);
  }

  const risks = collectRiskLines(allTouchedRequirements, weekStart, weekEnd);
  const content = renderReportContent(sections, risks);

  return {
    weekStart,
    weekEnd,
    content,
    sections,
    risks,
  };
}
