/** OpenAI 兼容 API 配置（从环境变量读取） */

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 30_000;

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

/** 模型用途：标题提取用小模型，生成/修订用主模型 */
export type LlmModelPurpose = 'default' | 'title' | 'generate' | 'revise';

/** 是否已配置 API Key（不校验连通性） */
export function isLlmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY?.trim());
}

/** 读取 LLM 配置；未配置 API Key 时返回 null */
export function getLlmConfig(): LlmConfig | null {
  const apiKey = process.env.LLM_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const baseUrl = (process.env.LLM_API_BASE?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '');
  const model = process.env.LLM_MODEL?.trim() || DEFAULT_MODEL;
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  return {
    apiKey,
    baseUrl,
    model,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
  };
}

/** 按用途选择模型（降本：标题默认走 LLM_MODEL_TITLE 或主模型） */
export function getLlmModelForPurpose(purpose: LlmModelPurpose): string {
  const config = getLlmConfig();
  const fallback = config?.model ?? DEFAULT_MODEL;

  if (purpose === 'title') {
    return process.env.LLM_MODEL_TITLE?.trim() || fallback;
  }
  if (purpose === 'generate' || purpose === 'revise') {
    return process.env.LLM_MODEL_GENERATE?.trim() || fallback;
  }
  return fallback;
}
