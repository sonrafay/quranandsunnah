// src/app/notifications/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  NotificationPrefs,
  onNotificationPrefs,
  saveNotificationPrefs,
} from "@/lib/cloud";
import { useToaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Bell, BellRing, Clock, CalendarDays, Check, ChevronDown, ChevronLeft, Sparkles } from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";

// --- Config ---
const OFFSET_OPTIONS = [
  { label: "1 hr", value: 60 },
  { label: "45 min", value: 45 },
  { label: "30 min", value: 30 },
  { label: "15 min", value: 15 },
  { label: "10 min", value: 10 },
  { label: "5 min", value: 5 },
] as const;

// Time options for daily dhikr reminder
const DHIKR_TIME_OPTIONS = [
  { label: "Morning", value: "morning" },
  { label: "Evening", value: "evening" },
] as const;

type Draft = {
  webEnabled: boolean;
  prayerEnabled: boolean;
  prayerOffsets: number[]; // minutes before
  kahfEnabled: boolean;    // Friday Surah Al-Kahf reminder
  dhikrEnabled: boolean;   // Daily dhikr reminder
  dhikrTime: string;       // "morning" | "evening"
};

function toDraft(p?: NotificationPrefs | null): Draft {
  return {
    webEnabled: !!p?.webEnabled,
    prayerEnabled: !!p?.prayer?.enabled,
    prayerOffsets: p?.prayer?.offsets?.slice()?.sort((a,b)=>b-a) || [30, 10, 5],
    kahfEnabled: !!p?.kahf?.enabled,
    dhikrEnabled: !!p?.dhikr?.enabled,
    dhikrTime: p?.dhikr?.time || "evening",
  };
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { push } = useToaster();

  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft(null));
  const [saving, setSaving] = useState(false);
  const [openOffsets, setOpenOffsets] = useState(false);

  // Live subscribe prefs
  useEffect(() => {
    if (!user) return;
    const off = onNotificationPrefs(user.uid, (p) => {
      setPrefs(p);
      setDraft(toDraft(p));
    });
    return () => off?.();
  }, [user]);

  const hasChanges = useMemo(() => {
    const cur = toDraft(prefs);
    return (
      cur.webEnabled !== draft.webEnabled ||
      cur.prayerEnabled !== draft.prayerEnabled ||
      JSON.stringify([...cur.prayerOffsets].sort()) !== JSON.stringify([...draft.prayerOffsets].sort()) ||
      cur.kahfEnabled !== draft.kahfEnabled ||
      cur.dhikrEnabled !== draft.dhikrEnabled ||
      cur.dhikrTime !== draft.dhikrTime
    );
  }, [prefs, draft]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-32 pb-8 sm:pt-28 sm:pb-12">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-32 pb-8 sm:pt-28 sm:pb-12">
        <header className="relative">
          <button
            onClick={() => router.back()}
            className={cn(
              "group absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 h-10 px-4 rounded-full",
              "glass-surface glass-readable",
              "text-sm font-medium transition-all duration-200",
              "hover:brightness-[0.92] dark:hover:brightness-[0.85]"
            )}
          >
            <ChevronLeft className={cn(
              "h-4 w-4 transition-all duration-200",
              "group-hover:text-green-600 dark:group-hover:text-green-400",
              "group-hover:drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
            )} />
            <span className={cn(
              "transition-all duration-200",
              "group-hover:text-green-600 dark:group-hover:text-green-400",
              "group-hover:drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
            )}>
              Back
            </span>
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-muted-foreground">Sign in to configure notifications.</p>
          </div>
        </header>
      </div>
    );
  }

  async function onSave() {
    if (!user) return;
    setSaving(true);
    try {
      const next: NotificationPrefs = {
        webEnabled: draft.webEnabled,
        prayer: {
          enabled: draft.prayerEnabled,
          offsets: [...draft.prayerOffsets].sort((a,b)=>b-a),
        },
        kahf: {
          enabled: draft.kahfEnabled,
        },
        dhikr: {
          enabled: draft.dhikrEnabled,
          time: draft.dhikrTime,
        },
      };
      await saveNotificationPrefs(user.uid, next);
      push({ title: "Notifications", body: "Preferences saved." });
    } catch (err) {
      push({ title: "Notifications", body: "Failed to save preferences." });
    } finally {
      setSaving(false);
    }
  }

  async function sendServerTest() {
    try {
      const fn = httpsCallable(getFunctions(app, "us-central1"), "sendTestPush");
      await fn();
      push({ title: "Notifications", body: "Test push sent." });
    } catch (err) {
      push({ title: "Notifications", body: "Failed to send test push (server)." });
    }
  }

  function toggleOffset(min: number) {
    setDraft((d) => {
      const has = d.prayerOffsets.includes(min);
      const next = has ? d.prayerOffsets.filter((v) => v !== min) : [...d.prayerOffsets, min];
      return { ...d, prayerOffsets: next.sort((a,b)=>b-a) };
    });
  }

  const offsetBadges = draft.prayerOffsets
    .slice()
    .sort((a,b)=>b-a)
    .map((m) => {
      const match = OFFSET_OPTIONS.find((o) => o.value === m);
      return (
        <Badge key={m} variant="secondary" className="rounded-full">
          {match?.label ?? `${m} min`}
        </Badge>
      );
    });

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-32 pb-8 sm:pt-28 sm:pb-12">
      <header className="relative mb-6">
        <button
          onClick={() => router.back()}
          className={cn(
            "group absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 h-10 px-4 rounded-full",
            "glass-surface glass-readable",
            "text-sm font-medium transition-all duration-200",
            "hover:brightness-[0.92] dark:hover:brightness-[0.85]"
          )}
        >
          <ChevronLeft className={cn(
            "h-4 w-4 transition-all duration-200",
            "group-hover:text-green-600 dark:group-hover:text-green-400",
            "group-hover:drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
          )} />
          <span className={cn(
            "transition-all duration-200",
            "group-hover:text-green-600 dark:group-hover:text-green-400",
            "group-hover:drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
          )}>
            Back
          </span>
        </button>

        {/* Right-aligned controls */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <button
            onClick={sendServerTest}
            title="Send a server-side test push"
            className={cn(
              "group flex items-center gap-2 h-10 px-4 rounded-full",
              "glass-surface glass-readable",
              "text-sm font-medium transition-all duration-200",
              "hover:brightness-[0.92] dark:hover:brightness-[0.85]"
            )}
          >
            <Bell className={cn(
              "h-4 w-4 transition-all duration-200",
              "group-hover:text-green-600 dark:group-hover:text-green-400",
              "group-hover:drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
            )} />
            <span className={cn(
              "transition-all duration-200",
              "group-hover:text-green-600 dark:group-hover:text-green-400",
              "group-hover:drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
            )}>
              Test
            </span>
          </button>
          <button
            onClick={onSave}
            disabled={!hasChanges || saving}
            className={cn(
              "group flex items-center gap-2 h-10 px-4 rounded-full",
              "glass-surface glass-readable",
              "text-sm font-medium transition-all duration-200",
              hasChanges && !saving
                ? "hover:brightness-[0.92] dark:hover:brightness-[0.85]"
                : "opacity-50 cursor-not-allowed"
            )}
          >
            <span className={cn(
              "transition-all duration-200",
              hasChanges && !saving && "group-hover:text-green-600 dark:group-hover:text-green-400",
              hasChanges && !saving && "group-hover:drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
            )}>
              {saving ? "Saving…" : "Save"}
            </span>
          </button>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">Customize reminders and alerts.</p>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Web Push card */}
        <section className="lg:col-span-3 rounded-2xl glass-surface glass-readable p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="inline-grid h-10 w-10 place-items-center rounded-full glass-surface glass-sheet">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Enable push notifications</h2>
                <p className="text-sm text-muted-foreground">
                  Receive system toasts even when you’re not on this tab.
                </p>
              </div>
            </div>
            <Switch
              checked={draft.webEnabled}
              onCheckedChange={(v: boolean) =>
                setDraft((d) => ({ ...d, webEnabled: v }))
              }
            />
          </div>

          <Separator className="my-4" />

          <div className="text-sm text-muted-foreground">
            Tip: On Windows, make sure system notifications are enabled for your browser. In foreground,
            the app also shows an in-app toast.
          </div>
        </section>

        {/* Prayer Reminders */}
        <section className={cn(
          "rounded-2xl glass-surface glass-readable p-5 transition-opacity",
          !draft.webEnabled && "opacity-50"
        )}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="inline-grid h-10 w-10 place-items-center rounded-full glass-surface glass-sheet">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Prayer reminders</h2>
                <p className="text-sm text-muted-foreground">
                  Get notified before each prayer time.
                </p>
              </div>
            </div>
            <Switch
              checked={draft.prayerEnabled}
              disabled={!draft.webEnabled}
              onCheckedChange={(v: boolean) =>
                setDraft((d) => ({ ...d, prayerEnabled: v }))
              }
            />
          </div>

          <div className={cn("mt-4 transition-opacity", (!draft.prayerEnabled || !draft.webEnabled) && "opacity-50 pointer-events-none")}>
            <label className="text-sm font-medium">Reminder times</label>
            <div className="mt-2">
              <Popover open={openOffsets} onOpenChange={setOpenOffsets}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-full">
                    Choose times
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[240px] p-2">
                  <div className="px-1 pb-2 text-xs font-medium opacity-80 border-b">Send before prayer</div>
                  <ul className="mt-2 space-y-1">
                    {OFFSET_OPTIONS.map((opt) => {
                      const checked = draft.prayerOffsets.includes(opt.value);
                      return (
                        <li key={opt.value} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleOffset(opt.value)}
                            id={`off-${opt.value}`}
                          />
                          <label htmlFor={`off-${opt.value}`} className="text-sm cursor-pointer select-none">
                            {opt.label}
                          </label>
                          {checked && <Check className="ml-auto h-3.5 w-3.5 opacity-80" />}
                        </li>
                      );
                    })}
                  </ul>
                </PopoverContent>
              </Popover>

              <div className="mt-2 flex flex-wrap gap-2">
                {offsetBadges.length ? offsetBadges : (
                  <span className="text-sm text-muted-foreground">No times selected</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Friday Surah Al-Kahf */}
        <section className={cn(
          "rounded-2xl glass-surface glass-readable p-5 transition-opacity",
          !draft.webEnabled && "opacity-50"
        )}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="inline-grid h-10 w-10 place-items-center rounded-full glass-surface glass-sheet">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Friday reminder (Surah Al-Kahf)</h2>
                <p className="text-sm text-muted-foreground">
                  Gentle nudge on Fridays to read Al-Kahf.
                </p>
              </div>
            </div>
            <Switch
              checked={draft.kahfEnabled}
              disabled={!draft.webEnabled}
              onCheckedChange={(v: boolean) =>
                setDraft((d) => ({ ...d, kahfEnabled: v }))
              }
            />
          </div>
        </section>

        {/* Daily Dhikr Reminder */}
        <section className={cn(
          "rounded-2xl glass-surface glass-readable p-5 transition-opacity",
          !draft.webEnabled && "opacity-50"
        )}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="inline-grid h-10 w-10 place-items-center rounded-full glass-surface glass-sheet">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Daily Dhikr Reminder</h2>
                <p className="text-sm text-muted-foreground">
                  Receive a gentle daily reminder for dhikr and remembrance of Allah.
                </p>
              </div>
            </div>
            <Switch
              checked={draft.dhikrEnabled}
              disabled={!draft.webEnabled}
              onCheckedChange={(v: boolean) =>
                setDraft((d) => ({ ...d, dhikrEnabled: v }))
              }
            />
          </div>

          <div className={cn("mt-4 transition-opacity", (!draft.dhikrEnabled || !draft.webEnabled) && "opacity-50 pointer-events-none")}>
            <label className="text-sm font-medium">Reminder time</label>
            <div className="mt-2 flex gap-2">
              {DHIKR_TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDraft((d) => ({ ...d, dhikrTime: opt.value }))}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-all",
                    draft.dhikrTime === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "glass-surface glass-sheet hover:brightness-[0.92] dark:hover:brightness-[0.85]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
