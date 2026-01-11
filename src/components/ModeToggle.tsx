"use client";

import { useThemeTransition } from "@/hooks/use-theme-transition";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useThemeTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = (resolvedTheme ?? "dark") === "dark";
  const next = isDark ? "light" : "dark";

  function onToggle() {
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
