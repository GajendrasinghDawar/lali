import type { ComponentProps } from "react";
import { cn } from "../../../lib/cn";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-slate5", className)} {...props} />;
}
