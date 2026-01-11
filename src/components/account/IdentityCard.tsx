"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Profile } from "@/lib/account/models";
import { validateDisplayName, validateHandle } from "@/lib/account/services";

export default function IdentityCard({
  profile,
  bestStreak,
  onSave,
}: {
  profile: Profile;
  bestStreak: number;
  onSave?: (nextName: string, nextHandle?: string) => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [handle, setHandle] = useState(profile.handle || "");
  const validation = validateDisplayName(displayName);
  const handleValidation = validateHandle(handle);
  const canEditHandle = !profile.handle || bestStreak >= 180;
  const hasChanges = displayName !== profile.displayName || handle !== (profile.handle || "");
  const disabled =
    !validation.valid ||
    !handleValidation.valid ||
    !hasChanges ||
    (!canEditHandle && handle !== (profile.handle || ""));

  return (
    <section className="rounded-xl border bg-background/60 p-5 space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Identity</h2>
        <p className="text-sm text-muted-foreground">
          Display name can change anytime. Handles are limited to protect identity.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Display name</label>
          <Input
            className="mt-2"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Enter a display name"
          />
          <div className="mt-2 text-xs text-muted-foreground">
            Profanity filter placeholder. Name updates are always allowed.
          </div>
          {!validation.valid && (
            <div className="mt-2 text-xs text-destructive">{validation.message}</div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Unique handle</label>
          <Input
            className="mt-2"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="set-handle"
            readOnly={!canEditHandle}
          />
          <div className="mt-2 text-xs text-muted-foreground">
            Set once on first visit. Rebrand unlocks at 180-day streak.
          </div>
          {!handleValidation.valid && (
            <div className="mt-2 text-xs text-destructive">{handleValidation.message}</div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Button
          disabled={disabled}
          onClick={() => onSave?.(displayName, handle.trim() || undefined)}
        >
          Save identity
        </Button>
      </div>
    </section>
  );
}