import { Router } from "express";
import { db } from "../auth.ts";
import { QueueManager } from "../queue.ts";
import { EffectManager } from "../effects.ts";

export const EffectRouter = Router();

EffectRouter.get("/pending", (req, res) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) return res.status(400).json({ error: "ERR_BAD_REQUEST" });
  
  try {
    QueueManager.assertSessionOwner(sessionId, res.locals.userId);
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    return res.status(403).json({ error: "ERR_UNAUTHORIZED", message });
  }

  const pending = db.prepare("SELECT * FROM effects WHERE sessionId = ? AND status = 'pending'").all(sessionId);
  res.json({ effects: pending });
});

EffectRouter.post("/:id/approve", async (req, res) => {
  const id = req.params.id as string;
  const digest = req.body.digest as string;
  try {
    const effect = db.prepare("SELECT sessionId FROM effects WHERE id = ?").get(id) as { sessionId: string } | undefined;
    if (!effect) return res.status(404).json({ error: "Not found" });
    QueueManager.assertSessionOwner(effect.sessionId, res.locals.userId);

    EffectManager.approve(id, digest);
    const result = await EffectManager.execute(id);
    
    // Submit the result as a new request back to the agent so it can resume
    QueueManager.submitRequest(result.sessionId, res.locals.userId, JSON.stringify({
      type: "effect_result",
      id,
      result: { success: result.success, data: result.data }
    }));
    
    res.json({ success: true, result });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

EffectRouter.post("/:id/reject", (req, res) => {
  const id = req.params.id as string;
  const digest = req.body.digest as string;
  try {
    const effect = db.prepare("SELECT sessionId, digest FROM effects WHERE id = ?").get(id) as { sessionId: string, digest: string } | undefined;
    if (!effect) return res.status(404).json({ error: "Not found" });
    if (effect.digest !== digest) return res.status(400).json({ error: "Digest mismatch" });
    QueueManager.assertSessionOwner(effect.sessionId, res.locals.userId);

    EffectManager.reject(id);
    
    QueueManager.submitRequest(effect.sessionId, res.locals.userId, JSON.stringify({
      type: "effect_result",
      id,
      result: { success: false, error: "Rejected by user" }
    }));
    
    res.json({ success: true });
  } catch (err) { const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});
