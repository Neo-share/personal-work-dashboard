import {
  SALES_KYC_STATUSES,
  SALES_RISK_LEVELS,
} from '@project-manager/shared';
import { Button, Form, Input, Modal, Select, Spin, Table } from 'antd';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PipelineStageTag from '../../components/sales/PipelineStageTag';
import {
  formatActiveDate,
  getSalesKycStatusLabel,
  getSalesRiskLevelLabel,
} from '../../utils/labels';
import { trpc } from '../../lib/trpc';

const riskOptions = SALES_RISK_LEVELS.map((value) => ({
  value,
  label: getSalesRiskLevelLabel(value),
}));

const kycOptions = SALES_KYC_STATUSES.map((value) => ({
  value,
  label: getSalesKycStatusLabel(value),
}));

export default function SalesCustomerDetailPage() {
  const { id } = useParams();
  const customerId = Number(id);
  const [editOpen, setEditOpen] = useState(false);
  const [oppOpen, setOppOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [oppForm] = Form.useForm();
  const utils = trpc.useUtils();

  const detailQuery = trpc.sales.customers.detail.useQuery(
    { id: customerId },
    { enabled: Number.isFinite(customerId) },
  );

  const updateMutation = trpc.sales.customers.update.useMutation({
    onSuccess: async () => {
      await utils.sales.customers.detail.invalidate({ id: customerId });
      await utils.sales.customers.list.invalidate();
      setEditOpen(false);
    },
  });

  const createOppMutation = trpc.sales.opportunities.create.useMutation({
    onSuccess: async () => {
      await utils.sales.customers.detail.invalidate({ id: customerId });
      await utils.sales.opportunities.list.invalidate();
      setOppOpen(false);
      oppForm.resetFields();
    },
  });

  if (detailQuery.isLoading) {
    return <Spin size="large" />;
  }

  const detail = detailQuery.data;
  if (!detail) {
    return <p className="empty-hint">客户不存在</p>;
  }

  const openEdit = () => {
    editForm.setFieldsValue(detail);
    setEditOpen(true);
  };

  return (
    <div>
      <div className="list-row">
        <div>
          <h2 className="page-title">{detail.name}</h2>
          <p className="page-desc">
            {detail.phone} · {getSalesRiskLevelLabel(detail.riskLevel)} ·{' '}
            {getSalesKycStatusLabel(detail.kycStatus)}
            {detail.source ? ` · 来源：${detail.source}` : ''}
          </p>
        </div>
        <div className="tag-list">
          <Link to="/sales/customers">
            <Button>返回列表</Button>
          </Link>
          <Button onClick={openEdit}>编辑客户</Button>
          <Button type="primary" onClick={() => setOppOpen(true)}>
            新建商机
          </Button>
        </div>
      </div>

      {detail.notes ? (
        <div className="content-card" style={{ marginBottom: 16 }}>
          <strong>备注：</strong>
          {detail.notes}
        </div>
      ) : null}

      <div className="content-card">
        <h3 style={{ marginTop: 0 }}>关联商机</h3>
        <Table
          rowKey="id"
          pagination={false}
          dataSource={detail.opportunities}
          locale={{ emptyText: '暂无商机，点击「新建商机」开始跟进' }}
          columns={[
            {
              title: '商机名称',
              dataIndex: 'title',
              render: (value: string, record) => (
                <Link to={`/sales/opportunities/${record.id}`}>{value}</Link>
              ),
            },
            {
              title: '阶段',
              dataIndex: 'stage',
              render: (stage) => <PipelineStageTag stage={stage} />,
            },
            { title: '产品', dataIndex: 'productType', render: (v) => v ?? '-' },
            {
              title: '预计金额',
              dataIndex: 'expectedAmount',
              render: (v) => (v != null ? `${v.toLocaleString()} 元` : '-'),
            },
            {
              title: '预计成交',
              dataIndex: 'expectedCloseAt',
              render: (v) => formatActiveDate(v),
            },
          ]}
        />
      </div>

      <Modal
        title="编辑客户"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => updateMutation.mutate({ id: customerId, ...values })}
        >
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="手机" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="source" label="来源渠道">
            <Input />
          </Form.Item>
          <Form.Item name="riskLevel" label="风评等级">
            <Select options={riskOptions} />
          </Form.Item>
          <Form.Item name="kycStatus" label="KYC 状态">
            <Select options={kycOptions} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新建商机"
        open={oppOpen}
        onCancel={() => {
          setOppOpen(false);
          oppForm.resetFields();
        }}
        onOk={() => oppForm.submit()}
        confirmLoading={createOppMutation.isPending}
      >
        <Form
          form={oppForm}
          layout="vertical"
          onFinish={(values) =>
            createOppMutation.mutate({
              customerId,
              title: values.title,
              productType: values.productType,
              expectedAmount: values.expectedAmount ? Number(values.expectedAmount) : undefined,
              expectedCloseAt: values.expectedCloseAt || undefined,
              notes: values.notes,
            })
          }
        >
          <Form.Item name="title" label="商机名称" rules={[{ required: true }]}>
            <Input placeholder="如：季度理财配置" />
          </Form.Item>
          <Form.Item name="productType" label="产品类型（可选）">
            <Input placeholder="基金、保险、信贷..." />
          </Form.Item>
          <Form.Item name="expectedAmount" label="预计金额（元）">
            <Input type="number" min={0} />
          </Form.Item>
          <Form.Item name="expectedCloseAt" label="预计成交日">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
