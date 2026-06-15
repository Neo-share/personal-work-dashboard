/** 需求状态 */
export type RequirementStatus =
  | 'pending_review'
  | 'developing'
  | 'integrating'
  | 'testing'
  | 'pending_release'
  | 'released'
  | 'paused';

/** 优先级 */
export type Priority = 'high' | 'medium' | 'low';

/** 个人工作域：区分开发、生活、学习等，同一套工作项模型下分域管理 */
export type WorkDomain = 'dev' | 'life' | 'learning' | 'admin' | 'other';

/** 协作方向 */
export type CollaborationDirection = 'upstream' | 'downstream';

/** 管理角色 */
export type ManagementRole =
  | 'owner'
  | 'participant'
  | 'watcher'
  | 'acceptor'
  | 'release_coordinator';

/** 人员协作状态 */
export type PersonCollaborationStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked';

/** 里程碑状态 */
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface Repository {
  id: number;
  name: string;
  path: string;
  remote: string | null;
  defaultBranch: string | null;
  currentBranch: string | null;
  lastCommit: string | null;
  lastCommitAuthor: string | null;
  lastCommitAt: string | null;
  isDirty: boolean;
  techTags: string[];
  envScripts: string[];
  scannedAt: string | null;
}

export interface RepositoryBranchItem {
  name: string;
  notes: string | null;
}

export interface RepositoryBranches {
  currentBranch: string | null;
  branches: RepositoryBranchItem[];
}

export interface RepositoryBranchSyncResult {
  ok: true;
  mode: 'fetch' | 'pull';
  branch: string | null;
  summary: string;
  currentBranch: string | null;
}

export interface Person {
  id: number;
  name: string;
  role: string;
  team: string | null;
  contact: string | null;
  feishuOpenId: string | null;
}

export interface Requirement {
  id: number;
  name: string;
  domain: WorkDomain;
  status: RequirementStatus;
  priority: Priority;
  targetVersion: string | null;
  plannedReleaseAt: string | null;
  actualReleaseAt: string | null;
  risk: string | null;
  blockers: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementRepository {
  id: number;
  requirementId: number;
  repositoryId: number;
  responsibility: string | null;
  branch: string | null;
  env: string | null;
  status: string | null;
  risk: string | null;
}

export interface RequirementPerson {
  id: number;
  requirementId: number;
  personId: number;
  managementRole: ManagementRole;
  direction: CollaborationDirection;
  roleType: string;
  responsibility: string | null;
  status: PersonCollaborationStatus;
  notes: string | null;
}

export interface Milestone {
  id: number;
  requirementId: number;
  name: string;
  targetDate: string | null;
  status: MilestoneStatus;
  blockers: string | null;
}

export interface Link {
  id: number;
  requirementId: number;
  type: string;
  title: string;
  url: string;
}

export interface RequirementDetail extends Requirement {
  repositories: Array<RequirementRepository & { repository: Repository }>;
  people: Array<RequirementPerson & { person: Person }>;
  milestones: Milestone[];
  links: Link[];
}

export interface WorkbenchSummary {
  pendingPush: Requirement[];
  pendingConfirm: Requirement[];
  riskRequirements: Requirement[];
  upcomingRelease: Requirement[];
  totalRequirements: number;
  totalRepositories: number;
  dirtyRepositories: number;
}

export interface ScanFailure {
  name: string;
  path: string;
  reason: string;
}

export interface ScanResult {
  scannedAt: string;
  repositoryCount: number;
  repositories: Repository[];
  failures: ScanFailure[];
}

export type GraphNodeType = 'requirement' | 'repository' | 'person' | 'milestone';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  meta?: Record<string, string | number | boolean | null>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface RequirementGraph {
  requirementId: number | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type NavigationActionType =
  | 'openRequirementDetail'
  | 'filterRequirements'
  | 'openGraph'
  | 'openScanCenter'
  | 'openWorkbench';

export interface NavigationAction {
  type: NavigationActionType;
  payload?: Record<string, string | number | boolean>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  action?: NavigationAction;
}

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  pending_review: '待评审',
  developing: '开发中',
  integrating: '联调中',
  testing: '提测中',
  pending_release: '待上线',
  released: '已上线',
  paused: '已暂停',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export const WORK_DOMAIN_LABELS: Record<WorkDomain, string> = {
  dev: '开发',
  life: '生活',
  learning: '学习',
  admin: '事务',
  other: '其他',
};

/** 周报进展分组 */
export type WeeklyReportSectionKey = 'completed' | 'testing' | 'developing';

export const WEEKLY_REPORT_SECTION_LABELS: Record<WeeklyReportSectionKey, string> = {
  completed: '已完成',
  testing: '测试中',
  developing: '开发中',
};

export interface WeeklyReportItem {
  type: 'requirement';
  text: string;
  requirementId: number;
  /** 飞书需求文档链接 */
  url?: string;
}

export interface WeeklyReportSections {
  completed: WeeklyReportItem[];
  testing: WeeklyReportItem[];
  developing: WeeklyReportItem[];
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  content: string;
  sections: WeeklyReportSections;
  risks: string[];
}

export interface RequirementStatusHistory {
  id: number;
  requirementId: number;
  oldStatus: RequirementStatus;
  newStatus: RequirementStatus;
  changedAt: string;
}
