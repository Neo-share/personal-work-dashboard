import {
  SALES_PIPELINE_STAGES,
  type SalesPipelineStage,
} from '@project-manager/shared';
import { Button, Form, Input, Modal, Select, Spin, message } from 'antd';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ActivityTimeline from '../../components/sales/ActivityTimeline';
import ComplianceChecklist from '../../components/sales/ComplianceChecklist';
import PipelineStageTag from '../../components/sales/PipelineStageTag';
import { formatActiveDate, getSalesPipelineStageLabel } from '../../utils/labels';
import { trpc } from '../../lib/trpc';

const stageOptions = SALES_PIPELINE_STAGES.map((value) => ({
  value,
  label: getSalesPipelineStageLabel(value),
}));

export default function SalesOpportunityDetailPage() {
  const { id } = useParams();
  const opportunityId = Number(id);
  const [editOpen, setEditOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [forceNote, setForceNote] = useState('');
  const [pendingStage, setPendingStage] = useState<SalesPipelineStage | null>(null);
  const [editForm] = Form.useForm();
  const [stageForm] = Form.useForm();
  const utils = trpc.useUtils();

  const detailQuery = trpc.sales.opportunities.detail.useQuery(
    { id: opportunityId },
    { enabled: Number.isFinite(opportunityId) },
  );

  const updateMutation = trpc.sales.opportunities.update.useMutation({
    onSuccess: async () => {
      await utils.sales.opportunities.detail.invalidate({ id: opportunityId });
      await utils.sales.opportunities.list.invalidate();
      setEditOpen(false);
    },
  });

  const advanceMutation = trpc.sales.opportunities.advanceStage.useMutation({
    onSuccess: async () => {
      await utils.sales.opportunities.detail.invalidate({ id: opportunityId });
      await utils.sales.opportunities.list.invalidate();
      setStageOpen(false);
      setForceNote('');
      setPendingStage(null);
      stageForm.resetFields();
      message.success('阶段已更新');
    },
    onError: (error) => {
      message.error(error.message);
    },
  });

  const checkQuery = trpc.sales.opportunities.checkAdvanceStage.useQuery(
    { id: opportunityId, targetStage: pendingStage! },
    { enabled: stageOpen && pendingStage != null },
  );

  if (detailQuery.isLoading) {
    return <Spin size="large" />;
  }

  const detail = detailQuery.data;
  if (!detail) {
    return <p className="empty-hint">商机不存在</p>;
  }

  const openEdit = () => {
    editForm.setFieldsValue({
      title: detail.title,
      productType: detail.productType,
      expectedAmount: detail.expectedAmount,
      expectedCloseAt: detail.expectedCloseAt,
      lostReason: detail.lostReason,
      notes: detail.notes,
    });
    setEditOpen(true);
  };

  const submitStage = (values: { targetStage: SalesPipelineStage }) => {
    const check = checkQuery.data;
    if (check && !check.ok && !forceNote.trim()) {
      setPendingStage(values.targetStage);
      message.warning('当前阶段必填合规项未完成，请填写 override 备注后强制推进');
      return;
    }
    advanceMutation.mutate({
      id: opportunityId,
      targetStage: values.targetStage,
      force: Boolean(check && !check.ok),
      forceNote: forceNote.trim() || undefined,
    });
  };

  const missingLabels =
    checkQuery.data?.missingRequired.map((item) => item.label).join('、') ?? '';

  return (
    <div>
      <div className="list-row">
        <div>
          <h2 className="page-title">{detail.title}</h2>
          <p className="page-desc">
            客户：
            <Link to={`/sales/customers/${detail.customer.id}`}> {detail.customer.name}</Link>
            {' · '}
            {detail.customer.phone}
            {detail.productType ? ` · 产品：${detail.productType}` : ''}
          </p>
        </div>
        <div className="tag-list">
          <Link to="/sales">
            <Button>返回管线</Button>
          </Link>
          <Button onClick={openEdit}>编辑商机</Button>
          <Button type="primary" onClick={() => setStageOpen(true)}>
            变更阶段
          </Button>
        </div>
      </div>

      <div className="panel-grid">
        <div className="content-card">
          <h3 style={{ marginTop: 0 }}>商机概览</h3>
          <div className="detail-grid">
            <div>
              <span className="detail-label">当前阶段</span>
              <PipelineStageTag stage={detail.stage} />
            </div>
            <div>
              <span className="detail-label">预计金额</span>
              {detail.expectedAmount != null ? `${detail.expectedAmount.toLocaleString()} 元` : '-'}
            </div>
            <div>
              <span className="detail-label">预计成交</span>
              {formatActiveDate(detail.expectedCloseAt)}
            </div>
            <div>
              <span className="detail-label">客户风评</span>
              {detail.customer.riskLevel.toUpperCase()}
            </div>
            <div>
              <span className="detail-label">KYC</span>
              {detail.customer.kycStatus}
            </div>
          </div>
          {detail.notes ? (
            <p style={{ marginTop: 12 }}>
              <strong>备注：</strong>
              {detail.notes}
            </p>
          ) : null}
          {detail.lostReason ? (
            <p style={{ marginTop: 8, color: 'var(--color-danger, #cf1322)' }}>
              <strong>流失原因：</strong>
              {detail.lostReason}
            </p>
          ) : null}
        </div>

        <div className="content-card">
          <h3 style={{ marginTop: 0 }}>当前阶段合规清单</h3>
          <p className="page-desc" style={{ marginBottom: 12 }}>
            推进到下一阶段前，请完成带 * 的必填项。
          </p>
          <ComplianceChecklist
            opportunityId={opportunityId}
            stage={detail.stage}
            items={detail.complianceItems}
            onUpdated={() => detailQuery.refetch()}
          />
        </div>
      </div>

      <div className="content-card" style={{ marginTop: 16 }}>
        <ActivityTimeline opportunityId={opportunityId} activities={detail.activities} />
      </div>

      <Modal
        title="编辑商机"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) =>
            updateMutation.mutate({
              id: opportunityId,
              title: values.title,
              productType: values.productType ?? null,
              expectedAmount: values.expectedAmount ?? null,
              expectedCloseAt: values.expectedCloseAt ?? null,
              lostReason: values.lostReason ?? null,
              notes: values.notes ?? null,
            })
          }
        >
          <Form.Item name="title" label="商机名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="productType" label="产品类型">
            <Input />
          </Form.Item>
          <Form.Item name="expectedAmount" label="预计金额（元）">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="expectedCloseAt" label="预计成交日">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="lostReason" label="流失/拒件原因">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="变更阶段"
        open={stageOpen}
        onCancel={() => {
          setStageOpen(false);
          setForceNote('');
          setPendingStage(null);
          stageForm.resetFields();
        }}
        onOk={() => stageForm.submit()}
        confirmLoading={advanceMutation.isPending}
      >
        <Form
          form={stageForm}
          layout="vertical"
          initialValues={{ targetStage: detail.stage }}
          onFinish={submitStage}
          onValuesChange={(changed) => {
            if (changed.targetStage) {
              setPendingStage(changed.targetStage as SalesPipelineStage);
            }
          }}
        >
          <Form.Item name="targetStage" label="目标阶段" rules={[{ required: true }]}>
            <Select options={stageOptions} />
          </Form.Item>
        </Form>
        {checkQuery.data && !checkQuery.data.ok ? (
          <div style={{ marginTop: 8 }}>
            <p style={{ color: 'var(--color-danger, #cf1322)' }}>
              未完成必填项：{missingLabels}
            </p>
            <Input.TextArea
              rows={2}
              placeholder="填写 override 备注后可强制推进（留痕）"
              value={forceNote}
              onChange={(event) => setForceNote(event.target.value)}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
