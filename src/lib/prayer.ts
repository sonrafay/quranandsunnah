// Simple helpers for Prayer & Qibla

// Core daily prayers (used for “Next prayer”)
export type PrayerName = "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";

// We also track Sunrise for display
export type TimingsMap = Record<PrayerName | "Sunrise", string>; // "HH:mm" 24h

// Format YYYY-MM-DD -> "DD-MM-YYYY" for AlAdhan path param
export function ddmmyyyy(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function parseHHmmToDateLocal(date: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export function to12h(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Bearing (degrees from true North) from (lat1,lon1) to Kaaba (21.4225, 39.8262)
export function bearingToQibla(lat: number, lon: number) {
  const kaabaLat = 21.4225 * Math.PI / 180;
  const kaabaLon = 39.8262 * Math.PI / 180;
  const φ1 = lat * Math.PI / 180;
  const λ1 = lon * Math.PI / 180;

  const y = Math.sin(kaabaLon - λ1) * Math.cos(kaabaLat);
  const x =
    Math.cos(φ1) * Math.sin(kaabaLat) -
    Math.sin(φ1) * Math.cos(kaabaLat) * Math.cos(kaabaLon - λ1);
  const θ = Math.atan2(y, x);
  const deg = (θ * 180) / Math.PI;
  return (deg + 360) % 360; // 0..360°
}

// Compute the next prayer (Sunrise is not considered a prayer here)
export function nextPrayerNow(today: Date, timings: TimingsMap, tomorrowTimings?: TimingsMap) {
  const order: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const now = new Date();

  for (const p of order) {
    const t = parseHHmmToDateLocal(today, timings[p]);
    if (t > now) return { name: p, at: t, day: "today" as const };
  }
  if (tomorrowTimings) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const t = parseHHmmToDateLocal(tomorrow, tomorrowTimings["Fajr"]);
    return { name: "Fajr" as const, at: t, day: "tomorrow" as const };
  }
  // fallback: today Isha (already passed)
  const last = parseHHmmToDateLocal(today, timings["Isha"]);
  return { name: "Isha" as const, at: last, day: "today" as const };
}
