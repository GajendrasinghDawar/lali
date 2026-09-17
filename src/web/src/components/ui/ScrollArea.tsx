import type { ComponentProps, RefObject } from "react";
import { ScrollArea as Primitive } from "radix-ui";
import { cn } from "../../lib/cn";

type ScrollAreaProps = ComponentProps<typeof Primitive.Root> & { viewportRef?: RefObject<HTMLDivElement | null> };

export function ScrollArea({ className, children, viewportRef, ...props }: ScrollAreaProps) {
  return <Primitive.Root className={cn("overflow-hidden", className)} {...props}><Primitive.Viewport ref={viewportRef} className="size-full">{children}</Primitive.Viewport><Primitive.Scrollbar orientation="vertical" className="flex w-2.5 touch-none p-0.5"><Primitive.Thumb className="relative flex-1 rounded-full bg-slate8" /></Primitive.Scrollbar></Primitive.Root>;
}
