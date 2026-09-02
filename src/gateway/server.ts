try { process.loadEnvFile(); } catch (e) {}

import express from "express";
import path from "path";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { auth, db, checkAuthHealth, checkDbHealth } from "./auth.ts";
import { toNodeHandler } from "better-auth/node";
import { QueueManager, sseEmitters } from "./queue.ts";
import { EffectManager } from "./effects.ts";
import { NotificationManager, initNotifications } from "./notifications.ts";

function getWorkspaces(): Record<string, string> {
  const workspaces: Record<string, string> = {};
  const envWorkspaces = process.env.LALI_WORKSPACES || "";
  for (const entry of envWorkspaces.split(",")) {
    const [name, wsPath] = entry.split("=");
    if (name && wsPath) {
      workspaces[name.trim()] = path.resolve(wsPath.trim());
    }
  }
  return workspaces;
}

const app = express();
initNotifications();
app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser(process.env.COOKIE_SECRET || "lali-secret"));

app.use("/api/auth", toNodeHandler(auth));

// @ts-ignore
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || "csrf-secret",
  getSessionIdentifier: (req: express.Request) => {
    return req.cookies["better-auth.session_token"] || "unknown";
  },
  cookieName: "x-csrf-token",
  cookieOptions: {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  }
});

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

app.use((req, res, next) => {
  res.locals.correlationId = crypto.randomUUID();
  next();
});

app.get("/health", (req, res) => {
  const authHealth = checkAuthHealth();
  if (authHealth.status !== "ok") {
    return res.status(503).json(authHealth);
  }
  
  const dbHealth = checkDbHealth();
  if (dbHealth.status !== "ok") {
    return res.status(503).json(dbHealth);
  }
  
  res.json({ status: "ok" });
});

app.use(async (req, res, next) => {
  if (req.path === "/") return next();
  if (req.path === "/csrf-token") return next();
  if (req.path === "/health") return next();
  if (req.path.startsWith("/api/auth")) return next();

  try {
    const session = await auth.api.getSession({ headers: new Headers(req.headers as Record<string, string>) });
    if (!session) {
      return res.status(401).json({ error: "ERR_UNAUTH", message: "Authentication required" });
    }
    res.locals.userId = session.user.id;
    next();
  } catch (err) {
    return res.status(500).json({ error: "ERR_AUTH", message: "Auth check failed" });
  }
});

app.get("/csrf-token", (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
});

app.get("/api/notifications", apiLimiter, (req, res) => {
  try {
    QueueManager.assertSessionOwner("main", res.locals.userId);
    const notifications = NotificationManager.list();
    res.json({ notifications });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }
});

app.post("/api/notifications/:id/read", doubleCsrfProtection, apiLimiter, (req, res) => {
  try {
    QueueManager.assertSessionOwner("main", res.locals.userId);
    NotificationManager.markRead(req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }
});


app.get("/api/sessions", apiLimiter, (req, res) => {
  const sessions = db.prepare("SELECT * FROM session_state WHERE userId = ? OR userId = 'owner' ORDER BY type ASC, sessionId ASC").all(res.locals.userId);
  res.json({ sessions });
});

app.post("/api/sessions", doubleCsrfProtection, apiLimiter, (req, res) => {
  const { sessionId, title, workspaceName, subPath } = req.body;
  if (!sessionId || !workspaceName) return res.status(400).json({ error: "sessionId and workspaceName required" });
  
  const workspaces = getWorkspaces();
  const root = workspaces[workspaceName];
  if (!root) return res.status(400).json({ error: "Invalid workspace name" });
  
  let targetPath = root;
  if (subPath) {
    targetPath = path.resolve(root, subPath);
    if (!targetPath.startsWith(root)) {
      return res.status(400).json({ error: "Path traversal detected" });
    }
  }

  try {
    db.prepare(`INSERT INTO session_state (sessionId, userId, type, title, workspaceName, workspacePath) VALUES (?, ?, 'project', ?, ?, ?)`).run(sessionId, res.locals.userId, title || sessionId, workspaceName, targetPath);
    res.json({ success: true, sessionId });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

app.put("/api/sessions/:id/archive", doubleCsrfProtection, apiLimiter, (req, res) => {
  const sessionId = req.params.id as string;
  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
    db.prepare(`UPDATE session_state SET status = 'archived' WHERE sessionId = ? AND type != 'main'`).run(sessionId);
    res.json({ success: true });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: message });
  }
});

app.put("/api/sessions/:id/restore", doubleCsrfProtection, apiLimiter, (req, res) => {
  const sessionId = req.params.id as string;
  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
    db.prepare(`UPDATE session_state SET status = 'active' WHERE sessionId = ?`).run(sessionId);
    res.json({ success: true });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: message });
  }
});

