
import { Outlet } from "@tanstack/react-router";
import { SessionSidebar } from "../features/sessions/SessionSidebar";

export function AppShell() {
  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden" }}>
      <SessionSidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
        <Outlet />
      </div>
    </div>
  );
}
