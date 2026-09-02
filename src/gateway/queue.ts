import { db } from "./auth.ts";
import crypto from "crypto";
import * as net from "net";
import * as os from "os";
import { AgentEventSchema, PROTOCOL_VERSION } from "../shared/protocol.ts";
import type { AgentEvent } from "../shared/protocol.ts";
import { EffectManager } from "./effects.ts";

// Setup schema
db.exec(`
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
  
  CREATE TABLE IF NOT EXISTS telegram_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    offset INTEGER NOT NULL DEFAULT 0
  );
  
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessionId TEXT NOT NULL,
    requestId TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    sequence INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS session_state (
    sessionId TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    is_paused BOOLEAN DEFAULT 0
  );
`);

// Reset interrupted state on startup
db.exec(`UPDATE requests SET status = 'interrupted' WHERE status = 'running'`);

const SOCKET_PATH = os.platform() === "win32" ? "\\\\.\\pipe\\lali-agent" : "/tmp/lali-agent.sock";
let agentSocket: net.Socket | null = null;
const responseEmitters = new Map<string, (event: AgentEvent) => void>();
export const sseEmitters = new Map<string, (event: AgentEvent | { type: string, sequence: number, requestId: string, data: unknown }) => void>();

function getAgentSocket(): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    if (agentSocket && !agentSocket.destroyed) {
      return resolve(agentSocket);
    }

    const socket = net.createConnection(SOCKET_PATH);
    let buffer = "";

    socket.on("connect", () => {
      agentSocket = socket;
      resolve(socket);
    });

    socket.on("data", (data) => {
      buffer += data.toString();
      const parts = buffer.split("\\n");
      buffer = parts.pop() || "";

      for (const msg of parts) {
        if (!msg.trim()) continue;
        try {
          const event = AgentEventSchema.parse(JSON.parse(msg));
          if (event.requestId) {
            const emitter = responseEmitters.get(event.requestId);
            if (emitter) emitter(event);
          }
        } catch (e) {
          console.error("Failed to parse agent event:", e);
        }
      }
    });

    socket.on("error", (err) => {
      console.error("Agent socket error:", err);
      agentSocket = null;
      // Mark all running as interrupted
      db.exec("UPDATE requests SET status = 'interrupted' WHERE status = 'running'");
      reject(err);
    });

    socket.on("close", () => {
      agentSocket = null;
    });
  });
}

export class QueueManager {
  static assertSessionOwner(sessionId: string, userId: string) {
    const session = db.prepare("SELECT userId FROM session_state WHERE sessionId = ?").get(sessionId) as { userId: string } | undefined;
    if (session && session.userId !== userId) throw new Error("Unauthorized session access");
    if (!session) {
      db.prepare("INSERT INTO session_state (sessionId, userId) VALUES (?, ?)").run(sessionId, userId);
    }
  }

  static submitRequest(sessionId: string, userId: string, message: string, idempotencyKey?: string, replyChannel: string = "web") {
    QueueManager.assertSessionOwner(sessionId, userId);

    if (idempotencyKey) {
      const existing = db.prepare("SELECT * FROM requests WHERE sessionId = ? AND idempotencyKey = ?").get(sessionId, idempotencyKey) as { id: string, status: string } | undefined;
      if (existing) {
        // Trigger queue in case it was stuck
        setTimeout(() => QueueManager.processQueue(sessionId), 0);
        return existing;
      }
    }

    const id = crypto.randomUUID();
    const isPaused = db.prepare("SELECT is_paused FROM session_state WHERE sessionId = ?").get(sessionId) as { is_paused: number } | undefined;
    
    let status = "queued";
    if (isPaused && isPaused.is_paused) {
      status = "paused_for_confirmation";
    }

    db.prepare("INSERT INTO requests (id, sessionId, idempotencyKey, message, status, replyChannel) VALUES (?, ?, ?, ?, ?, ?)").run(
      id, sessionId, idempotencyKey || null, message, status, replyChannel
    );

    const request = db.prepare("SELECT * FROM requests WHERE id = ?").get(id) as { id: string, status: string };
    
    setTimeout(() => QueueManager.processQueue(sessionId), 0);
    return request;
  }

  static getNextSequence(sessionId: string) {
    const row = db.prepare("SELECT MAX(sequence) as seq FROM events WHERE sessionId = ?").get(sessionId) as { seq: number | null };
    return (row.seq || 0) + 1;
  }

  static appendEvent(sessionId: string, requestId: string, type: string, data: unknown) {
    const seq = QueueManager.getNextSequence(sessionId);
    db.prepare("INSERT INTO events (sessionId, requestId, type, data, sequence) VALUES (?, ?, ?, ?, ?)").run(
      sessionId, requestId, type, JSON.stringify(data), seq
    );
    const eventObj = { type, data, sequence: seq, requestId };
    
    const clientEmitter = sseEmitters.get(sessionId);
    if (clientEmitter) clientEmitter(eventObj);
    return eventObj;
  }

