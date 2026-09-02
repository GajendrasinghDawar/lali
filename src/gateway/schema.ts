import { db } from "./auth.ts";

export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const currentVersion = (db.prepare("SELECT MAX(version) as v FROM schema_migrations").get() as { v: number | null }).v || 0;

  const migrations = [
    {
      version: 1,
      up: `
        CREATE TABLE IF NOT EXISTS requests (
          id TEXT PRIMARY KEY,
          sessionId TEXT NOT NULL,
          idempotencyKey TEXT,
          message TEXT NOT NULL,
          status TEXT NOT NULL,
          replyChannel TEXT DEFAULT 'web',
          deliveryStatus TEXT DEFAULT 'none',
          finalResponse TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS events (
          sessionId TEXT NOT NULL,
          requestId TEXT NOT NULL,
          sequence INTEGER NOT NULL,
          type TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (sessionId, sequence)
        );
        CREATE TABLE IF NOT EXISTS session_state (
          sessionId TEXT PRIMARY KEY,
          is_paused INTEGER DEFAULT 0,
          userId TEXT
        );
        CREATE TABLE IF NOT EXISTS artifacts (
          id TEXT PRIMARY KEY,
          sessionId TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS effects (
          id TEXT PRIMARY KEY,
          sessionId TEXT NOT NULL,
          requestId TEXT NOT NULL,
          summary TEXT NOT NULL,
          payload TEXT NOT NULL,
          digest TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS inbound_emails (
          id TEXT PRIMARY KEY,
          provider_message_id TEXT UNIQUE NOT NULL,
          sender TEXT NOT NULL,
          subject TEXT NOT NULL,
          body_text TEXT,
          body_html TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          summary TEXT NOT NULL,
          details TEXT,
          relatedEffectId TEXT,
          telegram_status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS scheduled_jobs (
          id TEXT PRIMARY KEY,
          summary TEXT NOT NULL,
          intervalMs INTEGER NOT NULL,
          enabled INTEGER DEFAULT 1,
          next_run INTEGER NOT NULL,
          last_run_status TEXT
        );
        CREATE TABLE IF NOT EXISTS telegram_state (
          id INTEGER PRIMARY KEY,
          offset INTEGER NOT NULL
        );
      `
    }
  ];

  db.exec("BEGIN");
  try {
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        db.exec(migration.up);
        db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(migration.version);
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
