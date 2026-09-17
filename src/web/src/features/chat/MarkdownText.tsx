import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownText({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: props => <a target="_blank" rel="noopener noreferrer" {...props} /> }}>{content}</ReactMarkdown>;
}
