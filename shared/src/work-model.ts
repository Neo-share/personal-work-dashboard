/**
 * 个人驾驶舱领域模型（逻辑层抽象）
 *
 * 持久化仍使用 requirements 等历史表名，通过类型别名与模块边界平滑演进。
 */
import type { Requirement, WorkbenchSummary, WorkDomain } from './types.js';

/** 工作项：个人范围内的一条可跟踪工作（当前映射 requirements 表） */
export type WorkItem = Requirement;

/** 工作项生命周期状态（当前与开发流程共用，后续可拆为通用状态机） */
export type WorkItemStatus = Requirement['status'];

/** 工作台快照：跨工作域聚合的个人视图 */
export type WorkbenchSnapshot = WorkbenchSummary;

/** 可挂载到工作项的上下文资产类型 */
export type WorkContextKind = 'repository' | 'link' | 'person' | 'milestone';

/** 工作域模块定义：区分能力边界，而非独立微服务 */
export interface WorkDomainModule {
  id: WorkDomain;
  label: string;
  /** 是否启用 Git / 仓库 / 扫描等开发专属能力 */
  devCapabilities: boolean;
}

export const WORK_DOMAIN_MODULES: WorkDomainModule[] = [
  { id: 'dev', label: '开发', devCapabilities: true },
  { id: 'life', label: '生活', devCapabilities: false },
  { id: 'learning', label: '学习', devCapabilities: false },
  { id: 'admin', label: '事务', devCapabilities: false },
  { id: 'other', label: '其他', devCapabilities: false },
];

export function isDevWorkDomain(domain: WorkDomain): boolean {
  return domain === 'dev';
}

export function getWorkDomainModule(domain: WorkDomain): WorkDomainModule {
  return WORK_DOMAIN_MODULES.find((item) => item.id === domain) ?? WORK_DOMAIN_MODULES[4]!;
}
