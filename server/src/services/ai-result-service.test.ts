import { describe, expect, it } from 'vitest';
import {
  buildReviseContextSummary,
  formatAiResultProvider,
  mergeExternalSnippetsIntoKnowledge,
} from './ai-result-service.js';
import type { KnowledgeSnippet } from './internal-knowledge-retriever.js';

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
