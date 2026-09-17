import { useEffect, useState } from "react";
import { Mail, RefreshCw } from "lucide-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "../components/ui/Button";
import { fetchEmails, checkEmails, openEmail, type EmailItem } from "../features/mail/mail-api";

export const Route = createFileRoute("/mail")({ component: MailPage });

function MailPage() {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const load = async () => { try { setError(null); setEmails(await fetchEmails()); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load mail"); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const handleCheck = async () => { setChecking(true); try { await checkEmails(); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to check mail"); } finally { setChecking(false); } };
  const handleOpen = async (email: EmailItem) => { try { const sessionId = email.session_id ?? await openEmail(email.id); await navigate({ to: "/chat/$sessionId", params: { sessionId } }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to open email"); } };
  return <main className="h-full overflow-y-auto p-4 sm:p-8"><div className="mx-auto max-w-3xl"><header className="mb-7 flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="rounded-lg border border-slate5 bg-slate3 p-2 text-amber10 shadow-1"><Mail size={20} /></div><div><h1 className="text-xl font-semibold text-slate12">Mail</h1><p className="text-sm text-slate10">Messages connected to Lali.</p></div></div><Button size="small" onClick={() => void handleCheck()} disabled={checking}><RefreshCw size={15} className={checking ? "animate-spin" : ""} />Check mail</Button></header>{error && <p role="alert" className="mb-4 rounded-md border border-red7 bg-red3 p-3 text-sm text-red11">{error}</p>}{loading ? <p className="text-sm text-slate10">Loading mail...</p> : emails.length === 0 ? <div className="rounded-lg border border-dashed border-slate6 p-8 text-center text-sm text-slate10">No emails.</div> : <div className="divide-y divide-slate5 overflow-hidden rounded-lg border border-slate5 bg-slate3 shadow-2">{emails.map(email => <button key={email.id} type="button" onClick={() => void handleOpen(email)} className="block w-full px-4 py-4 text-left transition-colors hover:bg-slate4"><div className="flex items-start justify-between gap-4"><strong className="truncate text-sm text-slate12">{email.sender}</strong><time className="shrink-0 text-xs text-slate9">{new Date(email.received_at).toLocaleString()}</time></div><div className="mt-1 text-sm text-slate11">{email.subject}</div>{email.session_id && <span className="mt-2 inline-block rounded-full bg-jade3 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-jade11">Active thread</span>}</button>)}</div>}</div></main>;
}
