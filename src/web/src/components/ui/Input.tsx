import type { ComponentPropsWithRef } from "react";
import { cn } from "../../lib/cn";

export function Input({ className, ...props }: ComponentPropsWithRef<"input">) {
  return <input className={cn("w-full rounded-md border border-slate6 bg-slate2 px-3 py-2 text-slate12 shadow-1 placeholder:text-slate9 hover:border-slate7 focus:border-crimson8 focus:outline-none", className)} {...props} />;
}
