"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import AvatarDisplay from "@/components/account/AvatarDisplay";
import { Avatar, Profile } from "@/lib/account/models";

export default function ProfileOverviewCard({
  profile,
  avatar,
  currentStreak,
  onSaveVerse,
}: {
  profile: Profile;
  avatar: Avatar;
  currentStreak: number;
  onSaveVerse?: (ref: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [verseRef, setVerseRef] = useState(profile.verseRef || "");
  const [verseMsg, setVerseMsg] = useState<string | null>(null);
  const [verseOpen, setVerseOpen] = useState(false);

  const parsedVerse = (() => {
    const trimmed = (profile.verseRef || "").trim();
    if (!/^\d{1,3}:\d{1,3}$/.test(trimmed)) return null;
    const [surah, ayah] = trimmed.split(":").map((v) => Number(v));
    if (!Number.isFinite(surah) || !Number.isFinite(ayah)) return null;
    return { surah, ayah, ref: trimmed };
  })();

  async function copyId() {
    if (!profile.publicId) return;
    try {
      await navigator.clipboard.writeText(profile.publicId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function handleSaveVerse() {
    const trimmed = verseRef.trim();
    if (!trimmed) {
      setVerseMsg("Enter a chapter:verse like 2:255.");
      return;
    }
    if (!/^\d{1,3}:\d{1,3}$/.test(trimmed)) {
      setVerseMsg("Use the format chapter:verse (e.g., 22:13).");
      return;
    }
    setVerseMsg("Saved.");
    onSaveVerse?.(trimmed);
    setTimeout(() => setVerseMsg(null), 2000);
    setVerseOpen(false);
  }

  return (
    <section className="rounded-2xl glass-surface glass-readable p-6 space-y-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <AvatarDisplay avatar={avatar} size="lg" />
          <div className="space-y-2">
            <div className="text-xl font-semibold">{profile.displayName}</div>
            <Badge variant="secondary" className="mt-1 w-fit">
              Streak · {currentStreak} day{currentStreak === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="rounded-xl glass-surface glass-readable p-4 text-sm space-y-3">
        {currentStreak >= 30 ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">Verse reflection</div>
              <Popover open={verseOpen} onOpenChange={setVerseOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    {profile.verseRef ? "Edit" : "Set verse"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 space-y-2 text-sm">
                  <div className="text-xs text-muted-foreground">
                    Use chapter:verse format (example 22:13).
                  </div>
                  <Input
                    value={verseRef}
                    onChange={(event) => setVerseRef(event.target.value)}
                    placeholder="22:13"
                  />
                  <Button size="sm" onClick={handleSaveVerse}>
                    Save
                  </Button>
                  {verseMsg && <div className="text-xs text-muted-foreground">{verseMsg}</div>}
                </PopoverContent>
              </Popover>
            </div>
            <div>
              {parsedVerse ? (
                <a
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm text-emerald-200/80 transition hover:border-emerald-300/60 hover:text-emerald-200"
                  href={`/quran/${parsedVerse.surah}#ayah-${parsedVerse.ayah}`}
                >
                  {parsedVerse.ref}
                </a>
              ) : (
                <span className="text-muted-foreground">No verse selected yet.</span>
              )}
            </div>
          </>
        ) : (
          <div>No bio yet. Unlock a verse reflection after a 30-day streak.</div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Badges</div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">Manage badges</Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 text-sm">
              No badges to manage yet. Unlocks will appear here.
            </PopoverContent>
          </Popover>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((slot) => (
            <div
              key={`badge-slot-${slot}`}
              className="rounded-lg glass-surface glass-readable p-3 text-center text-xs"
            >
              {slot === 0 ? (
                <div className="space-y-1">
                  <div className="font-medium">Streak</div>
                  <div className="text-muted-foreground">{currentStreak} day</div>
                </div>
              ) : (
                <div className="text-muted-foreground">Locked</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg glass-surface glass-readable px-3 py-2 text-sm">
        <span className="text-muted-foreground">User ID</span>
        <div className="flex items-center gap-2">
          <span className="font-mono">{profile.publicId || "pending"}</span>
          <Button variant="ghost" size="sm" onClick={copyId} disabled={!profile.publicId}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
    </section>
  );
}
