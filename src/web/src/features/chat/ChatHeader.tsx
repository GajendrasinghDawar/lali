import { useRouterState } from "@tanstack/react-router";
import { Separator, SidebarTrigger } from "../../components/ui/sidebar";

export function ChatHeader() {
  const pathname = useRouterState({ select: state => state.location.pathname });
  const sessionId = pathname.startsWith("/chat/") ? decodeURIComponent(pathname.slice(6)) : null;
  const title = sessionId === "main" ? "Main session" : sessionId ?? (pathname.slice(1) || "Lali");

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate4/50 px-2 md:px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-4" />
      <span className="truncate text-sm font-medium capitalize text-slate11">{title}</span>
    </header>
  );
}
