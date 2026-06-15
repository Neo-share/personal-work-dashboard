import {
  Button,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Table,
  Tag,
  message,
} from 'antd';
import type { Milestone, Priority, RequirementDetail, RequirementStatus } from '@project-manager/shared';
import { isDevWorkDomain, WORK_DOMAIN_MODULES } from '@project-manager/shared';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PersonFeishuLink } from '../components/PersonFeishuLink';
import {
  getDirectionLabel,
  getPriorityLabel,
  getRequirementStatusLabel,
  getWorkDomainLabel,
} from '../utils/labels';
import { trpc } from '../lib/trpc';

type ModalType =
  | 'repo'
  | 'person-upstream'
  | 'person-downstream'
  | 'milestone'
  | 'link'
  | 'edit'
  | null;

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

const domainOptions = WORK_DOMAIN_MODULES.map((item) => ({
  value: item.id,
  label: item.label,
}));

export default function RequirementDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const requirementId = Number(params.id);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const utils = trpc.useUtils();

  const detailQuery = trpc.requirements.detail.useQuery(
    { id: requirementId },
    { enabled: Number.isFinite(requirementId) },
  );
  const repositoriesQuery = trpc.repositories.list.useQuery();
  const peopleQuery = trpc.people.list.useQuery();

  const invalidate = async () => {
    await utils.requirements.detail.invalidate({ id: requirementId });
    await utils.workbench.summary.invalidate();
    await utils.graph.get.invalidate();
  };

  const closeModal = () => {
    setModalType(null);
    setEditingMilestoneId(null);
    form.resetFields();
  };

  const addRepoMutation = trpc.requirements.addRepository.useMutation({
    onSuccess: async () => {
      await invalidate();
      closeModal();
    },
  });
  const removeRepoMutation = trpc.requirements.removeRepository.useMutation({ onSuccess: invalidate });
  const addPersonMutation = trpc.requirements.addPerson.useMutation({
    onSuccess: async () => {
      await invalidate();
      closeModal();
    },
  });
  const removePersonMutation = trpc.requirements.removePerson.useMutation({ onSuccess: invalidate });
  const addMilestoneMutation = trpc.requirements.addMilestone.useMutation({
    onSuccess: async () => {
      await invalidate();
      closeModal();
    },
  });
  const removeMilestoneMutation = trpc.requirements.removeMilestone.useMutation({ onSuccess: invalidate });
  const addLinkMutation = trpc.requirements.addLink.useMutation({
    onSuccess: async () => {
      await invalidate();
      closeModal();
    },
  });
  const removeLinkMutation = trpc.requirements.removeLink.useMutation({ onSuccess: invalidate });
  const updateMutation = trpc.requirements.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      await utils.requirements.list.invalidate();
      closeModal();
    },
  });
  const deleteMutation = trpc.requirements.delete.useMutation({
    onSuccess: async () => {
      await utils.requirements.list.invalidate();
      await utils.workbench.summary.invalidate();
      navigate('/requirements');
    },
  });
  const updateMilestoneMutation = trpc.requirements.updateMilestone.useMutation({
    onSuccess: async () => {
      await invalidate();
      closeModal();
    },
  });
  const openInCursorMutation = trpc.repositories.openInCursor.useMutation({
    onSuccess: async (result) => {
      await invalidate();
      await utils.repositories.list.invalidate();
      const target =
        result.mode === 'agent_window' ? 'Agent Window' : '经典编辑器';
      message.success(
        result.mode === 'agent_window'
          ? `已切换到「${result.branch ?? '当前分支'}」并新建 Agent`
          : result.switched
            ? `已切换到「${result.branch}」并在 ${target} 中打开`
            : `已在 ${target} 中导航到仓库（${result.branch ?? '当前分支'}）`,
      );
    },
    onError: (error) => {
      message.error(error.message);
    },
  });

  if (detailQuery.isLoading) {
    return <Spin size="large" />;
  }

  const detail = detailQuery.data;
  if (!detail) {
    return <div className="empty-hint">未找到该工作项</div>;
  }

  const showDevSections = isDevWorkDomain(detail.domain);

  const upstreamPeople = detail.people.filter((item) => item.direction === 'upstream');
  const downstreamPeople = detail.people.filter((item) => item.direction === 'downstream');

  const openPersonModal = (direction: 'upstream' | 'downstream') => {
    form.setFieldsValue({
      direction,
      managementRole: 'participant',
      status: 'pending',
    });
    setModalType(direction === 'upstream' ? 'person-upstream' : 'person-downstream');
  };

  const openEditModal = () => {
    form.setFieldsValue({
      name: detail.name,
      domain: detail.domain,
      status: detail.status,
      priority: detail.priority,
      targetVersion: detail.targetVersion ?? undefined,
      plannedReleaseAt: detail.plannedReleaseAt ?? undefined,
      risk: detail.risk ?? undefined,
      blockers: detail.blockers ?? undefined,
      notes: detail.notes ?? undefined,
    });
    setModalType('edit');
  };

  const openMilestoneEdit = (milestone: Milestone) => {
    setEditingMilestoneId(milestone.id);
    form.setFieldsValue({
      name: milestone.name,
      targetDate: milestone.targetDate ?? undefined,
      status: milestone.status,
      blockers: milestone.blockers ?? undefined,
    });
    setModalType('milestone');
  };

  const openRepositoryInCursor = (
    record: RequirementDetail['repositories'][number],
    mode: 'agent_window' | 'classic' = 'agent_window',
  ) => {
    const branch = record.branch?.trim() || record.repository.currentBranch;
    openInCursorMutation.mutate({
      repositoryId: record.repositoryId,
      branch,
      mode,
    });
  };

  const handleSubmit = (values: Record<string, unknown>) => {
    switch (modalType) {
      case 'edit':
        updateMutation.mutate({ id: requirementId, ...values } as never);
        break;
      case 'repo':
        addRepoMutation.mutate({ requirementId, ...values } as never);
        break;
      case 'person-upstream':
      case 'person-downstream':
        addPersonMutation.mutate({ requirementId, ...values } as never);
        break;
      case 'milestone':
        if (editingMilestoneId) {
          updateMilestoneMutation.mutate({
            id: editingMilestoneId,
            requirementId,
            ...values,
          } as never);
        } else {
          addMilestoneMutation.mutate({ requirementId, ...values } as never);
        }
        break;
      case 'link':
        addLinkMutation.mutate({ requirementId, ...values } as never);
        break;
      default:
        break;
    }
  };

  const modalTitleMap: Record<Exclude<ModalType, null>, string> = {
    edit: '编辑工作项',
    repo: '关联仓库',
    'person-upstream': '添加上游开发人员',
    'person-downstream': '添加下游交付人员',
    milestone: editingMilestoneId ? '编辑里程碑' : '添加里程碑',
    link: '添加关联链接',
  };

  return (
    <div>
      <div className="list-row">
        <div>
          <h2 className="page-title">{detail.name}</h2>
          <p className="page-desc">
            {getWorkDomainLabel(detail.domain)} · 外部链接
            {showDevSections ? '、关联仓库' : ''}、里程碑与协作联系人
          </p>
        </div>
        <div className="tag-list">
          <Button onClick={openEditModal}>编辑</Button>
          <Popconfirm
            title="确认删除该工作项？所有关联数据将一并删除。"
            onConfirm={() => deleteMutation.mutate({ id: requirementId })}
          >
            <Button danger loading={deleteMutation.isPending}>
              删除
            </Button>
          </Popconfirm>
          {showDevSections ? (
            <Link to={`/graph?requirementId=${detail.id}`}>
              <Button>查看关系图</Button>
            </Link>
          ) : null}
          <Link to="/requirements">
            <Button>返回工作列表</Button>
          </Link>
        </div>
      </div>

      <div className="content-card">
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="工作域">
            {getWorkDomainLabel(detail.domain)}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {getRequirementStatusLabel(detail.status)}
          </Descriptions.Item>
          <Descriptions.Item label="优先级">
            {getPriorityLabel(detail.priority)}
          </Descriptions.Item>
          <Descriptions.Item label="目标版本">
            {detail.targetVersion || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="计划上线">
            {detail.plannedReleaseAt || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="风险" span={2}>
            {detail.risk || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="阻塞项" span={2}>
            {detail.blockers || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>
            {detail.notes || '-'}
          </Descriptions.Item>
        </Descriptions>
      </div>

      <section className="content-card links-section">
        <div className="list-row">
          <div>
            <h3 className="section-title">关联链接</h3>
            <p className="page-desc">Figma、YApi、文档等外部资源快捷入口</p>
          </div>
          <Button type="primary" size="small" onClick={() => setModalType('link')}>
            添加链接
          </Button>
        </div>
        {detail.links.length === 0 ? (
          <div className="empty-hint">暂无关联链接，可添加设计稿、接口文档、监控等外部资源。</div>
        ) : (
          <div className="link-card-grid">
            {detail.links.map((item) => (
              <div className="link-card" key={item.id}>
                <div className="link-card-header">
                  <Tag color="orange">{item.type}</Tag>
                  <Popconfirm
                    title="确认删除该链接？"
                    onConfirm={() =>
                      removeLinkMutation.mutate({ id: item.id, requirementId })
                    }
                  >
                    <Button size="small" danger>
                      删除
                    </Button>
                  </Popconfirm>
                </div>
                <a
                  className="content-link link-card-title"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.title}
                </a>
                <div className="empty-hint link-card-url">{item.url}</div>
                <a href={item.url} target="_blank" rel="noreferrer">
                  <Button type="primary" size="small">
                    打开链接
                  </Button>
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="detail-grid">
        <div>
          {showDevSections ? (
          <section className="content-card">
            <div className="list-row">
              <h3 className="section-title">关联仓库</h3>
              <Button size="small" onClick={() => setModalType('repo')}>
                关联仓库
              </Button>
            </div>
            <Table
              rowKey="id"
              pagination={false}
              dataSource={detail.repositories}
              columns={[
                {
                  title: '仓库',
                  dataIndex: ['repository', 'name'],
                  render: (value, record) => (
                    <Button
                      type="link"
                      className="content-link"
                      loading={
                        openInCursorMutation.isPending &&
                        openInCursorMutation.variables?.repositoryId === record.repositoryId
                      }
                      onClick={() => openRepositoryInCursor(record, 'agent_window')}
                      title="在 Cursor Agent Window 中打开并导航到该仓库"
                    >
                      {value}
                    </Button>
                  ),
                },
                { title: '职责', dataIndex: 'responsibility' },
                {
                  title: '分支',
                  dataIndex: 'branch',
                  className: 'mono',
                  render: (value, record) => {
                    const targetBranch = value || record.repository.currentBranch || '-';
                    const scannedBranch = record.repository.currentBranch;
                    if (value && scannedBranch && value !== scannedBranch) {
                      return (
                        <span>
                          {value}
                          <span className="empty-hint"> · 扫描时 {scannedBranch}</span>
                        </span>
                      );
                    }
                    return targetBranch;
                  },
                },
                { title: '状态', dataIndex: 'status' },
                { title: '风险', dataIndex: 'risk' },
                {
                  title: '操作',
                  render: (_, record) => (
                    <div className="tag-list">
                      <Button
                        size="small"
                        loading={
                          openInCursorMutation.isPending &&
                          openInCursorMutation.variables?.repositoryId === record.repositoryId
                        }
                        onClick={() => openRepositoryInCursor(record, 'agent_window')}
                      >
                        Agent 打开
                      </Button>
                      <Button
                        size="small"
                        loading={
                          openInCursorMutation.isPending &&
                          openInCursorMutation.variables?.repositoryId === record.repositoryId
                        }
                        onClick={() => openRepositoryInCursor(record, 'classic')}
                      >
                        编辑器打开
                      </Button>
                      <Popconfirm
                        title="确认移除该仓库关联？"
                        onConfirm={() =>
                          removeRepoMutation.mutate({ id: record.id, requirementId })
                        }
                      >
                        <Button size="small" danger>
                          移除
                        </Button>
                      </Popconfirm>
                    </div>
                  ),
                },
              ]}
            />
          </section>
          ) : null}

          <section className="content-card">
            <div className="list-row">
              <h3 className="section-title">里程碑</h3>
              <Button size="small" onClick={() => {
                setEditingMilestoneId(null);
                form.resetFields();
                setModalType('milestone');
              }}>
                添加里程碑
              </Button>
            </div>
            <Table
              rowKey="id"
              pagination={false}
              dataSource={detail.milestones}
              columns={[
                { title: '名称', dataIndex: 'name' },
                { title: '目标日期', dataIndex: 'targetDate' },
                { title: '状态', dataIndex: 'status' },
                {
                  title: '操作',
                  render: (_, record) => (
                    <div className="tag-list">
                      <Button size="small" onClick={() => openMilestoneEdit(record)}>
                        编辑
                      </Button>
                      <Popconfirm
                        title="确认删除该里程碑？"
                        onConfirm={() =>
                          removeMilestoneMutation.mutate({ id: record.id, requirementId })
                        }
                      >
                        <Button size="small" danger>
                          删除
                        </Button>
                      </Popconfirm>
                    </div>
                  ),
                },
              ]}
            />
          </section>
        </div>

        <div>
          <section className="content-card">
            <div className="list-row">
              <h3 className="section-title">上游开发人员</h3>
              <Button size="small" onClick={() => openPersonModal('upstream')}>
                添加人员
              </Button>
            </div>
            {upstreamPeople.map((item) => (
              <div className="list-row" key={item.id}>
                <div>
                  <strong>
                    <PersonFeishuLink person={item.person} />
                  </strong>
                  <div className="empty-hint">
                    {item.roleType} · {item.responsibility || '未填写职责'}
                  </div>
                </div>
                <div className="tag-list">
                  <Tag>{item.status}</Tag>
                  <Popconfirm
                    title="确认移除该人员关联？"
                    onConfirm={() =>
                      removePersonMutation.mutate({ id: item.id, requirementId })
                    }
                  >
                    <Button size="small" danger>
                      移除
                    </Button>
                  </Popconfirm>
                </div>
              </div>
            ))}
          </section>

          <section className="content-card">
            <div className="list-row">
              <h3 className="section-title">下游交付人员</h3>
              <Button size="small" onClick={() => openPersonModal('downstream')}>
                添加人员
              </Button>
            </div>
            {downstreamPeople.map((item) => (
              <div className="list-row" key={item.id}>
                <div>
                  <strong>
                    <PersonFeishuLink person={item.person} />
                  </strong>
                  <div className="empty-hint">
                    {getDirectionLabel(item.direction)} · {item.roleType}
                  </div>
                </div>
                <div className="tag-list">
                  <Tag>{item.status}</Tag>
                  <Popconfirm
                    title="确认移除该人员关联？"
                    onConfirm={() =>
                      removePersonMutation.mutate({ id: item.id, requirementId })
                    }
                  >
                    <Button size="small" danger>
                      移除
                    </Button>
                  </Popconfirm>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>

      <Modal
        title={modalType ? modalTitleMap[modalType] : ''}
        open={modalType !== null}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={
          updateMutation.isPending ||
          addRepoMutation.isPending ||
          addPersonMutation.isPending ||
          addMilestoneMutation.isPending ||
          updateMilestoneMutation.isPending ||
          addLinkMutation.isPending
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {modalType === 'edit' ? (
            <>
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
              <Form.Item name="blockers" label="阻塞项">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item name="notes" label="备注">
                <Input.TextArea rows={3} />
              </Form.Item>
            </>
          ) : null}

          {modalType === 'repo' ? (
            <>
              <Form.Item name="repositoryId" label="仓库" rules={[{ required: true }]}>
                <Select
                  options={(repositoriesQuery.data ?? []).map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                />
              </Form.Item>
              <Form.Item name="responsibility" label="职责">
                <Input />
              </Form.Item>
              <Form.Item name="branch" label="开发分支">
                <Input />
              </Form.Item>
              <Form.Item name="status" label="状态">
                <Input />
              </Form.Item>
              <Form.Item name="risk" label="风险">
                <Input />
              </Form.Item>
            </>
          ) : null}

          {modalType === 'person-upstream' || modalType === 'person-downstream' ? (
            <>
              <Form.Item name="personId" label="人员" rules={[{ required: true }]}>
                <Select
                  options={(peopleQuery.data ?? []).map((item) => ({
                    value: item.id,
                    label: `${item.name} · ${item.role}`,
                  }))}
                />
              </Form.Item>
              <Form.Item name="direction" hidden>
                <Input />
              </Form.Item>
              <Form.Item name="roleType" label="角色类型" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="responsibility" label="职责">
                <Input />
              </Form.Item>
              <Form.Item name="managementRole" label="管理角色">
                <Select
                  options={[
                    { value: 'owner', label: '主负责人' },
                    { value: 'participant', label: '参与人' },
                    { value: 'watcher', label: '关注人' },
                    { value: 'acceptor', label: '验收人' },
                    { value: 'release_coordinator', label: '发布协同' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="status" label="状态">
                <Select
                  options={[
                    { value: 'pending', label: '待参与' },
                    { value: 'in_progress', label: '进行中' },
                    { value: 'completed', label: '已完成' },
                    { value: 'blocked', label: '阻塞中' },
                  ]}
                />
              </Form.Item>
            </>
          ) : null}

          {modalType === 'milestone' ? (
            <>
              <Form.Item name="name" label="名称" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="targetDate" label="目标日期">
                <Input placeholder="2026-06-30" />
              </Form.Item>
              <Form.Item name="status" label="状态" initialValue="pending">
                <Select
                  options={[
                    { value: 'pending', label: '待开始' },
                    { value: 'in_progress', label: '进行中' },
                    { value: 'completed', label: '已完成' },
                    { value: 'blocked', label: '阻塞中' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="blockers" label="阻塞项">
                <Input.TextArea rows={2} />
              </Form.Item>
            </>
          ) : null}

          {modalType === 'link' ? (
            <>
              <Form.Item name="type" label="类型" rules={[{ required: true }]}>
                <Input placeholder="figma / yapi / doc" />
              </Form.Item>
              <Form.Item name="title" label="标题" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="url" label="链接" rules={[{ required: true, type: 'url' }]}>
                <Input />
              </Form.Item>
            </>
          ) : null}
        </Form>
      </Modal>
    </div>
  );
}
