import { db } from "./auth.ts";
import crypto from "crypto";

db.exec(`
  CREATE TABLE IF NOT EXISTS effects (
    id TEXT PRIMARY KEY,
    sessionId TEXT NOT NULL,
    requestId TEXT NOT NULL,
    summary TEXT NOT NULL,
    payload TEXT NOT NULL,
    digest TEXT NOT NULL,
    status TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export class EffectManager {
  static propose(sessionId: string, requestId: string, summary: string, payload: unknown) {
    const id = crypto.randomUUID();
    const payloadStr = JSON.stringify(payload);
    
    // Create canonical digest (SHA-256)
    const hash = crypto.createHash('sha256');
    hash.update(payloadStr);
    const digest = hash.digest('hex');

    // Expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    
    db.prepare(`
      INSERT INTO effects (id, sessionId, requestId, summary, payload, digest, status, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(id, sessionId, requestId, summary, payloadStr, digest, expiresAt);

    return { id, sessionId, requestId, summary, payload: payloadStr, digest, status: "pending", expiresAt };
  }

  static reject(id: string) {
    const result = db.prepare("UPDATE effects SET status = 'rejected' WHERE id = ? AND status = 'pending'").run(id);
    if (result.changes === 0) {
      throw new Error("Effect not found or not in pending state");
    }
  }

  static approve(id: string, digest: string) {
    // Atomically check digest and status, and transition to approved
    const result = db.prepare("UPDATE effects SET status = 'approved' WHERE id = ? AND digest = ? AND status = 'pending' AND expires_at > datetime('now')").run(id, digest);
    
    if (result.changes === 0) {
      const effect = db.prepare("SELECT status, digest, expires_at FROM effects WHERE id = ?").get(id) as any;
      if (!effect) throw new Error("Effect not found");
      if (effect.status !== "pending") throw new Error("Effect is not pending");
      if (effect.digest !== digest) throw new Error("Digest mismatch");
      if (new Date(effect.expires_at) <= new Date()) {
        db.prepare("UPDATE effects SET status = 'expired' WHERE id = ?").run(id);
        throw new Error("Effect expired");
      }
      throw new Error("Failed to approve effect");
    }
  }

  static async execute(id: string) {
    // Attempt to transition to executed atomically to prevent double execution
    const result = db.prepare("UPDATE effects SET status = 'executed' WHERE id = ? AND status = 'approved'").run(id);
    if (result.changes === 0) {
      throw new Error("Effect not approved or already executed");
    }

    const effect = db.prepare("SELECT payload FROM effects WHERE id = ?").get(id) as { payload: string };
    const payload = JSON.parse(effect.payload);

    // Fake execution logic
    if (payload.action === "fake_transfer") {
      return { success: true, data: `Executed ${payload.action} with amount ${payload.amount}` };
    }

    return { success: true, data: "Executed generic fake effect" };
  }
}
