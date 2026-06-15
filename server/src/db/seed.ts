import type Database from 'better-sqlite3';

const now = new Date().toISOString();

/** 首版示例数据，对应产品设计说明书中的会员权益页需求 */
export function seedDatabase(db: Database.Database): void {
  const requirementCount = db
    .prepare('SELECT COUNT(*) as count FROM requirements')
    .get() as { count: number };
  if (requirementCount.count > 0) {
    return;
  }

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
      now,
      now,
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
