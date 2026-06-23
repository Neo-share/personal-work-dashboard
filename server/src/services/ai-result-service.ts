import type { AiResultType, PersonalAssistantSoulSettings } from '@project-manager/shared';
import { getDb } from '../db/index.js';
import { getPersonalAssistantSoulSettings } from './personal-assistant-soul-service.js';

/** 异步生成延迟（毫秒），便于前端展示 pending 态并轮询 */
const AI_GENERATION_DELAY_MS = 1500;

const pendingGenerations = new Set<number>();

/** 能力判定：不可自动的关键词 */
const MANUAL_KEYWORDS = ['电话', '回访', '线下', '见面', '签字'];

/** 能力判定：可自动的关键词 → 结果类型 */
const AUTO_KEYWORD_MAP: Array<[RegExp, AiResultType]> = [
  [/会议纪要|纪要/, 'minutes'],
  [/复盘/, 'review'],
  [/审核|合规/, 'audit'],
  [/方案|改版/, 'plan'],
  [/报告/, 'report'],
  [/分析/, 'analysis'],
  [/选品|基金/, 'pick'],
];

export interface CapabilityResult {
  canAuto: boolean;
  resultType: AiResultType | null;
  reason: string;
}

export function detectCapability(title: string, description?: string | null): CapabilityResult {
  const text = `${title} ${description ?? ''}`;
  for (const keyword of MANUAL_KEYWORDS) {
    if (text.includes(keyword)) {
      return { canAuto: false, resultType: null, reason: '需人工处理' };
    }
  }
  for (const [pattern, resultType] of AUTO_KEYWORD_MAP) {
    if (pattern.test(text)) {
      return { canAuto: true, resultType, reason: `可自动生成${resultType}结果` };
    }
  }
  return { canAuto: false, resultType: null, reason: '未命中可自动能力词' };
}

/** 规则模板生成 AI 初步结果 HTML */
export function generateAiHtml(
  resultType: AiResultType,
  title: string,
  soulSettings?: PersonalAssistantSoulSettings,
): string {
  const soul = soulSettings ?? getPersonalAssistantSoulSettings();
  const tonePrefix =
    soul.tone === 'formal'
      ? '【正式表述】'
      : soul.tone === 'friendly'
        ? '【友好表述】'
        : '';
  const templates: Record<AiResultType, string> = {
    minutes: `<h3>${tonePrefix}会议纪要 · ${title}</h3>
<ul><li><strong>进度</strong>：讨论进行中，核心议题已覆盖 60%</li>
<li><strong>要点</strong>：需求范围确认、排期对齐、风险项梳理</li>
<li><strong>结论</strong>：待补充行动项后发送全员</li></ul>`,
    review: `<h3>复盘 · ${title}</h3>
<div style="display:flex;gap:12px;margin:8px 0">
<div style="padding:8px 12px;background:#f0fdf4;border-radius:8px"><strong>+2.3%</strong><br/>涨幅</div>
<div style="padding:8px 12px;background:#fef2f2;border-radius:8px"><strong>3</strong><br/>风险项</div>
</div><p><strong>结论</strong>：整体趋势向好，需关注波动区间。</p>`,
    audit: `<h3>合规审核清单 · ${title}</h3>
<ol><li>协议条款完整性 ✓</li><li>隐私政策引用 ✓</li>
<li>用户授权流程 □ 待确认</li><li>数据留存期限 □ 待补充</li></ol>`,
    plan: `<h3>方案 · ${title}</h3>
<p><strong>背景</strong>：业务目标明确，需快速交付 MVP。</p>
<ol><li>信息架构梳理</li><li>交互原型</li><li>视觉规范</li><li>开发排期</li></ol>
<p><strong>风险</strong>：设计资源紧张，需提前锁定评审窗口。</p>`,
    report: `<h3>报告 · ${title}</h3>
<p><strong>摘要</strong>：本期核心指标达成预期，用户反馈积极。</p>
<ul><li>DAU 环比 +5.2%</li><li>转化率 3.8%</li><li>客诉率 0.12%</li></ul>`,
    analysis: `<h3>分析 · ${title}</h3>
<table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
<tr><th>指标</th><th>数值</th><th>环比</th></tr>
<tr><td>成交量</td><td>1.2M</td><td>+8%</td></tr>
<tr><td>持仓量</td><td>450K</td><td>-2%</td></tr></table>`,
    pick: `<h3>选品分析 · ${title}</h3>
<table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
<tr><th>基金</th><th>近1年</th><th>风险</th></tr>
<tr><td>稳健增长A</td><td>+12.3%</td><td>中低</td></tr>
<tr><td>价值精选B</td><td>+8.7%</td><td>中</td></tr></table>`,
  };
  let html = templates[resultType];
  if (soul.customInstructions) {
    html += `<p style="font-size:12px;color:#64748b;margin-top:12px"><strong>Soul 偏好</strong>：${soul.customInstructions}</p>`;
  }
  return html;
}

