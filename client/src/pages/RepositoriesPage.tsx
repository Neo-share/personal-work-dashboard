import { Button, Input, Popconfirm, Spin, Table, Tag, message } from 'antd';
import type { Repository } from '@project-manager/shared';
import { useEffect, useState } from 'react';
import { trpc } from '../lib/trpc';
import { formatActiveDate } from '../utils/labels';

function BranchNoteField({
  repositoryId,
  branchName,
  initialNotes,
}: {
  repositoryId: number;
  branchName: string;
  initialNotes: string | null;
}) {
  const [value, setValue] = useState(initialNotes ?? '');
  const utils = trpc.useUtils();
  const setBranchNoteMutation = trpc.repositories.setBranchNote.useMutation({
    onSuccess: async () => {
      await utils.repositories.branches.invalidate({ id: repositoryId });
    },
    onError: (error) => {
      message.error(error.message || '保存备注失败');
    },
  });

  useEffect(() => {
    setValue(initialNotes ?? '');
  }, [initialNotes, branchName]);

  const saveNote = (nextValue: string) => {
    const trimmed = nextValue.trim();
    const initial = (initialNotes ?? '').trim();
    if (trimmed === initial) {
      return;
    }
    setBranchNoteMutation.mutate({
      repositoryId,
      branch: branchName,
      notes: nextValue,
    });
  };

  return (
    <Input
      size="small"
      value={value}
      placeholder="填写分支用途或关联任务"
      disabled={setBranchNoteMutation.isPending}
      onChange={(event) => setValue(event.target.value)}
      onBlur={(event) => saveNote(event.target.value)}
      onPressEnter={(event) => event.currentTarget.blur()}
    />
  );
}

