import { getLlmConfig, isLlmConfigured } from './llm-config.js';
import { createLlmClient } from './openai-client.js';

export interface LlmHealthResult {
  configured: boolean;
  ok: boolean;
  model?: string;
  baseUrl?: string;
  latencyMs?: number;
  message: string;
}

/**
 * 探测 LLM 连通性：发送极简 completion 验证 API Key 与端点可用
 */
export async function checkLlmHealth(): Promise<LlmHealthResult> {
  if (!isLlmConfigured()) {
    return {
      configured: false,
      ok: false,
      message: '未配置 LLM_API_KEY，请在 server/.env 中设置',
    };
  }

  const config = getLlmConfig()!;
  const client = createLlmClient();
  if (!client) {
    return {
      configured: false,
      ok: false,
      message: 'LLM 配置解析失败',
    };
  }

  const startedAt = Date.now();
  try {
    const result = await client.chatCompletion({
      messages: [{ role: 'user', content: 'ping' }],
      maxTokens: 5,
      temperature: 0,
    });

    return {
      configured: true,
      ok: true,
      model: result.model,
      baseUrl: config.baseUrl,
      latencyMs: Date.now() - startedAt,
      message: 'LLM 连通正常',
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知错误';
    return {
      configured: true,
      ok: false,
      model: config.model,
      baseUrl: config.baseUrl,
      latencyMs: Date.now() - startedAt,
      message: detail,
    };
  }
}
