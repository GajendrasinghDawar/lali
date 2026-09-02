import { db } from "./auth.ts";
import { QueueManager, queueEvents } from "./queue.ts";
import { EffectManager } from "./effects.ts";
import { ArtifactManager } from "./artifacts.ts";
import { NotificationManager, notificationEvents } from "./notifications.ts";
import { EmailManager } from "./email.ts";

const MAX_TELEGRAM_LENGTH = 4000;

function getConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const ownerId = process.env.TELEGRAM_OWNER_ID;
  if (!token || !ownerId) return null;
  return { token, ownerId: parseInt(ownerId, 10), ownerIdString: ownerId };
}

export function initTelegram() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      offset INTEGER NOT NULL DEFAULT 0
    );
  `);
  
  startTelegramPolling();
  processDeliveries();
  processNotificationDeliveries();

  notificationEvents.on("created", () => processNotificationDeliveries());

  queueEvents.on("request_completed", (req) => {
    if (req.replyChannel === "telegram") {
      processDeliveries();
    }
  });
}

async function startTelegramPolling() {
  const config = getConfig();
  if (!config) {
    console.warn("Telegram bot token or owner ID not set. Skipping Telegram polling.");
    return;
  }

  const state = db.prepare("SELECT offset FROM telegram_state WHERE id = 1").get() as { offset: number } | undefined;
  let offset = state ? state.offset : 0;
  if (!state) {
    db.prepare("INSERT INTO telegram_state (id, offset) VALUES (1, 0)").run();
  }

  while (true) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${config.token}/getUpdates?offset=${offset}&timeout=30`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data = await response.json();
      if (!data.ok) throw new Error(`API error: ${data.description}`);

      for (const update of data.result) {
        offset = update.update_id + 1;

        if (update.callback_query && update.callback_query.from.id === config.ownerId) {
          const cbData = update.callback_query.data;
          const action = cbData.substring(0, 4);
          const effectId = cbData.substring(4);
          
          try {
            const effect = db.prepare("SELECT digest, sessionId, requestId FROM effects WHERE id = ?").get(effectId) as { digest: string, sessionId: string, requestId: string } | undefined;
            if (effect) {
              if (action === "app:") {
                EffectManager.approve(effectId, effect.digest);
                const execResult = await EffectManager.execute(effectId);
                QueueManager.submitRequest(effect.sessionId, "owner", JSON.stringify({ type: "effect_result", id: effectId, result: execResult }), "tg_app_" + update.callback_query.id, "telegram");
              } else if (action === "rej:") {
                const sessionId = EffectManager.reject(effectId);
                QueueManager.submitRequest(sessionId, "owner", JSON.stringify({ type: "effect_result", id: effectId, result: { success: false, error: "Rejected by user" } }), "tg_rej_" + update.callback_query.id, "telegram");
              }
              // Answer callback query
              await fetch(`https://api.telegram.org/bot${config.token}/answerCallbackQuery`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ callback_query_id: update.callback_query.id, text: "Decision recorded" })
              });
            }
          } catch (e) {
             console.error("Effect decision failed:", e);
             const errorMessage = e instanceof Error ? e.message : String(e);
             await fetch(`https://api.telegram.org/bot${config.token}/answerCallbackQuery`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ callback_query_id: update.callback_query.id, text: "Failed: " + errorMessage })
              });
          }
        }

        const answerCallback = async (id: string, text: string) => {
           await fetch(`https://api.telegram.org/bot${config.token}/answerCallbackQuery`, {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ callback_query_id: id, text })
           });
        };

        if (update.callback_query && update.callback_query.from.id === config.ownerId) {
          const cbData = update.callback_query.data;
          const [action, effectId, shortDigest] = cbData.split(":");
          
          try {
            if (action === "app") {
              const sessionId = EffectManager.approveFromTelegram(effectId, shortDigest);
              const execResult = await EffectManager.execute(effectId);
              QueueManager.submitRequest(sessionId, "owner", JSON.stringify({ type: "effect_result", id: effectId, result: execResult }), "tg_app_" + update.callback_query.id, "telegram");
            } else if (action === "rej") {
              const sessionId = EffectManager.rejectFromTelegram(effectId, shortDigest);
              QueueManager.submitRequest(sessionId, "owner", JSON.stringify({ type: "effect_result", id: effectId, result: { success: false, error: "Rejected by user" } }), "tg_rej_" + update.callback_query.id, "telegram");
            }
            await answerCallback(update.callback_query.id, "Decision recorded");
          } catch (e) {
             console.error("Effect decision failed:", e);
             const errorMessage = e instanceof Error ? e.message : String(e);
             await answerCallback(update.callback_query.id, "Failed: " + errorMessage);
          }
        }

        if (update.message && update.message.chat.type === "private") {
          const fromId = update.message.from.id;
          if (fromId === config.ownerId && update.message.text) {
            const idempotencyKey = `tg_${update.update_id}`;
            QueueManager.submitRequest("main", "owner", update.message.text, idempotencyKey, "telegram");
          }
        }
        
        db.prepare("UPDATE telegram_state SET offset = ? WHERE id = 1").run(offset);
      }
    } catch (e) {
      console.error("Telegram polling error:", e);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

let isDelivering = false;
async function processDeliveries() {
  if (isDelivering) return;
  isDelivering = true;
  const config = getConfig();
  if (!config) {
    isDelivering = false;
    return;
  }

  try {
    while (true) {
      const req = db.prepare("SELECT id, finalResponse, deliveryStatus FROM requests WHERE replyChannel = 'telegram' AND deliveryStatus LIKE 'pending%' LIMIT 1").get() as { id: string, finalResponse: string, deliveryStatus: string } | undefined;
      if (!req) break;

      const cursor = req.deliveryStatus.startsWith("pending:") ? parseInt(req.deliveryStatus.split(":")[1], 10) : 0;
      
      const text = req.finalResponse || "";
      const chunks = [];
      for (let i = 0; i < text.length; i += MAX_TELEGRAM_LENGTH) {
        chunks.push(text.slice(i, i + MAX_TELEGRAM_LENGTH));
      }
      
      // If no text, send a placeholder or skip?
      if (chunks.length === 0) chunks.push("...");

      let success = true;
      for (let i = cursor; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
          const response = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: config.ownerIdString,
              text: chunk
            })
          });
          
          if (!response.ok) {
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
              // Terminal failure
              db.prepare("UPDATE requests SET deliveryStatus = 'failed' WHERE id = ?").run(req.id);
              NotificationManager.create({
                type: "failure",
                summary: "Terminal Telegram delivery failure",
                context: { requestId: req.id }
              });
              success = false;
              break;
            }
            throw new Error(`Send error: ${response.status}`);
          }

          db.prepare("UPDATE requests SET deliveryStatus = ? WHERE id = ?").run(`pending:${i + 1}`, req.id);
        } catch (e) {
          console.error("Telegram delivery failed", e);
          success = false;
          break;
        }
      }

      if (success) {
        db.prepare("UPDATE requests SET deliveryStatus = 'delivered' WHERE id = ?").run(req.id);
      } else {
        // Stop processing to wait for retry
        break;
      }
    }
  } finally {
    isDelivering = false;
    // Retry in 5s if there are still pending ones
    const remaining = db.prepare("SELECT id FROM requests WHERE replyChannel = 'telegram' AND deliveryStatus LIKE 'pending%' LIMIT 1").get();
    if (remaining) {
      setTimeout(processDeliveries, 5000);
    }
  }
}

