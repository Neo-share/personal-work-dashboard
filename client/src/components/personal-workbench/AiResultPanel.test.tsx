import type { TodoItem } from '@project-manager/shared';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AiResultPanel from './AiResultPanel';

const mockMutate = vi.fn();
const mockInvalidateList = vi.fn();
const mockInvalidateSummary = vi.fn();
const mockOnRefresh = vi.fn();
const mockOnEnterModify = vi.fn();

const aiResultsData = [
  {
    id: 10,
    todoId: 1,
    version: 2,
    resultType: 'minutes' as const,
    htmlContent: '<p>会议纪要 v2</p>',
    status: 'ready' as const,
    provider: 'rule-template',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

vi.mock('../../lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      todos: { list: { invalidate: mockInvalidateList } },
      personalWorkbench: { summary: { invalidate: mockInvalidateSummary } },
    }),
    todos: {
      aiResults: {
        useQuery: () => ({ data: aiResultsData }),
      },
      confirmAiResult: {
        useMutation: (opts: { onSuccess?: () => void }) => ({
          mutate: (args: { todoId: number; resultId: number }) => {
            mockMutate(args);
            opts.onSuccess?.();
          },
          isPending: false,
        }),
      },
    },
  },
}));

function buildActiveTodo(overrides?: Partial<TodoItem>): TodoItem {
  return {
    id: 1,
    title: '做会议纪要',
    description: '来源：定时任务',
    dueAt: '2026-06-25T10:00:00.000Z',
    source: 'recurring',
    status: 'active',
    isUrgent: false,
    aiStatus: 'ready',
    aiResultType: 'minutes',
    recurringTaskId: null,
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    latestAiVersion: 2,
    ...overrides,
  };
}

describe('AiResultPanel', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // L1-06 06.04 + 06.05
  it('06.05 展开面板后点击「确认结果」提交最新 resultId', async () => {
    const user = userEvent.setup();
    render(
      <AiResultPanel
        todo={buildActiveTodo()}
        onRefresh={mockOnRefresh}
        onEnterModify={mockOnEnterModify}
      />,
    );

    await user.click(screen.getByRole('button', { name: '已生成结果 · 点击展开' }));
    await user.click(screen.getByRole('button', { name: '确认结果' }));

    expect(mockMutate).toHaveBeenCalledWith({ todoId: 1, resultId: 10 });
    expect(mockInvalidateList).toHaveBeenCalledOnce();
    expect(mockInvalidateSummary).toHaveBeenCalledOnce();
    expect(mockOnRefresh).toHaveBeenCalledOnce();
  });

  // L1-06 06.04 全屏预览
  it('06.04 全屏弹窗「确定」与面板「确认结果」等价', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <AiResultPanel todo={buildActiveTodo()} onRefresh={mockOnRefresh} />,
    );

    await user.click(screen.getByRole('button', { name: '已生成结果 · 点击展开' }));
    await user.click(screen.getByRole('button', { name: '全屏查看' }));

    const dialog = within(baseElement).getByRole('dialog', { name: /做会议纪要 · v2/ });
    await user.click(within(dialog).getByRole('button', { name: /确\s*定/ }));

    expect(mockMutate).toHaveBeenCalledWith({ todoId: 1, resultId: 10 });
  });

  it('06.06 进行中待办展示「修改结果」并回调 onEnterModify', async () => {
    const user = userEvent.setup();
    render(
      <AiResultPanel
        todo={buildActiveTodo()}
        onEnterModify={mockOnEnterModify}
      />,
    );

    await user.click(screen.getByRole('button', { name: '已生成结果 · 点击展开' }));
    await user.click(screen.getByRole('button', { name: '修改结果' }));

    expect(mockOnEnterModify).toHaveBeenCalledWith(1, 2);
  });

  it('已完成待办不展示确认与修改按钮', async () => {
    const user = userEvent.setup();
    render(
      <AiResultPanel
        todo={buildActiveTodo({
          status: 'completed',
          aiStatus: 'confirmed',
          completedAt: '2026-06-25T12:00:00.000Z',
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'AI 结果已确认' }));

    expect(screen.queryByRole('button', { name: '确认结果' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '修改结果' })).not.toBeInTheDocument();
  });

  // L1-08 08.08：生成中禁用入口
  it('08.08 AI 生成中时入口条 disabled', () => {
    render(<AiResultPanel todo={buildActiveTodo({ aiStatus: 'pending' })} />);

    const bar = screen.getByRole('button', { name: 'AI 结果已确认' });
    expect(bar).toBeDisabled();
  });

  it('确认成功后收起展开面板', async () => {
    const user = userEvent.setup();
    render(<AiResultPanel todo={buildActiveTodo()} onRefresh={mockOnRefresh} />);

    await user.click(screen.getByRole('button', { name: '已生成结果 · 点击展开' }));
    expect(screen.getByText('会议纪要 v2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '确认结果' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '确认结果' })).not.toBeInTheDocument();
    });
  });
});
