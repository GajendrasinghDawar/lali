import dotenv from "dotenv";
dotenv.config();

import express from "express";
import Database from "better-sqlite3";
import * as net from "net";
import * as os from "os";
import path from "path";
import crypto from "crypto";
import { AgentEventSchema } from "../shared/protocol";

import session from "express-session";
// @ts-ignore
import createSqliteStore from "better-sqlite3-session-store";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { generatePKCE, generateState, sendError } from "./auth";
import "./types";

const app = express();
app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser(process.env.COOKIE_SECRET || "lali-secret"));

// Database setup
const db = new Database("gateway.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    message TEXT NOT NULL,
    status TEXT NOT NULL
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS oauth_state (
    state TEXT PRIMARY KEY,
    verifier TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const SqliteStore = createSqliteStore(session);
app.use(
  session({
    store: new SqliteStore({
      client: db,
      expired: {
        clear: true,
        intervalMs: 900000 // 15min
      }
    }),
    secret: process.env.SESSION_SECRET || "lali-session-secret",
    resave: false,
    saveUninitialized: false,
    name: "lali.sid",
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
  })
);

// @ts-ignore
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || "csrf-secret",
  getSessionIdentifier: (req: any) => req.sessionID || "unknown",
  cookieName: "x-csrf-token",
  cookieOptions: {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  }
} as any);

const generateToken = generateCsrfToken;

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

app.use((req, res, next) => {
  res.locals.correlationId = crypto.randomUUID();
  next();
});

// OAuth Routes
app.get("/login/github", authLimiter, (req, res) => {
  const state = generateState();
  const { challenge, verifier } = generatePKCE();

  db.prepare("INSERT INTO oauth_state (state, verifier) VALUES (?, ?)").run(state, verifier);

  const redirectUri = process.env.GITHUB_CALLBACK_URL || "http://localhost:3000/login/github/callback";
  const clientId = process.env.GITHUB_CLIENT_ID;
  
  if (!clientId) {
    return sendError(res, 500, "ERR_CONFIG", "Missing GitHub Client ID");
  }

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  // GitHub does not fully support PKCE for OAuth apps, but we include it per AC requirements
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  res.redirect(url.toString());
});

app.get("/login/github/callback", authLimiter, async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state || typeof code !== "string" || typeof state !== "string") {
    return sendError(res, 400, "ERR_OAUTH_PARAMS", "Missing code or state");
  }

  const row = db.prepare("SELECT verifier FROM oauth_state WHERE state = ? AND created_at > datetime('now', '-10 minutes')").get(state) as { verifier: string } | undefined;
  if (!row) {
    return sendError(res, 400, "ERR_OAUTH_STATE", "Invalid or expired state");
  }
  db.prepare("DELETE FROM oauth_state WHERE state = ?").run(state);

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const ownerId = process.env.OWNER_GITHUB_ID;

  if (!clientId || !clientSecret || !ownerId) {
    return sendError(res, 500, "ERR_CONFIG", "Missing configuration");
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: process.env.GITHUB_CALLBACK_URL || "http://localhost:3000/login/github/callback",
        code_verifier: row.verifier,
      })
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      return sendError(res, 400, "ERR_OAUTH_EXCHANGE", tokenData.error_description || tokenData.error);
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: { "Authorization": `Bearer ${tokenData.access_token}`, "User-Agent": "Lali" }
    });
    const userData = await userRes.json();
    if (userData.id.toString() !== ownerId) {
      return sendError(res, 403, "ERR_UNAUTHORIZED_USER", "Only the owner can log in");
    }

    req.session.userId = userData.id;
    res.redirect("/");
  } catch (err) {
    sendError(res, 500, "ERR_OAUTH_INTERNAL", "Internal server error during authentication");
  }
});

// Protect all other routes
app.use((req, res, next) => {
  if (!req.session.userId) {
    if (req.accepts('html') && req.path === "/") return res.redirect("/login/github");
    return sendError(res, 401, "ERR_UNAUTH", "Authentication required");
  }
  next();
});

app.get("/csrf-token", (req, res) => {
  res.json({ csrfToken: generateToken(req, res) });
});

app.post("/logout", doubleCsrfProtection, (req, res) => {
  req.session.destroy((err) => {
    if (err) return sendError(res, 500, "ERR_LOGOUT", "Failed to logout");
    res.clearCookie("lali.sid");
    res.json({ success: true });
  });
});

app.post("/logout/all", doubleCsrfProtection, (req, res) => {
  // SQLite store uses a sessions table implicitly
  db.prepare("DELETE FROM sessions").run();
  res.clearCookie("lali.sid");
  res.json({ success: true });
});

app.use(express.static(path.join(__dirname, "../web")));

// Chat socket setup
const SOCKET_PATH = os.platform() === "win32" ? "\\\\.\\pipe\\lali-agent" : "/tmp/lali-agent.sock";
let agentSocket: net.Socket | null = null;
const responseEmitters = new Map<string, (event: any) => void>();

function getAgentSocket(): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    if (agentSocket && !agentSocket.destroyed) {
      return resolve(agentSocket);
    }

    const socket = net.createConnection(SOCKET_PATH);
    let buffer = "";

    socket.on("connect", () => {
      agentSocket = socket;
      resolve(socket);
    });

    socket.on("data", (data) => {
      buffer += data.toString();
      const parts = buffer.split("\n");
      buffer = parts.pop() || "";

      for (const msg of parts) {
        if (!msg.trim()) continue;
        try {
          const event = AgentEventSchema.parse(JSON.parse(msg));
          const emitter = responseEmitters.get(event.requestId);
          if (emitter) emitter(event);
        } catch (e) {
          console.error("Failed to parse agent event:", e);
        }
      }
    });

    socket.on("error", (err) => {
      console.error("Agent socket error:", err);
      agentSocket = null;
      reject(err);
    });

    socket.on("close", () => {
      agentSocket = null;
    });
  });
}

app.post("/chat", doubleCsrfProtection, apiLimiter, async (req, res) => {
  const { message } = req.body;
  if (!message) return sendError(res, 400, "ERR_BAD_REQUEST", "Message required");

  const requestId = crypto.randomUUID();
  const stmt = db.prepare("INSERT INTO requests (id, message, status) VALUES (?, ?, ?)");
  stmt.run(requestId, message, "accepted");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const socket = await getAgentSocket();
    
    responseEmitters.set(requestId, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      
      if (event.type === "done" || event.type === "error") {
        const updateStmt = db.prepare("UPDATE requests SET status = ? WHERE id = ?");
        updateStmt.run(event.type === "done" ? "completed" : "failed", requestId);
        responseEmitters.delete(requestId);
        res.end();
      }
    });

    socket.write(JSON.stringify({ requestId, message }) + "\n");
  } catch (error) {
    console.error("Failed to communicate with agent:", error);
    res.write(`data: ${JSON.stringify({ type: "error", error: "Agent connection failed" })}\n\n`);
    res.end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Gateway listening on port ${PORT}`);
});
