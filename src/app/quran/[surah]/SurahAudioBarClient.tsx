"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

export type VerseTiming = { verse: number; start: number; end: number };

type Props = {
  surah: number;
  audioUrl: string | null;
  timings: VerseTiming[];
  /** Number of verses in this surah (for buttons/limits) */
  verseCount: number;
  /** Called when active verse changes (to toggle ring & auto-scroll in the list) */
  onActiveVerse?: (n: number) => void;
};

export default function SurahAudioBarClient({
  surah,
  audioUrl,
  timings,
  verseCount,
  onActiveVerse,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [show, setShow] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState<number>(1); // 1-based ayah #
  const [seekingTo, setSeekingTo] = useState<number | null>(null);

  // Sort timings by verse number just in case
  const ordered = useMemo(
    () => [...timings].sort((a, b) => a.verse - b.verse),
    [timings]
  );

  // Helper: find timing for verse n
  function tOf(n: number) {
    return ordered.find((t) => t.verse === n) || null;
  }

  // Public method (via window) that ayah "play" icons can call
  useEffect(() => {
    (window as any).__qsPlayFromAyah = (n: number) => {
      const t = tOf(n);
      if (!audioRef.current || !audioUrl || !t) return;
      ensureVisible();
      audioRef.current.currentTime = t.start / 1000;
      audioRef.current.play().catch(() => {});
      setPlaying(true);
      setActive(n);
    };
    return () => {
      delete (window as any).__qsPlayFromAyah;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, timings]);

  function ensureVisible() {
    if (!show) setShow(true);
  }

  function togglePlay() {
    if (!audioRef.current) return;
    ensureVisible();
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  }

  function seekToVerse(n: number) {
    const t = tOf(n);
    if (!audioRef.current || !t) return;
    ensureVisible();
    setSeekingTo(n);
    audioRef.current.currentTime = t.start / 1000;
    if (!playing) {
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  }

  // Keep active verse in sync as time moves
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => {
      const ms = el.currentTime * 1000;
      // If we have precise timings, pick the verse whose [start,end) contains ms
      const hit =
        ordered.find((x) => ms >= x.start && ms < x.end)?.verse ??
        // fallback: rough mapping by ratio if timings are missing
        Math.min(
          verseCount,
          Math.max(1, Math.round((ms / (el.duration * 1000)) * verseCount))
        );

      if (hit !== active) {
        setActive(hit);
        onActiveVerse?.(hit);
      }
    };

    const onEnded = () => setPlaying(false);

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
    };
  }, [ordered, verseCount, active, onActiveVerse]);

  // After we jump, nudge scroll to active verse
  useEffect(() => {
    if (seekingTo != null) {
      onActiveVerse?.(seekingTo);
      setSeekingTo(null);
    }
  }, [seekingTo, onActiveVerse]);

  return (
    <div
      className={`fixed inset-x-0 bottom-4 z-40 flex justify-center ${
        show ? "" : "pointer-events-none opacity-0"
      } transition`}
    >
      <div className="w-[min(980px,93vw)] rounded-2xl border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-lg p-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => seekToVerse(Math.max(1, active - 1))}
            disabled={active <= 1}
            aria-label="Previous verse"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <Button variant="default" size="icon" onClick={togglePlay} aria-label="Play/Pause">
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => seekToVerse(Math.min(verseCount, active + 1))}
            disabled={active >= verseCount}
            aria-label="Next verse"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          <div className="ml-2 flex-1">
            <audio
              ref={audioRef}
              src={audioUrl ?? undefined}
              preload="none"
              controls
              className="w-full"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onLoadedData={() => ensureVisible()}
            />
          </div>

          <div className="text-xs text-muted-foreground w-24 text-right">
            Ayah {active}/{verseCount}
          </div>
        </div>
      </div>
    </div>
  );
}
