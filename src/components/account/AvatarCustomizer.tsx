"use client";

import { useState } from "react";
import { BookOpen, Moon, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarBorderTier } from "@/lib/account/models";
import { cn } from "@/lib/utils";

const ICON_OPTIONS = [
  { id: "moon", name: "Evening Moon", unlockAt: 1, icon: Moon },
  { id: "spark", name: "Gentle Spark", unlockAt: 30, icon: Sparkles },
  { id: "book", name: "Open Book", unlockAt: 60, icon: BookOpen },
  { id: "shield", name: "Steadfast Shield", unlockAt: 100, icon: Shield },
];

const BORDER_OPTIONS: { tier: AvatarBorderTier; unlockAt: number }[] = [
  { tier: "Bronze", unlockAt: 1 },
  { tier: "Silver", unlockAt: 30 },
  { tier: "Gold", unlockAt: 60 },
  { tier: "Platinum", unlockAt: 100 },
  { tier: "Diamond", unlockAt: 180 },
  { tier: "Obsidian", unlockAt: 270 },
  { tier: "Sanctuary", unlockAt: 365 },
];

export default function AvatarCustomizer({
  avatar,
  bestStreak,
  onChange,
}: {
  avatar: Avatar;
  bestStreak: number;
  onChange: (next: Avatar) => void;
}) {
  const [showIcons, setShowIcons] = useState(true);
  const [showBorders, setShowBorders] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function isUnlocked(unlockAt: number) {
    return bestStreak >= unlockAt;
  }

  function handleIconSelect(id: string, name: string, unlockAt: number) {
    if (!isUnlocked(unlockAt)) {
      setNotice(`Icon unlocks at ${unlockAt}+ days.`);
      return;
    }
    setNotice(null);
    onChange({ ...avatar, iconId: id, iconName: name });
  }

  function handleBorderSelect(tier: AvatarBorderTier, unlockAt: number) {
    if (!isUnlocked(unlockAt)) {
      setNotice(`Border unlocks at ${unlockAt}+ days.`);
      return;
    }
    setNotice(null);
    onChange({
      ...avatar,
      borderTier: tier,
      auraEnabled: tier === "Sanctuary",
    });
  }

  return (
    <section className="rounded-2xl glass-surface glass-readable p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Avatar style</h2>
          <p className="text-sm text-muted-foreground">
            Icons and borders unlock with streak milestones.
          </p>
        </div>
        {notice && <div className="text-xs text-muted-foreground">{notice}</div>}
      </header>

      <div className="space-y-3">
        <Button variant="outline" size="sm" onClick={() => setShowIcons((prev) => !prev)}>
          {showIcons ? "Hide icons" : "Show icons"}
        </Button>
        {showIcons && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ICON_OPTIONS.map(({ id, name, unlockAt, icon: Icon }) => {
              const unlocked = isUnlocked(unlockAt);
              const active = avatar.iconId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleIconSelect(id, name, unlockAt)}
                  className={cn(
                    "rounded-xl border p-4 text-left text-sm transition",
                    active ? "border-primary" : "border-muted-foreground/20",
                    unlocked ? "glass-surface glass-readable glass-interactive" : "opacity-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" aria-hidden />
                    <span className="font-medium">{name}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {unlocked ? "Unlocked" : `Unlock at ${unlockAt} days`}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Button variant="outline" size="sm" onClick={() => setShowBorders((prev) => !prev)}>
          {showBorders ? "Hide borders" : "Show borders"}
        </Button>
        {showBorders && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-7">
            {BORDER_OPTIONS.map(({ tier, unlockAt }) => {
              const unlocked = isUnlocked(unlockAt);
              const active = avatar.borderTier === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => handleBorderSelect(tier, unlockAt)}
                  className={cn(
                    "rounded-xl border p-3 text-center text-xs transition",
                    active ? "border-primary" : "border-muted-foreground/20",
                    unlocked ? "glass-surface glass-readable glass-interactive" : "opacity-50"
                  )}
                >
                  <div className="font-medium">{tier}</div>
                  <div className="text-muted-foreground">
                    {unlocked ? "Unlocked" : `${unlockAt}+ days`}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
