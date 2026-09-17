import { fetchWithCsrf } from "../../lib/api";

export type AppNotification = {
  id: string;
  type: string;
  summary: string;
  status: "unread" | "read";
  created_at: string;
};

export async function fetchNotifications(): Promise<AppNotification[]> {
  const res = await fetchWithCsrf("/api/notifications");
  if (!res.ok) throw new Error("Failed to fetch notifications");
  const data = await res.json();
  return data.notifications;
}

export async function markNotificationRead(id: string): Promise<void> {
  const res = await fetchWithCsrf(`/api/notifications/${id}/read`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Failed to mark as read");
}
