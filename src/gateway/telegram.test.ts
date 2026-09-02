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
});
