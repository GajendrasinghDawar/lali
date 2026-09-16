import { Router } from "express";
import path from "path";
import { db } from "../auth.ts";
import { QueueManager } from "../queue.ts";

export const SessionRouter = Router();

function getWorkspaces(): Record<string, string> {
  const workspaces: Record<string, string> = {};
  const envWorkspaces = process.env.LALI_WORKSPACES || "";
  for (const entry of envWorkspaces.split(",")) {
    const [name, wsPath] = entry.split("=");
    if (name && wsPath) {
      workspaces[name.trim()] = path.resolve(wsPath.trim());
    }
  }
  return workspaces;
}

SessionRouter.get("/", (req, res) => {
  const sessions = db.prepare("SELECT * FROM session_state WHERE userId = ? OR userId = 'owner' ORDER BY type ASC, sessionId ASC").all(res.locals.userId);
  res.json({ sessions });
});

SessionRouter.post("/", (req, res) => {
  const { sessionId, title, workspaceName, subPath } = req.body;
  if (!sessionId || !workspaceName) return res.status(400).json({ error: "sessionId and workspaceName required" });
  
  const workspaces = getWorkspaces();
  const root = workspaces[workspaceName];
  if (!root) return res.status(400).json({ error: "Invalid workspace name" });
  
  let targetPath = root;
  if (subPath) {
    targetPath = path.resolve(root, subPath);
    if (!targetPath.startsWith(root)) {
      return res.status(400).json({ error: "Path traversal detected" });
    }
  }

  try {
    db.prepare(`INSERT INTO session_state (sessionId, userId, type, title, workspaceName, workspacePath) VALUES (?, ?, 'project', ?, ?, ?)`).run(sessionId, res.locals.userId, title || sessionId, workspaceName, targetPath);
    res.json({ success: true, sessionId });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

SessionRouter.put("/:id/archive", (req, res) => {
  const sessionId = req.params.id as string;
  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
    db.prepare(`UPDATE session_state SET status = 'archived' WHERE sessionId = ? AND type != 'main'`).run(sessionId);
    res.json({ success: true });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: message });
  }
});

SessionRouter.put("/:id/restore", (req, res) => {
  const sessionId = req.params.id as string;
  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
    db.prepare(`UPDATE session_state SET status = 'active' WHERE sessionId = ?`).run(sessionId);
    res.json({ success: true });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: message });
  }
});

SessionRouter.post("/:id/reset", async (req, res) => {
  const sessionId = req.params.id as string;
  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
    await QueueManager.resetSession(sessionId);
    res.json({ success: true });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: message });
  }
});

SessionRouter.delete("/:id", async (req, res) => {
  const sessionId = req.params.id as string;
  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
    if (sessionId === "main") return res.status(400).json({ error: "Cannot delete main session" });
    await QueueManager.deleteSession(sessionId);
    res.json({ success: true });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(403).json({ error: message });
  }
});
