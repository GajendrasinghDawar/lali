import { db } from "./auth.ts";
import crypto from "crypto";
import { NotificationManager } from "./notifications.ts";

db.exec(`
  CREATE TABLE IF NOT EXISTS inbound_emails (
    id TEXT PRIMARY KEY,
    provider_message_id TEXT UNIQUE NOT NULL,
    sender TEXT NOT NULL,
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    session_id TEXT,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export class EmailManager {
  static async checkEmails() {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.warn("RESEND_API_KEY not set, skipping email check");
      return;
    }

    try {
      const res = await fetch("https://api.resend.com/emails/receiving", {
        headers: { "Authorization": "Bearer " + key }
      });
      if (!res.ok) {
        throw new Error("Resend API error: " + res.status);
      }
      
      const data = await res.json();
      if (!data.data || !Array.isArray(data.data)) {
         return;
      }

      for (const emailMeta of data.data) {
         const providerId = emailMeta.id;
         
         const existing = db.prepare("SELECT 1 FROM inbound_emails WHERE provider_message_id = ?").get(providerId);
         if (existing) continue;

         const fullRes = await fetch("https://api.resend.com/emails/receiving/" + providerId, {
            headers: { "Authorization": "Bearer " + key }
         });
         
         if (!fullRes.ok) continue;

         const fullData = await fullRes.json();
         const email = fullData;
         
         const id = crypto.randomUUID();
         const sender = email.from || "unknown";
         const subject = email.subject || "No Subject";
         const text = email.text || email.body_text || "";
         const html = email.html || email.body_html || "";

         db.prepare(`
           INSERT INTO inbound_emails (id, provider_message_id, sender, subject, body_text, body_html)
           VALUES (?, ?, ?, ?, ?, ?)
         `).run(id, providerId, sender, subject, text, html);

         NotificationManager.create({
           type: "email",
           summary: "New Email from " + sender + ": " + subject,
           context: { }
         });
      }
    } catch (err) {
      console.error("Error checking emails:", err);
    }
  }

  static getEmail(id: string) {
    return db.prepare("SELECT * FROM inbound_emails WHERE id = ?").get(id) as any;
  }
  
  static setSession(id: string, sessionId: string) {
    db.prepare("UPDATE inbound_emails SET session_id = ? WHERE id = ?").run(sessionId, id);
  }
}
