import { useState, useEffect, useRef } from "react";

import { approveEffect, rejectEffect } from "../../lib/api";
import { Check, X, ShieldAlert } from "lucide-react";

export function EffectCard({ effect }: { effect: any }) {
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await approveEffect(effect.id, effect.digest || "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await rejectEffect(effect.id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    pending: "var(--color-warning)",
    approved: "var(--color-accent)",
    rejected: "var(--color-danger)",
    executed: "var(--color-accent)",
    failed: "var(--color-danger)",
  } as Record<string, string>;

  return (
    <div style={{
      border: "1px solid var(--color-border)",
      borderRadius: "0.5rem",
      padding: "1rem",
      margin: "1rem 0",
      background: "var(--color-surface)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <ShieldAlert size={18} style={{ color: statusColors[effect.status] || "var(--color-text)" }} />
        <strong style={{ fontSize: "0.95rem" }}>{effect.summary || effect.type || "Action Required"}</strong>
        <span style={{ 
          fontSize: "0.75rem", padding: "0.15rem 0.4rem", borderRadius: "1rem",
          background: "var(--color-surface-muted)", color: statusColors[effect.status] || "inherit"
        }}>
          {effect.status}
        </span>
      </div>

      <pre style={{ 
        background: "var(--color-surface-muted)", padding: "0.5rem", borderRadius: "0.25rem",
        fontSize: "0.85rem", overflowX: "auto", margin: "0.5rem 0"
      }}>
        {effect.digest || JSON.stringify(effect.data, null, 2)}
      </pre>

      {effect.status === "pending" && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button 
            onClick={handleApprove} 
            disabled={loading}
            style={{ 
              display: "flex", alignItems: "center", gap: "0.25rem",
              background: "var(--color-accent)", color: "white", padding: "0.4rem 0.8rem",
              border: "none", borderRadius: "0.25rem", cursor: "pointer", fontSize: "0.85rem"
            }}
          >
            <Check size={16} /> Approve
          </button>
          <button 
            onClick={handleReject} 
            disabled={loading}
            style={{ 
              display: "flex", alignItems: "center", gap: "0.25rem",
              background: "transparent", color: "var(--color-text)", padding: "0.4rem 0.8rem",
              border: "1px solid var(--color-border)", borderRadius: "0.25rem", cursor: "pointer", fontSize: "0.85rem"
            }}
          >
            <X size={16} /> Reject
          </button>
        </div>
      )}
    </div>
  );
}
