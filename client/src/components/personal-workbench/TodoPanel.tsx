import type { TodoFilter, TodoItem } from '@project-manager/shared';
import { TODO_SOURCE_LABELS } from '@project-manager/shared';
import { Button, Checkbox, DatePicker, Dropdown, Form, Input, Modal, Popconfirm, Switch, message } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { trpc } from '../../lib/trpc';
import AiResultPanel from './AiResultPanel';

const FILTERS: Array<{ key: TodoFilter; label: string }> = [
  { key: 'active', label: '进行中' },
  { key: 'all', label: '全部待办' },
  { key: 'completed', label: '已完成' },
  { key: 'overdue', label: '已逾期' },
];

interface TodoPanelProps {
  onRefresh?: () => void;
  onEnterModify?: (todoId: number, version?: number) => void;
}

function TodoCard({
  todo,
  onRefresh,
  onEnterModify,
  onEdit,
}: {
  todo: TodoItem;
  onRefresh?: () => void;
  onEnterModify?: (todoId: number, version?: number) => void;
  onEdit?: (todo: TodoItem) => void;
}) {
  const utils = trpc.useUtils();
  const completeMutation = trpc.todos.complete.useMutation({
    onSuccess: () => {
      void utils.todos.list.invalidate();
      void utils.personalWorkbench.summary.invalidate();
      onRefresh?.();
    },
  });
  const restoreMutation = trpc.todos.restore.useMutation({
    onSuccess: () => {
      void utils.todos.list.invalidate();
      void utils.personalWorkbench.summary.invalidate();
      onRefresh?.();
    },
  });
  const deleteMutation = trpc.todos.delete.useMutation({
    onSuccess: () => {
      void utils.todos.list.invalidate();
      void utils.personalWorkbench.summary.invalidate();
      onRefresh?.();
    },
  });
  const cancelMutation = trpc.todos.cancel.useMutation({
    onSuccess: () => {
      void utils.todos.list.invalidate();
      void utils.personalWorkbench.summary.invalidate();
      onRefresh?.();
    },
  });

  const menuItems = [
    ...(todo.status === 'active'
      ? [{ key: 'edit', label: '编辑', onClick: () => onEdit?.(todo) }]
      : []),
    { key: 'cancel', label: '取消待办', onClick: () => cancelMutation.mutate({ id: todo.id }) },
    {
      key: 'delete',
      label: (
        <Popconfirm title="确定删除？" onConfirm={() => deleteMutation.mutate({ id: todo.id })}>
          删除
        </Popconfirm>
      ),
    },
  ];

  if (todo.status === 'completed') {
    menuItems.unshift({
      key: 'restore',
      label: '恢复为待办',
      onClick: () => restoreMutation.mutate({ id: todo.id }),
    });
  }

  return (
    <div className={`pw-todo-card${todo.status === 'completed' ? ' is-completed' : ''}`}>
      <div className="pw-todo-card-head">
        {todo.status === 'active' ? (
          <Checkbox
            onChange={() => completeMutation.mutate({ id: todo.id })}
            disabled={completeMutation.isPending}
          />
        ) : null}
        <div style={{ flex: 1 }}>
          <div className={`pw-todo-title${todo.isUrgent ? ' is-urgent' : ''}`}>
            {todo.isUrgent && todo.status === 'active' ? '!!紧急 ' : ''}
            {todo.status === 'completed' ? <s>{todo.title}</s> : todo.title}
            {todo.isOverdue ? <span className="pw-tag-overdue">已逾期</span> : null}
            {todo.status === 'completed' ? (
              <span className="pw-tag-overdue" style={{ background: '#f0fdf4', color: '#059669' }}>
                已完成
              </span>
            ) : null}
          </div>
          {todo.description ? <div className="pw-todo-desc">{todo.description}</div> : null}
          <div className="pw-todo-meta">
            {todo.dueAt ? `截止：${dayjs(todo.dueAt).format('YYYY/MM/DD HH:mm')}` : null}
            {todo.dueAt ? ' · ' : ''}
            来源：{TODO_SOURCE_LABELS[todo.source]}
            {todo.completedAt ? ` · 完成于 ${dayjs(todo.completedAt).format('YYYY/MM/DD HH:mm')}` : null}
          </div>
        </div>
        <Dropdown menu={{ items: menuItems }} trigger={['click']}>
          <Button type="text" size="small">
            ···
          </Button>
        </Dropdown>
      </div>
      {todo.aiStatus === 'pending' ? (
        <div className="pw-ai-bar" style={{ cursor: 'not-allowed' }}>
          正在生成 AI 初步结果…
        </div>
      ) : null}
      {todo.aiStatus === 'ready' || todo.aiStatus === 'confirmed' ? (
        <AiResultPanel todo={todo} onRefresh={onRefresh} onEnterModify={onEnterModify} />
      ) : null}
    </div>
  );
}

