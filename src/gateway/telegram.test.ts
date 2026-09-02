import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "./auth.ts";
import { QueueManager } from "./queue.ts";
import { startTelegramPolling, sendTelegramMessage } from "./telegram.ts";

vi.mock("./queue.ts", () => ({
  QueueManager: {
    submitRequest: vi.fn(),
  }
}));

describe("Telegram Integration", () => {
  beforeEach(() => {
    db.exec("DROP TABLE IF EXISTS telegram_state");
    db.exec("CREATE TABLE telegram_state (id INTEGER PRIMARY KEY CHECK (id = 1), offset INTEGER NOT NULL DEFAULT 0)");
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_OWNER_ID = "123456";
  });

  it("polls and queues valid owner messages", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
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
              message: {
                chat: { type: "private" },
                from: { id: 123456 },
                text: "Hello from Telegram"
              }
            },
            {
              update_id: 101,
              message: {
                chat: { type: "private" },
                from: { id: 999999 }, // Not the owner
                text: "Hello from stranger"
              }
            }
          ]
        })
      };
    }) as any;

    const originalSetTimeout = global.setTimeout;
    let resolvePolling: any;
    const pollingPromise = new Promise(r => resolvePolling = r);

    // Mock setTimeout to throw and break the infinite loop after first iteration
    global.setTimeout = vi.fn().mockImplementation(() => {
      resolvePolling();
      throw new Error("Break loop");
    }) as any;

    try {
      await startTelegramPolling();
    } catch (e: any) {
      if (e.message !== "Break loop") throw e;
    }

    // Wait for loop break
    await pollingPromise;
    global.setTimeout = originalSetTimeout;

    expect(QueueManager.submitRequest).toHaveBeenCalledTimes(1);
    expect(QueueManager.submitRequest).toHaveBeenCalledWith(
      "main",
      "123456",
      "Hello from Telegram",
      "tg_100",
      "telegram"
    );

    const state = db.prepare("SELECT offset FROM telegram_state WHERE id = 1").get() as { offset: number };
    expect(state.offset).toBe(102); // 101 + 1
  });

  it("sends chunks correctly", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as any;
    
    // Create text slightly larger than 1000 characters
    const text = "a".repeat(1500);
    const success = await sendTelegramMessage(text);
    
    expect(success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
