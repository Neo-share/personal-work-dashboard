import type Database from 'better-sqlite3';

/** 首版示例数据，对应产品设计说明书中的会员权益页需求 */
export function seedDatabase(db: Database.Database): void {
  const requirementCount = db
    .prepare('SELECT COUNT(*) as count FROM requirements')
    .get() as { count: number };

  if (requirementCount.count === 0) {
    seedDevRequirements(db);
  }

  seedPersonalWorkbench(db);
}

function seedDevRequirements(db: Database.Database): void {
  const seedNow = new Date().toISOString();

  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO NOTHING`,
  ).run('workspace_path', '/Users/ningliu/Documents/CodeLab');

  const repos = [
    ['coin-h5', '/Users/ningliu/Documents/CodeLab/coin-h5'],
    ['admin-portal', '/Users/ningliu/Documents/CodeLab/admin-portal'],
    ['member-api', '/Users/ningliu/Documents/CodeLab/member-api'],
    ['opman-web-new', '/Users/ningliu/Documents/CodeLab/opman-web-new'],
    ['fsw-vue-operation-apps', '/Users/ningliu/Documents/CodeLab/fsw-vue-operation-apps'],
  ];

  const insertRepo = db.prepare(
    `INSERT INTO repositories (name, path, tech_tags, env_scripts, scanned_at)
     VALUES (?, ?, '[]', '[]', NULL)`,
  );
  for (const [name, repoPath] of repos) {
    insertRepo.run(name, repoPath);
  }

  const people = [
    ['张三', '前端', '会员中心', null],
    ['陈一', '后台前端', '会员中心', null],
    ['李四', '后端', '会员中心', null],
    ['钱七', '后端', '会员中心', null],
    ['赵六', '产品', '会员中心', null],
    ['孙八', '设计', '会员中心', null],
    ['王五', '测试', '会员中心', null],
    ['周九', '运营', '会员中心', null],
    ['吴十', '运维', '会员中心', null],
  ];
  const insertPerson = db.prepare(
    'INSERT INTO people (name, role, team, contact) VALUES (?, ?, ?, ?)',
  );
  for (const person of people) {
    insertPerson.run(...person);
  }

  const requirement = db
    .prepare(
      `INSERT INTO requirements (
        name, domain, status, priority, target_version, planned_release_at,
        risk, blockers, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      '新增会员权益页',
      'dev',
      'developing',
      'high',
      '2026-06 会员中心迭代',
      '2026-06-30',
      '接口字段未最终确认、会员等级规则需产品二次确认',
      null,
      '个人驾驶舱示例需求',
      seedNow,
      seedNow,
    );

  const requirementId = Number(requirement.lastInsertRowid);

  const repoMap = Object.fromEntries(
    (
      db.prepare('SELECT id, name FROM repositories').all() as Array<{
        id: number;
        name: string;
      }>
    ).map((row) => [row.name, row.id]),
  );

  const repoLinks = [
    [
      repoMap['coin-h5'],
      '会员权益页前端开发',
      'feature/member-benefits',
      'dev,sit,uat,prod',
      '开发中',
      '移动端兼容性待验证',
    ],
    [
      repoMap['admin-portal'],
      '会员权益配置后台',
      'feature/member-benefits-config',
      'dev,sit,uat,prod',
      '待联调',
      '配置字段需产品确认',
    ],
    [
      repoMap['member-api'],
      '会员权益接口与等级规则',
      'feature/member-benefits-api',
      'dev,sit,uat,prod',
      '开发中',
      '接口字段未最终确认',
    ],
  ];
  const insertRepoLink = db.prepare(
    `INSERT INTO requirement_repositories (
      requirement_id, repository_id, responsibility, branch, env, status, risk
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const link of repoLinks) {
    insertRepoLink.run(requirementId, ...link);
  }

  const personMap = Object.fromEntries(
    (
      db.prepare('SELECT id, name FROM people').all() as Array<{
        id: number;
        name: string;
      }>
    ).map((row) => [row.name, row.id]),
  );

  const peopleLinks = [
    [personMap['张三'], 'owner', 'upstream', '前端', '会员权益页前端开发', 'in_progress'],
    [personMap['陈一'], 'participant', 'upstream', '后台前端', '后台配置页开发', 'in_progress'],
    [personMap['李四'], 'participant', 'upstream', '后端', '会员权益接口联调', 'in_progress'],
    [personMap['钱七'], 'participant', 'upstream', '后端', '会员等级规则接口', 'blocked'],
    [personMap['赵六'], 'participant', 'downstream', '产品', '需求确认与规则确认', 'in_progress'],
    [personMap['孙八'], 'participant', 'downstream', '设计', '权益页设计稿确认', 'completed'],
    [personMap['王五'], 'acceptor', 'downstream', '测试', '提测与 UAT 验收', 'pending'],
    [personMap['周九'], 'watcher', 'downstream', '运营', '上线后运营反馈', 'pending'],
    [personMap['吴十'], 'release_coordinator', 'downstream', '运维', '发布协同', 'pending'],
  ];
  const insertPeopleLink = db.prepare(
    `INSERT INTO requirement_people (
      requirement_id, person_id, management_role, direction, role_type,
      responsibility, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
  );
  for (const link of peopleLinks) {
    insertPeopleLink.run(requirementId, ...link);
  }

  const milestones = [
    ['需求评审', '2026-06-01', 'completed'],
    ['开发完成', '2026-06-15', 'in_progress'],
    ['联调完成', '2026-06-20', 'pending'],
    ['提测', '2026-06-22', 'pending'],
    ['UAT 验收', '2026-06-25', 'pending'],
    ['上线', '2026-06-30', 'pending'],
    ['回归', '2026-07-02', 'pending'],
  ];
  const insertMilestone = db.prepare(
    'INSERT INTO milestones (requirement_id, name, target_date, status, blockers) VALUES (?, ?, ?, ?, NULL)',
  );
  for (const milestone of milestones) {
    insertMilestone.run(requirementId, ...milestone);
  }

  const links = [
    ['figma', 'Figma 设计稿', 'https://figma.com/example/member-benefits'],
    ['yapi', 'YApi 接口文档', 'https://yapi.example.com/member-benefits'],
    ['doc', '需求文档', 'https://feishu.example.com/member-benefits'],
    ['test', '提测单', 'https://feishu.example.com/test/member-benefits'],
    ['release', '发布单', 'https://feishu.example.com/release/member-benefits'],
  ];
  const insertLink = db.prepare(
    'INSERT INTO links (requirement_id, type, title, url) VALUES (?, ?, ?, ?)',
  );
  for (const link of links) {
    insertLink.run(requirementId, ...link);
  }
}

/** 个人工作台示例数据（对应 docs/个人工作台 产品文档） */
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
