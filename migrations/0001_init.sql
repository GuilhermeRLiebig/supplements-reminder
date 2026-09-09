PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS supplements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dose_value TEXT NOT NULL,
  dose_unit TEXT NOT NULL,
  instructions TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  supplement_id TEXT NOT NULL,
  time_local TEXT NOT NULL,
  days_of_week TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
  timezone TEXT NOT NULL DEFAULT 'America/Fortaleza',
  reminder_interval_min INTEGER NOT NULL DEFAULT 30,
  max_reminders INTEGER NOT NULL DEFAULT 4,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplement_id) REFERENCES supplements(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS intakes (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  supplement_id TEXT NOT NULL,
  due_date TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','taken','skipped','missed')),
  reminder_count INTEGER NOT NULL DEFAULT 0,
  next_reminder_at TEXT,
  taken_at TEXT,
  skipped_at TEXT,
  telegram_message_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (supplement_id) REFERENCES supplements(id) ON DELETE CASCADE,
  UNIQUE(schedule_id, due_date)
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_intakes_due ON intakes(status, next_reminder_at);
CREATE INDEX IF NOT EXISTS idx_intakes_date ON intakes(due_date);
CREATE INDEX IF NOT EXISTS idx_schedules_active ON schedules(active);
