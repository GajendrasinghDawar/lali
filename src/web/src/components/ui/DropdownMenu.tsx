import type { ComponentProps } from "react";
import { DropdownMenu as Primitive } from "radix-ui";
import { cn } from "../../lib/cn";

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export const DropdownMenuGroup = Primitive.Group;
export const DropdownMenuLabel = Primitive.Label;

export function DropdownMenuContent({ className, sideOffset = 5, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Portal><Primitive.Content sideOffset={sideOffset} className={cn("z-50 min-w-40 rounded-md border border-slate6 bg-slate4 p-1 text-slate11 shadow-4 data-[state=open]:animate-[fadeIn_.12s_ease-out]", className)} {...props} /></Primitive.Portal>;
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof Primitive.Item>) {
  return <Primitive.Item className={cn("flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none focus:bg-slate6 focus:text-slate12 data-[disabled]:opacity-50", className)} {...props} />;
}

export function DropdownMenuSeparator(props: ComponentProps<typeof Primitive.Separator>) {
  return <Primitive.Separator className="my-1 h-px bg-slate6" {...props} />;
}
