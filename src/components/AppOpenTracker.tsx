"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { recordStreakAction } from "@/lib/cloud";
import { toLocalDateString } from "@/lib/account/streak";

const LAST_OPEN_KEY = (uid: string) => `qs-streak-last-open:${uid}`;
const PENDING_OPEN_KEY = (uid: string) => `qs-streak-pending-open:${uid}`;

function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function readPending(uid: string): number[] {
  const raw = localStorage.getItem(PENDING_OPEN_KEY(uid));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value) => Number.isFinite(value));
  } catch {
    return [];
  }
}

function writePending(uid: string, pending: number[]) {
  if (!pending.length) {
    localStorage.removeItem(PENDING_OPEN_KEY(uid));
    return;
  }
  localStorage.setItem(PENDING_OPEN_KEY(uid), JSON.stringify(pending));
}

function addPending(pending: number[], timestamp: number, timeZone: string): number[] {
  const targetDate = toLocalDateString(timestamp, timeZone);
  const existingDates = new Set(pending.map((value) => toLocalDateString(value, timeZone)));
  if (existingDates.has(targetDate)) return pending;
  return [...pending, timestamp];
}

export default function AppOpenTracker() {
  const { user, loading } = useAuth();
  const uid = user?.uid;
  const syncingRef = useRef(false);

  useEffect(() => {
    if (loading || !uid) return;

    const timeZone = getTimeZone();

    async function syncPending(pending: number[]) {
      if (syncingRef.current || !pending.length) return;
      syncingRef.current = true;
      const sorted = [...pending].sort((a, b) => a - b);
      try {
        for (const actionAtMs of sorted) {
          await recordStreakAction(uid, actionAtMs, timeZone);
          localStorage.setItem(LAST_OPEN_KEY(uid), toLocalDateString(actionAtMs, timeZone));
        }
        writePending(uid, []);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[streak] failed to record app open", error);
        }
        writePending(uid, sorted);
      } finally {
        syncingRef.current = false;
      }
    }

    const now = Date.now();
    const today = toLocalDateString(now, timeZone);
    const lastOpen = localStorage.getItem(LAST_OPEN_KEY(uid));
    const pending = readPending(uid);

    if (lastOpen !== today) {
      const nextPending = addPending(pending, now, timeZone);
      if (!navigator.onLine) {
        writePending(uid, nextPending);
        localStorage.setItem(LAST_OPEN_KEY(uid), today);
      } else {
        void syncPending(nextPending);
      }
    } else if (pending.length) {
      void syncPending(pending);
    }

    const handleOnline = () => {
      const queued = readPending(uid);
      if (!queued.length) return;
      void syncPending(queued);
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [loading, uid]);

  return null;
}
