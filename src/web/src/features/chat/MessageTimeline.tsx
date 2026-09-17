import { ArrowDown } from "lucide-react";
import type { Message } from "./use-chat-session";
import { AssistantMessage } from "./AssistantMessage";
import { UserMessage } from "./UserMessage";
import { EmptyChat } from "./EmptyChat";
import { Button } from "../../components/ui/Button";

type MessageTimelineProps = { messages: Message[]; isStreaming: boolean; containerRef: React.RefObject<HTMLDivElement | null>; isAtBottom: boolean; scrollToBottom: () => void; onSuggestion: (text: string) => void };

export function MessageTimeline({ messages, isStreaming, containerRef, isAtBottom, scrollToBottom, onSuggestion }: MessageTimelineProps) {
  return <div className="relative min-h-0 flex-1"><div ref={containerRef} className="size-full overflow-y-auto px-2"><div className="mx-auto flex w-full max-w-4xl flex-col gap-4 py-4 md:gap-6 md:px-4">{messages.length === 0 && <EmptyChat onSelect={onSuggestion} />}{messages.map(message => message.role === "user" ? <UserMessage key={`user-${message.requestId}`} content={message.content} /> : <AssistantMessage key={`assistant-${message.requestId}`} content={message.content} activities={message.activities} effects={message.effects} isComplete={message.isComplete} active={isStreaming && !message.isComplete} />)}</div></div>{!isAtBottom && <Button size="icon" className="absolute bottom-4 right-4 rounded-full shadow-3" onClick={scrollToBottom} aria-label="Scroll to bottom"><ArrowDown size={18} /></Button>}</div>;
}
