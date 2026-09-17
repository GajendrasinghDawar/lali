import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type CSSProperties,
} from "react";
import { LayoutGroup, MotionConfig } from "motion/react";
import { TooltipProvider } from "../Tooltip";
import { cn } from "../../../lib/cn";
import { Sheet } from "./Sheet";

type SidebarState = "expanded" | "collapsed";

type SidebarContextValue = {
  state: SidebarState;
  open: boolean;
  setOpen: (open: boolean | ((current: boolean) => boolean)) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);
const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used inside SidebarProvider");
  return context;
}

export function SidebarProvider({
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  className,
  style,
  children,
  ...props
}: ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [openMobile, setOpenMobile] = useState(false);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => {
      setIsMobile(media.matches);
      if (!media.matches) setOpenMobile(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const setOpen = useCallback((value: boolean | ((current: boolean) => boolean)) => {
    const nextOpen = typeof value === "function" ? value(open) : value;
    if (onOpenChange) onOpenChange(nextOpen);
    else setInternalOpen(nextOpen);
    document.cookie = `${SIDEBAR_COOKIE_NAME}=${nextOpen}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
  }, [onOpenChange, open]);

  const toggleSidebar = useCallback(() => {
    if (isMobile) setOpenMobile(current => !current);
    else setOpen(current => !current);
  }, [isMobile, setOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const state = open ? "expanded" : "collapsed";
  const context = useMemo<SidebarContextValue>(() => ({
    state,
    open,
    setOpen,
    openMobile,
    setOpenMobile,
    isMobile,
    toggleSidebar,
  }), [state, open, setOpen, openMobile, isMobile, toggleSidebar]);

  return (
    <SidebarContext value={context}>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: "easeOut" }}>
        <LayoutGroup id="application-sidebar">
          <TooltipProvider delayDuration={0}>
            <Sheet open={openMobile} onOpenChange={setOpenMobile}>
              <div
                data-slot="sidebar-wrapper"
                style={{
                  "--sidebar-width": "18rem",
                  "--sidebar-width-icon": "3rem",
                  ...style,
                } as CSSProperties}
                className={cn("group/sidebar-wrapper flex min-h-svh w-full", className)}
                {...props}
              >
                {children}
              </div>
            </Sheet>
          </TooltipProvider>
        </LayoutGroup>
      </MotionConfig>
    </SidebarContext>
  );
}
