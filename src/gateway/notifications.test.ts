import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./auth.ts";
import { NotificationManager } from "./notifications.ts";

describe("Notifications", () => {
  beforeEach(() => {
    db.exec("DELETE FROM notifications");
  });

  it("creates a durable notification", () => {
    const id = NotificationManager.create({
      type: "interrupted",
      summary: "Run was interrupted by user",
      context: { sessionId: "session-1" },
    });

    const notif = db.prepare("SELECT * FROM notifications WHERE id = ?").get(id) as any;
    expect(notif.type).toBe("interrupted");
    expect(notif.summary).toBe("Run was interrupted by user");
    expect(notif.status).toBe("unread");
    expect(notif.telegramStatus).toBe("pending");
  });

  it("marks a notification as read", () => {
    const id = NotificationManager.create({
      type: "failure",
      summary: "Delivery failed",
    });

    NotificationManager.markRead(id);
    const notif = db.prepare("SELECT status FROM notifications WHERE id = ?").get(id) as any;
    expect(notif.status).toBe("read");
  });

  it("updates telegram delivery status independently", () => {
    const id = NotificationManager.create({
      type: "approval",
      summary: "Effect proposed",
    });

    NotificationManager.updateTelegramStatus(id, "sent");
    const notif = db.prepare("SELECT status, telegramStatus FROM notifications WHERE id = ?").get(id) as any;
    expect(notif.status).toBe("unread"); // Unchanged
    expect(notif.telegramStatus).toBe("sent");
  });
  
  it("retrieves notifications", () => {
    NotificationManager.create({ type: "t1", summary: "s1" });
    NotificationManager.create({ type: "t2", summary: "s2" });
    
    const list = NotificationManager.list();
    expect(list.length).toBe(2);
    // ordered by created_at DESC
  });
});
