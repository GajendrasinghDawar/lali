import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Copy, Sparkles } from "lucide-react";
import type { Effect } from "./use-chat-session";
import { ActivityItem } from "./ActivityItem";
import { MarkdownText } from "./MarkdownText";
import { EffectCard } from "../effects/EffectCard";
import { Action, Actions } from "../../components/ui/Actions";

type AssistantMessageProps = { content: string; activities?: string[]; effects?: Effect[]; isComplete?: boolean; active: boolean; isLast: boolean };

export function AssistantMessage({ content, activities = [], effects = [], isComplete, active, isLast }: AssistantMessageProps) {
  const [copied, setCopied] = useState(false);
  const reduceMotion = useReducedMotion();
  const copy = async () => { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return <motion.article initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.15 }} className={`group/message flex w-full items-start gap-2 md:gap-3 ${isLast ? "min-h-[50svh]" : ""}`} data-role="assistant"><div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-md text-jade10"><Sparkles size={14} /></div><div className="min-w-0 flex-1">{activities.length > 0 && <ActivityItem activities={activities} active={active} />}{content && <div className="prose max-w-none"><MarkdownText content={content} /></div>}{effects.length > 0 && <div className="mt-4 space-y-3">{effects.map(effect => <EffectCard key={effect.id} effect={effect} />)}</div>}{content && isComplete && <Actions className="mt-2 opacity-0 transition-opacity group-hover/message:opacity-100 focus-within:opacity-100"><Action tooltip={copied ? "Copied" : "Copy response"} onClick={() => void copy()}>{copied ? <Check size={15} /> : <Copy size={15} />}</Action></Actions>}</div></motion.article>;
}
