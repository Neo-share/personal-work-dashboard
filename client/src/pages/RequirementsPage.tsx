import { Button, Form, Input, Modal, Select, Spin, Table } from 'antd';
import type { Priority, RequirementStatus, WorkDomain } from '@project-manager/shared';
import { WORK_DOMAIN_MODULES } from '@project-manager/shared';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  getPriorityLabel,
  getRequirementStatusLabel,
  getWorkDomainLabel,
  formatActiveDate,
} from '../utils/labels';
import { trpc } from '../lib/trpc';

const statusOptions: Array<{ value: RequirementStatus; label: string }> = [
  { value: 'pending_review', label: '待评审' },
  { value: 'developing', label: '开发中' },
  { value: 'integrating', label: '联调中' },
  { value: 'testing', label: '提测中' },
  { value: 'pending_release', label: '待上线' },
  { value: 'released', label: '已上线' },
  { value: 'paused', label: '已暂停' },
];

const priorityOptions: Array<{ value: Priority; label: string }> = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];

function getWeekReleaseRange(): { releaseFrom: string; releaseTo: string } {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const format = (date: Date) => date.toISOString().slice(0, 10);
  return { releaseFrom: format(monday), releaseTo: format(sunday) };
}

const domainOptions = WORK_DOMAIN_MODULES.map((item) => ({
  value: item.id,
  label: item.label,
}));

function buildListFilters(searchParams: URLSearchParams) {
  const status = searchParams.get('status') as RequirementStatus | null;
  const domainRaw = searchParams.get('domain') as WorkDomain | null;
  const personIdRaw = searchParams.get('personId');
  const repositoryIdRaw = searchParams.get('repositoryId');
  const keyword = searchParams.get('keyword') ?? undefined;
  const riskOnly = searchParams.get('riskOnly') === '1';
  const releaseFrom = searchParams.get('releaseFrom') ?? undefined;
  const releaseTo = searchParams.get('releaseTo') ?? undefined;
  const beforeTesting = searchParams.get('beforeTesting') === '1';

  return {
    status: status && statusOptions.some((item) => item.value === status) ? status : undefined,
    domain:
      domainRaw && domainOptions.some((item) => item.value === domainRaw) ? domainRaw : undefined,
    beforeTesting: beforeTesting || undefined,
    personId: personIdRaw && Number.isFinite(Number(personIdRaw)) ? Number(personIdRaw) : undefined,
    repositoryId:
      repositoryIdRaw && Number.isFinite(Number(repositoryIdRaw))
        ? Number(repositoryIdRaw)
        : undefined,
    keyword: keyword || undefined,
    riskOnly: riskOnly || undefined,
    releaseFrom,
    releaseTo,
  };
}

