import * as net from "net";
import * as os from "os";
import { AgentEvent, AgentEventSchema } from "../shared/protocol.ts";

export interface AgentTransport {
  sendCommand(command: any): Promise<void>;
  onEvent(requestId: string, handler: (event: AgentEvent) => void): void;
  offEvent(requestId: string): void;
  onGlobalError(handler: (err: Error) => void): void;
}

export class TcpAgentTransport implements AgentTransport {
  private socketPath: string;
  private agentSocket: net.Socket | null = null;
  private responseEmitters = new Map<string, (event: AgentEvent) => void>();
  private globalErrorHandlers: ((err: Error) => void)[] = [];

  constructor(socketPath?: string) {
    this.socketPath = socketPath || (os.platform() === "win32" ? "\\\\.\\pipe\\lali-agent" : "/tmp/lali-agent.sock");
  }

  private getSocket(): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      if (this.agentSocket && !this.agentSocket.destroyed) {
        return resolve(this.agentSocket);
      }

      const socket = net.createConnection(this.socketPath);
      let buffer = "";

      socket.on("connect", () => {
        this.agentSocket = socket;
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
            if (event.requestId) {
              const emitter = this.responseEmitters.get(event.requestId);
              if (emitter) emitter(event);
            }
          } catch (e) {
            console.error("Failed to parse agent event:", e);
          }
        }
      });

      socket.on("error", (err) => {
        console.error("Agent socket error:", err);
        this.agentSocket = null;
        for (const handler of this.globalErrorHandlers) {
          handler(err);
        }
        reject(err);
      });

      socket.on("close", () => {
        this.agentSocket = null;
      });
    });
  }

  async sendCommand(command: any): Promise<void> {
    const socket = await this.getSocket();
    socket.write(JSON.stringify(command) + "\n");
  }

  onEvent(requestId: string, handler: (event: AgentEvent) => void): void {
    this.responseEmitters.set(requestId, handler);
  }

  offEvent(requestId: string): void {
    this.responseEmitters.delete(requestId);
  }

  onGlobalError(handler: (err: Error) => void): void {
    this.globalErrorHandlers.push(handler);
  }
}
