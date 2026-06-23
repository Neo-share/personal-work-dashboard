import type { TodoItem } from '@project-manager/shared';
import { Button, Modal } from 'antd';
import { useState } from 'react';
import { trpc } from '../../lib/trpc';

interface AiResultPanelProps {
  todo: TodoItem;
  onRefresh?: () => void;
  onEnterModify?: (todoId: number, version?: number) => void;
}

export default function AiResultPanel({ todo, onRefresh, onEnterModify }: AiResultPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const utils = trpc.useUtils();

  const resultsQuery = trpc.todos.aiResults.useQuery(
    { todoId: todo.id },
    { enabled: expanded || fullscreen },
  );

  const confirmMutation = trpc.todos.confirmAiResult.useMutation({
    onSuccess: () => {
      void utils.todos.list.invalidate();
      void utils.personalWorkbench.summary.invalidate();
      setExpanded(false);
      setFullscreen(false);
      onRefresh?.();
    },
  });

  const latest = resultsQuery.data?.[resultsQuery.data.length - 1];

  return (
    <>
      <button
        type="button"
        className="pw-ai-bar"
        onClick={() => setExpanded(!expanded)}
        disabled={todo.aiStatus === 'pending'}
      >
        {todo.aiStatus === 'ready' ? '已生成结果 · 点击展开' : 'AI 结果已确认'}
      </button>

      {expanded && latest ? (
        <div className="pw-ai-panel">
          <div
            dangerouslySetInnerHTML={{ __html: latest.htmlContent }}
            style={{ maxHeight: 200, overflow: 'auto' }}
          />
          <div className="pw-ai-actions">
            <Button size="small" onClick={() => setFullscreen(true)}>
              全屏查看
            </Button>
            {todo.status === 'active' ? (
              <>
                <Button
                  size="small"
                  onClick={() => onEnterModify?.(todo.id, latest.version)}
                >
                  修改结果
                </Button>
                <Button
                  size="small"
                  type="primary"
                  loading={confirmMutation.isPending}
                  onClick={() =>
                    confirmMutation.mutate({ todoId: todo.id, resultId: latest.id })
                  }
                >
                  确认结果
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <Modal
        title={`${todo.title} · v${latest?.version ?? 1}`}
        open={fullscreen}
        onCancel={() => setFullscreen(false)}
        width={720}
        footer={
          todo.status === 'active' ? (
            <>
              <Button onClick={() => onEnterModify?.(todo.id, latest?.version)}>修改结果</Button>
              <Button
                type="primary"
                loading={confirmMutation.isPending}
                onClick={() => {
                  if (latest) {
                    confirmMutation.mutate({ todoId: todo.id, resultId: latest.id });
                  }
                }}
              >
                确定
              </Button>
            </>
          ) : null
        }
      >
        {latest ? (
          <div dangerouslySetInnerHTML={{ __html: latest.htmlContent }} />
        ) : (
          <div>加载中…</div>
        )}
      </Modal>
    </>
  );
}
