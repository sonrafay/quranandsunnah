"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Compass, LocateFixed, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PrayerName,
  TimingsMap,
  ddmmyyyy,
  nextPrayerNow,
  parseHHmmToDateLocal,
  to12h,
  bearingToQibla,
} from "@/lib/prayer";
import { useAuth } from "@/components/auth/AuthProvider";
import { saveNotificationPrefs } from "@/lib/cloud";

type TabKey = "prayer" | "qibla";

type AlAdhanResponse = {
  code: number;
  data: {
    timings: Record<string, string>;
    date: { readable: string; timestamp: string };
    meta: { timezone: string; method: { name: string } };
  };
};

// display order now includes Sunrise
type DisplayName = PrayerName | "Sunrise";
const DISPLAY_ORDER: DisplayName[] = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

export default function PrayerPage() {
  const [tab, setTab] = useState<TabKey>("prayer");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [todayTimes, setTodayTimes] = useState<TimingsMap | null>(null);
  const [tomorrowTimes, setTomorrowTimes] = useState<TimingsMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Qibla compass
  const [bearing, setBearing] = useState<number | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const listenRef = useRef(false);
  const { user } = useAuth();


  const today = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }, []);

  const pickTimings = (src: any): TimingsMap => ({
    Fajr: src["Fajr"],
    Sunrise: src["Sunrise"],      // 👈 include Sunrise
    Dhuhr: src["Dhuhr"],
    Asr: src["Asr"],
    Maghrib: src["Maghrib"],
    Isha: src["Isha"],
  });

  const fetchTimes = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setErr(null);
    try {
      const d1 = ddmmyyyy(today);
      const d2 = ddmmyyyy(tomorrow);

      const [r1, r2] = await Promise.all<AlAdhanResponse>([
        fetch(
          `https://api.aladhan.com/v1/timings/${d1}?latitude=${lat}&longitude=${lon}&method=2`
        ).then((r) => r.json()),
        fetch(
          `https://api.aladhan.com/v1/timings/${d2}?latitude=${lat}&longitude=${lon}&method=2`
        ).then((r) => r.json()),
      ]);

      if (r1.code !== 200 || r2.code !== 200) {
        throw new Error("API error");
      }

      setTodayTimes(pickTimings(r1.data.timings));
      setTomorrowTimes(pickTimings(r2.data.timings));
    } catch (e: any) {
      console.error(e);
      setErr("Could not load prayer times. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [today, tomorrow]);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setErr("Geolocation not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setCoords({ lat, lon });
        fetchTimes(lat, lon);
        setBearing(bearingToQibla(lat, lon));

        // NEW: save to notification prefs so server can schedule
        if (user) {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
          await saveNotificationPrefs(user.uid, { location: { lat, lon, tz } });
        }
      },
      (e) => setErr(e.message || "Could not get location."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [fetchTimes, user]);


  // Try once on mount
  useEffect(() => {
    if (!coords) requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Device orientation (for Qibla)
  useEffect(() => {
    if (listenRef.current) return;
    listenRef.current = true;

    const handler = (ev: DeviceOrientationEvent) => {
      const webkitHeading = (ev as any).webkitCompassHeading as number | undefined;
      if (typeof webkitHeading === "number") {
        setDeviceHeading(webkitHeading);
        return;
      }
      if (typeof ev.alpha === "number") setDeviceHeading(360 - ev.alpha);
    };

    if (typeof window !== "undefined" && "DeviceOrientationEvent" in window) {
      window.addEventListener("deviceorientation", handler, true);
    }
    return () => window.removeEventListener("deviceorientation", handler as any);
  }, []);

  const next = useMemo(() => {
    if (!todayTimes) return null;
    return nextPrayerNow(today, todayTimes, tomorrowTimes || undefined);
  }, [today, todayTimes, tomorrowTimes]);

  // live countdown
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  function formatCountdown(target: Date) {
    const diff = Math.max(0, target.getTime() - Date.now());
    const s = Math.floor(diff / 1000);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  const qiblaRotation = useMemo(() => {
    if (bearing == null) return 0;
    if (deviceHeading == null) return bearing;
    const diff = bearing - deviceHeading;
    return ((diff % 360) + 360) % 360;
  }, [bearing, deviceHeading]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-28">
      {/* Segmented slider */}
      <div className="mx-auto max-w-md">
        <div className="rounded-full border bg-background/60 backdrop-blur p-1 flex items-center gap-1">
          {(["prayer", "qibla"] as TabKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "flex-1 text-sm py-2 rounded-full transition",
                tab === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
              aria-pressed={tab === k}
            >
              {k === "prayer" ? "Prayer" : "Qibla"}
            </button>
          ))}
        </div>
      </div>

      {/* Location + error */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <Button size="sm" variant="outline" onClick={requestLocation}>
          <LocateFixed className="h-4 w-4 mr-2" />
          Use my location
        </Button>
        {coords && (
          <span className="text-xs opacity-70 flex items-center">
            <MapPin className="h-4 w-4 mr-1" />
            {coords.lat.toFixed(3)}, {coords.lon.toFixed(3)}
          </span>
        )}
      </div>
      {err && <p className="mt-2 text-center text-sm text-red-500">{err}</p>}

      {/* Content */}
      {tab === "prayer" ? (
        <div className="mt-8">
          {!todayTimes ? (
            <p className="text-center text-muted-foreground">
              {loading ? "Loading prayer times…" : "Allow location to load prayer times."}
            </p>
          ) : (
            <>
              {/* Next prayer big card */}
              {next && (
                <div className="rounded-2xl border p-6 md:p-8 bg-card/60 backdrop-blur text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">Next prayer</span>
                  </div>
                  <h2 className="mt-2 text-3xl md:text-4xl font-semibold">
                    {next.name} — {to12h(
                      `${String(next.at.getHours()).padStart(2, "0")}:${String(
                        next.at.getMinutes()
                      ).padStart(2, "0")}`
                    )}{" "}
                    <span className="text-base align-middle opacity-70">({next.day})</span>
                  </h2>
                  <div className="mt-3 text-2xl font-mono tracking-tight">
                    {formatCountdown(next.at)}
                  </div>
                </div>
              )}

              {/* All cards: now 6 including Sunrise */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {DISPLAY_ORDER.map((name) => {
                  const t = todayTimes[name];
                  const d = parseHHmmToDateLocal(today, t);
                  const isNext = (name !== "Sunrise") && next?.name === name && next.day === "today";
                  const subtle = name === "Sunrise";
                  return (
                    <div
                      key={name}
                      className={cn(
                        "rounded-xl border p-4 text-center bg-background/40 backdrop-blur",
                        isNext && "ring-1 ring-primary",
                        subtle && "opacity-90"
                      )}
                    >
                      <div className="text-sm opacity-70">{name}</div>
                      <div className="mt-1 text-xl font-semibold">{to12h(t)}</div>
                      <div className="mt-1 text-xs opacity-60">
                        {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-10">
          {!coords ? (
            <p className="text-center text-muted-foreground">
              Allow location to calculate the Qibla direction.
            </p>
          ) : (
            <div className="flex flex-col items-center">
              <div className="text-center">
                <div className="text-sm opacity-70">Qibla bearing from true North</div>
                <div className="text-3xl font-semibold mt-1">
                  {bearing?.toFixed(1)}°
                </div>
              </div>

              {/* Simple arrow compass */}
              <div className="mt-6 h-56 w-56 rounded-full border flex items-center justify-center relative">
                <div className="absolute inset-3 rounded-full border border-dashed opacity-40" />
                <div className="absolute top-2 text-xs opacity-60">N</div>
                <div className="absolute bottom-2 text-xs opacity-60">S</div>
                <div className="absolute left-2 text-xs opacity-60">W</div>
                <div className="absolute right-2 text-xs opacity-60">E</div>

                <div
                  className="h-20 w-2 rounded-full bg-primary origin-bottom"
                  style={{ transform: `rotate(${qiblaRotation}deg)` }}
                  aria-label="Qibla arrow"
                />
              </div>

              <p className="mt-3 text-xs text-muted-foreground text-center max-w-sm">
                Rotate your phone so the arrow points straight up. On iOS you may need
                to allow motion/compass access in Safari settings.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
