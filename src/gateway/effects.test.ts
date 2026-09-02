import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./auth.ts";
import { EffectManager } from "./effects.ts";
import crypto from "crypto";

describe("EffectManager", () => {
  beforeEach(() => {
    db.exec(`
      DROP TABLE IF EXISTS effects;
      CREATE TABLE effects (
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
  });

  it("proposes, approves, and executes a fake effect securely", async () => {
    const payload = { action: "fake_transfer", amount: 100 };
    
    // Propose
    const effect = EffectManager.propose("sess1", "req1", "Transfer 100", payload);
    
    expect(effect.id).toBeDefined();
    expect(effect.status).toBe("pending");
    expect(effect.digest).toBeDefined();

    // Rejection
    EffectManager.reject(effect.id);
    const rejected = db.prepare("SELECT status FROM effects WHERE id = ?").get(effect.id) as { status: string };
    expect(rejected.status).toBe("rejected");

    // Propose another
    const effect2 = EffectManager.propose("sess1", "req1", "Transfer 200", payload);

    // Mismatched digest should fail approval
    expect(() => EffectManager.approve(effect2.id, "wrong-digest")).toThrow();
    
    // Approval
    EffectManager.approve(effect2.id, effect2.digest);
    const approved = db.prepare("SELECT status FROM effects WHERE id = ?").get(effect2.id) as { status: string };
    expect(approved.status).toBe("approved");

    // Execution
    const result = await EffectManager.execute(effect2.id);
    expect(result.success).toBe(true);
    expect(result.data).toBe("Executed fake_transfer with amount 100");

    const executed = db.prepare("SELECT status FROM effects WHERE id = ?").get(effect2.id) as { status: string };
    expect(executed.status).toBe("executed");

    // Double execution should fail
    await expect(EffectManager.execute(effect2.id)).rejects.toThrow();
  });
});
