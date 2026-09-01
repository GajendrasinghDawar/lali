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
        const req = AgentRequestSchema.parse(JSON.parse(msg));

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
  console.log(`Agent listening on ${SOCKET_PATH}`);
});

process.on("SIGINT", () => {
  server.close();
  process.exit(0);
});
