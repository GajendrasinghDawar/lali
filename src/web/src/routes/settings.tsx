
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div style={{ padding: "2rem", maxWidth: "var(--content-width)", margin: "0 auto" }}>
      <h1>Settings</h1>
      <p style={{ color: "var(--color-text-muted)" }}>Appearance and account settings will go here.</p>
    </div>
  );
}
