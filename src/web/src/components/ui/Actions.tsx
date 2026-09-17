import type { ComponentProps } from "react";
import { Button } from "./Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./Tooltip";
import { cn } from "../../lib/cn";

export function Actions({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-1", className)} {...props} />;
}

export function Action({ tooltip, className, children, ...props }: ComponentProps<typeof Button> & { tooltip: string }) {
  return <TooltipProvider><Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className={cn("size-8 text-slate9", className)} {...props}>{children}<span className="sr-only">{tooltip}</span></Button></TooltipTrigger><TooltipContent>{tooltip}</TooltipContent></Tooltip></TooltipProvider>;
}
