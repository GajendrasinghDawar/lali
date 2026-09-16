import { EventEmitter } from "events";
import { TcpAgentTransport } from "./AgentTransport.ts";
import { SqliteSessionStore } from "./SessionStore.ts";
import { SessionOrchestrator } from "./SessionOrchestrator.ts";
import { effectEvents } from "./effects.ts";

export const queueEvents = new EventEmitter();
export const sseEmitters = new Map<string, Set<(event: any) => void>>();

export const store = new SqliteSessionStore();
export const transport = new TcpAgentTransport();

export const QueueManager = new SessionOrchestrator(
  store,
  transport,
  queueEvents,
  sseEmitters
);

// Effect loopback
effectEvents.on("status_changed", ({ sessionId, requestId, id, status }) => {
  const eventObj = store.appendEvent(sessionId, requestId, "effect_status", { id, status });
  const emitters = sseEmitters.get(sessionId);
  if (emitters) {
    for (const emitter of emitters) {
      emitter(eventObj);
    }
  }
});
