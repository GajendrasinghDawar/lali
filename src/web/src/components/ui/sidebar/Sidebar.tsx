import { useMemo, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { PanelLeft } from "lucide-react";
import { Slot } from "radix-ui";
import { cn } from "../../../lib/cn";
import { Button } from "../Button";
import { Input } from "../Input";
import { ScrollArea } from "../ScrollArea";
import { Separator } from "./Separator";
import { SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./Sheet";
import { Skeleton } from "./Skeleton";
import { useSidebar } from "./SidebarProvider";

export function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: Omit<HTMLMotionProps<"aside">, "children"> & {
  children?: ReactNode;
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
}) {
  const { isMobile, state, setOpenMobile } = useSidebar();
  const reduceMotion = useReducedMotion();

  if (collapsible === "none") {
    return <motion.aside className={cn("flex h-full w-(--sidebar-width) flex-col bg-slate1/98", className)} {...props}>{children}</motion.aside>;
  }

  if (isMobile) {
    return (
      <SheetContent
        data-sidebar="sidebar"
        data-mobile="true"
        aria-describedby={undefined}
        className={cn("w-(--sidebar-width) max-w-none p-0", className)}
        style={{ "--sidebar-width": "18rem" } as CSSProperties}
        side={side}
        onEscapeKeyDown={() => setOpenMobile(false)}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Sidebar</SheetTitle>
          <SheetDescription>Displays the mobile navigation.</SheetDescription>
        </SheetHeader>
        <div className="flex h-full w-full flex-col">{children}</div>
      </SheetContent>
    );
  }

  const width = collapsible === "icon" && state === "collapsed" ? "3rem" : "18rem";
  return (
    <motion.aside
      initial={false}
      animate={{ width }}
      layout
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut", layout: { duration: reduceMotion ? 0 : 0.2 } }}
      className={cn(
        "group relative hidden h-svh shrink-0 overflow-hidden border-slate4/50 bg-slate1/98 text-slate11 md:flex",
        side === "left" ? "border-r" : "border-l",
        variant !== "sidebar" && "m-2 rounded-lg border shadow-3",
        className,
      )}
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-side={side}
      data-variant={variant}
      data-sidebar="sidebar"
      {...props}
    >
      <motion.div layout className="flex h-full w-full min-w-0 flex-col">{children}</motion.div>
    </motion.aside>
  );
}

export function SidebarTrigger({ className, onClick, ...props }: ComponentProps<typeof Button>) {
  const { isMobile, toggleSidebar } = useSidebar();
  const button = (
    <Button
      data-sidebar="trigger"
      size="icon"
      variant="ghost"
      className={cn("size-11 md:size-8", className)}
      onClick={event => {
        onClick?.(event);
        if (!isMobile) toggleSidebar();
      }}
      {...props}
    >
      <PanelLeft className="size-4" />
      <span className="sr-only">Toggle sidebar</span>
    </Button>
  );
  return isMobile ? <SheetTrigger asChild>{button}</SheetTrigger> : button;
}

export function SidebarInset({ className, ...props }: ComponentProps<"main">) {
  return <main className={cn("relative flex min-w-0 flex-1 flex-col bg-slate2", className)} {...props} />;
}

export function SidebarHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex h-16 shrink-0 flex-col justify-center gap-2 p-2", className)} {...props} />;
}

export function SidebarContent({ className, ...props }: ComponentProps<"div">) {
  return <ScrollArea className="min-h-0 flex-1"><div className={cn("flex min-h-0 flex-col gap-2 px-2", className)} {...props} /></ScrollArea>;
}

export function SidebarFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex shrink-0 flex-col gap-2 p-2", className)} {...props} />;
}

export function SidebarGroup({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("relative flex w-full min-w-0 flex-col p-2 group-data-[collapsible=icon]:px-0", className)} {...props} />;
}

export function SidebarGroupLabel({ className, children, ...props }: HTMLMotionProps<"div">) {
  const { isMobile, state } = useSidebar();
  const reduceMotion = useReducedMotion();
  const visible = isMobile || state === "expanded";
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {visible && (
        <motion.div
          key="group-label"
          initial={{ opacity: 0, x: reduceMotion ? 0 : -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reduceMotion ? 0 : -4 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
          className={cn("flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-slate10", className)}
          {...props}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function SidebarGroupContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("w-full text-sm", className)} {...props} />;
}

export function SidebarMenu({ className, ...props }: ComponentProps<"ul">) {
  return <ul className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: HTMLMotionProps<"li">) {
  return <motion.li layout="position" className={cn("group/menu-item relative", className)} {...props} />;
}

export function SidebarMenuAction({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: ComponentProps<"button"> & { asChild?: boolean; showOnHover?: boolean }) {
  const Component = asChild ? Slot.Slot : "button";
  return (
    <Component
      data-sidebar="menu-action"
      className={cn(
        "absolute right-0.5 top-0.5 flex size-7 items-center justify-center rounded-md text-slate10 outline-none after:absolute after:-inset-2 hover:bg-slate6 hover:text-slate12 focus-visible:ring-2 focus-visible:ring-slate8 md:after:hidden group-data-[collapsible=icon]:hidden [&_svg]:size-4",
        showOnHover && "peer-data-[active=true]/menu-button:opacity-100 group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:bg-slate6 data-[state=open]:opacity-100 md:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarSeparator({ className, ...props }: ComponentProps<typeof Separator>) {
  return <Separator className={cn("mx-2 w-auto", className)} {...props} />;
}

export function SidebarInput({ className, ...props }: ComponentProps<typeof Input>) {
  return <Input className={cn("h-8 w-full shadow-none", className)} {...props} />;
}

export function SidebarLabel({ children, className }: { children: ReactNode; className?: string }) {
  const { isMobile, state } = useSidebar();
  const reduceMotion = useReducedMotion();
  const visible = isMobile || state === "expanded";
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {visible && (
        <motion.span
          key="label"
          layout="position"
          initial={{ opacity: 0, x: reduceMotion ? 0 : -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reduceMotion ? 0 : -4 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
          className={cn("min-w-0 truncate whitespace-nowrap", className)}
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export function SidebarMenuSkeleton({ showIcon = false, className, ...props }: ComponentProps<"div"> & { showIcon?: boolean }) {
  const width = useMemo(() => `${Math.floor(Math.random() * 40) + 50}%`, []);
  return (
    <div className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)} {...props}>
      {showIcon && <Skeleton className="size-4" />}
      <Skeleton className="h-4 flex-1" style={{ maxWidth: width }} />
    </div>
  );
}
