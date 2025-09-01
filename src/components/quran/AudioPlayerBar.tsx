"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from "lucide-react";

export type Segment = { n: number; start: number; end: number };
export type AudioItem = { n: number; key: string; url: string };

type SingleProps = {
  mode: "single";
  surah: number;
  trackUrl: string;
  segments: Segment[];          // verse timings within the single track
  totalDuration?: number;       // full surah duration (sec) if API supplies it
};

type PerAyahProps = {
  mode: "perAyah";
  surah: number;
  items: AudioItem[];           // one url per verse
};

type Props = SingleProps | PerAyahProps;

const fmt = (t: number) => {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export default function AudioPlayerBar(props: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  // timeline state
  const [time, setTime] = useState(0);            // current position (single: native currentTime; perAyah: global)
  const [duration, setDuration] = useState(0);    // total timeline duration (single: track; perAyah: sum of verse durations/estimates)
  const [idx, setIdx] = useState(0);              // current verse index (for both modes)

  // volume
  const [volume, setVolume] = useState<number>(() => {
    const saved = Number(localStorage.getItem("qs-vol"));
    return Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 1;
  });
  const [muted, setMuted] = useState<boolean>(() => localStorage.getItem("qs-muted") === "1");

  const isSingle = props.mode === "single";
  const segments = isSingle ? (props as SingleProps).segments : [];
  const items    = !isSingle ? (props as PerAyahProps).items : [];
  const totalOverride = isSingle ? (props as SingleProps).totalDuration : undefined;

  // verse durations for per-ayah mode (we learn them lazily as metadata loads)
  const DEFAULT_VERSE_SECONDS = 5;
  const [verseDur, setVerseDur] = useState<number[]>(
    () => (!isSingle ? Array.from({ length: items.length }, () => DEFAULT_VERSE_SECONDS) : [])
  );
  const pendingSeek = useRef<{ toIndex: number; toOffset: number } | null>(null);

  // current ayah number (for highlighting)
  const currentAyah = useMemo(
    () => (isSingle ? segments[idx]?.n : items[idx]?.n),
    [isSingle, segments, items, idx]
  );

  // ------- attach source -------
  useEffect(() => {
    const a = audioRef.current; if (!a) return;

    if (isSingle) {
      a.src = (props as SingleProps).trackUrl;
      setIdx(0);
      setTime(0);
      setVisible(false);
      setVerseDur([]); // not used in single mode
    } else {
      a.src = items[idx]?.url ?? "";
      setVisible(true);
      setVerseDur((prev) => prev.length === items.length ? prev : Array.from({ length: items.length }, (_, i) => prev[i] ?? DEFAULT_VERSE_SECONDS));
    }
  }, [isSingle, props, items, idx]);

  // ------- audio events -------
  useEffect(() => {
    const a = audioRef.current; if (!a) return;

    const onLoaded = () => {
      setReady(true);

      // set total duration
      if (isSingle) {
        setDuration(
          (typeof totalOverride === "number" && totalOverride > 0)
            ? totalOverride
            : (Number.isFinite(a.duration) ? a.duration : 0)
        );
      } else {
        // per-ayah: update duration for current index with real metadata (we learn lazily)
        const d = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : verseDur[idx] ?? DEFAULT_VERSE_SECONDS;
        setVerseDur((prev) => {
          const next = prev.slice();
          next[idx] = d;
          setDuration(next.reduce((s, v) => s + (Number.isFinite(v) ? v : DEFAULT_VERSE_SECONDS), 0));
          return next;
        });

        // if a seek-to-offset is pending for this index, apply it now
        if (pendingSeek.current && pendingSeek.current.toIndex === idx) {
          a.currentTime = Math.max(0, Math.min(d - 0.05, pendingSeek.current.toOffset));
          pendingSeek.current = null;
          a.play().then(() => setPlaying(true)).catch(() => {});
        }
      }
    };

    const onTime = () => {
      if (isSingle) {
        setTime(a.currentTime || 0);
      } else {
        const before = verseDur.slice(0, idx).reduce((s, v) => s + (Number.isFinite(v) ? v : DEFAULT_VERSE_SECONDS), 0);
        setTime(before + (a.currentTime || 0));
      }
    };

    const onEnded = () => {
      if (!isSingle) {
        if (idx < items.length - 1) {
          setIdx((i) => i + 1);
          setTimeout(() => audioRef.current?.play().catch(() => {}), 30);
        } else {
          setPlaying(false);
        }
      } else {
        setPlaying(false);
      }
    };

    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnded);
    };
  }, [isSingle, items.length, idx, verseDur, totalOverride]);

  // volume / mute
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    a.volume = muted ? 0 : volume;
    localStorage.setItem("qs-vol", String(volume));
    localStorage.setItem("qs-muted", muted ? "1" : "0");
  }, [volume, muted]);

  // ------- highlight + auto-scroll -------
  function highlightAyah(n?: number) {
    if (!n) return;
    const el = document.getElementById(`ayah-${n}`) as HTMLElement | null;
    if (!el) return;

    document.querySelectorAll<HTMLElement>("[data-active-ayah]").forEach((e) => {
      e.removeAttribute("data-active-ayah");
      e.classList.remove("active-ayah");
    });
    el.setAttribute("data-active-ayah", "1");
    el.classList.add("active-ayah");

    const r = el.getBoundingClientRect(), vh = window.innerHeight || 0;
    const pad = Math.min(200, vh * 0.2);
    const inView = r.top >= pad && r.bottom <= vh - pad;
    if (!inView) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // single: map time -> segment; per-ayah: highlight on idx/time
  useEffect(() => {
    if (!isSingle) return;
    const a = audioRef.current; if (!a) return;
    let prev = -1, raf = 0;
    const tick = () => {
      if (playing) {
        const t = a.currentTime;

        // binary search for active segment
        let lo = 0, hi = segments.length - 1, found = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (segments[mid].start <= t) { found = mid; lo = mid + 1; } else { hi = mid - 1; }
        }
        if (t > (segments[found]?.end ?? Infinity) && found < segments.length - 1) found++;

        if (found !== prev) {
          prev = found;
          setIdx(found);
          highlightAyah(segments[found]?.n);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isSingle, playing, segments]);

  // verse-audio: highlight on idx changes
  useEffect(() => {
    if (!isSingle) highlightAyah(currentAyah);
  }, [isSingle, currentAyah]);

  // ------- play from verse (both modes) -------
  useEffect(() => {
    function handler(e: Event) {
      const { n } = (e as CustomEvent).detail || {};
      if (typeof n !== "number") return;
      const a = audioRef.current; if (!a) return;

      setVisible(true);
      highlightAyah(n);

      if (isSingle) {
        const k = segments.findIndex((s) => s.n === n);
        if (k < 0) return;
        setIdx(k);
        a.currentTime = Math.max(0, segments[k].start + 0.01);
        setTimeout(() => a.play().then(() => setPlaying(true)).catch(() => {}), 20);
      } else {
        const j = items.findIndex((it) => it.n === n);
        if (j < 0) return;
        setIdx(j);
        setTimeout(() => audioRef.current?.play().then(() => setPlaying(true)).catch(() => {}), 20);
      }
    }
    (window as any).__qsPlayFromAyah = (n: number) =>
      handler(new CustomEvent("qs-play-ayah", { detail: { n } }) as any);

    window.addEventListener("qs-play-ayah", handler as EventListener);
    return () => {
      window.removeEventListener("qs-play-ayah", handler as EventListener);
      delete (window as any).__qsPlayFromAyah;
    };
  }, [isSingle, segments, items]);

  // ------- controls -------
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    if (playing) a.play().catch(() => setPlaying(false));
    else a.pause();
  }, [playing]);

  function playPause() {
    if (!ready) return;
    setPlaying((p) => !p);
    setVisible(true);
  }

  function prev() {
    const a = audioRef.current; if (!a) return;
    if (isSingle) {
      const k = Math.max(0, idx - 1), seg = segments[k];
      if (seg) {
        setIdx(k); highlightAyah(seg.n);
        a.currentTime = Math.max(0, seg.start + 0.01);
        setTimeout(() => a.play().then(() => setPlaying(true)).catch(() => {}), 20);
      }
    } else {
      const k = Math.max(0, idx - 1);
      setIdx(k); highlightAyah(items[k]?.n);
      setTimeout(() => audioRef.current?.play().then(() => setPlaying(true)).catch(() => {}), 20);
    }
  }

  function next() {
    const a = audioRef.current; if (!a) return;
    if (isSingle) {
      const k = Math.min(segments.length - 1, idx + 1), seg = segments[k];
      if (seg) {
        setIdx(k); highlightAyah(seg.n);
        a.currentTime = Math.max(0, seg.start + 0.01);
        setTimeout(() => a.play().then(() => setPlaying(true)).catch(() => {}), 20);
      }
    } else {
      const k = Math.min(items.length - 1, idx + 1);
      setIdx(k); highlightAyah(items[k]?.n);
      setTimeout(() => audioRef.current?.play().then(() => setPlaying(true)).catch(() => {}), 20);
    }
  }

  /** Seek on the global timeline (works in both modes). */
  function onSeekGlobal(pct: number) {
    const a = audioRef.current; if (!a) return;

    if (isSingle) {
      const total = (typeof totalOverride === "number" && totalOverride > 0) ? totalOverride : duration;
      if (!total) return;
      a.currentTime = Math.max(0, Math.min(total, total * pct));
      setVisible(true);
      return;
    }

    // per-ayah → compute target time and map it to verse+offset
    const durTotal = verseDur.reduce((s, v) => s + (Number.isFinite(v) ? v : DEFAULT_VERSE_SECONDS), 0);
    const target = Math.max(0, Math.min(durTotal, durTotal * pct));

    let acc = 0, k = 0;
    for (; k < verseDur.length; k++) {
      const d = Number.isFinite(verseDur[k]) ? verseDur[k] : DEFAULT_VERSE_SECONDS;
      if (acc + d >= target) {
        const offset = target - acc;
        setIdx(k);
        pendingSeek.current = { toIndex: k, toOffset: offset };
        // will be applied in onLoaded for that verse
        setTimeout(() => {
          const src = items[k]?.url ?? "";
          if (audioRef.current && audioRef.current.src !== src) {
            audioRef.current.src = src;
          }
          audioRef.current?.load();
          audioRef.current?.play().then(() => setPlaying(true)).catch(() => {});
        }, 10);
        break;
      }
      acc += d;
    }
    setVisible(true);
  }

  const label = isSingle ? `Ayah ${segments[idx]?.n ?? "—"}` : (items[idx]?.key ?? "");
  const total = isSingle
    ? ((typeof totalOverride === "number" && totalOverride > 0) ? totalOverride : duration)
    : verseDur.reduce((s, v) => s + (Number.isFinite(v) ? v : DEFAULT_VERSE_SECONDS), 0);

  const percent = total ? Math.min(1, time / total) : 0;
  const src = isSingle ? (props as SingleProps).trackUrl : (items[idx]?.url ?? "");

  return (
    <div className={["fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t transition-transform duration-200", visible ? "translate-y-0" : "translate-y-full"].join(" ")}>
      <div className="mx-auto max-w-5xl px-4 py-2 flex items-center gap-3">
        <button className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-foreground/10" onClick={prev} aria-label="Previous verse"><SkipBack className="h-4 w-4" /></button>
        <button className="inline-flex h-9 w-9 items-center justify-center rounded hover:bg-foreground/10" onClick={playPause} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}</button>
        <button className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-foreground/10" onClick={next} aria-label="Next verse"><SkipForward className="h-4 w-4" /></button>

        {/* global timeline */}
        <div className="flex-1 flex items-center gap-3">
          <div
            className="relative w-full h-2 rounded bg-foreground/10 cursor-pointer"
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              onSeekGlobal(pct);
            }}
          >
            <div className="absolute inset-y-0 left-0 rounded bg-foreground/60" style={{ width: `${percent * 100}%` }} />
          </div>
          <div className="text-xs tabular-nums w-[110px] text-right">
            {fmt(time)} / {fmt(total)}
          </div>
        </div>

        <div className="text-xs opacity-80 whitespace-nowrap">{label}</div>

        {/* volume */}
        <div className="ml-2 flex items-center gap-2">
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-foreground/10"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute" : "Mute"}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => { setMuted(false); setVolume(parseFloat(e.target.value)); }}
            className="w-24 accent-foreground"
            aria-label="Volume"
          />
        </div>

        <button className="ml-1 inline-flex h-8 px-2 text-xs rounded hover:bg-foreground/10" onClick={() => setVisible(false)} aria-label="Close"><X className="h-4 w-4" /></button>

        <audio ref={audioRef} src={src} preload="auto" />
      </div>
    </div>
  );
}
