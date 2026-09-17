import type { ComponentProps } from "react";
import { Tooltip as Primitive } from "radix-ui";

export const TooltipProvider = Primitive.Provider;
export const Tooltip = Primitive.Root;
export const TooltipTrigger = Primitive.Trigger;

export function TooltipContent(props: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Portal><Primitive.Content sideOffset={6} className="z-50 rounded-md border border-slate6 bg-slate4 px-2 py-1 text-xs text-slate12 shadow-3" {...props} /></Primitive.Portal>;
}
