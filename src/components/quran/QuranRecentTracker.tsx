// src/components/quran/QuranRecentTracker.tsx
"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { saveRecentReading } from "@/lib/cloud";

function getClosestAyahToViewportCenter(): number | null {
  const articles = Array.from(document.querySelectorAll<HTMLElement>('article[id^="ayah-"]'));
  if (!articles.length) return null;
  const center = window.scrollY + window.innerHeight / 2;
  let best: { n: number; dist: number } | null = null;
  for (const el of articles) {
    const n = Number(el.id.replace("ayah-", ""));
    const rect = el.getBoundingClientRect();
    const mid = window.scrollY + rect.top + rect.height / 2;
    const dist = Math.abs(mid - center);
    if (!best || dist < best.dist) best = { n, dist };
  }
  return best?.n ?? null;
}

export default function QuranRecentTracker({ surah }: { surah: number }) {
  const { user } = useAuth();
  const ticking = useRef(false);
  const lastSavedAyah = useRef<number | null>(null);
  const saveTimer = useRef<number | null>(null);

  // Save helper (debounced)
  const scheduleSave = (ayah: number | null) => {
    if (!user) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      await saveRecentReading(user.uid, surah, ayah ?? null);
      lastSavedAyah.current = ayah ?? null;
    }, 600);
  };

  useEffect(() => {
    if (!user) return;

    // initial save: use hash (#ayah-N) if present, else closest to center
    const hashAyah = (() => {
      const m = location.hash.match(/ayah-(\d+)/);
      return m ? Number(m[1]) : null;
    })();
    const initial = hashAyah ?? getClosestAyahToViewportCenter() ?? 1;
    scheduleSave(initial);

    // scroll listener (throttled with rAF)
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        ticking.current = false;
        const n = getClosestAyahToViewportCenter();
        if (n && n !== lastSavedAyah.current) scheduleSave(n);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // when audio play jumps to an ayah, persist it too
    const onPlay = (e: any) => {
      const n = Number(e?.detail?.n);
      if (Number.isFinite(n)) scheduleSave(n);
    };
    window.addEventListener("qs-play-ayah", onPlay as any);

    return () => {
      window.removeEventListener("scroll", onScroll as any);
      window.removeEventListener("qs-play-ayah", onPlay as any);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [user, surah]);

  return null;
}
