import express, { Router } from "express";
import crypto from "crypto";
import path from "path";
import { QueueManager } from "../queue.ts";
import { ArtifactManager } from "../artifacts.ts";
import { ScheduledJobsManager } from "../scheduled_jobs.ts";

export const MiscRouter = Router();

MiscRouter.post("/artifacts", express.raw({ limit: '20mb', type: 'application/octet-stream' }), (req, res) => {
  const sessionId = req.headers["x-session-id"] as string;
  const fileName = req.headers["x-file-name"] as string;
  const mimeType = req.headers["content-type"] as string || "application/octet-stream";
  
  if (!sessionId || !fileName) return res.status(400).json({ error: "Missing headers" });
  
  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
    const id = ArtifactManager.store(sessionId, fileName, mimeType, req.body as Buffer);
    res.json({ id });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

MiscRouter.post("/jobs", (req, res) => {
  try {
    QueueManager.assertSessionOwner("main", res.locals.userId);
    const id = ScheduledJobsManager.create(req.body.summary, req.body.intervalMs);
    res.json({ id });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }
});

MiscRouter.post("/workspaces/clone", async (req, res) => {
  const { sourcePath, name } = req.body;
  if (!sourcePath || !name) return res.status(400).json({ error: "Missing parameters" });
  try {
    QueueManager.assertSessionOwner("main", res.locals.userId);
    const destPath = path.resolve(path.dirname(sourcePath), name);
    // In a real implementation this would clone the git repo or copy the dir.
    // For now it's just a placeholder for the agent skill.
    res.json({ success: true, path: destPath });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});
