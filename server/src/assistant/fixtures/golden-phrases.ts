/**
 * 产品 §6.4 黄金话术 + 重复周期/冲突优先级（F0 行为基准，共 11 条）
 */
export type GoldenIntentType =
  | 'schedule'
  | 'todo'
  | 'recurring'
  | 'recurring_schedule'
  | 'unknown';

export interface GoldenPhraseCase {
  input: string;
  intent: GoldenIntentType;
  /** 端到端集成测：回复须包含的片段 */
  replyIncludes?: string;
}

export const GOLDEN_PHRASES: GoldenPhraseCase[] = [
  { input: '明天下午3点开项目评审会', intent: 'schedule', replyIncludes: '会议安排' },
  { input: '下周二上午10点面试产品经理', intent: 'schedule', replyIncludes: '会议安排' },
  { input: '周三去北京出差', intent: 'schedule', replyIncludes: '会议安排' },
  { input: '本周五提醒我完成UI改造方案', intent: 'todo', replyIncludes: '待执行事项' },
  {
    input: '提醒我每天下午5点复盘港股收盘情况',
    intent: 'recurring',
    replyIncludes: '重复执行任务',
  },
  {
    input: '提醒我每月15号下午5点回访客户',
    intent: 'recurring',
    replyIncludes: '重复执行任务',
  },
  { input: '提醒我下周三完成协议合规审核', intent: 'todo', replyIncludes: '待执行事项' },
  { input: '会后整理会议纪要', intent: 'todo', replyIncludes: '待执行事项' },
  { input: '每周五开周会', intent: 'recurring_schedule', replyIncludes: '例会' },
  { input: '每天上午10点开站会', intent: 'recurring_schedule', replyIncludes: '例会' },
  { input: '今天天气怎么样', intent: 'unknown', replyIncludes: '我可以帮你创建待办' },
];

/** IntentRouter 单测默认上下文 */
export const GOLDEN_ROUTE_CONTEXT = { sessionId: 1 };