/** 延迟异步生成，创建待办后立即返回 pending 态 */
export function scheduleAiResultGeneration(
  todoId: number,
  resultType: AiResultType,
  title: string,
): void {
  if (pendingGenerations.has(todoId)) {
    return;
  }
  pendingGenerations.add(todoId);
  setTimeout(() => {
    try {
      const todo = getDb()
        .prepare('SELECT ai_status FROM todos WHERE id = ?')
        .get(todoId) as { ai_status: string } | undefined;
      // 仅 pending 时写入，避免重复或已取消
      if (todo?.ai_status === 'pending') {
        createAiResultForTodo(todoId, resultType, title);
      }
    } finally {
      pendingGenerations.delete(todoId);
    }
  }, AI_GENERATION_DELAY_MS);
}

export function createAiResultForTodo(
  todoId: number,
  resultType: AiResultType,
  title: string,
): { id: number; version: number; htmlContent: string } {
  const db = getDb();
  const now = new Date().toISOString();
  const latest = db
    .prepare('SELECT MAX(version) as maxVersion FROM todo_ai_results WHERE todo_id = ?')
    .get(todoId) as { maxVersion: number | null };
  const version = (latest.maxVersion ?? 0) + 1;
  const htmlContent = generateAiHtml(resultType, title);

  const result = db
    .prepare(
      `INSERT INTO todo_ai_results (todo_id, version, result_type, html_content, status, provider, created_at)
       VALUES (?, ?, ?, ?, 'ready', 'rule-template', ?)`,
    )
    .run(todoId, version, resultType, htmlContent, now);

  db.prepare(
    `UPDATE todos SET ai_status = 'ready', ai_result_type = ?, updated_at = ? WHERE id = ?`,
  ).run(resultType, now, todoId);

  return { id: Number(result.lastInsertRowid), version, htmlContent };
}

export function reviseAiResult(
  todoId: number,
  resultType: AiResultType,
  title: string,
  revisionHint: string,
): { id: number; version: number; htmlContent: string } {
  let html = generateAiHtml(resultType, title);
  // Demo 修改关键词处理
  if (/进度|百分比/.test(revisionHint)) {
    html = html.replace(/60%|\+2\.3%|\+12\.3%/, '85%');
  }
  if (/补充|添加/.test(revisionHint)) {
    html += '<p><em>（已补充用户要求的内容）</em></p>';
  }
  if (/精简/.test(revisionHint)) {
    html = html.replace(/<li>.*?<\/li>/g, '').slice(0, 500);
  }
  if (/结论/.test(revisionHint)) {
    html = html.replace(/结论.*?<\/p>/, '结论：已按用户意见更新。</p>');
  }
  if (/删除段落/.test(revisionHint)) {
    html = html.split('</p>')[0] + '</p>';
  }
  if (/表格|选品/.test(revisionHint)) {
    html += '<p>已更新表格数据。</p>';
  }

  const db = getDb();
  const now = new Date().toISOString();
  const latest = db
    .prepare('SELECT MAX(version) as maxVersion FROM todo_ai_results WHERE todo_id = ?')
    .get(todoId) as { maxVersion: number | null };
  const version = (latest.maxVersion ?? 0) + 1;

  const result = db
    .prepare(
      `INSERT INTO todo_ai_results (todo_id, version, result_type, html_content, status, provider, created_at)
       VALUES (?, ?, ?, ?, 'ready', 'rule-template', ?)`,
    )
    .run(todoId, version, resultType, html, now);

  db.prepare(`UPDATE todos SET ai_status = 'ready', updated_at = ? WHERE id = ?`).run(now, todoId);

  return { id: Number(result.lastInsertRowid), version, htmlContent: html };
}
