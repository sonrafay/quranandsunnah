// functions/src/index.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { DateTime } from "luxon";

initializeApp();

const db = getFirestore();

/** ------------ sendTestPush (Gen 2 callable) ------------ */
export const sendTestPush = onCall(
  { region: "us-central1" },
  async (req): Promise<{ ok: true }> => {
    if (!req.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign-in required");
    }

    const uid = req.auth.uid;
    const snap = await db.doc(`users/${uid}/settings/notifications`).get();
    const token = snap.get("fcmToken") as string | undefined;

    if (!token) {
      throw new HttpsError("failed-precondition", "No FCM token saved");
    }

    await getMessaging().send({
      token,
      notification: {
        title: "Quran & Sunnah",
        body: "Test push from server (FCM).",
      },
    });

    return { ok: true };
  }
);

/** ------------ Prayer reminders scheduler (Gen 2) ------------ */

type NotifPrefs = {
  webEnabled?: boolean;
  fcmToken?: string;
  location?: { lat: number; lon: number; tz: string };
  prayerOffsets?: number[]; // minutes before prayer
  // kahfEnabled?: boolean; // (future)
};

const DISPLAY_ORDER = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
type DisplayName = typeof DISPLAY_ORDER[number];

function ddmmyyyy(d: DateTime) {
  return d.toFormat("dd-MM-yyyy");
}

/** Returns { timings: Record<DisplayName, "HH:mm">, tz: string } for a given date & coords */
async function fetchTimings(lat: number, lon: number, date: DateTime) {
  const url = `https://api.aladhan.com/v1/timings/${ddmmyyyy(date)}?latitude=${lat}&longitude=${lon}&method=2`;
  // Node 20 has global fetch
  const r = await fetch(url);
  if (!r.ok) throw new Error(`AlAdhan error ${r.status}`);
  const j = (await r.json()) as {
    code: number;
    data: { timings: Record<string, string>; meta: { timezone: string } };
  };
  if (j.code !== 200) throw new Error("AlAdhan non-200 code");
  const src = j.data.timings;
  const tz = j.data.meta.timezone;

  const pick = (name: DisplayName) => src[name] || src[name.toLowerCase()] || "";
  const timings: Record<DisplayName, string> = {
    Fajr: pick("Fajr"),
    Sunrise: pick("Sunrise"),
    Dhuhr: pick("Dhuhr"),
    Asr: pick("Asr"),
    Maghrib: pick("Maghrib"),
    Isha: pick("Isha"),
  };
  return { timings, tz };
}

/** Parse "HH:mm" at a given zone into a DateTime (zone-aware) and produce UTC millis. */
function timeToUtcMillis(hhmm: string, zone: string, base: DateTime): number {
  const dt = DateTime.fromFormat(hhmm, "HH:mm", { zone })
    .set({ year: base.year, month: base.month, day: base.day });
  return dt.toUTC().toMillis();
}

/** Keys like `2025-09-05:Fajr:30` to de-dup each (prayer,offset) per day */
function makeSentKey(dateISO: string, prayer: string, offset: number) {
  return `${dateISO}:${prayer}:${offset}`;
}

/**
 * De-dup storage path: users/{uid}/notifState/prayer-YYYY-MM-DD
 * doc fields: { sent: { [key: string]: true } }
 */
async function alreadySentAndMark(uid: string, dateISO: string, key: string): Promise<boolean> {
  const ref = db.doc(`users/${uid}/notifState/prayer-${dateISO}`);
  const snap = await ref.get();
  const sent = (snap.exists ? ((snap.get("sent") as Record<string, boolean>) || {}) : {});
  if (sent[key]) return true;
  sent[key] = true;
  await ref.set({ sent }, { merge: true });
  return false;
}

/**
 * Every 5 minutes:
 *  - scan all users' settings docs (collectionGroup("settings")), keep only id === "notifications"
 *  - for each eligible user (has fcmToken, location, offsets, webEnabled),
 *  - fetch today's & tomorrow's timings, compute (prayer - offset),
 *  - if "now" falls in [target, target+5min), send a push (with de-dup).
 */
export const schedulePrayerReminders = onSchedule(
  {
    region: "us-central1",
    schedule: "every 5 minutes",
    timeZone: "UTC",
  },
  async () => {
    const nowUtc = DateTime.utc();
    const windowMs = 5 * 60 * 1000;

    // Get every doc in any "settings" subcollection, then filter to the ID "notifications"
    const settingsSnap = await db.collectionGroup("settings").get();

    const tasks: Promise<unknown>[] = [];

    for (const doc of settingsSnap.docs) {
      if (doc.id !== "notifications") continue;

      const prefs = doc.data() as NotifPrefs;
      const userDoc = doc.ref.parent.parent; // users/{uid}
      if (!userDoc) continue;
      const uid = userDoc.id;

      if (!prefs.webEnabled) continue;
      if (!prefs.fcmToken) continue;
      if (!prefs.location?.lat || !prefs.location?.lon || !prefs.location?.tz) continue;

      const offsets = (prefs.prayerOffsets || []).filter((n) => Number.isFinite(n) && n > 0) as number[];
      if (!offsets.length) continue;

      tasks.push(
        (async () => {
          const { lat, lon, tz } = prefs.location!;
          const userNow = nowUtc.setZone(tz);
          const today = userNow.startOf("day");
          const tomorrow = today.plus({ days: 1 });

          // timings for today & tomorrow in the user's zone
          const { timings: t1, tz: tz1 } = await fetchTimings(lat, lon, today);
          const { timings: t2 } = await fetchTimings(lat, lon, tomorrow);

          const todayKey = today.toISODate()!;
          const tomorrowKey = tomorrow.toISODate()!;

          const consider: Array<{ dayKey: string; name: DisplayName; whenUtcMs: number }> = [];

          for (const name of DISPLAY_ORDER) {
            const hhmm1 = t1[name];
            if (hhmm1) {
              consider.push({
                dayKey: todayKey,
                name,
                whenUtcMs: timeToUtcMillis(hhmm1, tz1, today.setZone(tz1)),
              });
            }
            const hhmm2 = t2[name];
            if (hhmm2) {
              consider.push({
                dayKey: tomorrowKey,
                name,
                whenUtcMs: timeToUtcMillis(hhmm2, tz1, tomorrow.setZone(tz1)),
              });
            }
          }

          for (const item of consider) {
            for (const off of offsets) {
              const targetMs = item.whenUtcMs - off * 60 * 1000;
              const diff = nowUtc.toMillis() - targetMs;
              if (diff >= 0 && diff < windowMs) {
                const sentKey = makeSentKey(item.dayKey, item.name, off);
                const wasSent = await alreadySentAndMark(uid, item.dayKey, sentKey);
                if (wasSent) continue;

                const body =
                  item.name === "Sunrise"
                    ? `Sunrise in ${off} min`
                    : `${item.name} in ${off} min`;

                await getMessaging().send({
                  token: prefs.fcmToken!,
                  notification: { title: "Prayer Reminder", body },
                  data: {
                    type: "prayer",
                    prayer: item.name,
                    offset: String(off),
                    day: item.dayKey,
                  },
                });
              }
            }
          }
        })().catch((e) => {
          console.error(`schedulePrayerReminders: error for ${doc.ref.path}`, e);
        })
      );
    }

    await Promise.allSettled(tasks);
    return;
  }
);
