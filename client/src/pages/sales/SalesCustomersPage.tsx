import {
  SALES_KYC_STATUSES,
  SALES_RISK_LEVELS,
} from '@project-manager/shared';
import { Button, Form, Input, Modal, Select, Spin, Table } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
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

export default function SalesCustomersPage() {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [form] = Form.useForm();
  const utils = trpc.useUtils();
  const listQuery = trpc.sales.customers.list.useQuery({ keyword: keyword || undefined });

  const createMutation = trpc.sales.customers.create.useMutation({
    onSuccess: async () => {
      await utils.sales.customers.list.invalidate();
      setOpen(false);
      form.resetFields();
    },
  });

  return (
    <div>
      <div className="list-row">
        <div>
          <h2 className="page-title">客户管理</h2>
          <p className="page-desc">维护销售客户卡片：联系方式、来源、风评与 KYC 状态。</p>
        </div>
        <Button type="primary" onClick={() => setOpen(true)}>
          新建客户
        </Button>
      </div>

      <div className="content-card" style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="搜索姓名/手机/来源"
          style={{ maxWidth: 320 }}
          onSearch={(value) => setKeyword(value.trim())}
        />
      </div>

      {listQuery.isLoading ? (
        <Spin size="large" />
      ) : (
        <div className="content-card">
          <Table
            rowKey="id"
            pagination={{ pageSize: 20 }}
            dataSource={listQuery.data ?? []}
            columns={[
              {
                title: '姓名',
                dataIndex: 'name',
                render: (value: string, record) => (
                  <Link to={`/sales/customers/${record.id}`}>{value}</Link>
                ),
              },
              { title: '手机', dataIndex: 'phone' },
              { title: '来源', dataIndex: 'source', render: (v) => v ?? '-' },
              {
                title: '风评',
                dataIndex: 'riskLevel',
                render: (v) => getSalesRiskLevelLabel(v),
              },
              {
                title: 'KYC',
                dataIndex: 'kycStatus',
                render: (v) => getSalesKycStatusLabel(v),
              },
              {
                title: '更新',
                dataIndex: 'updatedAt',
                render: (v) => v.slice(0, 10),
              },
            ]}
          />
        </div>
      )}

      <Modal
        title="新建客户"
        open={open}
        onCancel={() => {
          setOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ riskLevel: 'unknown', kycStatus: 'pending' }}
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="手机" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="source" label="来源渠道">
            <Input placeholder="网点、转介、活动..." />
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
    </div>
  );
}
