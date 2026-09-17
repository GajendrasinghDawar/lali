import type { ComponentProps } from "react";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

export function DialogContent({ className, children, ...props }: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-50 bg-blackA6 backdrop-blur-xs data-[state=open]:animate-[fadeIn_.15s_ease-out]" />
      <Primitive.Content className={cn("fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate6 bg-slate3 p-6 text-slate11 shadow-6 focus:outline-none", className)} {...props}>
        {children}
        <Primitive.Close className="absolute right-3 top-3 rounded-md p-1 text-slate10 hover:bg-slate4 hover:text-slate12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber8"><X size={16} /><span className="sr-only">Close</span></Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}

export function DialogTitle(props: ComponentProps<typeof Primitive.Title>) {
  return <Primitive.Title className="mb-2 text-lg font-semibold text-slate12" {...props} />;
}

export function DialogDescription(props: ComponentProps<typeof Primitive.Description>) {
  return <Primitive.Description className="mb-5 text-sm text-slate11" {...props} />;
}
