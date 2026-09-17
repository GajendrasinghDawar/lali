import { Settings } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  return <main className="h-full overflow-y-auto p-4 sm:p-8"><div className="mx-auto max-w-3xl"><div className="mb-7 flex items-center gap-3"><div className="rounded-lg border border-slate5 bg-slate3 p-2 text-crimson10 shadow-1"><Settings size={20} /></div><div><h1 className="text-xl font-semibold text-slate12">Settings</h1><p className="text-sm text-slate10">Account and application preferences.</p></div></div><section className="rounded-lg border border-slate5 bg-slate3 p-5 shadow-2"><h2 className="text-sm font-semibold uppercase tracking-wider text-slate12">Appearance</h2><p className="mt-2 text-sm text-slate10">Lali follows its dark application theme. Additional preferences will appear here.</p></section></div></main>;
}
