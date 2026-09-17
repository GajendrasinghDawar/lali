
import { Outlet } from "@tanstack/react-router";
import { SessionSidebar } from "../features/sessions/SessionSidebar";
import { SidebarProvider } from "../components/ui/sidebar/SidebarProvider";
import { ChatHeader } from "../features/chat/ChatHeader";

export function AppShell() {
  return (
    <SidebarProvider>
      <div className="flex h-svh w-screen overflow-hidden bg-slate2">
        <SessionSidebar />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <ChatHeader />
          <main className="min-h-0 flex-1"><Outlet /></main>
        </div>
      </div>
    </SidebarProvider>
  );
}
