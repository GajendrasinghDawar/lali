import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { auth, db } from "./auth";
import { toNodeHandler } from "better-auth/node";
import { QueueManager, sseEmitters } from "./queue";

const app = express();
app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser(process.env.COOKIE_SECRET || "lali-secret"));

app.use("/api/auth", toNodeHandler(auth));

// @ts-ignore
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || "csrf-secret",
  getSessionIdentifier: (req: any) => {
    return req.cookies["better-auth.session_token"] || "unknown";
  },
  cookieName: "x-csrf-token",
  cookieOptions: {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  }
} as any);

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

app.use((req, res, next) => {
  res.locals.correlationId = crypto.randomUUID();
  next();
});

app.get("/health", (req, res) => {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.OWNER_GITHUB_ID || !process.env.BETTER_AUTH_SECRET) {
    return res.status(503).json({ status: "error", message: "Missing auth configuration" });
  }
  try {
    db.prepare("SELECT 1 FROM requests LIMIT 1").get();
    res.json({ status: "ok" });
  } catch (err) {
    res.status(503).json({ status: "error", message: "Database not ready" });
  }
});

app.use(async (req, res, next) => {
  if (req.path === "/") return next();
  if (req.path === "/csrf-token") return next();
  if (req.path === "/health") return next();
  if (req.path.startsWith("/api/auth")) return next();

  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
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

app.use(express.static(path.join(__dirname, "../web")));

app.post("/chat", doubleCsrfProtection, apiLimiter, (req, res) => {
  const { message, sessionId, idempotencyKey } = req.body;
  if (!message || !sessionId) return res.status(400).json({ error: "ERR_BAD_REQUEST", message: "Message and sessionId required" });

  const request = QueueManager.submitRequest(sessionId, message, idempotencyKey);
  res.status(202).json({ requestId: request.id, status: request.status });
});

app.post("/chat/interrupt", doubleCsrfProtection, apiLimiter, (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "ERR_BAD_REQUEST", message: "sessionId required" });
  
  QueueManager.interruptSession(sessionId);
  res.json({ success: true });
});

app.post("/chat/resume", doubleCsrfProtection, apiLimiter, (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "ERR_BAD_REQUEST", message: "sessionId required" });
  
  QueueManager.resumeSession(sessionId);
  res.json({ success: true });
});

app.post("/chat/clear", doubleCsrfProtection, apiLimiter, (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "ERR_BAD_REQUEST", message: "sessionId required" });
  
  QueueManager.clearSession(sessionId);
  res.json({ success: true });
});

app.get("/chat/events", apiLimiter, (req, res) => {
  const sessionId = req.query.sessionId as string;
  const after = parseInt(req.query.after as string || "0", 10);
  if (!sessionId) return res.status(400).json({ error: "ERR_BAD_REQUEST", message: "sessionId required" });

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

export { app, db };

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Gateway listening on port ${PORT}`);
  });
}
