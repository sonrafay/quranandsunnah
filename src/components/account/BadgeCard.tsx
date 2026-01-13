"use client";

import { Badge } from "@/lib/account/models";

export default function BadgeCard({ badges }: { badges: Badge[] }) {
  const slots = Array.from({ length: 3 }, (_, index) => badges[index]);

  return (
    <section className="rounded-xl glass-surface glass-readable p-5 space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Badges</h2>
        <p className="text-sm text-muted-foreground">
          Cosmetic only. Badges are permanent once earned.
        </p>
      </header>

      <div>
        <div className="text-sm font-medium">Badge slots</div>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          {slots.map((badge, index) => (
            <div
              key={badge?.id ?? `slot-${index}`}
              className="rounded-lg glass-surface glass-readable p-4 text-center text-sm"
            >
              {badge && badge.unlocked ? (
                <>
                  <div className="font-medium">{badge.name}</div>
                  <div className="text-xs text-muted-foreground">{badge.description}</div>
                </>
              ) : (
                <>
                  <div className="font-medium">Locked slot</div>
                  <div className="text-xs text-muted-foreground">Unlock milestones to equip</div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm font-medium">Badge gallery</div>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className="rounded-lg glass-surface glass-readable p-4 text-sm"
            >
              <div className="font-medium">{badge.name}</div>
              <div className="text-xs text-muted-foreground">{badge.description}</div>
              {!badge.unlocked && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Locked — complete the requirement to earn
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
