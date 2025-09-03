// src/components/quran/BookmarksLayer.tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { BookmarkColor, onQuranBookmarksMap } from "@/lib/cloud";

/**
 * Listens to user's bookmarks for a surah and applies `data-bookmark="pX"`
 * on each verse article (#ayah-{n}).
 *
 * NOTE: The audio highlight `[data-active-ayah="1"]` will override the color
 * via CSS (we'll add :not([data-active-ayah="1"]) to the bookmark rules).
 */
export default function BookmarksLayer({ surah }: { surah: number }) {
  const { user } = useAuth();
  const [map, setMap] = useState<Map<number, BookmarkColor>>(new Map());

  useEffect(() => {
    if (!user) {
      // clear all attributes if signed-out
      document.querySelectorAll<HTMLElement>('[id^="ayah-"]').forEach((el) => {
        el.removeAttribute("data-bookmark");
      });
      return;
    }
    const off = onQuranBookmarksMap(user.uid, surah, (m) => setMap(m));
    return () => off();
  }, [user, surah]);

  useEffect(() => {
    // apply attributes
    document.querySelectorAll<HTMLElement>('[id^="ayah-"]').forEach((el) => {
      const id = el.id; // "ayah-12"
      const n = Number(id.replace("ayah-", ""));
      const color = map.get(n) || null;
      if (color) el.setAttribute("data-bookmark", color);
      else el.removeAttribute("data-bookmark");
    });
  }, [map]);

  return null;
}
