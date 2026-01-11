export type PrivacySettings = {
  shareStreak: boolean;
  receiveReminders: boolean;
  shareOnlineStatus: boolean;
};

export type User = {
  id: string;
  handle?: string;
};

export type Profile = {
  displayName: string;
  handle?: string;
  publicId?: string;
  avatarIconId?: string;
  avatarBorderTier?: AvatarBorderTier;
  verseRef?: string;
  nameLastUpdatedAt?: string;
  handleLastUpdatedAt?: string;
  privacy: PrivacySettings;
};

export type Streak = {
  current: number;
  best: number;
  lastActionAt?: string;
  lastMaintainedAt?: string;
};

export type AvatarBorderTier =
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Obsidian"
  | "Sanctuary";

export type Avatar = {
  iconId: string;
  iconName: string;
  borderTier: AvatarBorderTier;
  auraEnabled: boolean;
};

export type Badge = {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
};

export type ConnectionStatus = "pending" | "accepted" | "blocked";

export type Connection = {
  id: string;
  handle: string;
  status: ConnectionStatus;
  createdAt: string;
  online?: boolean;
  lastOnlineAt?: string;
};