export default function RequirementsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const utils = trpc.useUtils();

  const listFilters = useMemo(() => buildListFilters(searchParams), [searchParams]);
  const listQuery = trpc.requirements.list.useQuery(listFilters);

  const updateFilters = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    setSearchParams(next);
  };

  const clearFilters = () => setSearchParams({});

  const applyWeekRelease = () => {
    const range = getWeekReleaseRange();
    updateFilters({
      releaseFrom: range.releaseFrom,
      releaseTo: range.releaseTo,
    });
  };

  const createMutation = trpc.requirements.create.useMutation({
    onSuccess: async (created) => {
      await utils.requirements.list.invalidate();
      await utils.workbench.summary.invalidate();
      setOpen(false);
      form.resetFields();
      navigate(`/requirements/${created.id}`);
    },
  });

  const hasActiveFilters =
    searchParams.get('status') ||
    searchParams.get('domain') ||
    searchParams.get('personId') ||
    searchParams.get('repositoryId') ||
    searchParams.get('keyword') ||
    searchParams.get('riskOnly') === '1' ||
    searchParams.get('releaseFrom') ||
    searchParams.get('releaseTo') ||
    searchParams.get('beforeTesting') === '1';

  return (
    <div>
      <div className="list-row">
        <div>
          <h2 className="page-title">工作列表</h2>
          <p className="page-desc">按工作域、状态、关键词筛选个人工作项；查看风险与计划时间。</p>
        </div>
        <Button type="primary" onClick={() => setOpen(true)}>
          新建工作项
        </Button>
      </div>

      <div className="content-card">
        <div className="filter-grid">
          <Select
            allowClear
            placeholder="按工作域筛选"
            style={{ width: '100%' }}
            value={searchParams.get('domain') ?? undefined}
            options={domainOptions}
            onChange={(value) => updateFilters({ domain: value ?? null })}
          />
          <Select
            allowClear
            placeholder="按状态筛选"
            style={{ width: '100%' }}
            value={searchParams.get('status') ?? undefined}
            options={statusOptions}
            onChange={(value) => updateFilters({ status: value ?? null })}
          />
          <Input
            placeholder="关键词（名称/版本/仓库名）"
            value={searchParams.get('keyword') ?? ''}
            onChange={(event) => updateFilters({ keyword: event.target.value || null })}
          />
        </div>
        <div className="filter-toolbar">
          <div className="tag-list">
            <Button
              type={searchParams.get('riskOnly') === '1' ? 'primary' : 'default'}
              onClick={() =>
                updateFilters({
                  riskOnly: searchParams.get('riskOnly') === '1' ? null : '1',
                })
              }
            >
              仅有阻塞
            </Button>
            <Button
              type={searchParams.get('beforeTesting') === '1' ? 'primary' : 'default'}
              onClick={() =>
                updateFilters({
                  beforeTesting: searchParams.get('beforeTesting') === '1' ? null : '1',
                  status: null,
                })
              }
            >
              尚未提测
            </Button>
            <Button onClick={applyWeekRelease}>本周计划上线</Button>
            {hasActiveFilters ? (
              <Button onClick={clearFilters}>清除筛选</Button>
            ) : null}
          </div>
          {(searchParams.get('releaseFrom') || searchParams.get('releaseTo')) && (
            <span className="empty-hint">
              计划上线：{searchParams.get('releaseFrom') || '—'} ~{' '}
              {searchParams.get('releaseTo') || '—'}
            </span>
          )}
        </div>
      </div>

      {listQuery.isLoading ? (
        <Spin size="large" />
      ) : (
        <div className="content-card">
          <Table
            rowKey="id"
            dataSource={listQuery.data ?? []}
            pagination={false}
            columns={[
              {
                title: '名称',
                dataIndex: 'name',
                render: (value, record) => (
                  <Link className="content-link" to={`/requirements/${record.id}`}>
                    {value}
                  </Link>
                ),
              },
              {
                title: '工作域',
                dataIndex: 'domain',
                width: 88,
                render: (value: WorkDomain) => getWorkDomainLabel(value),
              },
              {
                title: '状态',
                dataIndex: 'status',
                render: (value: RequirementStatus) => getRequirementStatusLabel(value),
              },
              {
                title: '优先级',
                dataIndex: 'priority',
                render: (value: Priority) => getPriorityLabel(value),
              },
              {
                title: '目标版本',
                dataIndex: 'targetVersion',
              },
              {
                title: '计划上线',
                dataIndex: 'plannedReleaseAt',
              },
              {
                title: '最近活跃',
                dataIndex: 'updatedAt',
                render: (value: string) => formatActiveDate(value),
              },
              {
                title: '风险',
                dataIndex: 'risk',
                render: (value) => value || '-',
              },
              {
                title: '操作',
                width: 100,
                render: (_, record) => (
                  <Link to={`/requirements/${record.id}`}>
                    <Button type="link" size="small">
                      查看详情
                    </Button>
                  </Link>
                ),
              },
            ]}
          />
        </div>
      )}

      <Modal
        title="新建工作项"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ domain: 'dev', status: 'pending_review', priority: 'medium' }}
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="domain" label="工作域" rules={[{ required: true }]}>
            <Select options={domainOptions} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select options={statusOptions} />
          </Form.Item>
          <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
            <Select options={priorityOptions} />
          </Form.Item>
          <Form.Item name="targetVersion" label="目标版本">
            <Input />
          </Form.Item>
          <Form.Item name="plannedReleaseAt" label="计划上线时间">
            <Input placeholder="例如 2026-06-30" />
          </Form.Item>
          <Form.Item name="risk" label="风险">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
