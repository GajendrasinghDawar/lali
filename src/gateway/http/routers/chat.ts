import { Router } from "express";
import { QueueManager, sseEmitters } from "../../application/queue.ts";

export const ChatRouter = Router();

ChatRouter.post("/", (req, res) => {
  const { message, sessionId, idempotencyKey, attachmentIds } = req.body;
  
  if (!message || !sessionId) {
    return res.status(400).json({ error: "ERR_BAD_REQUEST" });
  }

  try {
    const request = QueueManager.submitRequest(sessionId, res.locals.userId, message, idempotencyKey, "web", attachmentIds);
    res.status(202).json({ requestId: request.id, status: request.status });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }
});

ChatRouter.post("/interrupt", (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "ERR_BAD_REQUEST" });
  
  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
    QueueManager.interruptSession(sessionId);
    res.json({ success: true });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }
});

ChatRouter.post("/resume", (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "ERR_BAD_REQUEST" });
  
  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
    QueueManager.resumeSession(sessionId);
    res.json({ success: true });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }
});

ChatRouter.post("/clear", (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "ERR_BAD_REQUEST" });
  
  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
    QueueManager.clearSession(sessionId);
    res.json({ success: true });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }
});

ChatRouter.get("/events", (req, res) => {
  const sessionId = req.query.sessionId as string;
  const afterStr = req.query.after as string;
  if (!sessionId) return res.status(400).json({ error: "ERR_BAD_REQUEST" });
  
  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    return res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }

  const after = afterStr ? parseInt(afterStr, 10) : 0;
  const pastEvents = QueueManager.getEventsAfter(sessionId, after);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  for (const ev of pastEvents) {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  }

  const onEvent = (event: unknown) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  let emitters = sseEmitters.get(sessionId);
  if (!emitters) {
    emitters = new Set();
    sseEmitters.set(sessionId, emitters);
  }
  emitters.add(onEvent);

  req.on("close", () => {
    emitters.delete(onEvent);
    if (emitters.size === 0) {
      sseEmitters.delete(sessionId);
    }
  });
});
