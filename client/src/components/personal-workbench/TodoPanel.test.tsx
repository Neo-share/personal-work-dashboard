import type { TodoFilter, TodoItem } from '@project-manager/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TodoPanel from './TodoPanel';

const mockListInvalidate = vi.fn();
const mockSummaryInvalidate = vi.fn();
const listQueryCalls = vi.hoisted(() => [] as Array<{ filter?: TodoFilter }>);

const todosByFilter = vi.hoisted((): Record<TodoFilter, TodoItem[]> => {
  const baseTodo = {
    description: null,
    dueAt: null,
    source: 'manual' as const,
    isUrgent: false,
    aiStatus: 'none' as const,
    aiResultType: null,
    recurringTaskId: null,
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const activeTodo: TodoItem = {
    ...baseTodo,
    id: 1,
    title: '进行中任务',
    status: 'active',
  };

  const urgentTodo: TodoItem = {
    ...baseTodo,
    id: 2,
    title: '紧急任务',
    status: 'active',
    isUrgent: true,
  };

  const overdueTodo: TodoItem = {
    ...baseTodo,
    id: 3,
    title: '逾期任务',
    status: 'active',
    dueAt: '2026-01-01T08:00:00.000Z',
    isOverdue: true,
  };

  const completedTodo: TodoItem = {
    ...baseTodo,
    id: 4,
    title: '已完成任务',
    status: 'completed',
    completedAt: '2026-06-20T10:00:00.000Z',
  };

  return {
    active: [activeTodo, urgentTodo],
    all: [activeTodo, completedTodo],
    completed: [completedTodo],
    overdue: [overdueTodo],
  };
});

vi.mock('../../lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      todos: { list: { invalidate: mockListInvalidate } },
      personalWorkbench: { summary: { invalidate: mockSummaryInvalidate } },
    }),
    todos: {
      list: {
        useQuery: (input?: { filter?: TodoFilter }) => {
          listQueryCalls.push(input ?? {});
          const filter = input?.filter ?? 'active';
          return { data: todosByFilter[filter], isLoading: false };
        },
      },
      create: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      update: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      complete: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      restore: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      delete: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      cancel: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      aiResults: {
        useQuery: () => ({ data: [] }),
      },
      confirmAiResult: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
  },
}));

describe('TodoPanel 筛选与卡片（L1-02）', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    listQueryCalls.length = 0;
  });

  // L1-02 02.01：四档筛选项
  it('02.01 展示进行中/全部待办/已完成/已逾期筛选项', () => {
    render(<TodoPanel />);

    expect(screen.getByRole('button', { name: '进行中' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全部待办' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '已完成' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '已逾期' })).toBeInTheDocument();
    expect(listQueryCalls[0]).toEqual({ filter: 'active' });
  });

  // L1-02 02.02：进行中不展示历史已完成
  it('02.02 进行中筛选仅展示 active 卡片且无历史区', () => {
    render(<TodoPanel />);

    expect(screen.getByText('进行中任务')).toBeInTheDocument();
    expect(screen.queryByText('已完成任务')).not.toBeInTheDocument();
    expect(screen.queryByText(/历史已完成/)).not.toBeInTheDocument();
  });

  // L1-02 02.03：全部待办展开历史已完成
  it('02.03 全部待办请求 all 并同时展示进行中与已完成', async () => {
    const user = userEvent.setup();
    render(<TodoPanel />);

    await user.click(screen.getByRole('button', { name: '全部待办' }));

    expect(listQueryCalls.some((c) => c.filter === 'all')).toBe(true);
    expect(screen.getByText('进行中任务')).toBeInTheDocument();
    expect(screen.getByText('已完成任务')).toBeInTheDocument();
    expect(screen.getByText(/历史已完成 \(1\)/)).toBeInTheDocument();
  });

  // L1-02 02.04：已完成筛选
  it('02.04 已完成筛选仅展示历史已完成区', async () => {
    const user = userEvent.setup();
    render(<TodoPanel />);

    await user.click(screen.getByRole('button', { name: '已完成' }));

    expect(listQueryCalls.some((c) => c.filter === 'completed')).toBe(true);
    expect(screen.queryByText('进行中任务')).not.toBeInTheDocument();
    expect(screen.getByText('已完成任务')).toBeInTheDocument();
  });

  // L1-02 02.05：已逾期筛选
  it('02.05 已逾期筛选请求 overdue 并展示逾期项', async () => {
    const user = userEvent.setup();
    render(<TodoPanel />);

    await user.click(screen.getByRole('button', { name: '已逾期' }));

    expect(listQueryCalls.some((c) => c.filter === 'overdue')).toBe(true);
    expect(screen.getByText('逾期任务')).toBeInTheDocument();
  });

  // L1-02 02.08：紧急前缀
  it('02.08 紧急项展示 !!紧急 前缀', () => {
    render(<TodoPanel />);

    expect(screen.getByText(/!!紧急/)).toBeInTheDocument();
    expect(screen.getByText(/紧急任务/)).toBeInTheDocument();
  });

  // L1-02 02.12：逾期标签
  it('02.12 逾期项展示红色已逾期标签', async () => {
    const user = userEvent.setup();
    render(<TodoPanel />);

    await user.click(screen.getByRole('button', { name: '已逾期' }));

    const card = screen.getByText('逾期任务').closest('.pw-todo-card');
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText('已逾期')).toHaveClass('pw-tag-overdue');
  });

  // L1-02 02.16–02.17：历史已完成折叠与样式
  it('02.16 全部待办展示历史折叠入口且可切换文案', async () => {
    const user = userEvent.setup();
    render(<TodoPanel />);

    await user.click(screen.getByRole('button', { name: '全部待办' }));
    expect(screen.getByText('已完成任务')).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /查看历史已完成 \(1\)/ });
    await user.click(toggle);

    expect(screen.getByRole('button', { name: /收起历史已完成 \(1\)/ })).toBeInTheDocument();
  });

  it('02.17 已完成卡片展示删除线与已完成标签', async () => {
    const user = userEvent.setup();
    render(<TodoPanel />);

    await user.click(screen.getByRole('button', { name: '已完成' }));

    const card = screen.getByText('已完成任务').closest('.pw-todo-card');
    expect(card).toHaveClass('is-completed');
    expect(within(card as HTMLElement).getByText('已完成')).toBeInTheDocument();
    expect(within(card as HTMLElement).getByText('已完成任务').tagName).toBe('S');
    expect(screen.getByText(/完成于/)).toBeInTheDocument();
  });

  // L1-08 08.07：需人工待办无 AI 入口条
  it('08.07 aiStatus=none 时不展示 AI 结果入口', () => {
    render(<TodoPanel />);

    expect(screen.queryByText(/已生成结果/)).not.toBeInTheDocument();
    expect(screen.queryByText(/正在生成 AI/)).not.toBeInTheDocument();
  });
});
