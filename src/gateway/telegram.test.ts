import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "./auth.ts";
import { QueueManager } from "./queue.ts";
// Assuming initTelegram calls processDeliveries and startTelegramPolling
import { initTelegram, sendTelegramMessage } from "./telegram.ts";

vi.mock("./queue.ts", () => ({
  QueueManager: {
    submitRequest: vi.fn(),
  },
  queueEvents: {
    on: vi.fn(),
  }
}));

describe("Telegram Integration", () => {
  let originalSetTimeout: any;
  beforeEach(() => {
    db.exec("DROP TABLE IF EXISTS telegram_state");
    db.exec("DROP TABLE IF EXISTS effects");
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_OWNER_ID = "123456";
    originalSetTimeout = global.setTimeout;
  });

  afterEach(() => {
    global.setTimeout = originalSetTimeout;
  });

  it("polls and queues valid owner messages", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("sendMessage")) {
        return { ok: true };
      }
      callCount++;
      if (callCount > 1) {
        throw new Error("Force error to break loop");
      }
      return {
        ok: true,
        json: async () => ({
          ok: true,
          result: [
            {
              update_id: 100,
              message: { chat: { type: "private" }, from: { id: 123456 }, text: "Hello" }
            }
          ]
        })
      };
    }) as any;

    let resolvePolling: any;
    const pollingPromise = new Promise(r => resolvePolling = r);

    global.setTimeout = vi.fn().mockImplementation(() => {
      resolvePolling();
      return new Promise(() => {}); // hang forever
    }) as any;

    initTelegram();
    
    await pollingPromise;

    expect(QueueManager.submitRequest).toHaveBeenCalledWith(
      "main", "owner", "Hello", "tg_100", "telegram"
    );
  });

  it("handles callback queries for effects", async () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS effects (
        id TEXT PRIMARY KEY, sessionId TEXT, requestId TEXT, summary TEXT,
        payload TEXT, digest TEXT, status TEXT, expires_at DATETIME
      );
    `);
    db.prepare("INSERT INTO effects (id, sessionId, requestId, summary, payload, digest, status, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '+1 hour'))")
      .run("eff-123", "main", "req-1", "test effect", "{}", "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a", "pending");

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("answerCallbackQuery")) return { ok: true, json: async () => ({ ok: true }) };
      if (url.includes("sendMessage")) return { ok: true };
      callCount++;
      if (callCount > 1) throw new Error("Force error to break loop");
      return {
        ok: true,
        json: async () => ({
          ok: true,
          result: [
            {
              update_id: 101,
              callback_query: { id: "cbq-1", from: { id: 123456 }, data: "app:eff-123" }
            }
          ]
        })
      };
    }) as any;

    let resolvePolling: any;
    const pollingPromise = new Promise(r => resolvePolling = r);
    global.setTimeout = vi.fn().mockImplementation(() => {
      resolvePolling();
      return new Promise(() => {});
    }) as any;

    initTelegram();
    await pollingPromise;

    const effect = db.prepare("SELECT status FROM effects WHERE id = 'eff-123'").get() as any;
    expect(effect.status).toBe("executed");
  });
});
