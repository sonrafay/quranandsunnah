"use client";

import { Badge } from "@/components/ui/badge";
import AvatarDisplay from "@/components/account/AvatarDisplay";
import { FriendProfile, Avatar, AvatarBorderTier } from "@/lib/account/models";
import { cn } from "@/lib/utils";

const ICON_LABELS: Record<string, string> = {
  moon: "Evening Moon",
  spark: "Gentle Spark",
  book: "Open Book",
  shield: "Steadfast Shield",
};

function buildAvatar(profile: FriendProfile): Avatar {
  const iconId = profile.avatarIconId || "moon";
  const borderTier = profile.avatarBorderTier || "Bronze";
  return {
    iconId,
    iconName: ICON_LABELS[iconId] || "Evening Moon",
    borderTier,
    auraEnabled: borderTier === "Sanctuary",
  };
}

type ProfileCardPreviewProps = {
  profile: FriendProfile;
  onClick?: () => void;
  showStreak?: boolean;
  size?: "sm" | "md";
  className?: string;
  children?: React.ReactNode;
};

export default function ProfileCardPreview({
  profile,
  onClick,
  showStreak = false,
  size = "md",
  className,
  children,
}: ProfileCardPreviewProps) {
  const avatar = buildAvatar(profile);
  const isClickable = !!onClick;

  return (
    <div
      className={cn(
        "rounded-xl glass-surface glass-readable p-4 transition-all",
        isClickable && "cursor-pointer hover:ring-1 hover:ring-emerald-500/30",
        size === "sm" && "p-3",
        className
      )}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div className="flex items-center gap-4">
        <AvatarDisplay avatar={avatar} size={size === "sm" ? "sm" : "md"} />
        <div className="flex-1 min-w-0 space-y-1">
          <div className={cn("font-semibold truncate", size === "sm" ? "text-sm" : "text-base")}>
            {profile.displayName}
          </div>
          {profile.handle && (
            <div className="text-sm text-muted-foreground truncate">
              @{profile.handle}
            </div>
          )}
          {showStreak && profile.currentStreak !== undefined && (
            <Badge variant="secondary" className="mt-1 text-xs">
              Streak · {profile.currentStreak} day{profile.currentStreak === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
      </div>
    </div>
  );
}
