import type { PersonalAssistantRefresh } from '@project-manager/shared';
import { PERSONAL_ASSISTANT_SOUL_TONE_LABELS } from '@project-manager/shared';
import { Button, Form, Input, Modal, Select, message } from 'antd';
import { useEffect, useState } from 'react';
import { trpc } from '../../lib/trpc';

const QUICK_CHIPS = [
  '明天下午3点开项目评审会',
  '下周二上午10点面试产品经理',
  '周三去北京出差',
  '本周五提醒我完成UI改版方案',
  '提醒我每天下午5点复盘港股收盘情况',
  '提醒我下周三完成协议合规审核',
];

interface PersonalAssistantPanelProps {
  onRefresh?: (targets?: PersonalAssistantRefresh[]) => void;
  modifyTodoId?: number | null;
  modifyVersion?: number;
  onExitModify?: () => void;
  onModifyMode?: (todoId: number, version?: number) => void;
  onEnterModify?: (todoId: number, version?: number) => void;
}

export default function PersonalAssistantPanel({
  onRefresh,
  modifyTodoId,
  modifyVersion,
  onExitModify,
  onModifyMode,
  onEnterModify,
}: PersonalAssistantPanelProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: '你好！我会先区分待办与日程，帮你创建内容或生成初步结果。',
    },
  ]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [soulOpen, setSoulOpen] = useState(false);
  const [soulForm] = Form.useForm();

  const sessionsQuery = trpc.assistant.sessions.useQuery();
  const soulQuery = trpc.personalWorkbench.getSoulSettings.useQuery(undefined, {
    enabled: soulOpen,
  });
  const setSoulMutation = trpc.personalWorkbench.setSoulSettings.useMutation({
    onSuccess: () => {
      void soulQuery.refetch();
      setSoulOpen(false);
      message.success('Soul 设置已保存');
    },
    onError: (err) => message.error(err.message || '保存失败'),
  });
  const todoThreadsQuery = trpc.assistant.todoThreads.useQuery(undefined, {
    enabled: historyOpen,
  });
  const createSessionMutation = trpc.assistant.createSession.useMutation({
    onSuccess: () => {
      setMessages([
        {
          role: 'assistant',
          content: '新对话已开始。我会先区分待办与日程。',
        },
      ]);
      void sessionsQuery.refetch();
    },
  });

  const activeSessionId = sessionsQuery.data?.[0]?.id;

  useEffect(() => {
    if (soulOpen && soulQuery.data) {
      soulForm.setFieldsValue(soulQuery.data);
    }
  }, [soulOpen, soulQuery.data, soulForm]);

  const selectedThread = todoThreadsQuery.data?.find((t) => t.todoId === selectedThreadId);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);

    let assistantText = '';
    let assistantStarted = false;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: 'personal',
          modifyTodoId: modifyTodoId ?? undefined,
          sessionId: activeSessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('无法读取响应');

      let refreshTargets: PersonalAssistantRefresh[] | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.startsWith('data: '));

        for (const line of lines) {
          const payload = JSON.parse(line.replace('data: ', '')) as {
            type: string;
            content?: string;
            message?: string;
            code?: string;
            refresh?: PersonalAssistantRefresh[];
            modifyTodoId?: number;
            modifyVersion?: number;
          };

          if (payload.type === 'error') {
            assistantText = payload.message ?? '助手暂时不可用，请稍后再试。';
            setMessages((prev) => [...prev, { role: 'assistant', content: assistantText }]);
            assistantStarted = true;
            continue;
          }

          if (payload.type === 'blocked') {
            assistantText = payload.message ?? '操作已被拦截。';
            setMessages((prev) => [...prev, { role: 'assistant', content: assistantText }]);
            assistantStarted = true;
            continue;
          }

          if (payload.type === 'text' && payload.content) {
            assistantText += payload.content;
            setMessages((prev) => {
              if (!assistantStarted) {
                assistantStarted = true;
                return [...prev, { role: 'assistant', content: assistantText }];
              }
              const next = [...prev];
              next[next.length - 1] = { role: 'assistant', content: assistantText };
              return next;
            });
          }

          if (payload.type === 'refresh' && payload.refresh) {
            refreshTargets = payload.refresh;
          }

          if (payload.type === 'modifyMode' && payload.modifyTodoId) {
            onModifyMode?.(payload.modifyTodoId, payload.modifyVersion);
          }
        }
      }

      if (assistantText && !assistantStarted) {
        setMessages((prev) => [...prev, { role: 'assistant', content: assistantText }]);
      }

      if (refreshTargets) {
        onRefresh?.(refreshTargets);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '助手暂时不可用，请稍后再试。' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function enterModifyFromHistory() {
    if (!selectedThread) return;
    onEnterModify?.(selectedThread.todoId, selectedThread.latestVersion);
    setHistoryOpen(false);
  }

  return (
    <aside className="pw-assistant">
      {modifyTodoId ? (
        <div className="pw-modify-bar">
          修改模式 · 待办 #{modifyTodoId} · v{modifyVersion ?? 1}
          <Button type="link" size="small" onClick={onExitModify}>
            退出
          </Button>
        </div>
      ) : null}

      <div className="pw-assistant-head">
        <span className="pw-assistant-title">个人助手</span>
        <div className="pw-assistant-tools">
          <Button
            type="text"
            size="small"
            onClick={() => createSessionMutation.mutate({ title: '新对话' })}
          >
            新建
          </Button>
          <Button
            type="text"
            size="small"
            onClick={() => {
              setHistoryOpen(true);
              void todoThreadsQuery.refetch();
            }}
          >
            历史
          </Button>
          <Button
            type="text"
            size="small"
            onClick={() => {
              setSoulOpen(true);
              void soulQuery.refetch();
            }}
          >
            Soul
          </Button>
        </div>
      </div>

      <div className="pw-assistant-body">
        {messages.map((msg, idx) => (
          <div key={idx} className={`pw-chat-msg ${msg.role}`}>
            {msg.content}
          </div>
        ))}

        {!modifyTodoId ? (
          <div className="pw-chips">
            {QUICK_CHIPS.map((chip) => (
              <button key={chip} type="button" className="pw-chip" onClick={() => void sendMessage(chip)}>
                {chip}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="pw-assistant-input">
        <Input.TextArea
          rows={2}
          value={input}
          placeholder="向个人助手提问"
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              void sendMessage(input);
            }
          }}
        />
        <Button
          type="primary"
          block
          style={{ marginTop: 8 }}
          loading={loading}
          onClick={() => void sendMessage(input)}
        >
          发送
        </Button>
      </div>

      <Modal
        title="历史对话 · AI 结果"
        open={historyOpen}
        onCancel={() => {
          setHistoryOpen(false);
          setSelectedThreadId(null);
        }}
        width={720}
        footer={
          selectedThread ? (
            <Button type="primary" onClick={enterModifyFromHistory}>
              继续修改
            </Button>
          ) : null
        }
      >
        <div style={{ display: 'flex', gap: 16, minHeight: 320 }}>
          <div style={{ width: 200, borderRight: '1px solid #e8eaf0', paddingRight: 12 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>待办与 AI 版本</div>
            {todoThreadsQuery.data?.map((thread) => (
              <button
                key={thread.todoId}
                type="button"
                onClick={() => setSelectedThreadId(thread.todoId)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 6px',
                  marginBottom: 4,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: selectedThreadId === thread.todoId ? '#ede9fe' : 'transparent',
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 600 }}>{thread.title}</div>
                <div style={{ color: '#64748b' }}>
                  v{thread.latestVersion} · {thread.messageCount} 条对话
                </div>
              </button>
            ))}
            {!todoThreadsQuery.data?.length ? (
              <div className="empty-hint" style={{ fontSize: 12 }}>
                暂无 AI 结果历史
              </div>
            ) : null}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {selectedThread?.latestHtmlPreview ? (
              <div
                dangerouslySetInnerHTML={{ __html: selectedThread.latestHtmlPreview }}
                style={{ fontSize: 13 }}
              />
            ) : (
              <div className="empty-hint">选择左侧待办查看 AI 结果预览</div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        title="Soul 设置"
        open={soulOpen}
        onCancel={() => setSoulOpen(false)}
        onOk={() => soulForm.submit()}
        confirmLoading={setSoulMutation.isPending}
      >
        <Form
          form={soulForm}
          layout="vertical"
          onFinish={(values: { tone: 'formal' | 'concise' | 'friendly'; customInstructions: string }) => {
            setSoulMutation.mutate(values);
          }}
        >
          <Form.Item name="tone" label="回复风格" rules={[{ required: true }]}>
            <Select
              options={Object.entries(PERSONAL_ASSISTANT_SOUL_TONE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="customInstructions"
            label="自定义偏好"
            extra="保存后将注入 AI 初步结果与个人助手上下文"
          >
            <Input.TextArea rows={4} placeholder="例如：优先简洁条目；结论必须可执行" />
          </Form.Item>
        </Form>
      </Modal>
    </aside>
  );
}
