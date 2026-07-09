import type Database from 'better-sqlite3';

/** 个人工作台示例数据（对应 docs/个人工作台 产品文档） */
export function seedDatabase(db: Database.Database): void {
  seedPersonalWorkbench(db);
}

function seedPersonalWorkbench(db: Database.Database): void {
  const todoCount = db.prepare('SELECT COUNT(*) as count FROM todos').get() as { count: number };
  if (todoCount.count > 0) return;

  const now = new Date().toISOString();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 日历渠道
  const calendarSources: Array<[string, string]> = [
    ['feishu', '飞书'],
    ['dingtalk', '钉钉'],
    ['outlook', 'Outlook'],
    ['local', '本地'],
  ];
  const insertSource = db.prepare(
    `INSERT INTO calendar_sources (source, label, enabled, last_synced_at)
     VALUES (?, ?, 1, NULL) ON CONFLICT(source) DO NOTHING`,
  );
  for (const [source, label] of calendarSources) {
    insertSource.run(source, label);
  }

  // 定时任务
  const recurringResult = db
    .prepare(
      `INSERT INTO recurring_tasks (title, frequency, day_of_week, day_of_month, time_of_day, todo_description, enabled, next_trigger_at, created_at, updated_at)
       VALUES (?, 'weekly', 4, NULL, '17:00', ?, 1, ?, ?, ?)`,
    )
    .run('做会议纪要', '到期将生成待办「做会议纪要」', now, now, now);
  const recurringId = Number(recurringResult.lastInsertRowid);

  // 待办示例
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(18, 0, 0, 0);

  const todos: Array<[string, string | null, string | null, string, string, number, string | null, number | null]> = [
    ['做会议纪要', '来源：定时任务；含 AI 结果多版本', now, 'recurring_task', 'active', 0, 'ready', recurringId],
    ['基金定投弱势群体', '需人工处理', yesterday.toISOString(), 'manual', 'active', 1, 'none', null],
    ['基金选品 Agent-Mona', '模拟异步生成选品分析', now, 'natural_language', 'active', 0, 'ready', null],
    ['完成UI改版方案', '个人助手结果已确认', now, 'natural_language', 'completed', 0, 'confirmed', null],
  ];

  const insertTodo = db.prepare(
    `INSERT INTO todos (title, description, due_at, source, status, is_urgent, ai_status, ai_result_type, recurring_task_id, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const todoIds: number[] = [];
  for (const [title, desc, dueAt, source, status, urgent, aiStatus, recId] of todos) {
    const aiType = title.includes('纪要') ? 'minutes' : title.includes('选品') ? 'pick' : title.includes('UI') ? 'plan' : null;
    const completedAt = status === 'completed' ? now : null;
    const result = insertTodo.run(
      title, desc, dueAt, source, status, urgent, aiStatus, aiType, recId, completedAt, now, now,
    );
    todoIds.push(Number(result.lastInsertRowid));
  }

  // AI 结果示例（做会议纪要 v1/v2）
  db.prepare(
    `INSERT INTO todo_ai_results (todo_id, version, result_type, html_content, status, provider, created_at)
     VALUES (?, 1, 'minutes', '<h3>会议纪要 v1</h3><p>进度 60%，要点已记录。</p>', 'ready', 'rule-template', ?)`,
  ).run(todoIds[0], now);
  db.prepare(
    `INSERT INTO todo_ai_results (todo_id, version, result_type, html_content, status, provider, created_at)
     VALUES (?, 2, 'minutes', '<h3>会议纪要 v2</h3><p>进度 85%，已补充行动项。</p>', 'ready', 'rule-template', ?)`,
  ).run(todoIds[0], now);

  db.prepare(
    `INSERT INTO todo_ai_results (todo_id, version, result_type, html_content, status, provider, created_at)
     VALUES (?, 1, 'pick', '<h3>选品分析</h3><table><tr><th>基金</th><th>近1年</th></tr></table>', 'ready', 'rule-template', ?)`,
  ).run(todoIds[2], now);

  // 日程示例（含跨渠道重复）
  function makeTime(hour: number, minute: number, durationMin: number): [string, string] {
    const start = new Date(today);
    start.setHours(hour, minute, 0, 0);
    const end = new Date(start.getTime() + durationMin * 60 * 1000);
    return [start.toISOString(), end.toISOString()];
  }

  const scheduleItems: Array<[string, string, string, string]> = [
    ['晨间站会', ...makeTime(9, 0, 30), 'dingtalk'],
    ['晨间站会', ...makeTime(9, 2, 28), 'feishu'],
    ['产品需求评审', ...makeTime(10, 30, 60), 'local'],
    ['客户方案演示', ...makeTime(13, 30, 30), 'outlook'],
    ['Q2 资源预算对齐', ...makeTime(14, 0, 60), 'outlook'],
    ['Q2 资源预算对齐', ...makeTime(14, 5, 55), 'feishu'],
    ['交互设计走查', ...makeTime(16, 0, 60), 'feishu'],
    ['运营数据复盘', ...makeTime(19, 0, 60), 'local'],
  ];

  for (const [title, startAt, endAt, source] of scheduleItems) {
    const existing = db
      .prepare(`SELECT id, start_at FROM schedule_events WHERE title = ? AND end_at = ?`)
      .all(title, endAt) as Array<{ id: number; start_at: string }>;

    let eventId: number | undefined;
    for (const ex of existing) {
      const diff = Math.abs(new Date(ex.start_at).getTime() - new Date(startAt).getTime());
      if (diff <= 15 * 60 * 1000) {
        eventId = ex.id;
        db.prepare(`UPDATE schedule_events SET is_merged = 1 WHERE id = ?`).run(eventId);
        break;
      }
    }

    if (eventId === undefined) {
      const ev = db
        .prepare(
          `INSERT INTO schedule_events (title, start_at, end_at, is_merged, created_at) VALUES (?, ?, ?, 0, ?)`,
        )
        .run(title, startAt, endAt, now);
      eventId = Number(ev.lastInsertRowid);
    }

    db.prepare(
      `INSERT INTO schedule_event_sources (event_id, source, title, start_at, end_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(eventId, source, title, startAt, endAt);
  }

  // 默认助手会话
  const sessionResult = db
    .prepare(
      `INSERT INTO assistant_sessions (title, todo_id, created_at, updated_at) VALUES ('默认对话', NULL, ?, ?)`,
    )
    .run(now, now);
  const sessionId = Number(sessionResult.lastInsertRowid);
  db.prepare(
    `INSERT INTO assistant_messages (session_id, role, content, ai_result_id, created_at)
     VALUES (?, 'assistant', '你好！我会先区分待办与日程，帮你创建内容或生成初步结果。', NULL, ?)`,
  ).run(sessionId, now);
}
