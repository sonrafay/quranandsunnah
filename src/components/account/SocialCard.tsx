"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Connection, PrivacySettings } from "@/lib/account/models";

export default function SocialCard({
  connections,
  privacy,
  onPrivacyChange,
}: {
  connections: Connection[];
  privacy: PrivacySettings;
  onPrivacyChange?: (next: PrivacySettings) => void;
}) {
  const [handleQuery, setHandleQuery] = useState("");
  const [inviteLink] = useState("https://quranandsunnah.app/invite/placeholder");
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl glass-surface glass-readable p-5 space-y-4">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Connections</h2>
          <p className="text-sm text-muted-foreground">
            Opt-in only. Mutual approval required. No messaging.
          </p>
        </div>
        <Button variant="outline" onClick={() => setOpen((prev) => !prev)}>
          {open ? "Close" : "Open"}
        </Button>
      </header>

      {open ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Find by handle</label>
              <div className="flex gap-2">
                <Input
                  value={handleQuery}
                  onChange={(event) => setHandleQuery(event.target.value)}
                  placeholder="Search handle"
                />
                <Button variant="outline">Search</Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Placeholder only. Hook into handle lookup service.
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Invite link</label>
              <div className="flex gap-2">
                <Input value={inviteLink} readOnly />
                <Button variant="outline">Copy</Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg glass-surface glass-readable px-3 py-2">
              <div>
                <div className="text-sm font-medium">Share streak</div>
                <div className="text-xs text-muted-foreground">Default off</div>
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
                <div className="text-xs text-muted-foreground">Default off</div>
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
                <div className="text-xs text-muted-foreground">Default off</div>
              </div>
              <Switch
                checked={privacy.shareOnlineStatus}
                onCheckedChange={(value) =>
                  onPrivacyChange?.({ ...privacy, shareOnlineStatus: value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Your connections</div>
              <Button variant="ghost" size="sm">
                View all
              </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between rounded-lg glass-surface glass-readable px-3 py-2 text-sm"
                >
                  <span>@{connection.handle}</span>
                  <span className="text-muted-foreground">
                    {connection.online
                      ? "Online"
                      : connection.lastOnlineAt
                        ? `Last online ${connection.lastOnlineAt}`
                        : connection.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg glass-surface glass-readable p-4 text-sm text-muted-foreground">
          Connections are closed for now. Open this panel to manage friends and privacy.
        </div>
      )}
    </section>
  );
}
