import dotenv from "dotenv";
dotenv.config();

import express from "express";
import * as net from "net";
import * as os from "os";
import path from "path";
import crypto from "crypto";
import { AgentEventSchema } from "../shared/protocol";

import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { auth, db } from "./auth";
import { toNodeHandler } from "better-auth/node";

const app = express();
app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser(process.env.COOKIE_SECRET || "lali-secret"));

db.exec(`
  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    message TEXT NOT NULL,
    status TEXT NOT NULL
  )
`);

app.all("/api/auth/*", toNodeHandler(auth));

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

app.use(async (req, res, next) => {
  if (req.path === "/") return next();
  if (req.path === "/csrf-token") return next();
  if (req.path.startsWith("/api/auth")) return next();

  try {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) {
      return res.status(401).json({ error: "ERR_UNAUTH", message: "Authentication required" });
    }
    next();
  } catch (err) {
    return res.status(500).json({ error: "ERR_AUTH", message: "Auth check failed" });
  }
});

app.get("/csrf-token", (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
});

app.use(express.static(path.join(__dirname, "../web")));

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
  if (!message) return res.status(400).json({ error: "ERR_BAD_REQUEST", message: "Message required" });

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
