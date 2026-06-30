import type { SalesComplianceItemView, SalesPipelineStage } from '@project-manager/shared';
import { Checkbox, Input, List, Typography } from 'antd';
import { trpc } from '../../lib/trpc';

interface ComplianceChecklistProps {
  opportunityId: number;
  stage: SalesPipelineStage;
  items: SalesComplianceItemView[];
  onUpdated: () => void;
}

export default function ComplianceChecklist({
  opportunityId,
  stage,
  items,
  onUpdated,
}: ComplianceChecklistProps) {
  const utils = trpc.useUtils();
  const setItemMutation = trpc.sales.opportunities.setComplianceItem.useMutation({
    onSuccess: async () => {
      await utils.sales.opportunities.detail.invalidate({ id: opportunityId });
      onUpdated();
    },
  });

  if (items.length === 0) {
    return <Typography.Text type="secondary">当前阶段无合规清单项</Typography.Text>;
  }

  return (
    <List
      size="small"
      dataSource={items}
      renderItem={(item) => (
        <List.Item>
          <div style={{ width: '100%' }}>
            <Checkbox
              checked={Boolean(item.completedAt)}
              disabled={setItemMutation.isPending}
              onChange={(event) => {
                setItemMutation.mutate({
                  opportunityId,
                  stage,
                  itemKey: item.key,
                  completed: event.target.checked,
                  note: item.note,
                });
              }}
            >
              {item.label}
              {item.required ? (
                <Typography.Text type="danger" style={{ marginLeft: 4 }}>
                  *
                </Typography.Text>
              ) : null}
            </Checkbox>
            {item.completedAt ? (
              <Typography.Text type="secondary" style={{ display: 'block', marginLeft: 24, fontSize: 12 }}>
                完成于 {item.completedAt.slice(0, 19).replace('T', ' ')}
              </Typography.Text>
            ) : null}
            <Input.TextArea
              rows={1}
              placeholder="备注（可选）"
              defaultValue={item.note ?? ''}
              style={{ marginTop: 4, marginLeft: 24 }}
              onBlur={(event) => {
                const nextNote = event.target.value.trim() || null;
                if (nextNote === (item.note ?? null)) return;
                setItemMutation.mutate({
                  opportunityId,
                  stage,
                  itemKey: item.key,
                  completed: Boolean(item.completedAt),
                  note: nextNote,
                });
              }}
            />
          </div>
        </List.Item>
      )}
    />
  );
}
