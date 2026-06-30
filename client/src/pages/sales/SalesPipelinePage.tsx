import {
  SALES_PIPELINE_STAGES,
  type SalesPipelineStage,
} from '@project-manager/shared';
import { Button, Input, Select, Spin, Table } from 'antd';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PipelineStageTag from '../../components/sales/PipelineStageTag';
import { formatActiveDate, getSalesPipelineStageLabel } from '../../utils/labels';
import { trpc } from '../../lib/trpc';

const stageOptions = SALES_PIPELINE_STAGES.map((value) => ({
  value,
  label: getSalesPipelineStageLabel(value),
}));

function buildFilters(searchParams: URLSearchParams) {
  const stageRaw = searchParams.get('stage') as SalesPipelineStage | null;
  const keyword = searchParams.get('keyword') ?? undefined;
  return {
    stage:
      stageRaw && SALES_PIPELINE_STAGES.includes(stageRaw) ? stageRaw : undefined,
    keyword,
  };
}

export default function SalesPipelinePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => buildFilters(searchParams), [searchParams]);
  const [keywordInput, setKeywordInput] = useState(filters.keyword ?? '');

  const listQuery = trpc.sales.opportunities.list.useQuery(filters);

  const applyKeyword = () => {
    const next = new URLSearchParams(searchParams);
    if (keywordInput.trim()) {
      next.set('keyword', keywordInput.trim());
    } else {
      next.delete('keyword');
    }
    setSearchParams(next);
  };

  return (
    <div>
      <div className="list-row">
        <div>
          <h2 className="page-title">销售管线</h2>
          <p className="page-desc">按阶段跟踪金融 B2C 商机，从线索到成交与存续服务。</p>
        </div>
        <Link to="/sales/customers">
          <Button type="primary">客户管理</Button>
        </Link>
      </div>

      <div className="content-card" style={{ marginBottom: 16 }}>
        <div className="tag-list" style={{ flexWrap: 'wrap', gap: 8 }}>
          <Select
            allowClear
            placeholder="按阶段筛选"
            style={{ minWidth: 160 }}
            value={filters.stage}
            options={stageOptions}
            onChange={(value) => {
              const next = new URLSearchParams(searchParams);
              if (value) {
                next.set('stage', value);
              } else {
                next.delete('stage');
              }
              setSearchParams(next);
            }}
          />
          <Input.Search
            allowClear
            placeholder="搜索商机/客户/产品"
            style={{ width: 260 }}
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onSearch={applyKeyword}
          />
        </div>
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
                title: '商机',
                dataIndex: 'title',
                render: (value: string, record) => (
                  <Link to={`/sales/opportunities/${record.id}`}>{value}</Link>
                ),
              },
              {
                title: '客户',
                render: (_, record) => (
                  <Link to={`/sales/customers/${record.customerId}`}>{record.customerName}</Link>
                ),
              },
              { title: '手机', dataIndex: 'customerPhone' },
              {
                title: '阶段',
                dataIndex: 'stage',
                render: (stage: SalesPipelineStage) => <PipelineStageTag stage={stage} />,
              },
              { title: '产品类型', dataIndex: 'productType', render: (v) => v ?? '-' },
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
              {
                title: '更新',
                dataIndex: 'updatedAt',
                render: (v) => v.slice(0, 10),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
