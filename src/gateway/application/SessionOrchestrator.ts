import crypto from "crypto";
import { EventEmitter } from "events";
import type { AgentTransport } from "../transport/AgentTransport.ts";
import type { SessionStore } from "../persistence/SessionStore.ts";
import { PROTOCOL_VERSION } from "../../shared/protocol.ts";
import { EffectManager } from "./effects.ts";

export class SessionOrchestrator {
  private readonly store: SessionStore;
  private readonly agentTransport: AgentTransport;
  private readonly queueEvents: EventEmitter;
  private readonly sseEmitters: Map<string, Set<(event: unknown) => void>>;

  constructor(
    store: SessionStore,
    agentTransport: AgentTransport,
    queueEvents: EventEmitter,
    sseEmitters: Map<string, Set<(event: unknown) => void>>
  ) {
    this.store = store;
    this.agentTransport = agentTransport;
    this.queueEvents = queueEvents;
    this.sseEmitters = sseEmitters;

    this.agentTransport.onGlobalError(() => {
      this.store.markAllRunningAsInterrupted();
    });
  }

  private broadcastSse(sessionId: string, eventObj: unknown) {
    const emitters = this.sseEmitters.get(sessionId);
    if (emitters) {
      for (const emitter of emitters) {
        emitter(eventObj);
      }
    }
  }

  public assertSessionOwner(sessionId: string, userId: string) {
    this.store.assertOwner(sessionId, userId);
  }

  public getEventsAfter(sessionId: string, sequence: number) {
    return this.store.getEventsAfter(sessionId, sequence);
  }

  public submitRequest(sessionId: string, userId: string, message: string, idempotencyKey?: string, replyChannel: string = "web", attachmentIds?: string[]) {
    this.store.assertOwner(sessionId, userId);
    
    const req = this.store.createRequest(sessionId, message, idempotencyKey, replyChannel);
    if (req.status === "queued" || req.status === "paused_for_confirmation") {
      const eventObj = this.store.appendEvent(sessionId, req.id, "user_message", { message, attachmentIds });
      this.broadcastSse(sessionId, eventObj);
    }
    
    setTimeout(() => this.processQueue(sessionId), 0);
    return req;
  }

  public interruptSession(sessionId: string) {
    this.store.interruptSession(sessionId);
    const eventObj = this.store.appendEvent(sessionId, "system", "interrupted", { message: "Run interrupted" });
    this.broadcastSse(sessionId, eventObj);
    this.queueEvents.emit("interrupted", { sessionId });
  }

  public resumeSession(sessionId: string) {
    this.store.resumeSession(sessionId);
    setTimeout(() => this.processQueue(sessionId), 0);
  }

  public clearSession(sessionId: string) {
    this.store.clearSession(sessionId);
  }

  public async resetSession(sessionId: string) {
    this.clearSession(sessionId);
    try {
      await this.agentTransport.sendCommand({ version: PROTOCOL_VERSION, requestId: crypto.randomUUID(), sessionId, command: "reset", message: "" });
    } catch (e) {
      console.error("Failed to send reset to agent", e);
    }
  }

  public async deleteSession(sessionId: string) {
    this.interruptSession(sessionId);
    this.store.deleteSession(sessionId);
    try {
      await this.agentTransport.sendCommand({ version: PROTOCOL_VERSION, requestId: crypto.randomUUID(), sessionId, command: "delete", message: "" });
    } catch (e) {
      console.error("Failed to send delete to agent", e);
    }
  }

  public async processQueue(sessionId: string) {
    if (this.store.isPaused(sessionId)) return;
    if (this.store.hasRunningRequests(sessionId)) return;

    const next = this.store.getNextQueuedRequest(sessionId);
    if (!next) return;

    this.store.updateRequestStatus(next.id, "running");

    try {
      this.agentTransport.onEvent(next.id, (event) => {
        const reqStatus = this.store.getRequest(next.id);
        if (reqStatus?.status === 'interrupted') {
          this.agentTransport.offEvent(next.id);
          return;
        }

        if (event.type === "done" || event.type === "error") {
          const finalState = event.type === "done" ? "completed" : "failed";
          const msg = event.type === "done" ? event.finalResponse : event.error;
          this.store.updateRequestStatus(next.id, finalState, msg);
          this.agentTransport.offEvent(next.id);
          
          const eventObj = this.store.appendEvent(sessionId, next.id, event.type, event.type === "done" ? { finalResponse: msg } : { error: msg });
          this.broadcastSse(sessionId, eventObj);

          if (event.type === "done") {
            const req = this.store.getRequest(next.id);
            if (req) {
              // mark pending delivery? QueueManager does it manually inline.
              this.queueEvents.emit("request_completed", { id: next.id, replyChannel: req.replyChannel, finalResponse: msg });
            }
          } else if (event.type === "error") {
            this.queueEvents.emit("agent_error", { sessionId, requestId: next.id, error: msg });
          }

          setTimeout(() => this.processQueue(sessionId), 0);
        } else if (event.type === "propose_effect") {
          this.store.updateRequestStatus(next.id, "completed");
          this.agentTransport.offEvent(next.id);
          const effect = EffectManager.propose(sessionId, next.id, event.summary, event.payload);
          
          const eventObj = this.store.appendEvent(sessionId, next.id, "propose_effect", { effect });
          this.broadcastSse(sessionId, eventObj);
          
          this.queueEvents.emit("effect_proposed", { sessionId, requestId: next.id, effect, summary: event.summary });
          setTimeout(() => this.processQueue(sessionId), 0);
        } else if (event.type === "text" || event.type === "lifecycle") {
          const data = event.type === "text" ? { text: event.text } : { event: event.event };
          const eventObj = this.store.appendEvent(sessionId, next.id, event.type, data);
          this.broadcastSse(sessionId, eventObj);
        }
      });

      const workspacePath = this.store.getWorkspacePath(sessionId);
      const artifacts = this.store.getArtifacts(next.attachmentIds);

      await this.agentTransport.sendCommand({ 
        version: PROTOCOL_VERSION, 
        requestId: next.id, 
        sessionId, 
        workspacePath, 
        message: next.message, 
        artifacts 
      });

    } catch (err) {
      this.store.updateRequestStatus(next.id, "failed");
      const eventObj = this.store.appendEvent(sessionId, next.id, "error", { error: "Agent connection failed" });
      this.broadcastSse(sessionId, eventObj);
      this.queueEvents.emit("agent_error", { sessionId, requestId: next.id, error: "Agent connection failed" });
      setTimeout(() => this.processQueue(sessionId), 0);
    }
  }
}