app.post("/api/sessions/:id/reset", doubleCsrfProtection, apiLimiter, async (req, res) => {
  const sessionId = req.params.id as string;
  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
    await QueueManager.resetSession(sessionId);
    res.json({ success: true });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: message });
  }
});

app.delete("/api/sessions/:id", doubleCsrfProtection, apiLimiter, async (req, res) => {
  const sessionId = req.params.id as string;
  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
    if (sessionId === "main") return res.status(400).json({ error: "Cannot delete main session" });
    await QueueManager.deleteSession(sessionId);
    res.json({ success: true });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: message });
  }
});

app.use(express.static(path.join(import.meta.dirname, "../web")));

app.post("/chat", doubleCsrfProtection, apiLimiter, (req, res) => {
  const { message, sessionId, idempotencyKey } = req.body;
  if (!message || !sessionId) return res.status(400).json({ error: "ERR_BAD_REQUEST", message: "Message and sessionId required" });

  try {
    const request = QueueManager.submitRequest(sessionId, res.locals.userId, message, idempotencyKey);
    res.status(202).json({ requestId: request.id, status: request.status });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }
});

app.post("/chat/interrupt", doubleCsrfProtection, apiLimiter, (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "ERR_BAD_REQUEST", message: "sessionId required" });
  
  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
    QueueManager.interruptSession(sessionId);
    res.json({ success: true });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }
});

app.post("/chat/resume", doubleCsrfProtection, apiLimiter, (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "ERR_BAD_REQUEST", message: "sessionId required" });
  
  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
    QueueManager.resumeSession(sessionId);
    res.json({ success: true });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }
});

app.post("/chat/clear", doubleCsrfProtection, apiLimiter, (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "ERR_BAD_REQUEST", message: "sessionId required" });
  
  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
    QueueManager.clearSession(sessionId);
    res.json({ success: true });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }
});

app.get("/effects/pending", apiLimiter, (req, res) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) return res.status(400).json({ error: "ERR_BAD_REQUEST" });
  
  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    return res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }

  const pending = db.prepare("SELECT * FROM effects WHERE sessionId = ? AND status = 'pending'").all(sessionId);
  res.json({ effects: pending });
});

app.post("/effects/:id/approve", doubleCsrfProtection, apiLimiter, async (req, res) => {
  const id = req.params.id as string;
  const digest = req.body.digest as string;
  try {
    const effect = db.prepare("SELECT sessionId FROM effects WHERE id = ?").get(id) as { sessionId: string } | undefined;
    if (!effect) return res.status(404).json({ error: "Not found" });
    QueueManager.assertSessionOwner(effect.sessionId, res.locals.userId);

    EffectManager.approve(id, digest);
    const result = await EffectManager.execute(id);
    
    // Submit the result as a new request back to the agent so it can resume
    QueueManager.submitRequest(result.sessionId, res.locals.userId, JSON.stringify({
      type: "effect_result",
      id,
      result: { success: result.success, data: result.data }
    }));
    
    res.json({ success: true, result });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

app.post("/effects/:id/reject", doubleCsrfProtection, apiLimiter, (req, res) => {
  const id = req.params.id as string;
  try {
    const effect = db.prepare("SELECT sessionId FROM effects WHERE id = ?").get(id) as { sessionId: string } | undefined;
    if (!effect) return res.status(404).json({ error: "Not found" });
    QueueManager.assertSessionOwner(effect.sessionId, res.locals.userId);

    const sessionId = EffectManager.reject(id);
    
    QueueManager.submitRequest(sessionId, res.locals.userId, JSON.stringify({
      type: "effect_result",
      id,
      result: { success: false, error: "Rejected by user" }
    }));
    
    res.json({ success: true });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

app.get("/chat/events", apiLimiter, (req, res) => {
  const sessionId = req.query.sessionId as string;
  const after = parseInt(req.query.after as string || "0", 10);
  if (!sessionId) return res.status(400).json({ error: "ERR_BAD_REQUEST", message: "sessionId required" });

  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    return res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Send missed events
  const pastEvents = QueueManager.getEventsAfter(sessionId, after);
  for (const ev of pastEvents) {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  }

  // Subscribe to new events
  sseEmitters.set(sessionId, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on("close", () => {
    sseEmitters.delete(sessionId);
  });
});

app.use((req, res) => {
  res.sendFile(path.join(import.meta.dirname, "../web/index.html"));
});

export { app, db };

import url from "node:url";
import { initTelegram } from "./telegram.ts";

if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const PORT = parseInt(process.env.PORT || "3000", 10);
  app.listen(PORT, "127.0.0.1", () => {
    console.log(`Gateway listening on 127.0.0.1:${PORT}`);
    initTelegram();
  });
}
