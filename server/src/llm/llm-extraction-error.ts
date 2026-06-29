/** 非黄金话术 LLM 提取失败（不做规则回退） */
export class LlmExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmExtractionError';
  }
}
