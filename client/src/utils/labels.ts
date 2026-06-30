import {
  LINK_TYPE_LABELS,
  PRIORITY_LABELS,
  REQUIREMENT_STATUS_LABELS,
  SALES_ACTIVITY_TYPE_LABELS,
  SALES_KYC_STATUS_LABELS,
  SALES_PIPELINE_STAGE_LABELS,
  SALES_RISK_LEVEL_LABELS,
  WORK_DOMAIN_LABELS,
  type LinkType,
  type Priority,
  type RequirementStatus,
  type SalesActivityType,
  type SalesKycStatus,
  type SalesPipelineStage,
  type SalesRiskLevel,
  type WorkDomain,
} from '@project-manager/shared';

export function getRequirementStatusLabel(status: RequirementStatus): string {
  return REQUIREMENT_STATUS_LABELS[status] ?? status;
}

export function getPriorityLabel(priority: Priority): string {
  return PRIORITY_LABELS[priority] ?? priority;
}

export function getWorkDomainLabel(domain: WorkDomain): string {
  return WORK_DOMAIN_LABELS[domain] ?? domain;
}

export function getLinkTypeLabel(type: LinkType | string): string {
  return LINK_TYPE_LABELS[type as LinkType] ?? type;
}

export function formatActiveDate(value: string | null | undefined): string {
  if (!value) return '-';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value.slice(0, 10);
  return new Date(parsed).toISOString().slice(0, 10);
}

export function getDirectionLabel(direction: 'upstream' | 'downstream'): string {
  return direction === 'upstream' ? '上游开发' : '下游交付';
}

export function getSalesPipelineStageLabel(stage: SalesPipelineStage): string {
  return SALES_PIPELINE_STAGE_LABELS[stage] ?? stage;
}

export function getSalesKycStatusLabel(status: SalesKycStatus): string {
  return SALES_KYC_STATUS_LABELS[status] ?? status;
}

export function getSalesRiskLevelLabel(level: SalesRiskLevel): string {
  return SALES_RISK_LEVEL_LABELS[level] ?? level;
}

export function getSalesActivityTypeLabel(type: SalesActivityType): string {
  return SALES_ACTIVITY_TYPE_LABELS[type] ?? type;
}
