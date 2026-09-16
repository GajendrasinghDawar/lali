import { useState, useEffect, useRef } from "react";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { EmailItem, fetchEmails, checkEmails, openEmail } from "../features/mail/mail-api";
import { Mail, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/mail")({
  component: MailPage,
});

function MailPage() {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const data = await fetchEmails();
      setEmails(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCheck = async () => {
    setChecking(true);
    try {
      await checkEmails();
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setChecking(false);
    }
  };

  const handleOpen = async (id: string, existingSessionId: string | null) => {
    if (existingSessionId) {
      navigate({ to: "/chat/$sessionId", params: { sessionId: existingSessionId } });
      return;
    }
    
    try {
      const sessionId = await openEmail(id);
      navigate({ to: "/chat/$sessionId", params: { sessionId } });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div style={{ padding: "2rem" }}>Loading mail...</div>;

  return (
    <div style={{ padding: "2rem", maxWidth: "var(--content-width)", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
          <Mail /> Mail
        </h1>
        <button 
          onClick={handleCheck} 
          disabled={checking}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem",
            background: "var(--color-surface)", border: "1px solid var(--color-border)",
            borderRadius: "0.25rem", cursor: "pointer"
          }}
        >
          <RefreshCw size={16} className={checking ? "animate-spin" : ""} /> Check Mail
        </button>
      </div>

      {emails.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No emails.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {emails.map(e => (
            <div key={e.id} style={{
              padding: "1rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface-muted)",
              cursor: "pointer"
            }} onClick={() => handleOpen(e.id, e.session_id)}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <strong>{e.sender}</strong>
                <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                  {new Date(e.received_at).toLocaleString()}
                </span>
              </div>
              <div style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>{e.subject}</div>
              {e.session_id && (
                <span style={{ fontSize: "0.75rem", background: "var(--color-accent)", color: "white", padding: "0.2rem 0.5rem", borderRadius: "1rem" }}>
                  Active Thread
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
