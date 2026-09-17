import type { ComponentProps } from "react";
import { Separator as Primitive } from "radix-ui";
import { cn } from "../../../lib/cn";

export function Separator({ className, orientation = "horizontal", decorative = true, ...props }: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-slate4 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className,
      )}
      {...props}
    />
  );
}
