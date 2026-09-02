import { db } from "./auth.ts";
import { QueueManager, queueEvents } from "./queue.ts";
import { NotificationManager } from "./notifications.ts";
import crypto from "crypto";

queueEvents.on("request_completed", (data) => {
  if (data.replyChannel === "scheduled_job") {
    const req = db.prepare("SELECT sessionId FROM requests WHERE id = ?").get(data.id) as { sessionId: string };
    const jobId = req.sessionId.replace("job-", "");
    const job = db.prepare("SELECT summary FROM scheduled_jobs WHERE id = ?").get(jobId) as { summary: string } | undefined;
    NotificationManager.create({
      type: "scheduled_job_result",
      summary: `Job "${job?.summary || 'Unknown'}" completed`,
      });
    // Can't pass details directly easily, summary is enough for notification.
  }
});

queueEvents.on("agent_error", (data) => {
  if (data.sessionId.startsWith("job-")) {
    const jobId = data.sessionId.replace("job-", "");
    const job = db.prepare("SELECT summary FROM scheduled_jobs WHERE id = ?").get(jobId) as { summary: string } | undefined;
    NotificationManager.create({
      type: "scheduled_job_error",
      summary: `Job "${job?.summary || 'Unknown'}" failed: ${data.error}`
    });
  }
});

export class ScheduledJobsManager {

  static init() {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS scheduled_jobs (
        id TEXT PRIMARY KEY,
        summary TEXT NOT NULL,
        intervalMs INTEGER NOT NULL,
        enabled INTEGER DEFAULT 1,
        next_run INTEGER NOT NULL,
        last_run_status TEXT
      )
    `).run();
  }

  static createJob(summary: string, intervalMs: number) {
    const id = crypto.randomUUID();
    const next_run = Date.now() + intervalMs;
    db.prepare("INSERT INTO scheduled_jobs (id, summary, intervalMs, next_run) VALUES (?, ?, ?, ?)").run(id, summary, intervalMs, next_run);
    return id;
  }

  static tick() {
    const now = Date.now();
    const jobs = db.prepare("SELECT * FROM scheduled_jobs WHERE enabled = 1 AND next_run <= ?").all(now) as {
      id: string;
      summary: string;
      intervalMs: number;
      next_run: number;
    }[];

    for (const job of jobs) {
      const sessionId = "job-" + job.id;
      
      const pendingReqs = db.prepare("SELECT count(*) as c FROM requests WHERE session_id = ? AND status IN ('pending', 'processing')").get(sessionId) as { c: number };
      
      if (pendingReqs.c > 0) {
        db.prepare("UPDATE scheduled_jobs SET last_run_status = 'skipped_overlap', next_run = ? WHERE id = ?").run(now + job.intervalMs, job.id);
        continue;
      }

      try {
        QueueManager.submitRequest(sessionId, "owner", "Execute scheduled job: " + job.summary, undefined, "scheduled_job");
        db.prepare("UPDATE scheduled_jobs SET last_run_status = 'submitted', next_run = ? WHERE id = ?").run(now + job.intervalMs, job.id);
      } catch (e) {
        db.prepare("UPDATE scheduled_jobs SET last_run_status = 'failed_submit', next_run = ? WHERE id = ?").run(now + job.intervalMs, job.id);
      }
    }
  }

  static start() {
    this.init();
    // Catch up on startup immediately, then interval
    this.tick();
    setInterval(() => this.tick(), 10000);
  }
}
