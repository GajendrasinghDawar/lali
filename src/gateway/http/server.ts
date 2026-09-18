try { process.loadEnvFile(); } catch (e) {}

import express from "express";
import path from "path";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import url from "node:url";

import { auth, checkAuthHealth, checkDbHealth } from "../persistence/auth.ts";
import { toNodeHandler } from "better-auth/node";
import { initNotifications } from "../integrations/notifications.ts";

import { SessionRouter } from "./routers/session.ts";
import { ChatRouter } from "./routers/chat.ts";
import { EffectRouter } from "./routers/effect.ts";
import { NotificationRouter } from "./routers/notification.ts";
import { EmailRouter } from "./routers/email.ts";
import { MiscRouter } from "./routers/misc.ts";

import { initTelegram } from "../integrations/telegram.ts";
import { runMigrations } from "../persistence/schema.ts";
import { startupCleanup, startRetentionCron } from "../persistence/startup_cleanup.ts";
import { ScheduledJobsManager } from "../integrations/scheduled_jobs.ts";

const app = express();
initNotifications();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));
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

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10000 });

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

// Auth middleware for all API routes (except auth itself and health)
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

// Mount domain routers
app.use("/api/sessions", doubleCsrfProtection, apiLimiter, SessionRouter);
app.use("/api/chat", doubleCsrfProtection, apiLimiter, ChatRouter);
app.use("/api/effects", doubleCsrfProtection, apiLimiter, EffectRouter);
app.use("/api/notifications", doubleCsrfProtection, apiLimiter, NotificationRouter);
app.use("/api/emails", doubleCsrfProtection, apiLimiter, EmailRouter);
app.use("/api", doubleCsrfProtection, apiLimiter, MiscRouter);

// SPA fallback for Web UI
app.use(express.static(path.join(import.meta.dirname, "../../../dist/web")));
app.use((req, res) => {
  res.sendFile(path.join(import.meta.dirname, "../../../dist/web/index.html"));
});

export { app };

if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  runMigrations();
  startupCleanup();
  startRetentionCron();
  const PORT = parseInt(process.env.PORT || "3000", 10);
  app.listen(PORT, "127.0.0.1", () => {
    console.log(`Gateway listening on http://localhost:${PORT}`);
    initTelegram();
    ScheduledJobsManager.start();
  });
}
