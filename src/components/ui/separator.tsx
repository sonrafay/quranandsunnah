"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
};

export function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  role,
  ...props
}: SeparatorProps) {
  return (
    <div
      role={decorative ? "none" : role ?? "separator"}
      aria-orientation={orientation === "vertical" ? "vertical" : undefined}
      className={cn(
        "shrink-0 bg-border",
        orientation === "vertical" ? "w-px h-full" : "h-px w-full",
        className
      )}
      {...props}
    />
  );
}

export default Separator;
