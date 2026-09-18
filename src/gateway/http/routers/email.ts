import { Router } from "express";
import { db } from "../../persistence/auth.ts";
import { QueueManager } from "../../application/queue.ts";
import { EmailManager } from "../../integrations/email.ts";

type EmailRow = {
  id: string;
  sender: string;
  subject: string | null;
  body_text: string | null;
};

export const EmailRouter = Router();

EmailRouter.get("/", (req, res) => {
  try {
    QueueManager.assertSessionOwner("main", res.locals.userId);
    const emails = db.prepare("SELECT * FROM inbound_emails ORDER BY received_at DESC").all();
    res.json({ emails });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }
});

EmailRouter.post("/check", async (req, res) => {
  try {
    QueueManager.assertSessionOwner("main", res.locals.userId);
    await EmailManager.checkEmails();
    res.json({ success: true });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

EmailRouter.post("/:id/open", (req, res) => {
  try {
    QueueManager.assertSessionOwner("main", res.locals.userId);
    const email = db.prepare("SELECT * FROM inbound_emails WHERE id = ?").get(req.params.id) as EmailRow | undefined;
    if (!email) return res.status(404).json({ error: "Not found" });
    
    // Check if a session already exists for this thread
    const subject = email.subject || "No subject";
    const sessionTitle = `Email: ${subject.substring(0, 30)}...`;
    const sessionId = email.id; // use email ID as sessionId
    
    const existing = db.prepare("SELECT * FROM session_state WHERE sessionId = ?").get(sessionId);
    if (!existing) {
      // Create session
      const wsPath = process.env.LALI_ASSISTANT_WORKSPACE || process.cwd();
      db.prepare(`INSERT INTO session_state (sessionId, userId, type, title, workspaceName, workspacePath) VALUES (?, ?, 'project', ?, 'assistant', ?)`).run(sessionId, res.locals.userId, sessionTitle, wsPath);
      
      // Auto-submit initial prompt
      const prompt = `I received an email from ${email.sender} with subject "${email.subject}". Here is the body:\n\n${email.body_text}\n\nHow should I respond?`;
      QueueManager.submitRequest(sessionId, res.locals.userId, prompt);
    }
    
    res.json({ sessionId });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }
});
