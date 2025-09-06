// src/components/notifications/ClientNotifications.tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  NotificationPrefs,
  onNotificationPrefs,
  saveNotificationPrefs,
  saveFcmToken,
  clearFcmToken,
} from "@/lib/cloud";
import { ensureFcmToken, onForegroundPush } from "@/lib/firebase-messaging";
import { useToaster } from "@/components/ui/toaster";

export default function ClientNotifications() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const { push } = useToaster();

  // Live prefs
  useEffect(() => {
    if (!user) return;
    const off = onNotificationPrefs(user.uid, (p) => setPrefs(p));
    return () => off?.();
  }, [user]);

  // Turn ON web push → request permission + get token → save to Firestore
  useEffect(() => {
    (async () => {
      if (!user) return;
      if (!prefs) return;

      if (prefs.webEnabled) {
        if (!("Notification" in window)) {
          push({ title: "Notifications", body: "This browser does not support Web Notifications." });
          await clearFcmToken(user.uid);
          return;
        }

        const permission =
          Notification.permission === "default"
            ? await Notification.requestPermission()
            : Notification.permission;

        if (permission !== "granted") {
          push({ title: "Notifications", body: "Permission not granted — using in-app popouts instead." });
          await clearFcmToken(user.uid);
          return;
        }

        const vapid = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";
        const token = await ensureFcmToken(vapid);
        if (token) {
          await saveFcmToken(user.uid, token);
          push({ title: "Notifications", body: "Push enabled (Google/FCM token saved)." });
        } else {
          // More helpful guidance:
          push({
            title: "Notifications",
            body:
              "Unable to get push token. Check: (1) HTTPS or localhost, (2) VAPID key set, (3) SW at /firebase-messaging-sw.js, (4) permission granted.",
          });
        }
      } else {
        // Turned OFF → clear token
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
