import { Button, Modal, Spin } from 'antd';
import { trpc } from '../../lib/trpc';

interface AssistantMetricsModalProps {
  open: boolean;
  onClose: () => void;
}

const CALLER_LABELS: Record<string, string> = {
  title: '标题提取',
  generate: 'AI 生成',
  revise: 'AI 修订',
};

export default function AssistantMetricsModal({ open, onClose }: AssistantMetricsModalProps) {
  const metricsQuery = trpc.assistant.metricsSummary.useQuery(undefined, {
    enabled: open,
    refetchOnWindowFocus: false,
  });

  const summary = metricsQuery.data;

  return (
    <Modal
      title="性能与用量观测"
      open={open}
      onCancel={onClose}
      footer={
        <Button onClick={() => void metricsQuery.refetch()} loading={metricsQuery.isFetching}>
          刷新
        </Button>
      }
      width={560}
    >
      {metricsQuery.isLoading ? (
        <div className="pw-metrics-loading">
          <Spin size="small" /> 加载中…
        </div>
      ) : summary ? (
        <div className="pw-metrics-body">
          <div className="pw-metrics-grid">
            <div className="pw-metrics-card">
              <span className="pw-metrics-label">LLM 调用</span>
              <strong>{summary.totalLlmCalls}</strong>
            </div>
            <div className="pw-metrics-card">
              <span className="pw-metrics-label">Token 合计</span>
              <strong>{summary.totalTokens}</strong>
            </div>
            <div className="pw-metrics-card">
              <span className="pw-metrics-label">输入 Token</span>
              <strong>{summary.totalPromptTokens}</strong>
            </div>
            <div className="pw-metrics-card">
              <span className="pw-metrics-label">输出 Token</span>
              <strong>{summary.totalCompletionTokens}</strong>
            </div>
            <div className="pw-metrics-card">
              <span className="pw-metrics-label">跳过 LLM</span>
              <strong>{summary.totalSkipped}</strong>
            </div>
            <div className="pw-metrics-card">
              <span className="pw-metrics-label">助手时延（ms）</span>
              <strong>{summary.orchestratorAvgLatencyMs}</strong>
            </div>
            <div className="pw-metrics-card">
              <span className="pw-metrics-label">AI 生成时延（ms）</span>
              <strong>{summary.aiGenerateAvgLatencyMs}</strong>
            </div>
          </div>

          <p className="pw-metrics-note">
            {summary.configuredModel ? `当前模型：${summary.configuredModel} · ` : ''}
            已持久化 {summary.eventCount} 条指标（SQLite metric_events，重启后可复盘）
          </p>

          {Object.keys(summary.byCaller).length > 0 ? (
            <table className="pw-metrics-table">
              <thead>
                <tr>
                  <th>场景</th>
                  <th>调用</th>
                  <th>Token</th>
                  <th>输入</th>
                  <th>输出</th>
                  <th>均时延</th>
                  <th>跳过</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(summary.byCaller).map(([caller, bucket]) => (
                  <tr key={caller}>
                    <td>{CALLER_LABELS[caller] ?? caller}</td>
                    <td>{bucket.calls}</td>
                    <td>{bucket.totalTokens}</td>
                    <td>{bucket.promptTokens}</td>
                    <td>{bucket.completionTokens}</td>
                    <td>{bucket.avgLatencyMs} ms</td>
                    <td>{bucket.skipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="pw-metrics-empty">暂无 LLM 调用记录，发送助手消息或触发 AI 生成后可见。</p>
          )}
        </div>
      ) : (
        <p className="pw-metrics-empty">无法加载指标，请确认后端已启动。</p>
      )}
    </Modal>
  );
}
