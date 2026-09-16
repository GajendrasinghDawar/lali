import React, { useState, Suspense } from "react";
const MarkdownText = React.lazy(() => import('./MarkdownText').then(module => ({ default: module.MarkdownText })));
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { EffectCard } from "../effects/EffectCard";

export function AssistantMessage({ content, activities, effects, isComplete }: { content: string, activities?: string[], effects?: any[], isComplete?: boolean }) {
  const [activitiesExpanded, setActivitiesExpanded] = useState(false);
  const hasActivities = activities && activities.length > 0;
  const hasEffects = effects && effects.length > 0;
  
  return (
    <div style={{ width: "100%", maxWidth: "var(--content-width)", margin: "0 auto", padding: "1rem 0" }}>
      {hasActivities && (
        <div style={{ marginBottom: "0.5rem" }}>
          <button 
            onClick={() => setActivitiesExpanded(!activitiesExpanded)}
            style={{ 
              display: "flex", alignItems: "center", gap: "0.5rem", 
              background: "transparent", border: "none", cursor: "pointer", 
              color: "var(--color-text-muted)", fontSize: "0.85rem", padding: "0.25rem 0"
            }}
          >
            {!isComplete ? <Loader2 size={14} className="animate-spin" style={{ animation: "spin 2s linear infinite" }} /> : null}
            {activitiesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Activity ({activities.length})</span>
          </button>
          
          {activitiesExpanded && (
            <div style={{ 
              marginLeft: "1.25rem", padding: "0.5rem 1rem", 
              borderLeft: "2px solid var(--color-border)",
              fontSize: "0.85rem", color: "var(--color-text-muted)",
              display: "flex", flexDirection: "column", gap: "0.25rem"
            }}>
              {activities.map((act, i) => (
                <div key={i}>{act}</div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {content && (
        <Suspense fallback={<div>Loading...</div>}>
          <MarkdownText content={content} />
        </Suspense>
      )}

      {hasEffects && (
        <div style={{ marginTop: "1rem" }}>
          {effects.map((effect, i) => (
            <EffectCard key={effect.id || i} effect={effect} />
          ))}
        </div>
      )}
    </div>
  );
}
