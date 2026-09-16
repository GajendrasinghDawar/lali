

export function UserMessage({ content }: { content: string }) {
  return (
    <div style={{ width: "100%", maxWidth: "var(--content-width)", margin: "0 auto", padding: "1rem 0", display: "flex", justifyContent: "flex-end" }}>
      <div style={{ 
        background: "var(--color-surface-muted)", 
        padding: "0.75rem 1rem", 
        borderRadius: "1rem", 
        borderBottomRightRadius: "0.25rem",
        maxWidth: "80%",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      }}>
        {content}
      </div>
    </div>
  );
}
