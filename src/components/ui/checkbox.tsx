"use client";

import * as React from "react";
import * as CheckboxPrimitives from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitives.Root> {}

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitives.Root>,
  CheckboxProps
>(({ className, ...props }, ref) => (
  <CheckboxPrimitives.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitives.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitives.Indicator>
  </CheckboxPrimitives.Root>
));
Checkbox.displayName = "Checkbox";
