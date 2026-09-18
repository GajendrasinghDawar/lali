# Codebase Design: Deepening the Gateway Queue

## The Problem: Shallow and Tangled `QueueManager`

Currently, `QueueManager` in `src/gateway/application/queue.ts` is a shallow module without a clear seam. 

### Why is it shallow?
1. **Large surface area:** It exposes internal state mechanics (`getNextSequence`, `appendEvent`, `processQueue`) alongside high-level commands (`submitRequest`, `interruptSession`).
2. **Creates dependencies:** It instantiates the DB connection globally and manages its own raw TCP socket (`getAgentSocket()`).
3. **Hard to test:** Because it relies on static methods creating side effects (writing to sockets, mutating the DB, emitting global events), it cannot be tested without a real database and a running agent process.
4. **Low Locality:** The caller (Express routes in `server.ts`) must manually call `QueueManager.assertSessionOwner` before calling `submitRequest`.

## Proposed Deep Module: `SessionOrchestrator`

We will introduce a clean **Seam** that decouples the HTTP transport (Express) from the business logic (queuing, durability, and Agent communication). 

### The New Interface

```typescript
export interface AgentTransport {
  send(command: AgentCommand): Promise<void>;
  onEvent(handler: (event: AgentEvent) => void): void;
}

export interface SessionStore {
  assertOwner(sessionId: string, userId: string): void;
  createRequest(sessionId: string, message: string, idempotencyKey?: string): Request;
  appendEvent(sessionId: string, requestId: string, type: string, data: unknown): TimelineEvent;
  // ...
}

export class SessionOrchestrator {
  constructor(
    private readonly store: SessionStore,
    private readonly agentTransport: AgentTransport,
    private readonly eventBus: EventEmitter
  ) {}

  // High-leverage, deep methods:
  
  /** Submits a user message, ensures durability, handles idempotency, and wakes the queue. */
  public submit(userId: string, sessionId: string, message: string, options?: SubmitOptions): Promise<Request>;
  
  /** Halts any running request and pauses the session. */
  public interrupt(userId: string, sessionId: string): Promise<void>;
  
  /** Retrieves the canonical event timeline for reconnecting clients. */
  public getTimelineSince(userId: string, sessionId: string, lastSequence: number): Promise<TimelineEvent[]>;
}
```

### Why is this better?
- **High Leverage:** The Express route handlers only need to call `orchestrator.submit(...)` and the orchestrator handles DB auth checks, idempotency, queuing, sending to the Agent, and broadcasting SSE events. 
- **Locality:** The rules for how a request flows from "queued" to "running" to "completed" are encapsulated entirely within the implementation.
- **Testability:** By providing a fake `AgentTransport` and an in-memory `SessionStore`, we can test the entire queue and interruption logic without a real database or TCP socket.

## Next Step

If you agree with this design, I will extract the adapter implementations (`SqliteSessionStore` and `TcpAgentTransport`) and refactor `queue.ts` into a testable `SessionOrchestrator`.
