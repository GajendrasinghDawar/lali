import { createContext, useContext, type ComponentProps } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import { cn } from "../../../lib/cn";

const SheetContext = createContext(false);

export function Sheet({ open = false, children, ...props }: ComponentProps<typeof Primitive.Root>) {
  return (
    <SheetContext value={open}>
      <Primitive.Root open={open} {...props}>{children}</Primitive.Root>
    </SheetContext>
  );
}

export const SheetTrigger = Primitive.Trigger;
export const SheetClose = Primitive.Close;

export function SheetContent({
  className,
  children,
  side = "left",
  ...props
}: ComponentProps<typeof Primitive.Content> & { side?: "top" | "right" | "bottom" | "left" }) {
  const open = useContext(SheetContext);
  const reduceMotion = useReducedMotion();
  const offset = reduceMotion ? 0 : "100%";
  const closed = side === "left"
    ? { x: `-${offset}`, y: 0 }
    : side === "right"
      ? { x: offset, y: 0 }
      : side === "top"
        ? { x: 0, y: `-${offset}` }
        : { x: 0, y: offset };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <Primitive.Portal forceMount>
          <Primitive.Overlay asChild forceMount>
            <motion.div
              key="sheet-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
              className="fixed inset-0 z-50 bg-slate2/70"
            />
          </Primitive.Overlay>
          <Primitive.Content asChild forceMount {...props}>
            <motion.div
              key="sheet-content"
              initial={{ ...closed, opacity: reduceMotion ? 0 : 1 }}
              animate={{ x: 0, y: 0, opacity: 1 }}
              exit={{ ...closed, opacity: reduceMotion ? 0 : 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
              className={cn(
                "fixed z-50 flex flex-col border-slate4/50 bg-slate1/98 shadow-6",
                side === "left" && "inset-y-0 left-0 h-full w-3/4 border-r",
                side === "right" && "inset-y-0 right-0 h-full w-3/4 border-l",
                side === "top" && "inset-x-0 top-0 border-b",
                side === "bottom" && "inset-x-0 bottom-0 border-t",
                className,
              )}
            >
              {children}
              <Primitive.Close
                aria-label="Close sidebar"
                data-sidebar="close"
                className="absolute right-2.5 top-2.5 flex size-11 items-center justify-center rounded-md text-slate10 outline-none hover:bg-slate5 hover:text-slate12 focus-visible:ring-2 focus-visible:ring-slate8"
              >
                <X className="size-4" />
                <span className="sr-only">Close sidebar</span>
              </Primitive.Close>
            </motion.div>
          </Primitive.Content>
        </Primitive.Portal>
      )}
    </AnimatePresence>
  );
}

export function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 p-4", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof Primitive.Title>) {
  return <Primitive.Title className={cn("font-semibold text-slate12", className)} {...props} />;
}

export function SheetDescription({ className, ...props }: ComponentProps<typeof Primitive.Description>) {
  return <Primitive.Description className={cn("text-sm text-slate10", className)} {...props} />;
}
