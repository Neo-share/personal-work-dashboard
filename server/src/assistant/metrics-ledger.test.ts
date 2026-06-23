import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { InMemoryMetricsLedger } from './metrics-ledger.js';

vi.mock('../services/recurring-task-service.js', () => ({
  runDueRecurringTasks: vi.fn(),
  materializeRecurringTask: vi.fn(),
}));

import { runDueRecurringTasks, materializeRecurringTask } from '../services/recurring-task-service.js';
import { startRecurringTaskScheduler } from '../services/recurring-task-scheduler.js';

describe('recurring-task-scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(runDueRecurringTasks).mockReturnValue({ taskIds: [] });
    vi.mocked(materializeRecurringTask).mockReturnValue({ todoIds: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  it('启动时立即执行一轮 tick', () => {
    startRecurringTaskScheduler();
    expect(runDueRecurringTasks).toHaveBeenCalledTimes(1);
  });

  it('到期任务物化并记录 metrics 日志', () => {
    const metricsSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(runDueRecurringTasks).mockReturnValue({ taskIds: [1, 2] });
    vi.mocked(materializeRecurringTask)
      .mockReturnValueOnce({ todoIds: [10] })
      .mockReturnValueOnce({ todoIds: [11, 12] });

    startRecurringTaskScheduler();

    expect(materializeRecurringTask).toHaveBeenCalledWith(1);
    expect(materializeRecurringTask).toHaveBeenCalledWith(2);

    const metricLog = metricsSpy.mock.calls.find(
      (call) =>
        call.some(
          (part) =>
            typeof part === 'string' && part.includes('pw.recurring.scheduled_materialize'),
        ),
    );
    expect(metricLog).toBeTruthy();

    metricsSpy.mockRestore();
  });

  it('无到期任务时不调用 materialize', () => {
    startRecurringTaskScheduler();
    vi.advanceTimersByTime(60_000);
    expect(materializeRecurringTask).not.toHaveBeenCalled();
  });
});

describe('InMemoryMetricsLedger', () => {
  it('record 与 queryRecent 按 name 过滤', () => {
    const ledger = new InMemoryMetricsLedger(10);
    ledger.record({ name: 'pw.intent.routed', ts: '1' });
    ledger.record({ name: 'pw.tool.invoked', ts: '2' });
    ledger.record({ name: 'pw.intent.routed', ts: '3' });

    expect(ledger.queryRecent({ name: 'pw.intent.routed' })).toHaveLength(2);
    expect(ledger.queryRecent({ limit: 1 })).toHaveLength(1);
  });
});
