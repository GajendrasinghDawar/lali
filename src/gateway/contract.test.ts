import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "./server.ts";
import { QueueManager } from "./queue.ts";
import { EffectManager } from "./effects.ts";
import { db } from "./auth.ts";

describe("Gateway Contract (Phase 0)", () => {
  it("emits user_message in timeline when a request is submitted", async () => {
    QueueManager.submitRequest("contract_sess1", "user1", "Hello contract test!");
    
    const events = QueueManager.getEventsAfter("contract_sess1", 0);
    const userMsgEvent = events.find(e => e.type === "user_message" && (e.data as any).message === "Hello contract test!");
    expect(userMsgEvent).toBeDefined();
    expect(userMsgEvent?.requestId).toBeDefined();
    expect(userMsgEvent?.sequence).toBeGreaterThan(0);
  });

  it("emits effect_status events for proposed, approved, and executed", async () => {
    const effectReqId = "req_efx_123";
    const effect = EffectManager.propose("contract_sess1", effectReqId, "Test Effect", { action: "fake_transfer", amount: 100 });
    
    EffectManager.approve(effect.id, effect.digest);
    await EffectManager.execute(effect.id);
    
    const events = QueueManager.getEventsAfter("contract_sess1", 0);
    
    const approved = events.find(e => e.type === "effect_status" && (e.data as any).status === "approved" && (e.data as any).id === effect.id);
    const executed = events.find(e => e.type === "effect_status" && (e.data as any).status === "executed" && (e.data as any).id === effect.id);
    
    expect(approved).toBeDefined();
    expect(executed).toBeDefined();
    expect(approved?.requestId).toBe(effectReqId);
    expect(executed?.requestId).toBe(effectReqId);
  });
});
