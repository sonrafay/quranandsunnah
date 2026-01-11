import { Avatar, AvatarBorderTier, PrivacySettings, Streak } from "./models";

const DISPLAY_NAME_COOLDOWN_DAYS = 14;

export function validateDisplayName(name: string): { valid: boolean; message?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, message: "Display name is required." };
  if (trimmed.length < 2) return { valid: false, message: "Name is too short." };
  if (trimmed.length > 32) return { valid: false, message: "Name is too long." };
  // TODO: plug in profanity filter service.
  return { valid: true };
}

export function validateHandle(handle: string): { valid: boolean; message?: string } {
  const trimmed = handle.trim();
  if (!trimmed) return { valid: true };
  if (trimmed.length < 3) return { valid: false, message: "Handle is too short." };
  if (trimmed.length > 16) return { valid: false, message: "Handle is too long." };
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return {
      valid: false,
      message: "Use letters, numbers, underscores, or dashes only.",
    };
  }
  const blocked = new Set([
    "allah",
    "prophet",
    "muhammad",
    "admin",
    "support",
    "moderator",
  ]);
  if (blocked.has(trimmed.toLowerCase())) {
    return { valid: false, message: "This handle is not allowed." };
  }
  // TODO: add profanity + reserved word checks.
  return { valid: true };
}

export function canUpdateDisplayName(lastUpdatedAt?: string): { allowed: boolean; waitDays?: number } {
  if (!lastUpdatedAt) return { allowed: true };
  const last = new Date(lastUpdatedAt).getTime();
  const now = Date.now();
  const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
  if (diffDays >= DISPLAY_NAME_COOLDOWN_DAYS) return { allowed: true };
  return { allowed: false, waitDays: DISPLAY_NAME_COOLDOWN_DAYS - diffDays };
}

export function updateStreak(streak: Streak, performedAction: boolean): Streak {
  // TODO: replace with backend-backed streak logic.
  if (!performedAction) {
    return { ...streak, current: 0 };
  }
  const nextCurrent = streak.current + 1;
  return {
    ...streak,
    current: nextCurrent,
    best: Math.max(streak.best, nextCurrent),
    lastMaintainedAt: new Date().toISOString(),
  };
}

export function getAvatarUnlocks(streakDays: number): {
  unlockedIcons: string[];
  unlockedBorders: AvatarBorderTier[];
} {
  // TODO: replace with backend-driven unlock system.
  const unlockedIcons = ["spark", "moon"];
  const unlockedBorders: AvatarBorderTier[] = ["Bronze"];
  if (streakDays >= 14) unlockedIcons.push("book");
  if (streakDays >= 30) unlockedBorders.push("Silver");
  if (streakDays >= 60) unlockedBorders.push("Gold");
  if (streakDays >= 100) unlockedBorders.push("Platinum");
  if (streakDays >= 180) unlockedBorders.push("Diamond");
  if (streakDays >= 270) unlockedBorders.push("Obsidian");
  if (streakDays >= 365) unlockedBorders.push("Sanctuary");
  return { unlockedIcons, unlockedBorders };
}

export function enforcePrivacy(settings: PrivacySettings): PrivacySettings {
  // TODO: apply privacy rules on backend responses.
  return {
    shareStreak: settings.shareStreak,
    receiveReminders: settings.receiveReminders,
    shareOnlineStatus: settings.shareOnlineStatus,
  };
}

export function buildAvatar(base: Avatar, streakDays: number): Avatar {
  const { unlockedBorders } = getAvatarUnlocks(streakDays);
  const highest = unlockedBorders[unlockedBorders.length - 1] ?? base.borderTier;
  return {
    ...base,
    borderTier: highest,
    auraEnabled: highest === "Sanctuary",
  };
}
