import { motion, useReducedMotion } from "motion/react";

export function UserMessage({ content }: { content: string }) {
  const reduceMotion = useReducedMotion();
  return <motion.article initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.15 }} className="flex w-full justify-end" data-role="user"><div className="max-w-[calc(100%-2.5rem)] whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-slate5 bg-slate4 px-4 py-2.5 text-sm leading-relaxed text-slate12 shadow-1 sm:max-w-[min(fit-content,80%)]">{content}</div></motion.article>;
}