  static getEventsAfter(sessionId: string, sequence: number) {
    const rows = db.prepare("SELECT * FROM events WHERE sessionId = ? AND sequence > ? ORDER BY sequence ASC").all(sessionId, sequence) as { type: string, data: string, sequence: number, requestId: string }[];
    return rows.map(r => ({ type: r.type, data: JSON.parse(r.data), sequence: r.sequence, requestId: r.requestId }));
  }

  static interruptSession(sessionId: string) {
    db.prepare("UPDATE requests SET status = 'interrupted' WHERE sessionId = ? AND status = 'running'").run(sessionId);
    db.prepare("INSERT INTO session_state (sessionId, is_paused) VALUES (?, 1) ON CONFLICT(sessionId) DO UPDATE SET is_paused = 1").run(sessionId);
    db.prepare("UPDATE requests SET status = 'paused_for_confirmation' WHERE sessionId = ? AND status = 'queued'").run(sessionId);
    
    // Broadcast interrupt
    QueueManager.appendEvent(sessionId, "system", "interrupted", { message: "Run interrupted" });
  }

  static resumeSession(sessionId: string) {
    db.prepare("UPDATE session_state SET is_paused = 0 WHERE sessionId = ?").run(sessionId);
    db.prepare("UPDATE requests SET status = 'queued' WHERE sessionId = ? AND status = 'paused_for_confirmation'").run(sessionId);
    setTimeout(() => QueueManager.processQueue(sessionId), 0);
  }
  
  static clearSession(sessionId: string) {
    db.prepare("UPDATE session_state SET is_paused = 0 WHERE sessionId = ?").run(sessionId);
    db.prepare("DELETE FROM requests WHERE sessionId = ? AND status IN ('queued', 'paused_for_confirmation')").run(sessionId);
  }

  static async processQueue(sessionId: string) {
    const isPaused = db.prepare("SELECT is_paused FROM session_state WHERE sessionId = ?").get(sessionId) as { is_paused: number } | undefined;
    if (isPaused && isPaused.is_paused) return;

    const running = db.prepare("SELECT count(*) as count FROM requests WHERE sessionId = ? AND status = 'running'").get(sessionId) as { count: number };
    if (running.count > 0) return;

    const next = db.prepare("SELECT * FROM requests WHERE sessionId = ? AND status = 'queued' ORDER BY created_at ASC LIMIT 1").get(sessionId) as { id: string, message: string } | undefined;
    if (!next) return;

    db.prepare("UPDATE requests SET status = 'running' WHERE id = ?").run(next.id);
    
    try {
      const socket = await getAgentSocket();
      
      responseEmitters.set(next.id, (event) => {
        // Check if interrupted mid-stream
        const currentStatus = db.prepare("SELECT status FROM requests WHERE id = ?").get(next.id) as { status: string } | undefined;
        if (currentStatus && currentStatus.status === 'interrupted') {
          responseEmitters.delete(next.id);
          return; // Ignore events after interruption
        }

        if (event.type === "done" || event.type === "error") {
          db.prepare("UPDATE requests SET status = ?, finalResponse = ? WHERE id = ?").run(event.type === "done" ? "completed" : "failed", event.type === "done" ? event.finalResponse : event.error, next.id);
          responseEmitters.delete(next.id);
          QueueManager.appendEvent(sessionId, next.id, event.type, event.type === "done" ? { finalResponse: event.finalResponse } : { error: event.error });
          
          if (event.type === "done") {
            const req = db.prepare("SELECT replyChannel FROM requests WHERE id = ?").get(next.id) as { replyChannel: string };
            if (req.replyChannel === "telegram") {
              db.prepare("UPDATE requests SET deliveryStatus = 'pending' WHERE id = ?").run(next.id);
              import("./telegram.ts").then(({ sendTelegramMessage }) => {
                sendTelegramMessage(event.finalResponse).then(success => {
                  db.prepare("UPDATE requests SET deliveryStatus = ? WHERE id = ?").run(success ? "delivered" : "failed", next.id);
                });
              }).catch(e => console.error("Failed to load telegram module", e));
            }
          }
          
          setTimeout(() => QueueManager.processQueue(sessionId), 0);
        } else if (event.type === "propose_effect") {
          db.prepare("UPDATE requests SET status = 'completed' WHERE id = ?").run(next.id);
          responseEmitters.delete(next.id);
          const effect = EffectManager.propose(sessionId, next.id, event.summary, event.payload);
          QueueManager.appendEvent(sessionId, next.id, "propose_effect", { effect });
          setTimeout(() => QueueManager.processQueue(sessionId), 0);
        } else if (event.type === "text") {
          QueueManager.appendEvent(sessionId, next.id, "text", { text: event.text });
        } else if (event.type === "lifecycle") {
          QueueManager.appendEvent(sessionId, next.id, "lifecycle", { event: event.event });
        }
      });

      socket.write(JSON.stringify({ version: PROTOCOL_VERSION, requestId: next.id, message: next.message }) + "\n");
    } catch (err) {
      db.prepare("UPDATE requests SET status = 'failed' WHERE id = ?").run(next.id);
      QueueManager.appendEvent(sessionId, next.id, "error", { error: "Agent connection failed" });
      setTimeout(() => QueueManager.processQueue(sessionId), 0);
    }
  }
}
