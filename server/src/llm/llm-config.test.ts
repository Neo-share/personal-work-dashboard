import { afterEach, describe, expect, it } from 'vitest';
import { getLlmConfig, getLlmModelForDifficulty, getLlmModelForPurpose } from './llm-config.js';

const ENV_KEYS = [
  'LLM_API_KEY',
  'LLM_MODEL_SIMPLE',
  'LLM_MODEL_COMPLEX',
  'LLM_MODEL_DIFFICULT',
] as const;

function saveEnv(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
  }
  return saved;
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  }
}

describe('llm-config 难度分档', () => {
  const saved = saveEnv();

  afterEach(() => {
    restoreEnv(saved);
  });

  it('默认走简单模型', () => {
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_MODEL_SIMPLE = 'glm-simple';

    expect(getLlmModelForDifficulty('simple')).toBe('glm-simple');
    expect(getLlmModelForPurpose('title')).toBe('glm-simple');
    expect(getLlmModelForPurpose('slots')).toBe('glm-simple');
    expect(getLlmConfig()?.model).toBe('glm-simple');
  });

  it('未配 SIMPLE 时使用内置默认模型', () => {
    delete process.env.LLM_MODEL_SIMPLE;

    expect(getLlmModelForDifficulty('simple')).toBe('gpt-4o-mini');
  });

  it('复杂 / 困难档按 env 选择', () => {
    process.env.LLM_MODEL_SIMPLE = 'glm-simple';
    process.env.LLM_MODEL_COMPLEX = 'glm-complex';
    process.env.LLM_MODEL_DIFFICULT = 'claude-hard';

    expect(getLlmModelForPurpose('generate')).toBe('glm-complex');
    expect(getLlmModelForPurpose('revise')).toBe('claude-hard');
    expect(getLlmModelForDifficulty('complex')).toBe('glm-complex');
    expect(getLlmModelForDifficulty('difficult')).toBe('claude-hard');
  });

  it('困难档缺失时回退到复杂再简单', () => {
    process.env.LLM_MODEL_SIMPLE = 'glm-simple';
    process.env.LLM_MODEL_COMPLEX = 'glm-complex';
    delete process.env.LLM_MODEL_DIFFICULT;

    expect(getLlmModelForPurpose('revise')).toBe('glm-complex');
  });

  it('复杂档缺失时回退到简单', () => {
    process.env.LLM_MODEL_SIMPLE = 'glm-simple';
    delete process.env.LLM_MODEL_COMPLEX;
    delete process.env.LLM_MODEL_DIFFICULT;

    expect(getLlmModelForPurpose('generate')).toBe('glm-simple');
    expect(getLlmModelForPurpose('revise')).toBe('glm-simple');
  });
});