export default function TodoPanel({ onRefresh, onEnterModify }: TodoPanelProps) {
  const [filter, setFilter] = useState<TodoFilter>('active');
  const [showHistory, setShowHistory] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const utils = trpc.useUtils();

  const todosQuery = trpc.todos.list.useQuery(
    { filter },
    {
      // pending 态轮询，等待异步 AI 生成完成
      refetchInterval: (query) => {
        const data = query.state.data;
        return data?.some((todo) => todo.aiStatus === 'pending') ? 800 : false;
      },
    },
  );
  const createMutation = trpc.todos.create.useMutation({
    onSuccess: () => {
      void utils.todos.list.invalidate();
      void utils.personalWorkbench.summary.invalidate();
      setAddOpen(false);
      form.resetFields();
      onRefresh?.();
      message.success('待办已添加');
    },
    onError: (err) => message.error(err.message || '添加失败'),
  });
  const updateMutation = trpc.todos.update.useMutation({
    onSuccess: () => {
      void utils.todos.list.invalidate();
      void utils.personalWorkbench.summary.invalidate();
      setEditOpen(false);
      setEditingTodo(null);
      editForm.resetFields();
      onRefresh?.();
      message.success('待办已更新');
    },
    onError: (err) => message.error(err.message || '更新失败'),
  });

  function openEdit(todo: TodoItem) {
    setEditingTodo(todo);
    editForm.setFieldsValue({
      title: todo.title,
      description: todo.description ?? '',
      dueAt: todo.dueAt ? dayjs(todo.dueAt) : null,
      isUrgent: todo.isUrgent,
    });
    setEditOpen(true);
  }

  const items = todosQuery.data ?? [];
  const activeItems = items.filter((t) => t.status === 'active');
  const completedItems = items.filter((t) => t.status === 'completed');

  const displayActive = filter === 'completed' ? [] : filter === 'overdue' ? activeItems : activeItems;
  const displayCompleted =
    filter === 'all' || filter === 'completed' ? completedItems : [];

  return (
    <div className="pw-panel pw-panel-todo">
      <div className="pw-panel-head">
        <span className="pw-panel-title">待办事项</span>
        <div className="pw-panel-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="pw-todo-filter">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={filter === f.key ? 'is-active' : undefined}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button size="small" type="primary" onClick={() => setAddOpen(true)}>
            + 添加事项
          </Button>
        </div>
      </div>
      <div className="pw-panel-body">
        {todosQuery.isLoading ? <div>加载中…</div> : null}
        {displayActive.map((todo) => (
          <TodoCard
            key={todo.id}
            todo={todo}
            onRefresh={onRefresh}
            onEnterModify={onEnterModify}
            onEdit={openEdit}
          />
        ))}
        {displayActive.length === 0 && filter !== 'completed' ? (
          <div className="empty-hint">暂无进行中的待办</div>
        ) : null}

        {filter !== 'active' && filter !== 'overdue' && completedItems.length > 0 ? (
          <>
            <button
              type="button"
              className="pw-history-toggle"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? '收起' : '查看'}历史已完成 ({completedItems.length})
            </button>
            {(showHistory || filter === 'completed' || filter === 'all') &&
              displayCompleted.map((todo) => (
                <TodoCard
                  key={todo.id}
                  todo={todo}
                  onRefresh={onRefresh}
                  onEnterModify={onEnterModify}
                  onEdit={openEdit}
                />
              ))}
          </>
        ) : null}
      </div>

      <Modal
        title="添加事项"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values: {
            title: string;
            description?: string;
            dueAt?: dayjs.Dayjs;
            isUrgent?: boolean;
          }) => {
            createMutation.mutate({
              title: values.title,
              description: values.description,
              dueAt: values.dueAt?.toISOString(),
              isUrgent: values.isUrgent,
            });
          }}
        >
          <Form.Item name="title" label="任务名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="dueAt" label="截止时间">
            <DatePicker showTime format="YYYY/MM/DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isUrgent" label="紧急" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑事项"
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
          setEditingTodo(null);
        }}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values: {
            title: string;
            description?: string;
            dueAt?: dayjs.Dayjs | null;
            isUrgent?: boolean;
          }) => {
            if (!editingTodo) return;
            updateMutation.mutate({
              id: editingTodo.id,
              title: values.title,
              description: values.description ?? null,
              dueAt: values.dueAt ? values.dueAt.toISOString() : null,
              isUrgent: values.isUrgent,
            });
          }}
        >
          <Form.Item name="title" label="任务名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="dueAt" label="截止时间">
            <DatePicker showTime format="YYYY/MM/DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isUrgent" label="紧急" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
