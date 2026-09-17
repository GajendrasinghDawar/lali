import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "../components/ui/Button";
import { fetchNotifications, markNotificationRead, type AppNotification } from "../features/notifications/notification-api";

export const Route = createFileRoute("/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => { try { setError(null); setNotifications(await fetchNotifications()); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load notifications"); } finally { setLoading(false); } };
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 15000); return () => clearInterval(timer); }, []);
  const handleRead = async (id: string) => { try { await markNotificationRead(id); setNotifications(current => current.map(notification => notification.id === id ? { ...notification, status: "read" } : notification)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update notification"); } };
  return <main className="h-full overflow-y-auto p-4 sm:p-8"><div className="mx-auto max-w-3xl"><header className="mb-7 flex items-center gap-3"><div className="rounded-lg border border-slate5 bg-slate3 p-2 text-crimson10 shadow-1"><Bell size={20} /></div><div><h1 className="text-xl font-semibold text-slate12">Notifications</h1><p className="text-sm text-slate10">Recent assistant activity.</p></div></header>{error && <p role="alert" className="mb-4 rounded-md border border-red7 bg-red3 p-3 text-sm text-red11">{error}</p>}{loading ? <p className="text-sm text-slate10">Loading notifications...</p> : notifications.length === 0 ? <div className="rounded-lg border border-dashed border-slate6 p-8 text-center text-sm text-slate10">No notifications.</div> : <div className="space-y-3">{notifications.map(notification => <article key={notification.id} className={`flex items-start gap-4 rounded-lg border p-4 shadow-1 ${notification.status === "read" ? "border-slate4 bg-slate2" : "border-slate6 bg-slate3"}`}><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold capitalize text-slate12">{notification.type.replaceAll("_", " ")}</h2><p className="mt-1 text-sm text-slate10">{notification.summary}</p><time className="mt-2 block text-xs text-slate9">{new Date(notification.created_at).toLocaleString()}</time></div>{notification.status !== "read" && <Button size="icon" variant="ghost" onClick={() => void handleRead(notification.id)} aria-label="Mark as read"><Check size={16} /></Button>}</article>)}</div>}</div></main>;
}
