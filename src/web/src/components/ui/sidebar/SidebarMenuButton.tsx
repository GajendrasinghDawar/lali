import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "motion/react";
import { Slot } from "radix-ui";
import { cn } from "../../../lib/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip";
import { useSidebar } from "./SidebarProvider";

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm text-slate11 outline-none transition-[width,height,padding] hover:bg-slate5 hover:text-slate12 focus-visible:ring-2 focus-visible:ring-slate8 active:bg-slate6 active:text-slate12 disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-9 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-slate5 data-[active=true]:font-medium data-[active=true]:text-slate12 data-[state=open]:bg-slate5 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2 [&>span:last-child]:truncate [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-slate5 hover:text-slate12",
        outline: "bg-slate2 shadow-[0_0_0_1px] shadow-slate6 hover:bg-slate5 hover:shadow-slate8",
      },
      size: {
        default: "h-8",
        sm: "h-7 text-xs",
        lg: "h-12",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant,
  size,
  tooltip,
  className,
  ...props
}: ComponentProps<"button"> & {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string | ComponentProps<typeof TooltipContent>;
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const Component = asChild ? Slot.Slot : "button";
  const { isMobile, state } = useSidebar();
  const button = (
    <Component
      data-sidebar="menu-button"
      data-size={size ?? "default"}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  );

  if (!tooltip) return button;
  const content = typeof tooltip === "string" ? { children: tooltip } : tooltip;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile} {...content} />
    </Tooltip>
  );
}

export const SidebarMenuIcon = motion.span;
