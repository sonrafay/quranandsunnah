// src/components/notifications/ClientNotifications.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  NotificationPrefs,
  onNotificationPrefs,
  saveFcmToken,
  clearFcmToken,
} from "@/lib/cloud";
import { ensureFcmToken, onForegroundPush } from "@/lib/firebase-messaging";
import { useToaster } from "@/components/ui/toaster";

export default function ClientNotifications() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const { push } = useToaster();

  // Track if this is the initial load to avoid showing toast on app start
  const isInitialLoad = useRef(true);
  // Track the last webEnabled value we processed to avoid duplicate processing
  const lastWebEnabled = useRef<boolean | undefined>(undefined);

  // Live prefs
  useEffect(() => {
    if (!user) {
      // Reset tracking when user logs out
      isInitialLoad.current = true;
      lastWebEnabled.current = undefined;
      return;
    }
    const off = onNotificationPrefs(user.uid, (p) => setPrefs(p));
    return () => off?.();
  }, [user]);

  // Turn ON web push → request permission + get token → save to Firestore
  // Only show toasts when user explicitly changes the setting, not on initial load
  useEffect(() => {
    (async () => {
      if (!user) return;
      if (!prefs) return;

      const currentWebEnabled = !!prefs.webEnabled;

      // Skip if the value hasn't actually changed from what we last processed
      if (lastWebEnabled.current === currentWebEnabled) return;

      const wasInitialLoad = isInitialLoad.current;
      isInitialLoad.current = false;
      lastWebEnabled.current = currentWebEnabled;

      if (currentWebEnabled) {
        if (!("Notification" in window)) {
          // Only show error toasts - these are important for user feedback
          if (!wasInitialLoad) {
            push({ title: "Notifications", body: "This browser does not support Web Notifications." });
          }
          await clearFcmToken(user.uid);
          return;
        }

        const permission =
          Notification.permission === "default"
            ? await Notification.requestPermission()
            : Notification.permission;

        if (permission !== "granted") {
          // Only show toast if user just enabled notifications (not initial load)
          if (!wasInitialLoad) {
            push({ title: "Notifications", body: "Permission not granted — using in-app popouts instead." });
          }
          await clearFcmToken(user.uid);
          return;
        }

        const vapid = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";
        const token = await ensureFcmToken(vapid);
        if (token) {
          await saveFcmToken(user.uid, token);
          // Only show success toast when user explicitly enables notifications
          // Skip toast on initial app load to avoid annoying messages
          if (!wasInitialLoad) {
            push({ title: "Notifications", body: "Push notifications enabled." });
          }
        } else if (!wasInitialLoad) {
          // Only show error toast if user just tried to enable
          push({
            title: "Notifications",
            body: "Unable to get push token. Check browser settings.",
          });
        }
      } else {
        // Turned OFF → clear token (silent operation)
        await clearFcmToken(user.uid);
      }
    })();
  }, [prefs?.webEnabled, user, push]);

  // Foreground messages → in-app toast (system popup is handled manually if you want; SW handles background)
  useEffect(() => {
    let off: (() => void) | undefined;
    (async () => {
      off = await onForegroundPush((payload) => {
        const title = payload?.notification?.title || "Quran & Sunnah";
        const body  = payload?.notification?.body || "";
        push({ title, body });

        // Optional: also show a native popup while focused if desired:
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(title, { body, icon: "/icons/icon-192.png" });
          } catch {}
        }
      });
    })();
    return () => { if (off) off(); };
  }, [push]);

  return null;
}
