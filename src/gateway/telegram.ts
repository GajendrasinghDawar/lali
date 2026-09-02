import { db } from "./auth.ts";
import { QueueManager } from "./queue.ts";

// 1000 characters per message
const MAX_TELEGRAM_LENGTH = 1000;

export async function startTelegramPolling() {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_OWNER_ID = process.env.TELEGRAM_OWNER_ID;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_OWNER_ID) {
    console.warn("Telegram bot token or owner ID not set. Skipping Telegram polling.");
    return;
  }

  const ownerId = parseInt(TELEGRAM_OWNER_ID, 10);

  // Read offset
  const state = db.prepare("SELECT offset FROM telegram_state WHERE id = 1").get() as { offset: number } | undefined;
  let offset = state ? state.offset : 0;
  if (!state) {
    db.prepare("INSERT INTO telegram_state (id, offset) VALUES (1, 0)").run();
  }

  while (true) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`);
      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.ok) {
        throw new Error(`Telegram API returned error: ${data.description}`);
      }

      for (const update of data.result) {
        offset = update.update_id + 1;

        if (update.message && update.message.chat.type === "private") {
          const fromId = update.message.from.id;
          if (fromId === ownerId && update.message.text) {
            const idempotencyKey = `tg_${update.update_id}`;
            // Use the Telegram owner ID string as the userId in Lali
            QueueManager.submitRequest("main", TELEGRAM_OWNER_ID, update.message.text, idempotencyKey, "telegram");
          }
        }
        
        // Update offset in DB to prevent re-processing on restart
        db.prepare("UPDATE telegram_state SET offset = ? WHERE id = 1").run(offset);
      }
    } catch (e) {
      console.error("Telegram polling error:", e);
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

export async function sendTelegramMessage(text: string) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_OWNER_ID = process.env.TELEGRAM_OWNER_ID;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_OWNER_ID) return false;

  try {
    // Basic chunking if text exceeds limits
    const chunks = [];
    for (let i = 0; i < text.length; i += MAX_TELEGRAM_LENGTH) {
      chunks.push(text.slice(i, i + MAX_TELEGRAM_LENGTH));
    }

    for (const chunk of chunks) {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_OWNER_ID,
          text: chunk
        })
      });
      if (!response.ok) {
        throw new Error(`Telegram send error: ${response.status}`);
      }
    }
    return true;
  } catch (e) {
    console.error("Telegram send error:", e);
    return false;
  }
}
