import { materializeRecurringTask, runDueRecurringTasks } from './recurring-task-service.js';

/** 调度 tick 间隔（毫秒）：Demo 环境 60s，便于验证到期物化 */
const TICK_INTERVAL_MS = 60_000;

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * 启动定时任务物化调度：进程启动时先跑一轮，再按间隔扫描到期任务。
 */
export function startRecurringTaskScheduler(): void {
  void tick();

  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    void tick();
  }, TICK_INTERVAL_MS);
}

async function tick(): Promise<void> {
  const due = runDueRecurringTasks();
  if (due.taskIds.length === 0) return;

  let totalTodos = 0;
  for (const taskId of due.taskIds) {
    const { todoIds } = materializeRecurringTask(taskId);
    totalTodos += todoIds.length;
  }

  console.log(
    '[pw.metrics]',
    JSON.stringify({
      event: 'pw.recurring.scheduled_materialize',
      taskCount: due.taskIds.length,
      todoCount: totalTodos,
    }),
  );
}
