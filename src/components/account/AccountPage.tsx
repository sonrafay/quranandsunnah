"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import AvatarCustomizer from "@/components/account/AvatarCustomizer";
import IdentityCard from "@/components/account/IdentityCard";
import ProfileOverviewCard from "@/components/account/ProfileOverviewCard";
import PrivacyCard from "@/components/account/PrivacyCard";
import {
  Avatar,
  AvatarBorderTier,
  PrivacySettings,
  Profile,
} from "@/lib/account/models";
import { getStreak, getUserProfile, recordStreakAction, saveProfile } from "@/lib/cloud";

const DEFAULT_PRIVACY: PrivacySettings = {
  shareStreak: false,
  receiveReminders: false,
  shareOnlineStatus: false,
};

const ICON_LABELS: Record<string, string> = {
  moon: "Evening Moon",
  spark: "Gentle Spark",
  book: "Open Book",
  shield: "Steadfast Shield",
};

function generatePublicId(): string {
  // TODO: replace with server-generated unique IDs.
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function buildAvatar(profile: Profile): Avatar {
  const iconId = profile.avatarIconId || "moon";
  const borderTier = profile.avatarBorderTier || "Bronze";
  return {
    iconId,
    iconName: ICON_LABELS[iconId] || "Evening Moon",
    borderTier,
    auraEnabled: borderTier === "Sanctuary",
  };
}

export default function AccountPage() {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatar, setAvatar] = useState<Avatar>({
    iconId: "moon",
    iconName: "Evening Moon",
    borderTier: "Bronze",
    auraEnabled: false,
  });
  const [streak, setStreak] = useState({ currentStreak: 1, bestStreak: 1 });
  const [privacy, setPrivacy] = useState<PrivacySettings>(DEFAULT_PRIVACY);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (loading) return;
    if (!user) {
      setLoadingProfile(false);
      return;
    }

    async function loadProfile() {
      setLoadingProfile(true);
      const [profileDoc, streakDoc] = await Promise.all([
        getUserProfile(user.uid),
        getStreak(user.uid),
      ]);
      if (!mounted) return;

      const displayName =
        profileDoc?.displayName || user.displayName || user.email || "User";
      const publicId = profileDoc?.publicId || generatePublicId();
      const nextProfile: Profile = {
        displayName,
        handle: profileDoc?.handle,
        publicId,
        avatarIconId: profileDoc?.avatarIconId || "moon",
        avatarBorderTier: (profileDoc?.avatarBorderTier as AvatarBorderTier) || "Bronze",
        verseRef: profileDoc?.verseRef,
        privacy: profileDoc?.privacy || DEFAULT_PRIVACY,
      };

      setProfile(nextProfile);
      setAvatar(buildAvatar(nextProfile));
      setPrivacy(nextProfile.privacy);
      let nextStreak = streakDoc;
      if (!nextStreak) {
        try {
          nextStreak = await recordStreakAction(user.uid, Date.now(), getTimeZone());
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            console.error("[streak] failed to initialize", error);
          }
          nextStreak = null;
        }
      }

      setStreak({
        currentStreak: nextStreak?.currentStreak ?? 1,
        bestStreak: nextStreak?.bestStreak ?? 1,
      });

      if (!profileDoc?.publicId) {
        await saveProfile(user.uid, { publicId });
      }
      setLoadingProfile(false);
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [loading, user]);

  const bestStreak = streak.bestStreak;

  async function handleSaveIdentity(nextName: string, nextHandle?: string) {
    if (!user || !profile) return;
    const canEditHandle = !profile.handle || bestStreak >= 180;
    const trimmedHandle = nextHandle ? nextHandle.trim() : undefined;
    const finalHandle = canEditHandle ? trimmedHandle ?? profile.handle : profile.handle;
    const updated: Profile = {
      ...profile,
      displayName: nextName,
      handle: finalHandle,
    };
    setProfile(updated);
    await saveProfile(user.uid, {
      displayName: nextName,
      handle: finalHandle,
    });
  }

  async function handleAvatarChange(next: Avatar) {
    if (!user || !profile) return;
    setAvatar(next);
    const updated: Profile = {
      ...profile,
      avatarIconId: next.iconId,
      avatarBorderTier: next.borderTier,
    };
    setProfile(updated);
    await saveProfile(user.uid, {
      avatarIconId: next.iconId,
      avatarBorderTier: next.borderTier,
    });
  }

  async function handlePrivacyChange(next: PrivacySettings) {
    if (!user || !profile) return;
    setPrivacy(next);
    setProfile({ ...profile, privacy: next });
    await saveProfile(user.uid, { privacy: next });
  }

  async function handleSaveVerse(ref: string) {
    if (!user || !profile) return;
    const updated = { ...profile, verseRef: ref };
    setProfile(updated);
    await saveProfile(user.uid, { verseRef: ref });
  }

  if (loadingProfile || !profile) {
    return <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-28">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-24 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-sm text-muted-foreground">
          Privacy-first profile with calm progression and opt-in social features.
        </p>
      </header>

      <ProfileOverviewCard
        profile={profile}
        avatar={avatar}
        currentStreak={streak.currentStreak}
        onSaveVerse={handleSaveVerse}
      />

      <IdentityCard
        profile={profile}
        bestStreak={bestStreak}
        onSave={handleSaveIdentity}
      />

      <AvatarCustomizer
        avatar={avatar}
        bestStreak={bestStreak}
        onChange={handleAvatarChange}
      />

      <PrivacyCard
        privacy={privacy}
        onPrivacyChange={handlePrivacyChange}
      />
    </div>
  );
}
