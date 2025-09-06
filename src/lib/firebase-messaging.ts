// src/lib/firebase-messaging.ts
"use client";

import { app } from "@/lib/firebase";
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  MessagePayload,
} from "firebase/messaging";

/**
 * Ensures a service worker is registered at /firebase-messaging-sw.js
 * and returns the registration.
 */
async function getSwRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    // Use existing registration if it’s already there
    const existing = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
    if (existing) return existing;

    // Otherwise, register it now (scope = '/')
    return await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch {
    return null;
  }
}

/**
 * Request/refresh an FCM token.
 * Returns the token string or null (and logs why it failed).
 */
export async function ensureFcmToken(vapidKey: string): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    console.warn("[FCM] Messaging not supported in this browser.");
    return null;
  }

  if (!("Notification" in window)) {
    console.warn("[FCM] Web Notifications not supported in this browser.");
    return null;
  }

  if (!vapidKey) {
    console.warn("[FCM] Missing VAPID key (NEXT_PUBLIC_FIREBASE_VAPID_KEY).");
    return null;
  }

  const permission = Notification.permission;
  if (permission !== "granted") {
    console.warn(`[FCM] Notification permission is '${permission}'.`);
    return null;
  }

  const swReg = await getSwRegistration();
  if (!swReg) {
    console.warn("[FCM] Service worker registration failed/missing. Check public/firebase-messaging-sw.js path.");
    return null;
  }

  try {
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });
    if (!token) {
      console.warn("[FCM] getToken returned null (permission blocked or browser policy).");
      return null;
    }
    return token;
  } catch (err) {
    console.error("[FCM] getToken error:", err);
    return null;
  }
}

/**
 * Foreground push: call this once (e.g. in ClientNotifications) to receive messages
 * while the tab is focused. Return an unsubscribe function.
 */
export async function onForegroundPush(
  handler: (payload: MessagePayload) => void
): Promise<() => void> {
  const supported = await isSupported().catch(() => false);
  if (!supported) {
    return () => {};
  }
  const messaging = getMessaging(app);
  return onMessage(messaging, handler);
}
