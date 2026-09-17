import type { ComponentPropsWithRef } from "react";
import { cn } from "../../lib/cn";

export function Textarea({ className, ...props }: ComponentPropsWithRef<"textarea">) {
  return <textarea className={cn("w-full resize-none border-0 bg-transparent p-0 text-sm leading-relaxed text-slate12 caret-jade9 outline-none placeholder:text-slate10 focus:border-0 focus:ring-0", className)} {...props} />;
}
