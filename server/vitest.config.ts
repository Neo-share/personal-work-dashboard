import { defineConfig } from 'vitest/config';

/** 个人工作台覆盖率纳入的 service（开发域 requirement/repository 等不计入分母） */
const PERSONAL_WORKBENCH_SERVICES = [
  'src/services/todo-service.ts',
  'src/services/schedule-service.ts',
  'src/services/recurring-task-service.ts',
  'src/services/recurring-task-scheduler.ts',
  'src/services/ai-result-service.ts',
  'src/services/assistant-session-service.ts',
  'src/services/personal-assistant-service.ts',
  'src/services/personal-assistant-soul-service.ts',
  'src/services/internal-knowledge-retriever.ts',
];

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/assistant/**/*.ts',
        'src/routes/chat.ts',
        ...PERSONAL_WORKBENCH_SERVICES,
      ],
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
