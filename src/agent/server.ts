import * as net from "net";
import * as os from "os";
import { PiSession } from "./pi";
import { AgentRequestSchema } from "../shared/protocol";

const SOCKET_PATH = os.platform() === "win32" ? "\\\\.\\pipe\\lali-agent" : "/tmp/lali-agent.sock";

const session = new PiSession();

const server = net.createServer((socket) => {
  let buffer = "";

  socket.on("data", async (data) => {
    buffer += data.toString();
    const parts = buffer.split("\n");
    buffer = parts.pop() || "";

    for (const msg of parts) {
      if (!msg.trim()) continue;

      try {
        const parsed = JSON.parse(msg);
        const reqResult = AgentRequestSchema.safeParse(parsed);
        
        if (!reqResult.success) {
          console.error("Protocol error:", reqResult.error);
          const reqId = parsed.requestId || "unknown";
          socket.write(JSON.stringify({ type: "error", error: "Incompatible protocol version or invalid format", requestId: reqId }) + "\n");
          continue;
        }
        
        const req = reqResult.data;

        const textListener = (text: string) => {
          socket.write(JSON.stringify({ type: "text", text, requestId: req.requestId }) + "\n");
        };
        const lifecycleListener = (event: string) => {
          socket.write(JSON.stringify({ type: "lifecycle", event, requestId: req.requestId }) + "\n");
        };

        session.on("text", textListener);
        session.on("lifecycle", lifecycleListener);

        try {
          const finalResponse = await session.sendMessage(req.message);
          socket.write(JSON.stringify({ type: "done", finalResponse, requestId: req.requestId }) + "\n");
        } catch (e) {
          socket.write(JSON.stringify({ type: "error", error: String(e), requestId: req.requestId }) + "\n");
        } finally {
          session.off("text", textListener);
          session.off("lifecycle", lifecycleListener);
        }
      } catch (e) {
        console.error("Invalid message format received", e, msg);
      }
    }
  });
  
  socket.on("error", (err) => {
    console.error("Socket error", err);
  });
});

server.listen(SOCKET_PATH, () => {
  if (os.platform() !== "win32") {
    try {
      // Allow user (lali) and group (lali) read/write
      const fs = require("fs");
      fs.chmodSync(SOCKET_PATH, 0o660);
    } catch (e) {
      console.warn("Could not set socket permissions:", e);
    }
  }
  console.log(`Agent listening on ${SOCKET_PATH}`);
});

process.on("SIGINT", () => {
  server.close();
  process.exit(0);
});
