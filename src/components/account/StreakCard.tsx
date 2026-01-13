"use client";

import { Streak } from "@/lib/account/models";

export default function StreakCard({ streak }: { streak: Streak }) {
  return (
    <section className="rounded-xl glass-surface glass-readable p-5 space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Streak</h2>
        <p className="text-sm text-muted-foreground">
          Any daily religious action keeps the streak alive. Missed days reset only the current count.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[140px_1fr] items-center">
        <div className="relative h-28 w-28 rounded-full border border-muted-foreground/30 grid place-items-center">
          <div className="text-center">
            <div className="text-2xl font-semibold">{streak.current}</div>
            <div className="text-xs text-muted-foreground">Current days</div>
          </div>
          <span
            className="absolute inset-1 rounded-full border border-emerald-400/30"
            aria-hidden
          />
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-lg glass-surface glass-readable px-3 py-2">
            <span className="text-muted-foreground">Best streak</span>
            <span className="font-medium">{streak.best} days</span>
          </div>
          <div className="flex items-center justify-between rounded-lg glass-surface glass-readable px-3 py-2">
            <span className="text-muted-foreground">100+ days</span>
            <span className="font-medium">Animation unlock placeholder</span>
          </div>
        </div>
      </div>
    </section>
  );
}
