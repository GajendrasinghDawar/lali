import { useState, useEffect, useRef } from "react";

import { useChatSession } from "./use-chat-session";
import { AssistantMessage } from "./AssistantMessage";
import { UserMessage } from "./UserMessage";
import { useScrollToBottom } from "./useScrollToBottom";
import { ArrowDown, Paperclip, X } from "lucide-react";
import { uploadFile } from "../../lib/api";

type StagedFile = { file: File; id?: string; error?: string; uploading: boolean };

export function ChatPage({ sessionId }: { sessionId: string }) {
  const { messages, submitMessage, isStreaming } = useChatSession(sessionId);
  const [draft, setDraft] = useState("");
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { containerRef, isAtBottom, scrollToBottom } = useScrollToBottom<HTMLDivElement>([messages], isStreaming);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const newFiles = Array.from(e.target.files).map(file => ({ file, uploading: true }));
    setStagedFiles(prev => [...prev, ...newFiles]);
    
    for (const staged of newFiles) {
      try {
        const id = await uploadFile(sessionId, staged.file);
        setStagedFiles(prev => prev.map(p => p.file === staged.file ? { ...p, id, uploading: false } : p));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setStagedFiles(prev => prev.map(p => p.file === staged.file ? { ...p, error: message, uploading: false } : p));
      }
    }
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (file: File) => {
    setStagedFiles(prev => prev.filter(p => p.file !== file));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() && stagedFiles.length === 0) return;
    if (stagedFiles.some(f => f.uploading)) return; // Wait for uploads
    
    const attachmentIds = stagedFiles.filter(f => f.id).map(f => f.id as string);
    submitMessage(draft, attachmentIds);
    setDraft("");
    setStagedFiles([]);
    setTimeout(scrollToBottom, 50);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", position: "relative" }}>
      <div ref={containerRef} style={{ flex: 1, overflowY: "auto", padding: "1rem", position: "relative" }}>
        {messages.map((msg, i) => {
          if (msg.role === "user") {
            return <UserMessage key={i} content={msg.content} />;
          } else {
            return <AssistantMessage key={i} content={msg.content} activities={msg.activities} effects={msg.effects} isComplete={msg.isComplete} />;
          }
        })}
        {isStreaming && <div>Assistant is typing...</div>}
      </div>

      {!isAtBottom && (
        <button 
          onClick={scrollToBottom}
          style={{
            position: "absolute",
            bottom: "80px", // Just above the composer
            right: "2rem",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "50%",
            width: "40px",
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            zIndex: 10
          }}
          title="Scroll to bottom"
        >
          <ArrowDown size={20} />
        </button>
      )}

      <div style={{ padding: "1rem", borderTop: "1px solid var(--color-border)" }}>
        {stagedFiles.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
            {stagedFiles.map((f, i) => (
              <div key={i} style={{ 
                display: "flex", alignItems: "center", gap: "0.25rem",
                padding: "0.25rem 0.5rem", borderRadius: "0.25rem",
                background: "var(--color-surface-muted)", fontSize: "0.8rem",
                border: f.error ? "1px solid var(--color-danger)" : "1px solid var(--color-border)"
              }}>
                <span style={{ maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.file.name}
                </span>
                {f.uploading && <span style={{ color: "var(--color-text-muted)" }}>...</span>}
                {f.error && <span style={{ color: "var(--color-danger)" }} title={f.error}>!</span>}
                <button 
                  type="button" 
                  onClick={() => removeFile(f.file)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: "0.5rem", background: "transparent", border: "1px solid var(--color-border)", borderRadius: "0.25rem", cursor: "pointer" }}
            title="Attach file"
          >
            <Paperclip size={20} />
          </button>
          <input 
            type="file" 
            multiple 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: "none" }} 
          />
          <textarea 
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            style={{ flex: 1, padding: "0.5rem", borderRadius: "0.25rem", border: "1px solid var(--color-border)", minHeight: "40px", resize: "vertical" }}
            placeholder="Message Lali..."
          />
          <button type="submit" disabled={isStreaming || (!draft.trim() && stagedFiles.length === 0) || stagedFiles.some(f => f.uploading)} style={{ height: "40px", padding: "0 1rem" }}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
