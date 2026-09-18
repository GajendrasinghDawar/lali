import { db } from "./auth.ts";

export interface SessionStore {
  assertOwner(sessionId: string, userId: string): void;
  createRequest(sessionId: string, message: string, idempotencyKey?: string, replyChannel?: string): { id: string, status: string };
  appendEvent(sessionId: string, requestId: string, type: string, data: unknown): { type: string, data: unknown, sequence: number, requestId: string };
  updateRequestStatus(requestId: string, status: string, finalResponseOrError?: string): void;
  interruptSession(sessionId: string): void;
  resumeSession(sessionId: string): void;
  clearSession(sessionId: string): void;
  deleteSession(sessionId: string): void;
  isPaused(sessionId: string): boolean;
  hasRunningRequests(sessionId: string): boolean;
  getNextQueuedRequest(sessionId: string): { id: string, message: string, attachmentIds: string | null } | undefined;
  getWorkspacePath(sessionId: string): string | undefined;
  getArtifacts(attachmentIdsStr: string | null): any[] | undefined;
  getRequest(requestId: string): { status: string, replyChannel: string } | undefined;
  markAllRunningAsInterrupted(): void;
  getEventsAfter(sessionId: string, sequence: number): { type: string, data: unknown, sequence: number, requestId: string }[];
}

export class SqliteSessionStore implements SessionStore {
  assertOwner(sessionId: string, userId: string): void {
    const session = db.prepare("SELECT userId FROM session_state WHERE sessionId = ?").get(sessionId) as { userId: string } | undefined;
    if (session && session.userId === "owner" && userId !== "owner") {
      db.prepare("UPDATE session_state SET userId = ? WHERE sessionId = ?").run(userId, sessionId);
      return;
    }
    if (session && userId === "owner") return;
    if (session && session.userId !== userId) throw new Error("Unauthorized session access");
    if (!session) {
      if (sessionId === "main") {
        const wsPath = process.env.LALI_ASSISTANT_WORKSPACE || process.cwd();
        db.prepare("INSERT INTO session_state (sessionId, userId, type, title, workspaceName, workspacePath) VALUES (?, ?, 'main', 'Main Session', 'assistant', ?)").run(sessionId, userId, wsPath);
      } else {
        db.prepare("INSERT INTO session_state (sessionId, userId) VALUES (?, ?)").run(sessionId, userId);
      }
    }
  }

  createRequest(sessionId: string, message: string, idempotencyKey?: string, replyChannel: string = "web") {
    if (idempotencyKey) {
      const existing = db.prepare("SELECT * FROM requests WHERE sessionId = ? AND idempotencyKey = ?").get(sessionId, idempotencyKey) as { id: string, status: string } | undefined;
      if (existing) return existing;
    }

    const id = crypto.randomUUID();
    const isPaused = this.isPaused(sessionId);
    const status = isPaused ? "paused_for_confirmation" : "queued";

    db.prepare("INSERT INTO requests (id, sessionId, idempotencyKey, message, status, replyChannel) VALUES (?, ?, ?, ?, ?, ?)").run(
      id, sessionId, idempotencyKey || null, message, status, replyChannel
    );

    return db.prepare("SELECT * FROM requests WHERE id = ?").get(id) as { id: string, status: string };
  }

  private getNextSequence(sessionId: string) {
    const row = db.prepare("SELECT MAX(sequence) as seq FROM events WHERE sessionId = ?").get(sessionId) as { seq: number | null };
    return (row.seq || 0) + 1;
  }

  appendEvent(sessionId: string, requestId: string, type: string, data: unknown) {
    const seq = this.getNextSequence(sessionId);
    db.prepare("INSERT INTO events (sessionId, requestId, type, data, sequence) VALUES (?, ?, ?, ?, ?)").run(
      sessionId, requestId, type, JSON.stringify(data), seq
    );
    return { type, data, sequence: seq, requestId };
  }

