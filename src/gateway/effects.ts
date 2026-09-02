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

// Reset interrupted executions
db.exec("UPDATE effects SET status = 'unknown' WHERE status = 'running'");

export class EffectManager {
  static propose(sessionId: string, requestId: string, summary: string, payload: unknown) {
    const id = crypto.randomUUID();
    const payloadStr = JSON.stringify(payload);
    
    // Create canonical digest (SHA-256)
    const hash = crypto.createHash('sha256');
    hash.update(payloadStr);
    const digest = hash.digest('hex');
    
    db.prepare(`
      INSERT INTO effects (id, sessionId, requestId, summary, payload, digest, status, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now', '+15 minutes'))
    `).run(id, sessionId, requestId, summary, payloadStr, digest);

    const expiresAt = db.prepare("SELECT expires_at FROM effects WHERE id = ?").get(id) as { expires_at: string };
    
    return { id, sessionId, requestId, summary, payload: payloadStr, digest, status: "pending", expiresAt: expiresAt.expires_at };
  }

  
  static getShortDigest(id: string): string {
    const effect = db.prepare("SELECT digest FROM effects WHERE id = ?").get(id) as { digest: string } | undefined;
    return effect ? effect.digest.substring(0, 16) : "";
  }

  static approveFromTelegram(id: string, shortDigest: string) {
    const effect = db.prepare("SELECT digest, sessionId FROM effects WHERE id = ?").get(id) as { digest: string, sessionId: string } | undefined;
    if (!effect) throw new Error("Effect not found");
    if (effect.digest.substring(0, 16) !== shortDigest) throw new Error("Digest mismatch");
    EffectManager.approve(id, effect.digest);
    return effect.sessionId;
  }

  static rejectFromTelegram(id: string, shortDigest: string) {
    const effect = db.prepare("SELECT digest, sessionId FROM effects WHERE id = ?").get(id) as { digest: string, sessionId: string } | undefined;
    if (!effect) throw new Error("Effect not found");
    if (effect.digest.substring(0, 16) !== shortDigest) throw new Error("Digest mismatch");
    return EffectManager.reject(id);
  }

  static reject(id: string) {
    const effect = db.prepare("SELECT sessionId, status FROM effects WHERE id = ?").get(id) as { sessionId: string; status: string } | undefined;
    if (!effect) throw new Error("Effect not found");
    if (effect.status !== "pending") throw new Error("Effect is not pending");

    const result = db.prepare("UPDATE effects SET status = 'rejected' WHERE id = ? AND status = 'pending'").run(id);
    if (result.changes === 0) {
      throw new Error("Failed to reject effect");
    }
    return effect.sessionId;
  }

  static approve(id: string, digest: string) {
    // Atomically check digest and status, and transition to approved
    const result = db.prepare("UPDATE effects SET status = 'approved' WHERE id = ? AND digest = ? AND status = 'pending' AND expires_at > datetime('now')").run(id, digest);
    
    if (result.changes === 0) {
      const effect = db.prepare("SELECT status, digest, expires_at FROM effects WHERE id = ?").get(id) as any;
      if (!effect) throw new Error("Effect not found");
      if (effect.status !== "pending") throw new Error("Effect is not pending");
      if (effect.digest !== digest) throw new Error("Digest mismatch");
      
      const isExpired = db.prepare("SELECT 1 FROM effects WHERE id = ? AND expires_at <= datetime('now')").get(id);
      if (isExpired) {
        db.prepare("UPDATE effects SET status = 'expired' WHERE id = ?").run(id);
        throw new Error("Effect expired");
      }
      throw new Error("Failed to approve effect");
    }
  }

  static async execute(id: string) {
    const effect = db.prepare("SELECT payload, digest, sessionId FROM effects WHERE id = ?").get(id) as { payload: string; digest: string; sessionId: string } | undefined;
    if (!effect) throw new Error("Effect not found");

    const hash = crypto.createHash('sha256');
    hash.update(effect.payload);
    const currentDigest = hash.digest('hex');
    if (currentDigest !== effect.digest) {
      db.prepare("UPDATE effects SET status = 'failed' WHERE id = ?").run(id);
      throw new Error("Payload tampered in database");
    }

    // Transition to running atomically
    const result = db.prepare("UPDATE effects SET status = 'running' WHERE id = ? AND status = 'approved'").run(id);
    if (result.changes === 0) {
      throw new Error("Effect not approved or already executed");
    }

    const payload = JSON.parse(effect.payload);

    let execResult;
    // Fake execution logic
    if (payload.action === "fake_transfer") {
      execResult = { success: true, data: `Executed ${payload.action} with amount ${payload.amount}`, sessionId: effect.sessionId };
    } else {
      execResult = { success: true, data: "Executed generic fake effect", sessionId: effect.sessionId };
    }
    
    db.prepare("UPDATE effects SET status = 'executed' WHERE id = ?").run(id);
    return execResult;
  }
}
