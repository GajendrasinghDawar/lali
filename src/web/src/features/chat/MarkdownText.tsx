import { useState, useEffect, useRef } from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

function CodeBlock({ node, inline, className, children, ...props }: any) {
  const match = /language-(\w+)/.exec(className || "");
  const codeString = String(children).replace(/\n$/, "");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (inline) {
    return (
      <code className="inline-code" {...props}>
        {children}
      </code>
    );
  }

  return (
    <div style={{ position: "relative", marginBottom: "1rem", marginTop: "1rem", borderRadius: "0.5rem", overflow: "hidden", border: "1px solid var(--color-border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.25rem 0.75rem", background: "var(--color-surface-muted)", fontSize: "0.8rem", color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}>
        <span>{match ? match[1] : "text"}</span>
        <button
          onClick={handleCopy}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", display: "flex", alignItems: "center", gap: "0.25rem" }}
          title="Copy code"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{ margin: 0, padding: "1rem", overflowX: "auto", fontSize: "0.9rem" }}>
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export function MarkdownText({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code: CodeBlock,
        p: ({ children }) => <p style={{ margin: "0 0 1rem 0", lineHeight: "1.5" }}>{children}</p>,
        a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-accent)", textDecoration: "none" }} {...props} />,
        ul: ({ children }) => <ul style={{ margin: "0 0 1rem 1.5rem", padding: 0 }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ margin: "0 0 1rem 1.5rem", padding: 0 }}>{children}</ol>,
        li: ({ children }) => <li style={{ marginBottom: "0.25rem" }}>{children}</li>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
