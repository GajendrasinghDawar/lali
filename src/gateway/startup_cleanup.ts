import { db } from "./auth.ts";

export function startupCleanup() {
  db.exec("BEGIN");
  try {
    // 1. Mark interrupted work accurately
    // Any requests that were 'running' when the server crashed are now interrupted
    db.prepare("UPDATE requests SET status = 'interrupted' WHERE status = 'running'").run();

    // 2. Expire stale proposals (older than 24 hours)
    db.prepare("UPDATE effects SET status = 'rejected' WHERE status = 'pending' AND created_at < datetime('now', '-1 day')").run();
    
    // 3. Mark sessions with interrupted requests as paused
    const interruptedRequests = db.prepare("SELECT DISTINCT sessionId FROM requests WHERE status = 'interrupted'").all() as { sessionId: string }[];
    for (const req of interruptedRequests) {
      db.prepare("INSERT INTO session_state (sessionId, is_paused) VALUES (?, 1) ON CONFLICT(sessionId) DO UPDATE SET is_paused = 1").run(req.sessionId);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function runRetentionPruning() {
  const queries = [
    "DELETE FROM events WHERE requestId IN (SELECT id FROM requests WHERE status IN ('completed', 'failed', 'interrupted') AND created_at < datetime('now', '-30 days'))",
    "DELETE FROM requests WHERE status IN ('completed', 'failed', 'interrupted') AND created_at < datetime('now', '-30 days')",
    "DELETE FROM effects WHERE status != 'pending' AND created_at < datetime('now', '-30 days')",
    "DELETE FROM notifications WHERE created_at < datetime('now', '-30 days')",
    "DELETE FROM inbound_emails WHERE created_at < datetime('now', '-30 days')",
  ];
  for (const sql of queries) {
    try {
      db.prepare(sql).run();
    } catch (_e) {
      // Table or column may not exist in pre-migration databases; skip silently
    }
  }
}

export function startRetentionCron() {
  runRetentionPruning(); // Run on startup
  setInterval(() => {
    try {
      runRetentionPruning();
    } catch (e) {
      console.error("Retention pruning failed:", e);
    }
  }, 1000 * 60 * 60 * 24); // Run daily
}
