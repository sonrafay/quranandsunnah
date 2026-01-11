"use client";

export type StreakState = {
  currentStreak: number;
  bestStreak: number;
  lastCompletedDate?: string; // YYYY-MM-DD in user timezone
  timeZone: string;
};

export type StreakUnlocks = {
  cosmetics: string[];
  animations: string[];
};

export type StreakAdminOverride = {
  currentStreak?: number;
  bestStreak?: number;
  lastCompletedDate?: string;
};

export type StreakUpdateResult = {
  state: StreakState;
  unlocks: StreakUnlocks;
  change: "initialized" | "incremented" | "reset" | "noop" | "ignored_past";
  appliedDate: string;
};

export function toLocalDateString(timestampMs: number, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(timestampMs));
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") lookup[part.type] = part.value;
  }
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function dateDiffInDays(a: string, b: string): number {
  const [aYear, aMonth, aDay] = a.split("-").map(Number);
  const [bYear, bMonth, bDay] = b.split("-").map(Number);
  const aUtc = Date.UTC(aYear, aMonth - 1, aDay);
  const bUtc = Date.UTC(bYear, bMonth - 1, bDay);
  return Math.floor((bUtc - aUtc) / (1000 * 60 * 60 * 24));
}

export function getDefaultUnlocks(): StreakUnlocks {
  return {
    cosmetics: ["starter-icon"],
    animations: [],
  };
}

export function applyAdminOverride(
  state: StreakState,
  override?: StreakAdminOverride
): StreakState {
  if (!override) return state;
  return {
    ...state,
    currentStreak: override.currentStreak ?? state.currentStreak,
    bestStreak: override.bestStreak ?? state.bestStreak,
    lastCompletedDate: override.lastCompletedDate ?? state.lastCompletedDate,
  };
}

export function calculateStreakUpdate(
  previous: StreakState | null,
  actionAtMs: number,
  timeZone: string,
  previousUnlocks?: StreakUnlocks,
  adminOverride?: StreakAdminOverride
): StreakUpdateResult {
  const appliedDate = toLocalDateString(actionAtMs, timeZone);
  const baseState: StreakState = previous
    ? { ...previous, timeZone }
    : { currentStreak: 0, bestStreak: 0, lastCompletedDate: undefined, timeZone };

  const state = applyAdminOverride(baseState, adminOverride);
  const unlocks = previousUnlocks ?? getDefaultUnlocks();

  if (!state.lastCompletedDate) {
    const next = { ...state, currentStreak: 1, bestStreak: 1, lastCompletedDate: appliedDate };
    return {
      state: next,
      unlocks: computeUnlocks(unlocks, next),
      change: "initialized",
      appliedDate,
    };
  }

  const diffDays = dateDiffInDays(state.lastCompletedDate, appliedDate);
  if (diffDays === 0) {
    return { state, unlocks, change: "noop", appliedDate };
  }

  if (diffDays < 0) {
    return { state, unlocks, change: "ignored_past", appliedDate };
  }

  if (diffDays === 1) {
    const currentStreak = state.currentStreak + 1;
    const bestStreak = Math.max(state.bestStreak, currentStreak);
    const next = { ...state, currentStreak, bestStreak, lastCompletedDate: appliedDate };
    return {
      state: next,
      unlocks: computeUnlocks(unlocks, next),
      change: "incremented",
      appliedDate,
    };
  }

  const next = { ...state, currentStreak: 1, lastCompletedDate: appliedDate };
  return {
    state: next,
    unlocks: computeUnlocks(unlocks, next),
    change: "reset",
    appliedDate,
  };
}

export function computeUnlocks(previous: StreakUnlocks, state: StreakState): StreakUnlocks {
  const cosmetics = new Set(previous.cosmetics);
  const animations = new Set(previous.animations);

  // Cosmetics unlocked by best streak milestones.
  if (state.bestStreak >= 7) cosmetics.add("badge-steady-7");
  if (state.bestStreak >= 14) cosmetics.add("icon-book-14");
  if (state.bestStreak >= 30) cosmetics.add("border-silver-30");
  if (state.bestStreak >= 60) cosmetics.add("border-gold-60");
  if (state.bestStreak >= 100) cosmetics.add("border-platinum-100");

  // Animations unlocked by current streak milestones.
  if (state.currentStreak >= 100) animations.add("streak-100");
  if (state.currentStreak >= 200) animations.add("streak-200");

  return {
    cosmetics: Array.from(cosmetics),
    animations: Array.from(animations),
  };
}