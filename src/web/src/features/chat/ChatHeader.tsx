import { PanelLeft } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { Button } from "../../components/ui/Button";
import { useSidebar } from "../../components/ui/sidebar/SidebarProvider";

export function ChatHeader() {
  const { toggle } = useSidebar();
  const pathname = useRouterState({ select: state => state.location.pathname });
  const sessionId = pathname.startsWith("/chat/") ? decodeURIComponent(pathname.slice(6)) : null;
  const title = sessionId === "main" ? "Main session" : sessionId ?? (pathname.slice(1) || "Lali");

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate4/50 px-3 sm:px-5">
      <Button size="icon" variant="ghost" onClick={toggle} aria-label="Toggle sidebar"><PanelLeft size={18} /></Button>
      <div className="h-4 w-px bg-slate5" />
      <span className="truncate text-sm font-medium capitalize text-slate11">{title}</span>
    </header>
  );
}
