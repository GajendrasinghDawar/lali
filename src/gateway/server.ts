import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { auth, db, checkAuthHealth, checkDbHealth } from "./auth";
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
  const PORT = parseInt(process.env.PORT || "3000", 10);
  app.listen(PORT, "127.0.0.1", () => {
    console.log(`Gateway listening on 127.0.0.1:${PORT}`);
  });
}
