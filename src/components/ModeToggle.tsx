"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * A small helper to add a fade class to <html> for a short time,
 * unless the user prefers reduced motion.
 */
function runThemeFade(ms = 320) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const root = document.documentElement as HTMLElement & { __fadeTO?: number };
  root.classList.add("theme-fade");
  if (root.__fadeTO) window.clearTimeout(root.__fadeTO);
  root.__fadeTO = window.setTimeout(() => {
    root.classList.remove("theme-fade");
  }, ms) as unknown as number;
}

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = (resolvedTheme ?? "dark") === "dark";
  const next = isDark ? "light" : "dark";

  function onToggle() {
    runThemeFade();
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="rounded-full border bg-background/60 backdrop-blur h-8 w-8 grid place-items-center hover:bg-muted transition"
    >
      {mounted ? (isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />) : null}
    </button>
  );
}

export default ModeToggle;