  updateRequestStatus(requestId: string, status: string, finalResponseOrError?: string) {
    db.prepare("UPDATE requests SET status = ?, finalResponse = ? WHERE id = ?").run(status, finalResponseOrError || null, requestId);
  }

  interruptSession(sessionId: string) {
    db.prepare("UPDATE requests SET status = 'interrupted' WHERE sessionId = ? AND status = 'running'").run(sessionId);
    db.prepare("UPDATE session_state SET is_paused = 1 WHERE sessionId = ?").run(sessionId);
    db.prepare("UPDATE requests SET status = 'paused_for_confirmation' WHERE sessionId = ? AND status = 'queued'").run(sessionId);
  }

  resumeSession(sessionId: string) {
    db.prepare("UPDATE session_state SET is_paused = 0 WHERE sessionId = ?").run(sessionId);
    db.prepare("UPDATE requests SET status = 'queued' WHERE sessionId = ? AND status = 'paused_for_confirmation'").run(sessionId);
  }

  clearSession(sessionId: string) {
    db.prepare("UPDATE session_state SET is_paused = 0 WHERE sessionId = ?").run(sessionId);
    db.prepare("DELETE FROM requests WHERE sessionId = ? AND status IN ('queued', 'paused_for_confirmation')").run(sessionId);
  }

  deleteSession(sessionId: string) {
    this.interruptSession(sessionId);
    db.prepare("DELETE FROM session_state WHERE sessionId = ?").run(sessionId);
    db.prepare("DELETE FROM requests WHERE sessionId = ?").run(sessionId);
    db.prepare("DELETE FROM events WHERE sessionId = ?").run(sessionId);
  }

  isPaused(sessionId: string): boolean {
    const row = db.prepare("SELECT is_paused FROM session_state WHERE sessionId = ?").get(sessionId) as { is_paused: number } | undefined;
    return !!row?.is_paused;
  }

  hasRunningRequests(sessionId: string): boolean {
    const row = db.prepare("SELECT count(*) as count FROM requests WHERE sessionId = ? AND status = 'running'").get(sessionId) as { count: number };
    return row.count > 0;
  }

  getNextQueuedRequest(sessionId: string) {
    return db.prepare("SELECT * FROM requests WHERE sessionId = ? AND status = 'queued' ORDER BY created_at ASC LIMIT 1").get(sessionId) as { id: string, message: string, attachmentIds: string | null } | undefined;
  }

  getWorkspacePath(sessionId: string): string | undefined {
    const row = db.prepare("SELECT workspacePath FROM session_state WHERE sessionId = ?").get(sessionId) as { workspacePath: string } | undefined;
    return row?.workspacePath;
  }

  getArtifacts(attachmentIdsStr: string | null): any[] | undefined {
    if (!attachmentIdsStr) return undefined;
    try {
      const ids = JSON.parse(attachmentIdsStr);
      if (Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => "?").join(",");
        const artifactRows = db.prepare(`SELECT id, fileName as name, mimeType, storagePath as path FROM artifacts WHERE id IN (${placeholders})`).all(...ids) as any[];
        return artifactRows.map(r => ({ id: r.id, name: r.name, mimeType: r.mimeType, path: r.path }));
      }
    } catch (e) {
      console.error("Failed to parse attachmentIds", e);
    }
    return undefined;
  }

  getRequest(requestId: string) {
    return db.prepare("SELECT * FROM requests WHERE id = ?").get(requestId) as { status: string, replyChannel: string } | undefined;
  }

  markAllRunningAsInterrupted() {
    db.prepare("UPDATE requests SET status = 'interrupted' WHERE status = 'running'").run();
  }

  getEventsAfter(sessionId: string, sequence: number) {
    const rows = db.prepare("SELECT * FROM events WHERE sessionId = ? AND sequence > ? ORDER BY sequence ASC").all(sessionId, sequence) as { type: string, data: string, sequence: number, requestId: string }[];
    return rows.map(r => ({ type: r.type, data: JSON.parse(r.data), sequence: r.sequence, requestId: r.requestId }));
  }
}
