import express from "express";
import Database from "better-sqlite3";
import * as net from "net";
import * as os from "os";
import path from "path";
import crypto from "crypto";
import { AgentEventSchema } from "../shared/protocol";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../web")));

// Database setup
const db = new Database("gateway.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    message TEXT NOT NULL,
    status TEXT NOT NULL
  )
`);

const SOCKET_PATH = os.platform() === "win32" ? "\\\\.\\pipe\\lali-agent" : "/tmp/lali-agent.sock";

// Maintain a single persistent connection to the agent
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

app.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });

  const requestId = crypto.randomUUID();

  // Commit to temporary SQLite state before streaming
  const stmt = db.prepare("INSERT INTO requests (id, message, status) VALUES (?, ?, ?)");
  stmt.run(requestId, message, "accepted");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const socket = await getAgentSocket();
    
    // Relay events from agent to web client
    responseEmitters.set(requestId, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      
      if (event.type === "done" || event.type === "error") {
        const updateStmt = db.prepare("UPDATE requests SET status = ? WHERE id = ?");
        updateStmt.run(event.type === "done" ? "completed" : "failed", requestId);
        responseEmitters.delete(requestId);
        res.end();
      }
    });

    // Send to agent
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
