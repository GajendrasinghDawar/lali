import type { ComponentPropsWithRef } from "react";
import { cn } from "../../lib/cn";

type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: "primary" | "secondary" | "destructive" | "ghost" | "amber";
  size?: "small" | "normal" | "icon";
};

const variants = {
  primary: "border-crimson8 bg-crimson9 text-slate12 hover:bg-crimson10 focus-visible:ring-crimson8",
  secondary: "border-slate6 bg-slate4 text-slate12 hover:bg-slate5 focus-visible:ring-slate8",
  destructive: "border-red8 bg-red9 text-slate12 hover:bg-red10 focus-visible:ring-red8",
  ghost: "border-transparent bg-transparent text-slate11 hover:bg-slate4 hover:text-slate12 focus-visible:ring-slate8",
  amber: "border-amber8 bg-amber9 text-slate2 hover:bg-amber10 focus-visible:ring-amber8",
};

const sizes = {
  small: "h-8 px-3 text-sm",
  normal: "h-10 px-4 text-sm",
  icon: "size-8 p-0",
};

export function Button({ className, variant = "secondary", size = "normal", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn("inline-flex items-center justify-center gap-2 rounded-md border font-semibold shadow-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate2 disabled:pointer-events-none disabled:opacity-50", variants[variant], sizes[size], className)} {...props} />;
}
