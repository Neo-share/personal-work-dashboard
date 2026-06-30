import type { SalesActivity, SalesActivityType } from '@project-manager/shared';
import { Button, Form, Input, List, Popconfirm, Select, Typography } from 'antd';
import { useState } from 'react';
import { getSalesActivityTypeLabel } from '../../utils/labels';
import { trpc } from '../../lib/trpc';

const activityTypeOptions: Array<{ value: SalesActivityType; label: string }> = [
  { value: 'call', label: '电话' },
  { value: 'meeting', label: '面访' },
  { value: 'wechat', label: '企微/微信' },
  { value: 'other', label: '其他' },
];

interface ActivityTimelineProps {
  opportunityId: number;
  activities: SalesActivity[];
}

export default function ActivityTimeline({ opportunityId, activities }: ActivityTimelineProps) {
  const [form] = Form.useForm();
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(false);

  const createMutation = trpc.sales.activities.create.useMutation({
    onSuccess: async () => {
      await utils.sales.opportunities.detail.invalidate({ id: opportunityId });
      form.resetFields();
      setExpanded(false);
    },
  });

  const deleteMutation = trpc.sales.activities.delete.useMutation({
    onSuccess: async () => {
      await utils.sales.opportunities.detail.invalidate({ id: opportunityId });
    },
  });

  return (
    <div>
      <div className="list-row" style={{ marginBottom: 12 }}>
        <Typography.Text strong>跟进记录</Typography.Text>
        <Button size="small" onClick={() => setExpanded((value) => !value)}>
          {expanded ? '取消' : '新增跟进'}
        </Button>
      </div>

      {expanded ? (
        <Form
          form={form}
          layout="vertical"
          initialValues={{ type: 'call' }}
          onFinish={(values: { type: SalesActivityType; content: string; activityAt?: string }) => {
            createMutation.mutate({
              opportunityId,
              type: values.type,
              content: values.content,
              activityAt: values.activityAt
                ? new Date(values.activityAt).toISOString()
                : undefined,
            });
          }}
          style={{ marginBottom: 16 }}
        >
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={activityTypeOptions} />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请填写跟进内容' }]}>
            <Input.TextArea rows={3} placeholder="沟通要点、客户反馈、下一步计划" />
          </Form.Item>
          <Form.Item name="activityAt" label="跟进时间（可选，默认当前）">
            <Input type="datetime-local" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
            保存
          </Button>
        </Form>
      ) : null}

      {activities.length === 0 ? (
        <Typography.Text type="secondary">暂无跟进记录</Typography.Text>
      ) : (
        <List
          size="small"
          dataSource={activities}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Popconfirm
                  key="delete"
                  title="确认删除该跟进记录？"
                  onConfirm={() => deleteMutation.mutate({ id: item.id })}
                >
                  <Button size="small" danger loading={deleteMutation.isPending}>
                    删除
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={
                  <>
                    {getSalesActivityTypeLabel(item.type)} ·{' '}
                    {item.activityAt.slice(0, 19).replace('T', ' ')}
                  </>
                }
                description={item.content}
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );
}
