/** 金融 B2C 销售管线阶段 */
export const SALES_PIPELINE_STAGES = [
  'lead',
  'qualifying',
  'kyc',
  'suitability',
  'proposal',
  'application',
  'review',
  'signing',
  'closed_won',
  'servicing',
  'closed_lost',
] as const;

export type SalesPipelineStage = (typeof SALES_PIPELINE_STAGES)[number];

export const SALES_PIPELINE_STAGE_LABELS: Record<SalesPipelineStage, string> = {
  lead: '线索',
  qualifying: '意向沟通',
  kyc: 'KYC/实名',
  suitability: '适当性/风评',
  proposal: '方案确认',
  application: '进件/申购',
  review: '审批/核保',
  signing: '待签约',
  closed_won: '已成交',
  servicing: '存续服务',
  closed_lost: '流失/拒件',
};

/** 客户 KYC 状态 */
export const SALES_KYC_STATUSES = ['pending', 'in_progress', 'verified', 'rejected'] as const;
export type SalesKycStatus = (typeof SALES_KYC_STATUSES)[number];

export const SALES_KYC_STATUS_LABELS: Record<SalesKycStatus, string> = {
  pending: '未开始',
  in_progress: '进行中',
  verified: '已通过',
  rejected: '未通过',
};

/** 风评等级 C1-C5 */
export const SALES_RISK_LEVELS = ['unknown', 'c1', 'c2', 'c3', 'c4', 'c5'] as const;
export type SalesRiskLevel = (typeof SALES_RISK_LEVELS)[number];

export const SALES_RISK_LEVEL_LABELS: Record<SalesRiskLevel, string> = {
  unknown: '未测评',
  c1: 'C1 保守型',
  c2: 'C2 稳健型',
  c3: 'C3 平衡型',
  c4: 'C4 成长型',
  c5: 'C5 进取型',
};

/** 跟进活动类型 */
export const SALES_ACTIVITY_TYPES = ['call', 'meeting', 'wechat', 'other'] as const;
export type SalesActivityType = (typeof SALES_ACTIVITY_TYPES)[number];

export const SALES_ACTIVITY_TYPE_LABELS: Record<SalesActivityType, string> = {
  call: '电话',
  meeting: '面访',
  wechat: '企微/微信',
  other: '其他',
};

/** 合规模板项定义 */
export interface SalesComplianceTemplateItem {
  key: string;
  label: string;
  required: boolean;
}

/** 各阶段合规必做项（销售自律清单，非监管报送） */
export const SALES_COMPLIANCE_TEMPLATES: Record<
  SalesPipelineStage,
  SalesComplianceTemplateItem[]
> = {
  lead: [
    { key: 'source_recorded', label: '已记录线索来源渠道', required: true },
    { key: 'contact_valid', label: '已确认联系方式有效', required: true },
  ],
  qualifying: [
    { key: 'need_identified', label: '已完成初步需求沟通', required: true },
    { key: 'product_fit_checked', label: '已初步判断产品匹配度', required: false },
  ],
  kyc: [
    { key: 'id_verified', label: '已完成身份核验（实名/KYC）', required: true },
    { key: 'aml_screened', label: '已完成反洗钱基础筛查', required: true },
  ],
  suitability: [
    { key: 'risk_assessment_done', label: '风险承受能力测评已完成且在有效期内', required: true },
    { key: 'suitability_matched', label: '产品与客户风评等级匹配', required: true },
  ],
  proposal: [
    { key: 'solution_presented', label: '已向客户讲解方案要点', required: true },
    { key: 'fee_disclosed', label: '费率/费用/保障范围已说明', required: true },
    { key: 'risk_disclosure_signed', label: '风险揭示书已签署或已读确认', required: true },
  ],
  application: [
    { key: 'application_submitted', label: '正式进件/申购材料已提交', required: true },
    { key: 'docs_complete', label: '必填材料齐全', required: true },
  ],
  review: [
    { key: 'review_tracking', label: '已跟进审批/核保进度', required: true },
  ],
  signing: [
    { key: 'contract_signed', label: '合同/协议已签署', required: true },
    { key: 'payment_authorized', label: '扣款/资金授权已完成（如适用）', required: false },
  ],
  closed_won: [
    { key: 'policy_or_order_confirmed', label: '保单/订单/借据号已确认', required: true },
  ],
  servicing: [
    { key: 'handoff_done', label: '已交接客户成功/存续服务', required: false },
    { key: 'followup_scheduled', label: '已安排下次跟进时间', required: true },
  ],
  closed_lost: [
    { key: 'lost_reason_recorded', label: '已记录流失/拒件原因', required: true },
  ],
};

