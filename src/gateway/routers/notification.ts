import { Router } from "express";
import { QueueManager } from "../queue.ts";
import { NotificationManager } from "../notifications.ts";

export const NotificationRouter = Router();

NotificationRouter.get("/", (req, res) => {
  try {
    QueueManager.assertSessionOwner("main", res.locals.userId);
    const notifications = NotificationManager.list();
    res.json({ notifications });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }
});

NotificationRouter.post("/:id/read", (req, res) => {
  try {
    QueueManager.assertSessionOwner("main", res.locals.userId);
    NotificationManager.markRead(req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }
});
