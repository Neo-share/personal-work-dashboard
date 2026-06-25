import { describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import { seedDatabase } from '../db/seed.js';
import {
  buildReviseContextSummary,
  detectCapability,
  formatAiResultProvider,
  generateAiHtml,
  mergeExternalSnippetsIntoKnowledge,
  reviseAiResult,
} from './ai-result-service.js';
import type { KnowledgeSnippet } from './internal-knowledge-retriever.js';
import { getTodoAiResults } from './todo-service.js';

describe('detectCapability 能力判定（L1-05 / L1-06）', () => {
  // L1-05 05.14：不可自动
  it.each([
    ['下周三电话回访客户', '需人工处理'],
    ['线下见面签字', '需人工处理'],
  ])('05.14 不可自动：%s', (title, reason) => {
    const result = detectCapability(title);
    expect(result.canAuto).toBe(false);
    expect(result.resultType).toBeNull();
    expect(result.reason).toBe(reason);
  });

  // L1-05 05.15–05.21：可自动能力类型
  it.each([
    ['做会议纪要', 'minutes'],
    ['港股收盘复盘', 'review'],
    ['协议合规审核', 'audit'],
    ['完成 UI 改版方案', 'plan'],
    ['撰写季度报告', 'report'],
    ['成交量分析', 'analysis'],
    ['基金选品对比', 'pick'],
  ])('05.15–05.21 命中 %s → %s', (title, resultType) => {
    const result = detectCapability(title);
    expect(result.canAuto).toBe(true);
    expect(result.resultType).toBe(resultType);
  });

  // L1-06 06.03：未命中能力词
  it('06.03 未命中可自动能力词时 canAuto=false', () => {
    const result = detectCapability('整理桌面');
    expect(result.canAuto).toBe(false);
    expect(result.resultType).toBeNull();
  });

  it('06.01 描述字段参与能力判定', () => {
    const result = detectCapability('待办事项', '补充会议纪要要点');
    expect(result.canAuto).toBe(true);
    expect(result.resultType).toBe('minutes');
  });
});

describe('generateAiHtml 规则模板', () => {
  it('formal Soul 语气前缀写入 HTML', () => {
    const html = generateAiHtml('minutes', '周会', {
      tone: 'formal',
      customInstructions: '',
    });
    expect(html).toContain('【正式表述】');
  });

  it('customInstructions 追加到模板末尾', () => {
    const html = generateAiHtml('audit', '合规', {
      tone: 'neutral',
      customInstructions: '优先列风险项',
    });
    expect(html).toContain('Soul 偏好');
    expect(html).toContain('优先列风险项');
  });
});

describe('reviseAiResult 多轮修订（L1-06）', () => {
  // L1-06 06.08：版本递增
  it('06.08 修订后 version 在最新版本基础上 +1', async () => {
    seedDatabase(getDb());
    const before = getTodoAiResults(1);
    const maxBefore = Math.max(...before.map((r) => r.version));

    const revised = await reviseAiResult(1, 'minutes', '做会议纪要', '补充负责人');

    expect(revised.version).toBe(maxBefore + 1);
    const after = getTodoAiResults(1);
    expect(after).toHaveLength(before.length + 1);
    expect(after[after.length - 1]?.version).toBe(revised.version);
    expect(revised.htmlContent.length).toBeGreaterThan(0);
  });

  it('06.08 连续修订版本号单调递增', async () => {
    seedDatabase(getDb());

    const first = await reviseAiResult(1, 'minutes', '做会议纪要', '补充行动项');
    const second = await reviseAiResult(1, 'minutes', '做会议纪要', '精简结论');

    expect(second.version).toBe(first.version + 1);
  });
});

describe('ai-result-service RAG 元数据', () => {
  it('formatAiResultProvider 记录 snippetIds', () => {
    expect(formatAiResultProvider('llm', [])).toBe('llm');
    expect(formatAiResultProvider('llm', ['schedule_events:1', 'todo_ai_results:2'])).toBe(
      'llm-rag:schedule_events:1,todo_ai_results:2',
    );
    expect(formatAiResultProvider('rule-template', ['todos:3'])).toBe('rule-template');
  });

  it('buildReviseContextSummary 含日程与外部文档说明', () => {
    const snippets: KnowledgeSnippet[] = [
      {
        id: 'schedule_events:1',
        sourceTable: 'schedule_events',
        sourceId: 1,
        label: '日程 · 产品需求评审',
        excerpt: '产品需求评审 10:30-11:30',
      },
    ];
    expect(buildReviseContextSummary(snippets, 1)).toBe('已参考 v1 与日程上下文');
    expect(buildReviseContextSummary([], 2)).toBe('已参考 v2');
    expect(
      buildReviseContextSummary(snippets, 1, [{ source: '飞书文档', excerpt: 'PRD' }]),
    ).toBe('已参考 v1、日程与外部文档上下文');
  });

  it('mergeExternalSnippetsIntoKnowledge 将 MCP 片段置于前列', () => {
    const merged = mergeExternalSnippetsIntoKnowledge(
      [
        {
          id: 'todos:1',
          sourceTable: 'todos',
          sourceId: 1,
          label: '待办',
          excerpt: '内部',
        },
      ],
      [{ source: '飞书', excerpt: '外部' }],
    );
    expect(merged[0]?.id).toMatch(/^external_mcp:/);
    expect(merged).toHaveLength(2);
  });
});
