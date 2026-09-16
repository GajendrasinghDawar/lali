import { useState, useEffect, useRef } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { AppNotification, fetchNotifications, markNotificationRead } from "../features/notifications/notification-api";
import { Bell, Check } from "lucide-react";

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div style={{ padding: "2rem" }}>Loading notifications...</div>;

  return (
    <div style={{ padding: "2rem", maxWidth: "var(--content-width)", margin: "0 auto" }}>
      <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "2rem" }}>
        <Bell /> Notifications
      </h1>

      {notifications.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No notifications.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {notifications.map(n => (
            <div key={n.id} style={{
              padding: "1rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--color-border)",
              background: n.is_read ? "transparent" : "var(--color-surface-muted)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start"
            }}>
              <div>
                <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem" }}>{n.title}</h3>
                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", color: "var(--color-text-muted)" }}>{n.body}</p>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
              {!n.is_read && (
                <button 
                  onClick={() => handleRead(n.id)}
                  style={{
                    background: "transparent", border: "1px solid var(--color-border)",
                    padding: "0.4rem", borderRadius: "0.25rem", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "0.25rem"
                  }}
                  title="Mark as read"
                >
                  <Check size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
