"use client";

import { Switch } from "@/components/ui/switch";
import { PrivacySettings } from "@/lib/account/models";

export default function PrivacyCard({
  privacy,
  onPrivacyChange,
}: {
  privacy: PrivacySettings;
  onPrivacyChange?: (next: PrivacySettings) => void;
}) {
  return (
    <section className="rounded-xl glass-surface glass-readable p-5 space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Privacy</h2>
        <p className="text-sm text-muted-foreground">
          Control what others can see about you.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg glass-surface glass-readable px-3 py-2">
          <div>
            <div className="text-sm font-medium">Share streak</div>
            <div className="text-xs text-muted-foreground">
              Allow friends to see your streak
            </div>
          </div>
          <Switch
            checked={privacy.shareStreak}
            onCheckedChange={(value) =>
              onPrivacyChange?.({ ...privacy, shareStreak: value })
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-lg glass-surface glass-readable px-3 py-2">
          <div>
            <div className="text-sm font-medium">Receive reminders</div>
            <div className="text-xs text-muted-foreground">
              Allow friends to send you reminders
            </div>
          </div>
          <Switch
            checked={privacy.receiveReminders}
            onCheckedChange={(value) =>
              onPrivacyChange?.({ ...privacy, receiveReminders: value })
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-lg glass-surface glass-readable px-3 py-2">
          <div>
            <div className="text-sm font-medium">Share online status</div>
            <div className="text-xs text-muted-foreground">
              Show when you're online to friends
            </div>
          </div>
          <Switch
            checked={privacy.shareOnlineStatus}
            onCheckedChange={(value) =>
              onPrivacyChange?.({ ...privacy, shareOnlineStatus: value })
            }
          />
        </div>
      </div>
    </section>
  );
}