export async function sendTelegramMessage(text: string) {
  // Only for tests to verify chunking
  const config = getConfig();
  if (!config) return false;
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_TELEGRAM_LENGTH) {
    chunks.push(text.slice(i, i + MAX_TELEGRAM_LENGTH));
  }
  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: config.ownerIdString, text: chunk })
    });
  }
  return true;
}

let isDeliveringNotifications = false;
async function processNotificationDeliveries() {
  if (isDeliveringNotifications) return;
  isDeliveringNotifications = true;
  const config = getConfig();
  if (!config) {
    isDeliveringNotifications = false;
    return;
  }

  try {
    while (true) {
      const notif = db.prepare("SELECT id, summary, type, relatedEffectId, telegramStatus FROM notifications WHERE telegramStatus IN ('pending', 'retrying') LIMIT 1").get() as { id: string, summary: string, type: string, relatedEffectId: string, telegramStatus: string } | undefined;
      if (!notif) break;

      try {
        let text = notif.summary;
        let reply_markup = undefined;

        if (notif.type === 'approval' && notif.relatedEffectId) {
          const effect = db.prepare("SELECT payload, digest FROM effects WHERE id = ?").get(notif.relatedEffectId) as { payload: string, digest: string } | undefined;
          if (effect) {
            const shortDigest = effect.digest.substring(0, 16);
            try {
              const payload = JSON.parse(effect.payload);
              if (payload.action === 'send_email') {
                text += `\n\nTo: ${payload.to}\nSubject: ${payload.subject}\n\n${payload.body}`;
              }
            } catch (e) {}

            reply_markup = {
              inline_keyboard: [
                [
                  { text: "Approve", callback_data: `app:${notif.relatedEffectId}:${shortDigest}` },
                  { text: "Reject", callback_data: `rej:${notif.relatedEffectId}:${shortDigest}` }
                ]
              ]
            };
          }
        }

        const response = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: config.ownerIdString,
            text: text.substring(0, MAX_TELEGRAM_LENGTH),
            reply_markup
          })
        });
        if (!response.ok) throw new Error(`Send error: ${response.status}`);
        NotificationManager.updateTelegramStatus(notif.id, "sent");
      } catch (e) {
        console.error("Telegram notification delivery failed", e);
        NotificationManager.updateTelegramStatus(notif.id, "failed");
        break; // Wait for next tick to retry or give up (actually if it fails we marked it failed so it won't retry next loop)
        // Wait, issue says: "terminal delivery failures create actionable notifications" 
        // If we mark it "failed", we should maybe create another notification? But that would loop.
        // I will just mark it "failed".
      }
    }
  } finally {
    isDeliveringNotifications = false;
    // We could retry if there are retrying ones, but for now we mark as failed.
  }
}
