import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";

const suggestions = [
  "Plan my day",
  "Summarize what matters",
  "Help me think through a decision",
  "Draft a clear project update",
  "Organize my next steps",
] as const;

export function EmptyChat({ onSelect }: { onSelect: (text: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const reduceMotion = useReducedMotion();
  const visibleSuggestions = showAll ? suggestions : suggestions.slice(0, 3);
  return (
    <section className="w-full px-3 pb-12 pt-[calc(max(1vh,0.5rem))] sm:px-0">
      <div className="mx-auto w-full max-w-3xl py-8 sm:py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate12 sm:text-3xl md:text-4xl">What can I help with?</h1>
          <p className="max-w-xl text-sm font-medium text-slate10">Choose a prompt or write your own message below.</p>
        </div>
        <LayoutGroup id="empty-chat-prompts">
          <motion.div layout className="relative mt-7 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <AnimatePresence initial={false} mode="popLayout">
              {visibleSuggestions.map(suggestion => (
                <motion.button
                  layout
                  key={suggestion}
                  type="button"
                  onClick={() => onSelect(suggestion)}
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                  transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
                  className="rounded-md border border-slate4 bg-slate3 px-4 py-3 text-left text-sm font-medium text-slate11 transition-colors hover:border-slate5 hover:text-slate12 focus-visible:ring-2 focus-visible:ring-amber8"
                >
                  {suggestion}
                </motion.button>
              ))}
            </AnimatePresence>
          </motion.div>
          <motion.button
            layout
            type="button"
            aria-expanded={showAll}
            onClick={() => setShowAll(current => !current)}
            className="ml-0.5 mt-4 rounded text-xs font-bold text-slate10 transition-colors hover:text-slate11 focus-visible:ring-2 focus-visible:ring-amber8"
          >
            {showAll ? "Show less" : "Show more"}
          </motion.button>
        </LayoutGroup>
      </div>
    </section>
  );
}
