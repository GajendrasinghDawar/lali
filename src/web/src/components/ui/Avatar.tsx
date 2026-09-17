import type { ComponentProps } from "react";
import { Avatar as Primitive } from "radix-ui";
import { cn } from "../../lib/cn";

export function Avatar({ className, ...props }: ComponentProps<typeof Primitive.Root>) {
  return <Primitive.Root className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-lg", className)} {...props} />;
}
export function AvatarImage(props: ComponentProps<typeof Primitive.Image>) { return <Primitive.Image className="size-full object-cover" {...props} />; }
export function AvatarFallback({ className, ...props }: ComponentProps<typeof Primitive.Fallback>) { return <Primitive.Fallback className={cn("flex size-full items-center justify-center bg-slate6 text-sm font-semibold text-slate12", className)} {...props} />; }
