import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PersonalAssistantPanel from './PersonalAssistantPanel';

const mockInvalidateTodoThread = vi.fn();
const mockInvalidateMetrics = vi.fn();
const mockMessagesFetch = vi.fn(async () => [] as Array<{ role: 'user' | 'assistant'; content: string }>);
let todoThreadFetchImpl: (args: { todoId: number }) => Promise<unknown> = async () => ({
  sessionId: 1,
  title: '测试待办',
  latestVersion: 2,
  messages: [{ role: 'assistant' as const, content: '线程历史消息' }],
});

const mockOnRefresh = vi.fn();
const mockOnEnterModify = vi.fn();
const mockRefetchTodoThreads = vi.fn();

const mockTodoThreads = vi.hoisted(() => [
  {
    todoId: 1,
    title: '做会议纪要',
    latestVersion: 2,
    messageCount: 3,
    latestHtmlPreview: '<h3>会议纪要 v2</h3><p>进度 85%</p>',
  },
]);
const stableSessions = [{ id: 1, title: '默认会话' }];
const stableSoulSettings = undefined;
const stableMetricsSummary = undefined;

const stableTrpcUtils = {
  assistant: {
    todoThread: {
      fetch: (args: { todoId: number }) => todoThreadFetchImpl(args),
      invalidate: mockInvalidateTodoThread,
    },
    messages: {
      fetch: (args: { sessionId: number }) => mockMessagesFetch(args),
    },
    metricsSummary: {
      invalidate: mockInvalidateMetrics,
    },
  },
};

