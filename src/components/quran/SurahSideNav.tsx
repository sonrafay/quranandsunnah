"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function SurahSideNav({ current }: { current: number }) {
  const router = useRouter();
  const prev = current > 1 ? current - 1 : null;
  const next = current < 114 ? current + 1 : null;

  const goTo = useCallback((target?: number | null) => {
    if (!target) return;
    router.push(`/quran/${target}`);
  }, [router]);

  useEffect(() => {
    if (!prev && !next) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    const EDGE_PX = 24;
    const MIN_SWIPE_X = 60;
    const MAX_SWIPE_Y = 40;
    let startX = 0;
    let startY = 0;
    let edge: "left" | "right" | null = null;

    const shouldIgnoreTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return !!target.closest("input, textarea, select, button, a, [data-no-swipe]");
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (shouldIgnoreTarget(e.target)) return;

      const width = window.innerWidth;
      if (touch.clientX <= EDGE_PX) edge = "left";
      else if (touch.clientX >= width - EDGE_PX) edge = "right";
      else edge = null;

      if (!edge) return;
      startX = touch.clientX;
      startY = touch.clientY;
    };

    const onEnd = (e: TouchEvent) => {
      if (!edge) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (Math.abs(dx) < MIN_SWIPE_X || Math.abs(dy) > MAX_SWIPE_Y) {
        edge = null;
        return;
      }

      if (edge === "left" && dx > 0 && next) goTo(next);
      if (edge === "right" && dx < 0 && prev) goTo(prev);
      edge = null;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [prev, next, goTo]);

  if (!prev && !next) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-30 hidden md:block">
      <div className="relative mx-auto h-full max-w-5xl">
        {next && (
          <button
            type="button"
            onClick={() => goTo(next)}
            aria-label={`Next surah: ${next}`}
            className="
              group pointer-events-auto absolute left-0 top-1/2 -translate-x-12 -translate-y-1/2
              h-10 w-10 rounded-full glass-surface
              grid place-items-center text-foreground/80
              transition-[filter,color,transform] duration-200 hover:text-foreground
              hover:brightness-95 hover:scale-[1.05] active:scale-[0.98]
            "
          >
            <ChevronLeft className="h-4 w-4 transition-[filter,transform] duration-200 group-hover:scale-110 group-hover:drop-shadow-[0_0_6px_hsl(var(--primary)/0.55)]" />
          </button>
        )}

        {prev && (
          <button
            type="button"
            onClick={() => goTo(prev)}
            aria-label={`Previous surah: ${prev}`}
            className="
              group pointer-events-auto absolute right-0 top-1/2 translate-x-12 -translate-y-1/2
              h-10 w-10 rounded-full glass-surface
              grid place-items-center text-foreground/80
              transition-[filter,color,transform] duration-200 hover:text-foreground
              hover:brightness-95 hover:scale-[1.05] active:scale-[0.98]
            "
          >
            <ChevronRight className="h-4 w-4 transition-[filter,transform] duration-200 group-hover:scale-110 group-hover:drop-shadow-[0_0_6px_hsl(var(--primary)/0.55)]" />
          </button>
        )}
      </div>
    </div>
  );
}
