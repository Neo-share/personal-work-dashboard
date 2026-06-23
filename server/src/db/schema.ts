export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS repositories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  path TEXT NOT NULL,
  remote TEXT,
  default_branch TEXT,
  current_branch TEXT,
  last_commit TEXT,
  last_commit_author TEXT,
  last_commit_at TEXT,
  is_dirty INTEGER NOT NULL DEFAULT 0,
  tech_tags TEXT NOT NULL DEFAULT '[]',
  env_scripts TEXT NOT NULL DEFAULT '[]',
  scanned_at TEXT
);

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  team TEXT,
  contact TEXT,
  feishu_open_id TEXT
);

CREATE TABLE IF NOT EXISTS requirements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'dev',
  priority TEXT NOT NULL,
  target_version TEXT,
  planned_release_at TEXT,
  actual_release_at TEXT,
  risk TEXT,
  blockers TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS requirement_repositories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requirement_id INTEGER NOT NULL,
  repository_id INTEGER NOT NULL,
  responsibility TEXT,
  branch TEXT,
  env TEXT,
  status TEXT,
  risk TEXT,
  FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE CASCADE,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS requirement_people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requirement_id INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  management_role TEXT NOT NULL,
  direction TEXT NOT NULL,
  role_type TEXT NOT NULL,
  responsibility TEXT,
  status TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requirement_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  target_date TEXT,
  status TEXT NOT NULL,
  blockers TEXT,
  FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requirement_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS repository_branch_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repository_id INTEGER NOT NULL,
  branch TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  UNIQUE(repository_id, branch)
);

CREATE TABLE IF NOT EXISTS scan_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scanned_at TEXT NOT NULL,
  repository_count INTEGER NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS requirement_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requirement_id INTEGER NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recurring_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  frequency TEXT NOT NULL,
  day_of_week INTEGER,
  day_of_month INTEGER,
  time_of_day TEXT NOT NULL,
  todo_description TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  next_trigger_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  due_at TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'active',
  is_urgent INTEGER NOT NULL DEFAULT 0,
  ai_status TEXT NOT NULL DEFAULT 'none',
  ai_result_type TEXT,
  recurring_task_id INTEGER,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (recurring_task_id) REFERENCES recurring_tasks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS todo_ai_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  result_type TEXT NOT NULL,
  html_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schedule_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  is_merged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_event_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES schedule_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calendar_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS recurring_task_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recurring_task_id INTEGER NOT NULL,
  todo_id INTEGER,
  trigger_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (recurring_task_id) REFERENCES recurring_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS assistant_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  todo_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS assistant_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  ai_result_id INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES assistant_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (ai_result_id) REFERENCES todo_ai_results(id) ON DELETE SET NULL
);
`;
