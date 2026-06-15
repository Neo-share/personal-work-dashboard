import { Button, Form, Input, Modal, Popconfirm, Spin, Table } from 'antd';
import type { Person } from '@project-manager/shared';
import { useState } from 'react';
import { PersonFeishuLink } from '../components/PersonFeishuLink';
import { trpc } from '../lib/trpc';

export default function PeoplePage() {
  const [open, setOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [form] = Form.useForm();
  const utils = trpc.useUtils();
  const listQuery = trpc.people.list.useQuery();

  const closeModal = () => {
    setOpen(false);
    setEditingPerson(null);
    form.resetFields();
  };

  const openCreate = () => {
    setEditingPerson(null);
    form.resetFields();
    setOpen(true);
  };

  const openEdit = (person: Person) => {
    setEditingPerson(person);
    form.setFieldsValue(person);
    setOpen(true);
  };

  const createMutation = trpc.people.create.useMutation({
    onSuccess: async () => {
      await utils.people.list.invalidate();
      closeModal();
    },
  });

  const updateMutation = trpc.people.update.useMutation({
    onSuccess: async () => {
      await utils.people.list.invalidate();
      closeModal();
    },
  });

  const deleteMutation = trpc.people.delete.useMutation({
    onSuccess: async () => {
      await utils.people.list.invalidate();
    },
  });

  const handleSubmit = (values: {
    name: string;
    role: string;
    team?: string;
    contact?: string;
    feishuOpenId?: string;
  }) => {
    if (editingPerson) {
      updateMutation.mutate({ id: editingPerson.id, ...values });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <div>
      <div className="list-row">
        <div>
          <h2 className="page-title">协作联系人</h2>
          <p className="page-desc">记录任务相关的产品、测试等协作对象，按需关联到任务详情。</p>
        </div>
        <Button type="primary" onClick={openCreate}>
          新增人员
        </Button>
      </div>

      {listQuery.isLoading ? (
        <Spin size="large" />
      ) : (
        <div className="content-card">
          <Table
            rowKey="id"
            pagination={false}
            dataSource={listQuery.data ?? []}
            columns={[
              {
                title: '姓名',
                dataIndex: 'name',
                render: (_, record) => <PersonFeishuLink person={record} />,
              },
              { title: '角色', dataIndex: 'role' },
              { title: '团队', dataIndex: 'team' },
              { title: '联系方式', dataIndex: 'contact' },
              { title: '飞书 Open ID', dataIndex: 'feishuOpenId' },
              {
                title: '操作',
                render: (_, record) => (
                  <div className="tag-list">
                    <Button size="small" onClick={() => openEdit(record)}>
                      编辑
                    </Button>
                    <Popconfirm
                      title="确认删除该人员？关联的需求人员关系将一并移除。"
                      onConfirm={() => deleteMutation.mutate({ id: record.id })}
                    >
                      <Button size="small" danger loading={deleteMutation.isPending}>
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      <Modal
        title={editingPerson ? '编辑关联人员' : '新增关联人员'}
        open={open}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="team" label="团队">
            <Input />
          </Form.Item>
          <Form.Item name="contact" label="联系方式">
            <Input />
          </Form.Item>
          <Form.Item
            name="feishuOpenId"
            label="飞书 Open ID"
            extra="填写 ou_ 开头的 open_id，或把 applink 链接填在联系方式中也可识别"
          >
            <Input placeholder="ou_xxxxxxxx" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