/** 推进阶段时，需校验「当前阶段」必填合规项是否完成 */
export function getActivePipelineStages(): SalesPipelineStage[] {
  return SALES_PIPELINE_STAGES.filter(
    (stage) => stage !== 'closed_won' && stage !== 'closed_lost' && stage !== 'servicing',
  );
}

export function getNextPipelineStage(
  current: SalesPipelineStage,
): SalesPipelineStage | null {
  const order: SalesPipelineStage[] = [
    'lead',
    'qualifying',
    'kyc',
    'suitability',
    'proposal',
    'application',
    'review',
    'signing',
    'closed_won',
    'servicing',
  ];
  const index = order.indexOf(current);
  if (index < 0 || index >= order.length - 1) return null;
  return order[index + 1] ?? null;
}

export interface SalesCustomer {
  id: number;
  name: string;
  phone: string;
  source: string | null;
  riskLevel: SalesRiskLevel;
  kycStatus: SalesKycStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesOpportunity {
  id: number;
  customerId: number;
  title: string;
  productType: string | null;
  stage: SalesPipelineStage;
  expectedAmount: number | null;
  expectedCloseAt: string | null;
  lostReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesOpportunityListItem extends SalesOpportunity {
  customerName: string;
  customerPhone: string;
}

export interface SalesActivity {
  id: number;
  opportunityId: number;
  type: SalesActivityType;
  content: string;
  activityAt: string;
  createdAt: string;
}

export interface SalesComplianceRecord {
  id: number;
  opportunityId: number;
  stage: SalesPipelineStage;
  itemKey: string;
  completedAt: string | null;
  note: string | null;
}

/** 合规模板项 + 勾选状态（详情页展示） */
export interface SalesComplianceItemView {
  stage: SalesPipelineStage;
  key: string;
  label: string;
  required: boolean;
  completedAt: string | null;
  note: string | null;
}

export interface SalesCustomerDetail extends SalesCustomer {
  opportunities: SalesOpportunity[];
}

export interface SalesOpportunityDetail extends SalesOpportunity {
  customer: SalesCustomer;
  activities: SalesActivity[];
  complianceItems: SalesComplianceItemView[];
}

/** 阶段推进校验结果 */
export interface SalesStageAdvanceCheck {
  ok: boolean;
  missingRequired: SalesComplianceItemView[];
}

export function checkStageComplianceComplete(
  stage: SalesPipelineStage,
  records: Pick<SalesComplianceRecord, 'stage' | 'itemKey' | 'completedAt'>[],
): SalesStageAdvanceCheck {
  const template = SALES_COMPLIANCE_TEMPLATES[stage] ?? [];
  const completedKeys = new Set(
    records
      .filter((r) => r.stage === stage && r.completedAt)
      .map((r) => r.itemKey),
  );
  const missingRequired: SalesComplianceItemView[] = [];
  for (const item of template) {
    if (item.required && !completedKeys.has(item.key)) {
      missingRequired.push({
        stage,
        key: item.key,
        label: item.label,
        required: item.required,
        completedAt: null,
        note: null,
      });
    }
  }
  return { ok: missingRequired.length === 0, missingRequired };
}

export function buildComplianceItemViews(
  stage: SalesPipelineStage,
  records: SalesComplianceRecord[],
): SalesComplianceItemView[] {
  const template = SALES_COMPLIANCE_TEMPLATES[stage] ?? [];
  const recordMap = new Map(
    records.filter((r) => r.stage === stage).map((r) => [r.itemKey, r]),
  );
  return template.map((item) => {
    const record = recordMap.get(item.key);
    return {
      stage,
      key: item.key,
      label: item.label,
      required: item.required,
      completedAt: record?.completedAt ?? null,
      note: record?.note ?? null,
    };
  });
}
