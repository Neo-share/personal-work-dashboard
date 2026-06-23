import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/services/**/*.ts', 'src/assistant/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/assistant/fixtures/**'],
      // 初版阈值宽松，后续随单测增加再收紧
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
});