function RepositoryBranchesPanel({
  repository,
  enabled,
  onOpen,
  openingKey,
  onDeleteBranch,
  deletingBranchKey,
  onSyncBranches,
  onSyncBranch,
  syncingKey,
}: {
  repository: Repository;
  enabled: boolean;
  onOpen: (repository: Repository, branch: string, mode: 'agent_window' | 'classic') => void;
  openingKey: string | null;
  onDeleteBranch: (repository: Repository, branch: string) => void;
  deletingBranchKey: string | null;
  onSyncBranches: (repository: Repository) => void;
  onSyncBranch: (repository: Repository, branch: string) => void;
  syncingKey: string | null;
}) {
  const branchesQuery = trpc.repositories.branches.useQuery(
    { id: repository.id },
    { enabled },
  );

  if (branchesQuery.isLoading) {
    return <Spin size="small" />;
  }

  if (branchesQuery.error) {
    return <div className="empty-hint">{branchesQuery.error.message}</div>;
  }

  const data = branchesQuery.data;
  if (!data?.branches.length) {
    return <div className="empty-hint">暂无本地分支</div>;
  }

  return (
    <div>
      <div className="list-row">
        <div className="empty-hint">
          共 {data.branches.length} 个本地分支，当前检出：
          <span className="mono"> {data.currentBranch ?? '未知'}</span>
        </div>
        <Button
          size="small"
          loading={syncingKey === `${repository.id}:fetch`}
          onClick={() => onSyncBranches(repository)}
        >
          同步远程分支
        </Button>
      </div>
      <div className="branch-table-head">
        <span>分支</span>
        <span>备注</span>
        <span>操作</span>
      </div>
      {data.branches.map((branch) => {
        const isCurrent = branch.name === data.currentBranch;
        const openingAgentKey = `${repository.id}:${branch.name}:agent_window`;
        const openingClassicKey = `${repository.id}:${branch.name}:classic`;
        const deletingKey = `${repository.id}:${branch.name}`;
        const syncingBranchKey = `${repository.id}:${branch.name}:sync`;

        return (
          <div className="branch-table-row" key={branch.name}>
            <div className="branch-table-cell branch-name-cell">
              <span className="mono">{branch.name}</span>
              {isCurrent ? <Tag color="blue">当前</Tag> : null}
            </div>
            <div className="branch-table-cell branch-note-cell">
              <BranchNoteField
                repositoryId={repository.id}
                branchName={branch.name}
                initialNotes={branch.notes}
              />
            </div>
            <div className="branch-table-cell branch-actions-cell">
              <div className="tag-list">
                <Button
                  size="small"
                  loading={syncingKey === syncingBranchKey}
                  onClick={() => onSyncBranch(repository, branch.name)}
                >
                  同步
                </Button>
                <Button
                  size="small"
                  loading={openingKey === openingAgentKey}
                  onClick={() => onOpen(repository, branch.name, 'agent_window')}
                >
                  Agent 打开
                </Button>
                <Button
                  size="small"
                  loading={openingKey === openingClassicKey}
                  onClick={() => onOpen(repository, branch.name, 'classic')}
                >
                  编辑器打开
                </Button>
                {isCurrent ? (
                  <Button size="small" danger disabled>
                    删除
                  </Button>
                ) : (
                  <Popconfirm
                    title={`确认删除本地分支「${branch.name}」？`}
                    description="此操作不可恢复，仅删除本地分支引用。"
                    okText="确认删除"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => onDeleteBranch(repository, branch.name)}
                  >
                    <Button size="small" danger loading={deletingBranchKey === deletingKey}>
                      删除
                    </Button>
                  </Popconfirm>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function RepositoriesPage() {
  const utils = trpc.useUtils();
  const [expandedRepoIds, setExpandedRepoIds] = useState<number[]>([]);
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [deletingBranchKey, setDeletingBranchKey] = useState<string | null>(null);
  const [syncingKey, setSyncingKey] = useState<string | null>(null);
  const listQuery = trpc.repositories.list.useQuery();

  const openInCursorMutation = trpc.repositories.openInCursor.useMutation({
    onSuccess: async (result, variables) => {
      await utils.repositories.list.invalidate();
      if (variables.repositoryId) {
        await utils.repositories.branches.invalidate({ id: variables.repositoryId });
      }
      setOpeningKey(null);
      const target =
        result.mode === 'agent_window' ? 'Agent Window' : '经典编辑器';
      message.success(
        result.mode === 'agent_window'
          ? result.switched
            ? `已切换到「${result.branch}」并在 Cursor 中打开`
            : `已在 Cursor 中打开（${result.branch ?? '当前分支'}）`
          : result.switched
            ? `已切换到「${result.branch}」并在 ${target} 中打开`
            : `已在 ${target} 中导航到仓库（${result.branch ?? '当前分支'}）`,
      );
    },
    onError: (error) => {
      setOpeningKey(null);
      message.error(error.message);
    },
  });

  const deleteBranchMutation = trpc.repositories.deleteBranch.useMutation({
    onSuccess: async (_, variables) => {
      await utils.repositories.branches.invalidate({ id: variables.repositoryId });
      await utils.repositories.list.invalidate();
      setDeletingBranchKey(null);
      message.success(`已删除分支「${variables.branch}」`);
    },
    onError: (error) => {
      setDeletingBranchKey(null);
      message.error(error.message);
    },
  });

  const syncBranchesMutation = trpc.repositories.syncBranches.useMutation({
    onSuccess: async (result, variables) => {
      await utils.repositories.branches.invalidate({ id: variables.repositoryId });
      await utils.repositories.list.invalidate();
      setSyncingKey(null);
      message.success(result.summary);
    },
    onError: (error) => {
      setSyncingKey(null);
      message.error(error.message);
    },
  });

  const openRepositoryInCursor = (
    record: Repository,
    branch: string | null | undefined,
    mode: 'agent_window' | 'classic' = 'agent_window',
  ) => {
    const targetBranch = branch ?? record.currentBranch;
    setOpeningKey(`${record.id}:${targetBranch ?? ''}:${mode}`);
    openInCursorMutation.mutate({
      repositoryId: record.id,
      branch: targetBranch,
      mode,
    });
  };

  const deleteRepositoryBranch = (record: Repository, branch: string) => {
    setDeletingBranchKey(`${record.id}:${branch}`);
    deleteBranchMutation.mutate({
      repositoryId: record.id,
      branch,
    });
  };

  const syncRepositoryBranches = (record: Repository) => {
    setSyncingKey(`${record.id}:fetch`);
    syncBranchesMutation.mutate({ repositoryId: record.id });
  };

  const syncRepositoryBranch = (record: Repository, branch: string) => {
    setSyncingKey(`${record.id}:${branch}:sync`);
    syncBranchesMutation.mutate({ repositoryId: record.id, branch });
  };

  if (listQuery.isLoading) {
    return <Spin size="large" />;
  }

  return (
    <div>
      <h2 className="page-title">仓库</h2>
      <p className="page-desc">
        CodeLab 工作区内的 Git 仓库；展开可管理分支，并反查关联任务。
      </p>

      <div className="content-card">
        <Table
          rowKey="id"
          pagination={false}
          dataSource={listQuery.data ?? []}
          expandable={{
            expandedRowKeys: expandedRepoIds,
            onExpandedRowsChange: (keys) => setExpandedRepoIds(keys as number[]),
            expandedRowRender: (record) => (
              <RepositoryBranchesPanel
                repository={record}
                enabled={expandedRepoIds.includes(record.id)}
                onOpen={openRepositoryInCursor}
                openingKey={openingKey}
                onDeleteBranch={deleteRepositoryBranch}
                deletingBranchKey={deletingBranchKey}
                onSyncBranches={syncRepositoryBranches}
                onSyncBranch={syncRepositoryBranch}
                syncingKey={syncingKey}
              />
            ),
          }}
          columns={[
            {
              title: '仓库',
              dataIndex: 'name',
              render: (value, record) => (
                <Button
                  type="link"
                  className="content-link"
                  loading={
                    openingKey === `${record.id}:${record.currentBranch ?? ''}:agent_window`
                  }
                  onClick={() => openRepositoryInCursor(record, record.currentBranch, 'agent_window')}
                  title="在 Cursor Agent Window 中打开当前分支"
                >
                  {value}
                </Button>
              ),
            },
            { title: '当前分支', dataIndex: 'currentBranch', className: 'mono' },
            {
              title: 'Git 状态',
              dataIndex: 'isDirty',
              render: (value: boolean) =>
                value ? <Tag color="orange">有未提交改动</Tag> : <Tag>干净</Tag>,
            },
            {
              title: '技术标签',
              dataIndex: 'techTags',
              render: (tags: string[]) => (
                <div className="tag-list">
                  {tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              ),
            },
            {
              title: '环境脚本',
              dataIndex: 'envScripts',
              render: (envs: string[]) => envs.join(', ') || '-',
            },
            { title: '最近扫描', dataIndex: 'scannedAt' },
            {
              title: '最近活跃',
              render: (_, record) =>
                formatActiveDate(record.lastCommitAt ?? record.scannedAt),
            },
            {
              title: '操作',
              width: 180,
              render: (_, record) => (
                <div className="tag-list">
                  <Button
                    size="small"
                    loading={
                      openingKey === `${record.id}:${record.currentBranch ?? ''}:agent_window`
                    }
                    onClick={() =>
                      openRepositoryInCursor(record, record.currentBranch, 'agent_window')
                    }
                  >
                    Agent 打开
                  </Button>
                  <Button
                    size="small"
                    loading={
                      openingKey === `${record.id}:${record.currentBranch ?? ''}:classic`
                    }
                    onClick={() =>
                      openRepositoryInCursor(record, record.currentBranch, 'classic')
                    }
                  >
                    编辑器打开
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
