import type { RecurringFrequency, RecurringTask } from '@project-manager/shared';
import { RECURRING_FREQUENCY_LABELS } from '@project-manager/shared';
import { Button, Form, Input, Modal, Popconfirm, Select, Switch, message } from 'antd';
import { useState } from 'react';
import { trpc } from '../../lib/trpc';

function formatCycle(task: {
  frequency: RecurringFrequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string;
}): string {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const [h, m] = task.timeOfDay.split(':');
  const timeStr = `${h}:${m}:00`;
  if (task.frequency === 'daily') return `每天 ${timeStr}`;
  if (task.frequency === 'weekly') return `每周${days[task.dayOfWeek ?? 0]} ${timeStr}`;
  return `每月${task.dayOfMonth ?? 1}日 ${timeStr}`;
}

interface RecurringTaskPanelProps {
  onRefresh?: () => void;
  /** 物化操作后切 Tab 并高亮待办（含 0 条新增时定位已有待办） */
  onMaterialized?: (payload: { todoIds: number[]; taskTitle: string }) => void;
}

export default function RecurringTaskPanel({ onRefresh, onMaterialized }: RecurringTaskPanelProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const utils = trpc.useUtils();

  const listQuery = trpc.recurringTasks.list.useQuery();
  const createMutation = trpc.recurringTasks.create.useMutation({
    onSuccess: () => {
      void utils.recurringTasks.list.invalidate();
      void utils.todos.list.invalidate();
      void utils.personalWorkbench.summary.invalidate();
      setCreateOpen(false);
      form.resetFields();
      onRefresh?.();
      message.success('定时任务已创建，待办将自动物化');
    },
    onError: (err) => message.error(err.message || '创建失败'),
  });
  const updateMutation = trpc.recurringTasks.update.useMutation({
    onSuccess: (_, variables) => {
      const titleSynced =
        editingTask !== null &&
        variables.title !== undefined &&
        variables.title !== editingTask.title;
      void utils.recurringTasks.list.invalidate();
      void utils.todos.list.invalidate();
      setEditOpen(false);
      setEditingTask(null);
      editForm.resetFields();
      onRefresh?.();
      message.success(
        titleSynced ? '定时任务已更新，进行中待办标题已同步' : '定时任务已更新',
      );
    },
    onError: (err) => message.error(err.message || '更新失败'),
  });
  const toggleMutation = trpc.recurringTasks.toggle.useMutation({
    onSuccess: () => void utils.recurringTasks.list.invalidate(),
    onError: (err) => message.error(err.message || '操作失败'),
  });
  const deleteMutation = trpc.recurringTasks.delete.useMutation({
    onSuccess: () => void utils.recurringTasks.list.invalidate(),
    onError: (err) => message.error(err.message || '删除失败'),
  });
  const materializeMutation = trpc.recurringTasks.materializeNow.useMutation({
    onSuccess: async (data, variables) => {
      void utils.todos.list.invalidate();
      void utils.personalWorkbench.summary.invalidate();
      onRefresh?.();

      const task = listQuery.data?.find((item) => item.id === variables.id);
      const taskTitle = task?.title ?? '定时任务';

      if (!task?.enabled) {
        message.warning(`定时任务「${taskTitle}」已停用，无法物化待办`);
        return;
      }

      if (data.todoIds.length > 0) {
        message.success(`已生成 ${data.todoIds.length} 条待办「${taskTitle}」，已切换到日程与事项`);
        onMaterialized?.({ todoIds: data.todoIds, taskTitle });
        return;
      }

      const activeTodos = await utils.todos.list.fetch({ filter: 'active' });
      const linkedIds = activeTodos
        .filter((todo) => todo.recurringTaskId === variables.id)
        .map((todo) => todo.id);

      if (linkedIds.length > 0) {
        message.info(
          `本轮触发点已物化，无新增待办。请在「日程与事项」查看「${taskTitle}」（${linkedIds.length} 条进行中）`,
        );
        onMaterialized?.({ todoIds: linkedIds, taskTitle });
      } else {
        message.info(`本轮触发点已物化，暂无与「${taskTitle}」关联的进行中待办`);
        onMaterialized?.({ todoIds: [], taskTitle });
      }
    },
    onError: (err) => message.error(err.message || '物化失败'),
  });

  function openEdit(task: RecurringTask) {
    setEditingTask(task);
    editForm.setFieldsValue({
      title: task.title,
      frequency: task.frequency,
      timeOfDay: task.timeOfDay,
      dayOfWeek: task.dayOfWeek,
      dayOfMonth: task.dayOfMonth,
    });
    setEditOpen(true);
  }

  return (
    <div className="pw-tab-inner" style={{ overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 className="pw-panel-title">定时任务</h3>
        <Button type="primary" onClick={() => setCreateOpen(true)}>
          新建任务
        </Button>
      </div>

      {listQuery.data?.map((task) => (
        <div key={task.id} className="pw-recurring-card">
          <div className="pw-recurring-head">
            <div>
              <div className="pw-recurring-title">{task.title}</div>
              <div className="pw-recurring-cycle">{formatCycle(task)}</div>
              <div className="pw-recurring-desc">{task.todoDescription}</div>
            </div>
            <Switch
              checked={task.enabled}
              onChange={(enabled) => toggleMutation.mutate({ id: task.id, enabled })}
            />
          </div>
          <div className="pw-recurring-actions">
            <Button size="small" onClick={() => openEdit(task)}>
              编辑
            </Button>
            <Button
              size="small"
              onClick={() => materializeMutation.mutate({ id: task.id })}
              loading={materializeMutation.isPending}
            >
              立即生成待办（测试）
            </Button>
            <Popconfirm
              title="确定删除？"
              onConfirm={() => deleteMutation.mutate({ id: task.id })}
            >
              <Button size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </div>
        </div>
      ))}

      {!listQuery.data?.length ? <div className="empty-hint">暂无定时任务</div> : null}

      <Modal
        title="新建定时任务"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ frequency: 'daily', timeOfDay: '17:00' }}
          onFinish={(values: {
            title: string;
            frequency: RecurringFrequency;
            timeOfDay: string;
          }) => {
            createMutation.mutate({
              title: values.title,
              frequency: values.frequency,
              timeOfDay: values.timeOfDay,
            });
          }}
        >
          <Form.Item name="nlInstruction" label="自然语言指令">
            <Input placeholder="如：提醒我每天下午5点复盘（可交给个人助手解析）" disabled />
          </Form.Item>
          <Form.Item name="title" label="任务名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="frequency" label="重复周期">
            <Select
              options={Object.entries(RECURRING_FREQUENCY_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Form.Item name="timeOfDay" label="时间">
            <Input placeholder="17:00" />
          </Form.Item>
          <Form.Item label="待办生成说明">
            <Input disabled value="到期将自动生成待办" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑定时任务"
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
          setEditingTask(null);
        }}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values: {
            title: string;
            frequency: RecurringFrequency;
            timeOfDay: string;
            dayOfWeek?: number;
            dayOfMonth?: number;
          }) => {
            if (!editingTask) return;
            updateMutation.mutate({
              id: editingTask.id,
              title: values.title,
              frequency: values.frequency,
              timeOfDay: values.timeOfDay,
              dayOfWeek: values.frequency === 'weekly' ? (values.dayOfWeek ?? 4) : null,
              dayOfMonth: values.frequency === 'monthly' ? (values.dayOfMonth ?? 15) : null,
            });
          }}
        >
          <Form.Item name="title" label="任务名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="frequency" label="重复周期">
            <Select
              options={Object.entries(RECURRING_FREQUENCY_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Form.Item name="timeOfDay" label="时间">
            <Input placeholder="17:00" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
