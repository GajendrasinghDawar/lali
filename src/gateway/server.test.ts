import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app, db } from "./server.ts";
import { QueueManager } from "./queue.ts";

vi.mock("./auth.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth.ts")>();
  return {
    ...actual,
    auth: {
      api: {
        getSession: vi.fn().mockResolvedValue({ user: { id: "mock-user" } })
      }
    }
  };
});

vi.mock("net", () => {
  return {
    createConnection: vi.fn().mockReturnValue({
      on: vi.fn(),
      write: vi.fn(),
      destroyed: false
    })
  };
});

describe("Gateway API", () => {
  let csrfToken = "";
  let cookie = "";

  beforeEach(async () => {
    db.exec("DELETE FROM requests; DELETE FROM events; DELETE FROM session_state;");
    const res = await request(app).get("/csrf-token");
    csrfToken = res.body.csrfToken;
    cookie = res.headers["set-cookie"][0];
  });

  it("handles duplicate idempotency keys by returning existing request", async () => {
    const payload = { sessionId: "sess1", message: "hello", idempotencyKey: "key1" };
    
    // First request
    const res1 = await request(app)
      .post("/chat")
      .set("Cookie", cookie)
      .set("x-csrf-token", csrfToken)
      .send(payload);
    expect(res1.status).toBe(202);

    // Second request with same key
    const res2 = await request(app)
      .post("/chat")
      .set("Cookie", cookie)
      .set("x-csrf-token", csrfToken)
      .send(payload);
    expect(res2.status).toBe(202);
    expect(res2.body.requestId).toBe(res1.body.requestId);
  });

  it("queues requests and exposes interruption state", async () => {
    const payload1 = { sessionId: "sess1", message: "hello 1" };
    const payload2 = { sessionId: "sess1", message: "hello 2" };

    const res1 = await request(app)
      .post("/chat")
      .set("Cookie", cookie)
      .set("x-csrf-token", csrfToken)
      .send(payload1);
    expect(res1.status).toBe(202);

    // Force first request to 'running'
    db.prepare("UPDATE requests SET status = 'running' WHERE id = ?").run(res1.body.requestId);

    const res2 = await request(app)
      .post("/chat")
      .set("Cookie", cookie)
      .set("x-csrf-token", csrfToken)
      .send(payload2);
    expect(res2.status).toBe(202);
    expect(res2.body.status).toBe("queued");

    // Interrupt
    await request(app)
      .post("/chat/interrupt")
      .set("Cookie", cookie)
      .set("x-csrf-token", csrfToken)
      .send({ sessionId: "sess1" });

    const req2 = db.prepare("SELECT status FROM requests WHERE id = ?").get(res2.body.requestId) as { status: string };
    expect(req2.status).toBe("paused_for_confirmation");

    // Resume
    await request(app)
      .post("/chat/resume")
      .set("Cookie", cookie)
      .set("x-csrf-token", csrfToken)
      .send({ sessionId: "sess1" });
    const req2Resumed = db.prepare("SELECT status FROM requests WHERE id = ?").get(res2.body.requestId) as { status: string };
    expect(["queued", "running"]).toContain(req2Resumed.status);
  });
});
