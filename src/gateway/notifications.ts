import { db } from "./auth.ts";
import crypto from "crypto";
import { EventEmitter } from "events";

export const notificationEvents = new EventEmitter();

db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    summary TEXT NOT NULL,
    relatedSessionId TEXT,
    relatedRequestId TEXT,
    relatedEffectId TEXT,
    status TEXT NOT NULL DEFAULT 'unread',
    telegramStatus TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export interface CreateNotificationParams {
  type: string;
  summary: string;
  context?: { sessionId?: string, requestId?: string, effectId?: string };
}


import { queueEvents } from "./queue.ts";

export function initNotifications() {
  queueEvents.on("interrupted", (data) => {
    NotificationManager.create({
      type: "interrupted",
      summary: "Run was interrupted",
      context: { sessionId: data.sessionId }
    });
  });

  queueEvents.on("effect_proposed", (data) => {
    NotificationManager.create({
      type: "approval",
      summary: `Approval needed: ${data.summary}`,
      context: { sessionId: data.sessionId, requestId: data.requestId, effectId: data.effect.id }
    });
  });

  queueEvents.on("agent_error", (data) => {
    NotificationManager.create({
      type: "failure",
      summary: `Agent error: ${data.error}`,
      context: { sessionId: data.sessionId, requestId: data.requestId }
    });
  });
}

export class NotificationManager {
  static create(params: CreateNotificationParams): string {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO notifications (id, type, summary, relatedSessionId, relatedRequestId, relatedEffectId)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.type,
      params.summary,
      params.context?.sessionId || null,
      params.context?.requestId || null,
      params.context?.effectId || null
    );
    
    notificationEvents.emit("created", id);
    return id;
  }

  static list() {
    return db.prepare("SELECT * FROM notifications ORDER BY created_at DESC").all();
  }

  static markRead(id: string) {
    db.prepare("UPDATE notifications SET status = 'read' WHERE id = ?").run(id);
  }

  static updateTelegramStatus(id: string, status: "pending" | "retrying" | "sent" | "failed") {
    db.prepare("UPDATE notifications SET telegramStatus = ? WHERE id = ?").run(status, id);
  }
}
