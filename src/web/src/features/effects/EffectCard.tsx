import { useState } from "react";
import { Check, ChevronDown, ShieldAlert, X } from "lucide-react";
import type { Effect } from "../chat/use-chat-session";
import { approveEffect, rejectEffect } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/ui/Collapsible";
import { cn } from "../../lib/cn";

type EffectStatus = NonNullable<Effect["status"]>;

const statusStyles: Record<EffectStatus, string> = {
  pending: "bg-amber2 text-amber11", approved: "bg-jade2 text-jade11", running: "bg-jade2 text-jade11", executed: "bg-jade2 text-jade11", failed: "bg-red2 text-red11", rejected: "bg-slate4 text-slate11", expired: "bg-slate4 text-slate11", interrupted: "bg-slate4 text-slate11", unknown: "bg-slate4 text-slate11",
};

export function EffectCard({ effect }: { effect: Effect }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const status = effect.status ?? "pending";
  const run = async (action: "approve" | "reject") => { setLoading(true); try { if (action === "approve") await approveEffect(effect.id, effect.digest ?? ""); else await rejectEffect(effect.id); } finally { setLoading(false); } };
  return <section className="rounded-xl border border-slate4 bg-slate2 px-4 py-4 shadow-2"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate10"><ShieldAlert size={15} />{effect.type?.replaceAll("_", " ") || "Effect"}</div><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", statusStyles[status])}>{status}</span></div><div className="mt-2 text-sm text-slate11">{effect.summary || "Review this requested action."}</div>{status === "pending" && <div className="mt-4 flex gap-2"><Button size="small" variant="primary" disabled={loading} onClick={() => void run("approve")}><Check size={15} />Approve</Button><Button size="small" variant="ghost" disabled={loading} onClick={() => void run("reject")}><X size={15} />Reject</Button></div>}<Collapsible open={open} onOpenChange={setOpen}><CollapsibleTrigger className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate10 hover:text-slate12"><ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />Details</CollapsibleTrigger><CollapsibleContent className="mt-3 space-y-3 text-xs"><div><div className="mb-1 uppercase tracking-wide text-slate9">Payload</div><pre className="overflow-auto rounded-md bg-slate1 p-3 text-slate11">{typeof effect.payload === "string" ? effect.payload : JSON.stringify(effect.payload ?? effect.data ?? null, null, 2)}</pre></div>{effect.digest && <div><div className="mb-1 uppercase tracking-wide text-slate9">Digest</div><code className="break-all text-slate10">{effect.digest}</code></div>}</CollapsibleContent></Collapsible></section>;
}
