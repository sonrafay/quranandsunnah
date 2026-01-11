"use client";

import { useTheme } from "next-themes";

/**
 * Custom hook that wraps next-themes.
 * Transitions are now handled globally via CSS in globals.css
 */
export function useThemeTransition() {
  return useTheme();
}
