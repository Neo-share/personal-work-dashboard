import { Button, Drawer, Input, List } from 'antd';
import { useState } from 'react';
import type { ChatMessage, NavigationAction } from '@project-manager/shared';
import { useNavigationAction } from '../hooks/useNavigationAction';

export default function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '你好，我可以帮你打开任务详情、查看阻塞项、打开关系图谱或进入扫描中心。',
    },
  ]);
  const navigateByAction = useNavigationAction();

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);

    let assistantText = '';
    let action: NavigationAction | undefined;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取助手响应');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.startsWith('data: '));

        for (const line of lines) {
          const payload = JSON.parse(line.replace('data: ', '')) as {
            type: 'text' | 'action' | 'done';
            content?: string;
            action?: NavigationAction;
          };

          if (payload.type === 'text' && payload.content) {
            assistantText += payload.content;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant' && last.content.startsWith(assistantText.slice(0, 1))) {
                next[next.length - 1] = { role: 'assistant', content: assistantText };
              } else {
                next.push({ role: 'assistant', content: assistantText });
              }
              return next;
            });
          }

          if (payload.type === 'action' && payload.action) {
            action = payload.action;
          }
        }
      }

      if (assistantText) {
        setMessages((prev) => {
          const next = [...prev];
          const lastIndex = next.length - 1;
          if (next[lastIndex]?.role === 'assistant') {
            next[lastIndex] = { role: 'assistant', content: assistantText, action };
          } else {
            next.push({ role: 'assistant', content: assistantText, action });
          }
          return next;
        });
      }

      if (action) {
        navigateByAction(action);
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

  return (
    <>
      <button className="chat-fab" type="button" onClick={() => setOpen(true)}>
        对话助手
      </button>

      <Drawer
        title="对话助手"
        placement="right"
        width={360}
        open={open}
        onClose={() => setOpen(false)}
      >
        <List
          dataSource={messages}
          renderItem={(item) => (
            <List.Item className={item.role === 'user' ? 'chat-item-user' : 'chat-item-assistant'}>
              <div>
                <div>{item.content}</div>
                {item.action ? (
                  <div className="empty-hint">已触发导航：{item.action.type}</div>
                ) : null}
              </div>
            </List.Item>
          )}
        />

        <div className="chat-input-row">
          <Input.TextArea
            rows={2}
            value={input}
            placeholder="例如：打开新增会员权益页任务详情"
            onChange={(event) => setInput(event.target.value)}
            onPressEnter={(event) => {
              if (!event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
          />
          <Button
            type="primary"
            loading={loading}
            onClick={() => void sendMessage()}
            style={{ marginTop: 8 }}
          >
            发送
          </Button>
        </div>
      </Drawer>
    </>
  );
}
