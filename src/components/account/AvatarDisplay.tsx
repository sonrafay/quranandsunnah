"use client";

import { Shield, Sparkles, Moon, BookOpen } from "lucide-react";
import { Avatar } from "@/lib/account/models";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, JSX.Element> = {
  spark: <Sparkles className="h-6 w-6" aria-hidden />,
  moon: <Moon className="h-6 w-6" aria-hidden />,
  book: <BookOpen className="h-6 w-6" aria-hidden />,
  shield: <Shield className="h-6 w-6" aria-hidden />,
};

const BORDER_CLASSES: Record<Avatar["borderTier"], string> = {
  Bronze: "ring-2 ring-amber-700/60",
  Silver: "ring-2 ring-slate-300/80",
  Gold: "ring-2 ring-yellow-500/70",
  Platinum: "ring-2 ring-slate-200/70",
  Diamond: "ring-2 ring-cyan-300/80",
  Obsidian: "ring-2 ring-zinc-500/70",
  Sanctuary: "ring-2 ring-emerald-400/80",
};

export default function AvatarDisplay({
  avatar,
  size = "md",
}: {
  avatar: Avatar;
  size?: "sm" | "md" | "lg";
}) {
  const icon = ICON_MAP[avatar.iconId] ?? ICON_MAP.spark;
  const sizes = {
    sm: "h-14 w-14 text-sm",
    md: "h-20 w-20 text-base",
    lg: "h-28 w-28 text-lg",
  };

  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "relative grid place-items-center rounded-full bg-muted/60",
          sizes[size],
          BORDER_CLASSES[avatar.borderTier]
        )}
        aria-label={`Avatar ${avatar.iconName}`}
      >
        {icon}
        {avatar.auraEnabled && (
          <span
            className="absolute -inset-2 rounded-full bg-emerald-500/10 blur-md"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