vi.mock('../../lib/trpc', () => ({
  trpc: {
    useUtils: () => stableTrpcUtils,
    assistant: {
      sessions: {
        useQuery: () => ({ data: stableSessions }),
      },
      todoThreads: {
        useQuery: () => ({ data: mockTodoThreads, refetch: mockRefetchTodoThreads }),
      },
      createSession: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      metricsSummary: {
        useQuery: () => ({
          data: stableMetricsSummary,
          isLoading: false,
          isFetching: false,
          refetch: vi.fn(),
        }),
      },
    },
    personalWorkbench: {
      getSoulSettings: {
        useQuery: () => ({ data: stableSoulSettings, refetch: vi.fn() }),
      },
      setSoulSettings: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
  },
}));

function sseResponse(events: unknown[]): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

describe('PersonalAssistantPanel', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockMessagesFetch.mockResolvedValue([]);
    mockTodoThreads.splice(0, mockTodoThreads.length, {
      todoId: 1,
      title: '做会议纪要',
      latestVersion: 2,
      messageCount: 3,
      latestHtmlPreview: '<h3>会议纪要 v2</h3><p>进度 85%</p>',
    });
    todoThreadFetchImpl = async () => ({
      sessionId: 1,
      title: '测试待办',
      latestVersion: 2,
      messages: [{ role: 'assistant' as const, content: '线程历史消息' }],
    });
  });

  it('修改模式下展示修改模式栏', async () => {
    render(
      <PersonalAssistantPanel modifyTodoId={42} modifyVersion={3} onRefresh={mockOnRefresh} />,
    );

    expect(await screen.findByText(/修改模式 · 待办 #42 · v3/)).toBeInTheDocument();
  });

  it('SSE refresh 事件触发 onRefresh', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn(async () =>
      sseResponse([
        { type: 'text', content: '已修订' },
        { type: 'refresh', refresh: ['todos', 'summary'] },
      ]),
    ) as typeof fetch;

    const { container } = render(<PersonalAssistantPanel onRefresh={mockOnRefresh} />);
    const panel = within(container);

    const input = panel.getByPlaceholderText('向个人助手提问');
    await user.type(input, '把进度改成 90%');
    await user.click(panel.getByRole('button', { name: /发\s*送/ }));

    await waitFor(() => {
      expect(mockOnRefresh).toHaveBeenCalledWith(['todos', 'summary']);
    });
    expect(panel.getByText('已修订')).toBeInTheDocument();
  });

  it('发送中 todoThread 同步完成时不覆盖用户消息', async () => {
    const user = userEvent.setup();
    let resolveThread!: (value: unknown) => void;
    const threadPromise = new Promise((resolve) => {
      resolveThread = resolve;
    });
    todoThreadFetchImpl = () => threadPromise as Promise<unknown>;

    let resolveChat!: () => void;
    const chatPromise = new Promise<Response>((resolve) => {
      resolveChat = () =>
        resolve(
          sseResponse([
            { type: 'text', content: '修订完成' },
            { type: 'refresh', refresh: ['todos'] },
          ]),
        );
    });
    global.fetch = vi.fn(() => chatPromise) as typeof fetch;

    const { container } = render(
      <PersonalAssistantPanel modifyTodoId={1} modifyVersion={1} onRefresh={mockOnRefresh} />,
    );
    const panel = within(container);

    const input = panel.getByPlaceholderText('向个人助手提问');
    await user.type(input, '补充风险项');
    await user.click(panel.getByRole('button', { name: /发\s*送/ }));

    expect(panel.getByText('补充风险项')).toBeInTheDocument();

    resolveThread({
      sessionId: 1,
      title: '测试待办',
      latestVersion: 1,
      messages: [{ role: 'assistant', content: '线程历史消息' }],
    });

    await waitFor(() => {
      expect(panel.getByText('补充风险项')).toBeInTheDocument();
    });
    expect(panel.queryByText('线程历史消息')).not.toBeInTheDocument();

    resolveChat();
    await waitFor(() => {
      expect(panel.getByText('修订完成')).toBeInTheDocument();
    });
  });

  describe('历史对话 Modal（L1-06）', () => {
    // L1-06 06.11：顶栏历史入口
    it('06.11 点击「历史」打开历史对话弹窗', async () => {
      const user = userEvent.setup();
      render(<PersonalAssistantPanel onRefresh={mockOnRefresh} onEnterModify={mockOnEnterModify} />);

      await user.click(screen.getByRole('button', { name: '历史' }));

      expect(mockRefetchTodoThreads).toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: /历史对话 · AI 结果/ })).toBeInTheDocument();
    });

    // L1-06 06.12：左栏列表
    it('06.12 左栏展示待办标题、版本与对话条数', async () => {
      const user = userEvent.setup();
      render(<PersonalAssistantPanel onEnterModify={mockOnEnterModify} />);

      await user.click(screen.getByRole('button', { name: '历史' }));

      const dialog = screen.getByRole('dialog', { name: /历史对话 · AI 结果/ });
      expect(within(dialog).getByText('做会议纪要')).toBeInTheDocument();
      expect(within(dialog).getByText(/v2 · 3 条对话/)).toBeInTheDocument();
    });

    // L1-06 06.13：右栏预览
    it('06.13 选中线程后右栏展示 AI 结果预览', async () => {
      const user = userEvent.setup();
      render(<PersonalAssistantPanel onEnterModify={mockOnEnterModify} />);

      await user.click(screen.getByRole('button', { name: '历史' }));
      const dialog = screen.getByRole('dialog', { name: /历史对话 · AI 结果/ });
      await user.click(within(dialog).getByRole('button', { name: /做会议纪要/ }));

      expect(within(dialog).getByText('进度 85%')).toBeInTheDocument();
    });

    // L1-06 06.14：继续修改
    it('06.14 点击「继续修改」关闭弹窗并回调 onEnterModify', async () => {
      const user = userEvent.setup();
      render(<PersonalAssistantPanel onEnterModify={mockOnEnterModify} />);

      await user.click(screen.getByRole('button', { name: '历史' }));
      const dialog = screen.getByRole('dialog', { name: /历史对话 · AI 结果/ });
      await user.click(within(dialog).getByRole('button', { name: /做会议纪要/ }));
      await user.click(within(dialog).getByRole('button', { name: '继续修改' }));

      expect(mockOnEnterModify).toHaveBeenCalledWith(1, 2);
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /历史对话 · AI 结果/ })).not.toBeInTheDocument();
      });
    });
  });
});
