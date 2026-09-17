import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "../../lib/cn";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/ui/Collapsible";

export function ActivityItem({ activities, active }: { activities: string[]; active: boolean }) {
  const [open, setOpen] = useState(false);
  const latest = activities.at(-1) ?? "Thinking...";
  return <Collapsible open={open} onOpenChange={setOpen} className="mb-3"><CollapsibleTrigger className="flex items-center gap-2 rounded text-sm font-medium text-slate10 hover:text-slate12"><Sparkles size={14} className="text-jade10" /><span className={cn(active && "bg-gradient-to-r from-slate10 via-slate12 to-slate10 bg-[length:200%_auto] bg-clip-text text-transparent animate-[shimmer_2s_linear_infinite]")}>{active ? latest : `Activity (${activities.length})`}</span><ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} /></CollapsibleTrigger><CollapsibleContent className="ml-2 mt-2 space-y-1 border-l border-slate5 pl-5 text-xs text-slate9">{activities.map((activity, index) => <div key={`${index}-${activity}`}>{activity}</div>)}</CollapsibleContent></Collapsible>;
}
