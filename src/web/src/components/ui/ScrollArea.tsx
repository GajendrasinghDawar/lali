import type { ComponentProps, ReactNode, RefObject } from "react";
import { ScrollArea as Primitive } from "radix-ui";
import { cn } from "../../lib/cn";

type ScrollAreaProps = Omit<ComponentProps<typeof Primitive.Root>, "children" | "type"> & {
  children: ReactNode;
  orientation?: "horizontal" | "vertical" | "both";
  type?: "auto" | "always" | "scroll" | "hover";
  viewportRef?: RefObject<HTMLDivElement | null>;
};

const scrollbarClassName = "flex touch-none select-none bg-transparent p-0.5 transition-colors duration-150 ease-out hover:bg-slate6 data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:flex-col data-[orientation=vertical]:w-2.5 data-[orientation=vertical]:py-2";
const thumbClassName = "relative flex-1 rounded-[10px] bg-slate8 before:absolute before:left-1/2 before:top-1/2 before:size-full before:min-h-11 before:min-w-11 before:-translate-x-1/2 before:-translate-y-1/2";

export function ScrollArea({
  className,
  children,
  orientation = "vertical",
  type = "auto",
  viewportRef,
  ...props
}: ScrollAreaProps) {
  return (
    <Primitive.Root className={cn("overflow-hidden", className)} type={type} {...props}>
      <Primitive.Viewport ref={viewportRef} className="size-full [&>div]:!block">{children}</Primitive.Viewport>
      {orientation !== "horizontal" && (
        <Primitive.Scrollbar orientation="vertical" className={scrollbarClassName}>
          <Primitive.Thumb className={thumbClassName} />
        </Primitive.Scrollbar>
      )}
      {orientation !== "vertical" && (
        <Primitive.Scrollbar orientation="horizontal" className={scrollbarClassName}>
          <Primitive.Thumb className={thumbClassName} />
        </Primitive.Scrollbar>
      )}
      <Primitive.Corner className="bg-slate6" />
    </Primitive.Root>
  );
}
