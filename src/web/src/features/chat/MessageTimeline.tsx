import type { RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { ScrollArea } from "../../components/ui/ScrollArea";
import type { Message } from "./use-chat-session";
import { AssistantMessage } from "./AssistantMessage";
import { EmptyChat } from "./EmptyChat";
import { UserMessage } from "./UserMessage";

type MessageTimelineProps = {
  messages: Message[];
  isStreaming: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  isAtBottom: boolean;
  scrollToBottom: () => void;
  onSuggestion: (text: string) => void;
};

export function MessageTimeline({ messages, isStreaming, containerRef, isAtBottom, scrollToBottom, onSuggestion }: MessageTimelineProps) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="relative min-h-0 flex-1">
      <ScrollArea data-chat-scroll-area viewportRef={containerRef} className="size-full px-1 sm:px-2 md:px-0">
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex flex-col gap-4 px-2 py-4 md:gap-6 md:px-4">
            {messages.length === 0 && <EmptyChat onSelect={onSuggestion} />}
            {messages.map((message, index) => message.role === "user"
              ? <UserMessage key={`user-${message.requestId}`} content={message.content} />
              : (
                <AssistantMessage
                  key={`assistant-${message.requestId}`}
                  content={message.content}
                  activities={message.activities}
                  effects={message.effects}
                  isComplete={message.isComplete}
                  active={isStreaming && !message.isComplete}
                  isLast={index === messages.length - 1}
                />
              ))}
          </div>
        </div>
      </ScrollArea>
      <AnimatePresence initial={false}>
        {!isAtBottom && (
          <motion.button
            key="scroll-to-bottom"
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
            className="absolute bottom-4 right-4 z-10 inline-flex size-10 items-center justify-center rounded-full border border-slate6 bg-slate3 text-slate11 shadow-3 backdrop-blur-sm hover:bg-slate4 focus-visible:ring-2 focus-visible:ring-slate8"
          >
            <ChevronDown className="size-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
