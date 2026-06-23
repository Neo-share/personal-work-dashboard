import { getLlmConfig, type LlmConfig } from './llm-config.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface OpenAiChatResponse {
  model?: string;
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string };
}

/**
 * OpenAI 兼容 Chat Completions 客户端（fetch 实现，无额外 SDK 依赖）
 */
export class OpenAiCompatibleClient {
  constructor(private readonly config: LlmConfig) {}

  async chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const model = options.model ?? this.config.model;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
        }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as OpenAiChatResponse;

      if (!response.ok) {
        const detail = payload.error?.message ?? response.statusText;
        throw new Error(`LLM 请求失败 (${response.status}): ${detail}`);
      }

      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('LLM 返回内容为空');
      }

      return {
        content,
        model: payload.model ?? model,
        usage: payload.usage
          ? {
              promptTokens: payload.usage.prompt_tokens ?? 0,
              completionTokens: payload.usage.completion_tokens ?? 0,
              totalTokens: payload.usage.total_tokens ?? 0,
            }
          : undefined,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`LLM 请求超时（${this.config.timeoutMs}ms）`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** 按当前环境变量创建客户端；未配置时返回 null */
export function createLlmClient(): OpenAiCompatibleClient | null {
  const config = getLlmConfig();
  return config ? new OpenAiCompatibleClient(config) : null;
}
