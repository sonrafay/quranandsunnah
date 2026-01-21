"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AvatarDisplay from "@/components/account/AvatarDisplay";
import { FriendProfile, Avatar } from "@/lib/account/models";
import { getPublicProfile, getFriendsList, removeFriend } from "@/lib/cloud";
import { ArrowLeft, UserMinus, Loader2, Users, ShieldAlert } from "lucide-react";

const ICON_LABELS: Record<string, string> = {
  moon: "Evening Moon",
  spark: "Gentle Spark",
  book: "Open Book",
  shield: "Steadfast Shield",
};

function buildAvatar(profile: FriendProfile): Avatar {
  const iconId = profile.avatarIconId || "moon";
  const borderTier = profile.avatarBorderTier || "Bronze";
  return {
    iconId,
    iconName: ICON_LABELS[iconId] || "Evening Moon",
    borderTier,
    auraEnabled: borderTier === "Sanctuary",
  };
}

type FriendProfileViewProps = {
  uid: string;
};

export default function FriendProfileView({ uid }: FriendProfileViewProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    async function loadProfile() {
      setLoading(true);
      try {
        const [profileData, friendsList] = await Promise.all([
          getPublicProfile(uid),
          getFriendsList(user!.uid),
        ]);

        setProfile(profileData);
        setIsFriend(friendsList.some((f) => f.friendUid === uid));
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [uid, user, authLoading]);

  async function handleRemoveFriend() {
    if (!user || !profile) return;
    setRemoving(true);

    try {
      const result = await removeFriend(user.uid, uid);
      if (result.success) {
        setIsFriend(false);
        router.push("/friends");
      }
    } catch (error) {
      console.error("Failed to remove friend:", error);
    } finally {
      setRemoving(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-28">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading profile...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-28">
        <div className="rounded-xl glass-surface glass-readable p-8 text-center space-y-4">
          <Users className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-semibold">Sign in to view profiles</h2>
          <Button onClick={() => router.push(`/signin?next=/friends/${uid}`)}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-28">
        <div className="rounded-xl glass-surface glass-readable p-8 text-center space-y-4">
          <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-semibold">Profile not found</h2>
          <p className="text-sm text-muted-foreground">
            This user may have deleted their account or doesn't exist.
          </p>
          <Button variant="outline" onClick={() => router.push("/friends")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Friends
          </Button>
        </div>
      </div>
    );
  }

  if (!isFriend) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-28">
        <div className="rounded-xl glass-surface glass-readable p-8 text-center space-y-4">
          <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-semibold">Not a friend</h2>
          <p className="text-sm text-muted-foreground">
            You can only view profiles of your friends.
          </p>
          <Button variant="outline" onClick={() => router.push("/friends")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Friends
          </Button>
        </div>
      </div>
    );
  }

  const avatar = buildAvatar(profile);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24 space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.push("/friends")} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Friends
      </Button>

      {/* Profile Card */}
      <section className="rounded-xl glass-surface glass-readable p-6 space-y-6">
        {/* Avatar and name section */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <AvatarDisplay avatar={avatar} size="lg" />
          <div className="flex-1 text-center sm:text-left space-y-2">
            <h1 className="text-2xl font-semibold">{profile.displayName}</h1>
            {profile.handle && (
              <div className="text-muted-foreground">@{profile.handle}</div>
            )}
            {profile.publicId && (
              <div className="text-xs text-muted-foreground">
                ID: {profile.publicId}
              </div>
            )}
          </div>
        </div>

        {/* Stats / Badges */}
        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
          <Badge variant="secondary">{avatar.borderTier} Tier</Badge>
          {profile.privacy?.shareStreak && profile.currentStreak !== undefined && (
            <Badge variant="secondary">
              Streak: {profile.currentStreak} day{profile.currentStreak === 1 ? "" : "s"}
            </Badge>
          )}
        </div>

        {/* Info notice */}
        <div className="rounded-lg glass-surface glass-readable p-4 text-sm text-muted-foreground text-center">
          This is a read-only view of your friend's public profile. No private data is shown.
        </div>
      </section>

      {/* Actions */}
      <section className="rounded-xl glass-surface glass-readable p-5 space-y-4">
        <h2 className="text-lg font-semibold">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={handleRemoveFriend}
            disabled={removing}
            className="text-red-400 hover:text-red-300 hover:border-red-400/50"
          >
            {removing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <UserMinus className="h-4 w-4 mr-2" />
            )}
            Remove Friend
          </Button>
        </div>
      </section>
    </div>
  );
}
