"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from "lucide-react";
import {
  getWordAudioController,
  WORD_AUDIO_EVENTS,
  emitWordHighlight,
} from "@/lib/wordAudio";
import ReciterPicker, { Reciter } from "@/components/quran/ReciterPicker";

export type Segment = { n: number; start: number; end: number };
export type AudioItem = { n: number; key: string; url: string };

// Word-level segment for word-by-word highlighting
// Each segment contains: verse number, word index (1-based), start time (seconds), end time (seconds)
export type WordSegment = { verseNum: number; wordIndex: number; start: number; end: number };

declare global {
  interface Window {
    __QS_PLAYBACK__?: {
      surah: number;
      ayah: number | null;
      wordIndex: number | null;
      time: number;
      playing: boolean;
    };
  }
}

// Word counts per verse - will be populated from verse data
type VerseWordCounts = Map<number, number>; // ayah number -> word count

type SingleProps = {
  mode: "single";
  surah: number;
  trackUrl: string;
  segments: Segment[];          // verse timings within the single track
  wordSegments?: WordSegment[]; // word-level timings for word highlighting
  totalDuration?: number;       // full surah duration (sec) if API supplies it
  wordCounts?: VerseWordCounts; // word counts per verse for word-by-word audio
  reciters?: Reciter[];
  selectedReciterId?: number;
};

type PerAyahProps = {
  mode: "perAyah";
  surah: number;
  items: AudioItem[];           // one url per verse
  wordSegmentsByAyah?: Record<number, WordSegment[]>; // word segments per verse (per-ayah timing)
  wordCounts?: VerseWordCounts; // word counts per verse for word-by-word audio
  reciters?: Reciter[];
  selectedReciterId?: number;
};

type Props = SingleProps | PerAyahProps;

const fmt = (t: number) => {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export default function AudioPlayerBar(props: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const searchParams = useSearchParams();

  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  // highlight only after the user initiates playback/seek/prev/next
  const [activated, setActivated] = useState(false);

  // timeline state
  const [time, setTime] = useState(0);            // current position
  const [duration, setDuration] = useState(0);    // total timeline duration
  const [idx, setIdx] = useState(0);              // current verse index

  // volume
  const [volume, setVolume] = useState<number>(1);
  const [muted, setMuted] = useState<boolean>(false);

  const isSingle = props.mode === "single";
  const baseSegments = isSingle ? (props as SingleProps).segments : [];
  const baseWordSegments = isSingle ? (props as SingleProps).wordSegments : undefined;
  const baseItems = !isSingle ? (props as PerAyahProps).items : [];
  const baseWordSegmentsByAyah = !isSingle ? (props as PerAyahProps).wordSegmentsByAyah : undefined;
  const totalOverride = isSingle ? (props as SingleProps).totalDuration : undefined;
  const baseTrackUrl = isSingle ? (props as SingleProps).trackUrl : "";
  const reciters = props.reciters;
  const selectedReciterId = props.selectedReciterId;
  const wordCounts = props.wordCounts;

  const requestPlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);

  const [overrideTrackUrl, setOverrideTrackUrl] = useState<string | null>(null);
  const [overrideSegments, setOverrideSegments] = useState<Segment[] | null>(null);
  const [overrideWordSegments, setOverrideWordSegments] = useState<WordSegment[] | null>(null);
  const [overrideItems, setOverrideItems] = useState<AudioItem[] | null>(null);
  const [overrideWordSegmentsByAyah, setOverrideWordSegmentsByAyah] = useState<Record<number, WordSegment[]> | null>(null);
  const [activeReciterId, setActiveReciterId] = useState<number | undefined>(selectedReciterId);

  const segments = isSingle ? (overrideSegments ?? baseSegments) : [];
  const wordSegments = isSingle ? (overrideWordSegments ?? baseWordSegments) : undefined;
  const items = !isSingle ? (overrideItems ?? baseItems) : [];
  const wordSegmentsByAyah = !isSingle ? (overrideWordSegmentsByAyah ?? baseWordSegmentsByAyah) : undefined;
  const trackUrl = isSingle ? (overrideTrackUrl ?? baseTrackUrl) : "";

  // verse durations for per-ayah mode (learn lazily as metadata loads)
  const DEFAULT_VERSE_SECONDS = 5;
  const [verseDur, setVerseDur] = useState<number[]>(
    () => (!isSingle ? Array.from({ length: items.length }, () => DEFAULT_VERSE_SECONDS) : [])
  );
  const pendingSeek = useRef<{ toIndex: number; toOffset: number } | null>(null);

  const currentAyah = useMemo(
    () => (isSingle ? segments[idx]?.n : items[idx]?.n),
    [isSingle, segments, items, idx]
  );

  const resumeTargetRef = useRef<{
    ayah?: number;
    wordIndex?: number;
    time?: number;
    autoPlay: boolean;
  } | null>(null);
  const resumeAppliedRef = useRef(false);
  const suppressScrollRef = useRef(false);

  useEffect(() => {
    if (selectedReciterId == null) return;
    setActiveReciterId(selectedReciterId);
    setOverrideTrackUrl(null);
    setOverrideSegments(null);
    setOverrideWordSegments(null);
    setOverrideItems(null);
    setOverrideWordSegmentsByAyah(null);
  }, [selectedReciterId]);

  const absolutizeAudio = (url?: string) => {
    if (!url) return undefined;
    if (/^https?:\/\//i.test(url)) return url;
    return `https://audio.qurancdn.com/${url.replace(/^\/?/, "")}`;
  };

  const fetchChapterRecitation = useCallback(async (reciterId: number) => {
    const chapterUrl = `https://api.quran.com/api/v4/chapter_recitations/${reciterId}/${props.surah}?segments=true`;
    const res = await fetch(chapterUrl);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      audio_file?: {
        audio_url?: string;
        timestamps?: Array<{
          verse_key?: string;
          timestamp_from?: number;
          timestamp_to?: number;
          segments?: Array<number[] | string>;
        }>;
      };
    };

    const audioUrl = absolutizeAudio(data.audio_file?.audio_url);
    if (!audioUrl) return null;

    const timestamps = data.audio_file?.timestamps ?? [];
    const nextSegments: Segment[] = [];
    const nextWordSegments: WordSegment[] = [];

    for (const ts of timestamps) {
      if (!ts?.verse_key) continue;
      const parts = ts.verse_key.split(":");
      if (parts.length !== 2) continue;
      const ayah = Number(parts[1]);
      if (!Number.isFinite(ayah)) continue;

      if (typeof ts.timestamp_from === "number" && typeof ts.timestamp_to === "number") {
        const start = ts.timestamp_from / 1000;
        const end = ts.timestamp_to / 1000;
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
          nextSegments.push({ n: ayah, start, end });
        }
      }

      for (const seg of ts.segments ?? []) {
        const nums = Array.isArray(seg)
          ? seg.map((n) => Number(n)).filter((n) => Number.isFinite(n))
          : typeof seg === "string"
            ? seg.trim().split(/\s+/).map((n) => Number(n)).filter((n) => Number.isFinite(n))
            : [];

        if (nums.length < 3) continue;
        let wordIndex = nums[0];
        let startMs = nums[1];
        let endMs = nums[2];
        if (nums.length >= 4) {
          wordIndex = nums[1];
          startMs = nums[2];
          endMs = nums[3];
        }
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;

        nextWordSegments.push({
          verseNum: ayah,
          wordIndex: Math.max(1, Math.trunc(wordIndex)),
          start: startMs / 1000,
          end: endMs / 1000,
        });
      }
    }

    nextSegments.sort((a, b) => a.start - b.start);
    nextWordSegments.sort((a, b) => a.start - b.start);

    if (!nextSegments.length) return null;
    return { trackUrl: audioUrl, segments: nextSegments, wordSegments: nextWordSegments };
  }, [props.surah]);

  const fetchPerAyahData = useCallback(async (reciterId: number) => {
    const versesUrl = `https://api.quran.com/api/v4/verses/by_chapter/${props.surah}?audio=${reciterId}&fields=verse_key,verse_number`;
    const segmentsUrl = `https://api.quran.com/api/v4/recitations/${reciterId}/by_chapter/${props.surah}?fields=segments`;

    const [versesRes, segmentsRes] = await Promise.all([fetch(versesUrl), fetch(segmentsUrl)]);
    if (!versesRes.ok || !segmentsRes.ok) return null;

    const versesData = (await versesRes.json()) as {
      verses?: Array<{ verse_number?: number; verse_key?: string; audio?: { url?: string } }>;
    };
    const segmentsData = (await segmentsRes.json()) as {
      audio_files?: Array<{ verse_key?: string; segments?: string[] }>;
    };

    const nextItems: AudioItem[] = [];
    for (const v of versesData.verses ?? []) {
      if (!v?.verse_number) continue;
      const url = absolutizeAudio(v.audio?.url);
      if (!url) continue;
      nextItems.push({ n: v.verse_number, key: v.verse_key ?? `${props.surah}:${v.verse_number}`, url });
    }

    const nextByAyah: Record<number, WordSegment[]> = {};
    for (const audio of segmentsData.audio_files ?? []) {
      if (!audio.verse_key) continue;
      const parts = audio.verse_key.split(":");
      if (parts.length !== 2) continue;
      const ayahNum = Number(parts[1]);
      if (!Number.isFinite(ayahNum)) continue;

      const ayahSegments: WordSegment[] = [];
      for (const seg of audio.segments ?? []) {
        if (typeof seg !== "string") continue;
        const nums = seg
          .trim()
          .split(/\s+/)
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n));
        if (nums.length < 3) continue;

        let wordIndex = nums[0];
        let startMs = nums[1];
        let endMs = nums[2];
        if (nums.length >= 4) {
          wordIndex = nums[1];
          startMs = nums[2];
          endMs = nums[3];
        }
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;

        ayahSegments.push({
          verseNum: ayahNum,
          wordIndex: Math.max(1, Math.trunc(wordIndex)),
          start: startMs / 1000,
          end: endMs / 1000,
        });
      }

      if (ayahSegments.length) {
        ayahSegments.sort((a, b) => a.start - b.start);
        nextByAyah[ayahNum] = ayahSegments;
      }
    }

    if (!nextItems.length) return null;
    return { items: nextItems, wordSegmentsByAyah: nextByAyah };
  }, [props.surah]);

  useEffect(() => {
    const ayahParam = searchParams.get("ay");
    const wordParam = searchParams.get("aw");
    const timeParam = searchParams.get("at");
    const autoPlay = searchParams.get("ap") === "1";

    if (ayahParam == null && wordParam == null && timeParam == null && !autoPlay) {
      resumeTargetRef.current = null;
      return;
    }

    const target: {
      ayah?: number;
      wordIndex?: number;
      time?: number;
      autoPlay: boolean;
    } = { autoPlay };

    if (ayahParam != null) {
      const ayah = Number(ayahParam);
      if (Number.isFinite(ayah)) target.ayah = ayah;
    }
    if (wordParam != null) {
      const wordIndex = Number(wordParam);
      if (Number.isFinite(wordIndex)) target.wordIndex = wordIndex;
    }
    if (timeParam != null) {
      const time = Number(timeParam);
      if (Number.isFinite(time)) target.time = time;
    }

    resumeTargetRef.current = target;
    resumeAppliedRef.current = false;
  }, [searchParams]);

  useEffect(() => {
    if (!ready || resumeAppliedRef.current) return;
    const target = resumeTargetRef.current;
    if (!target) return;
    const a = audioRef.current;
    if (!a) return;

    let didSeek = false;

    if (isSingle) {
      if (target.ayah != null && target.wordIndex != null && wordSegments?.length) {
        const seg = wordSegments.find(
          (s) => s.verseNum === target.ayah && s.wordIndex === target.wordIndex
        );
        if (seg) {
          a.currentTime = Math.max(0, seg.start + 0.01);
          didSeek = true;
        }
      }
      if (!didSeek && target.ayah != null && segments.length) {
        const verseSeg = segments.find((s) => s.n === target.ayah);
        if (verseSeg) {
          a.currentTime = Math.max(0, verseSeg.start + 0.01);
          didSeek = true;
        }
      }
      if (!didSeek && typeof target.time === "number") {
        a.currentTime = Math.max(0, target.time);
        didSeek = true;
      }
    } else {
      if (target.ayah != null) {
        const verseIdx = items.findIndex((it) => it.n === target.ayah);
        if (verseIdx >= 0) {
          setIdx(verseIdx);
          const ayahSegments = wordSegmentsByAyah?.[target.ayah];
          if (target.wordIndex != null && ayahSegments?.length) {
            const seg = ayahSegments.find((s) => s.wordIndex === target.wordIndex);
            if (seg) {
              pendingSeek.current = { toIndex: verseIdx, toOffset: seg.start };
              didSeek = true;
            }
          }
          if (!didSeek) {
            pendingSeek.current = { toIndex: verseIdx, toOffset: 0 };
            didSeek = true;
          }
        }
      }
    }

    if (didSeek) {
      setVisible(true);
      setActivated(true);
      if (target.autoPlay) {
        requestPlay();
      }
    }

    resumeAppliedRef.current = true;
  }, [ready, isSingle, segments, wordSegments, items, wordSegmentsByAyah, requestPlay]);

  // ------- attach source (do NOT auto-show) -------
  useEffect(() => {
    if (!isSingle) return;
    const a = audioRef.current; if (!a) return;

    a.src = trackUrl;
    setReady(false);
    setIdx((prev) => (prev === 0 ? prev : 0));
    setTime(0);
    if (!activated) {
      setVisible(false);  // keep hidden until user hits play from a verse
    }
    setVerseDur((prev) => (prev.length ? [] : prev));    // not used in single mode
  }, [isSingle, trackUrl, activated]);

  useEffect(() => {
    if (isSingle) return;
    const a = audioRef.current; if (!a) return;

    a.src = items[idx]?.url ?? "";
    setReady(false);
    // no setVisible here; bar appears only when verse play is pressed
    setVerseDur((prev) =>
      prev.length === items.length
        ? prev
        : Array.from({ length: items.length }, (_, i) => prev[i] ?? DEFAULT_VERSE_SECONDS)
    );
  }, [isSingle, items.length, idx]);

// ------- audio events -------
  useEffect(() => {
    const a = audioRef.current; if (!a) return;

    const onLoaded = () => {
      setReady(true);

      if (isSingle) {
        setDuration(
          (typeof totalOverride === "number" && totalOverride > 0)
            ? totalOverride
            : (Number.isFinite(a.duration) ? a.duration : 0)
        );
      } else {
        // per-ayah: learn the real duration for this verse when available
        const d = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : verseDur[idx] ?? DEFAULT_VERSE_SECONDS;
        setVerseDur((prev) => {
          const next = prev.slice();
          next[idx] = d;
          setDuration(next.reduce((s, v) => s + (Number.isFinite(v) ? v : DEFAULT_VERSE_SECONDS), 0));
          return next;
        });

        // apply pending seek for this verse if any
        if (pendingSeek.current && pendingSeek.current.toIndex === idx) {
          a.currentTime = Math.max(0, Math.min(d - 0.05, pendingSeek.current.toOffset));
          pendingSeek.current = null;
          requestPlay();
        }
      }
    };

    const onTime = () => {
      if (isSingle) {
        setTime(audioRef.current?.currentTime || 0);
      } else {
        const before = verseDur.slice(0, idx).reduce((s, v) => s + (Number.isFinite(v) ? v : DEFAULT_VERSE_SECONDS), 0);
        setTime(before + (audioRef.current?.currentTime || 0));
      }

      if (typeof window !== "undefined") {
        const activeWord = prevWordRef.current;
        window.__QS_PLAYBACK__ = {
          surah: props.surah,
          ayah: currentAyah ?? null,
          wordIndex: activeWord?.wordIndex ?? null,
          time: audioRef.current?.currentTime ?? 0,
          playing,
        };
      }
    };

    const onEnded = () => {
      if (!isSingle) {
        if (idx < items.length - 1) {
          setIdx((i) => i + 1);
          setTimeout(() => requestPlay(), 30);
        } else {
          setPlaying(false);
        }
      } else {
        setPlaying(false);
      }
    };

    const onPlay = () => {
      setActivated(true);
      setPlaying(true);
      if (typeof window !== "undefined") {
        window.__QS_PLAYBACK__ = {
          surah: props.surah,
          ayah: currentAyah ?? null,
          wordIndex: prevWordRef.current?.wordIndex ?? null,
          time: audioRef.current?.currentTime ?? 0,
          playing: true,
        };
      }
    };

    const onPause = () => {
      setPlaying(false);
      if (typeof window !== "undefined") {
        window.__QS_PLAYBACK__ = {
          surah: props.surah,
          ayah: currentAyah ?? null,
          wordIndex: prevWordRef.current?.wordIndex ?? null,
          time: audioRef.current?.currentTime ?? 0,
          playing: false,
        };
      }
    };

    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnded);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, [isSingle, items.length, idx, verseDur, totalOverride, currentAyah, playing, props.surah, requestPlay]);

  // volume / mute
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = Number(window.localStorage.getItem("qs-vol"));
    setVolume(Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 1);
    setMuted(window.localStorage.getItem("qs-muted") === "1");
  }, []);

  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    a.volume = muted ? 0 : volume;
    if (typeof window === "undefined") return;
    window.localStorage.setItem("qs-vol", String(volume));
    window.localStorage.setItem("qs-muted", muted ? "1" : "0");
  }, [volume, muted]);

  // ------- Word click audio integration -------
  // Word-by-word audio is now click-only (not synced to verse playback)
  // This avoids inaccurate timing from playing word audio files sequentially

  // Lazy initialization to avoid SSR issues
  const wordAudioRef = useRef<ReturnType<typeof getWordAudioController> | null>(null);
  const getWordAudio = useCallback(() => {
    if (!wordAudioRef.current && typeof window !== "undefined") {
      wordAudioRef.current = getWordAudioController();
    }
    return wordAudioRef.current;
  }, []);

  // Track if verse audio is paused due to word click playback
  const clickPausedRef = useRef(false);
  const savedTimeRef = useRef(0);

  // Handle word click playback events (pause verse audio while word audio plays)
  useEffect(() => {
    const handleClickStart = () => {
      const a = audioRef.current;
      if (a && playing) {
        savedTimeRef.current = a.currentTime;
        clickPausedRef.current = true;
        a.pause();
      }
    };

    const handleClickEnd = () => {
      const a = audioRef.current;
      if (a && clickPausedRef.current) {
        clickPausedRef.current = false;
        // Resume from where we left off
        a.currentTime = savedTimeRef.current;
        requestPlay();
      }
    };

    window.addEventListener(WORD_AUDIO_EVENTS.HOVER_PLAYBACK_START, handleClickStart);
    window.addEventListener(WORD_AUDIO_EVENTS.HOVER_PLAYBACK_END, handleClickEnd);

    return () => {
      window.removeEventListener(WORD_AUDIO_EVENTS.HOVER_PLAYBACK_START, handleClickStart);
      window.removeEventListener(WORD_AUDIO_EVENTS.HOVER_PLAYBACK_END, handleClickEnd);
    };
  }, [playing]);

  // Cleanup word audio on close
  const stopWordAudio = useCallback(() => {
    const controller = getWordAudio();
    controller?.stop();
  }, [getWordAudio]);

  // ------- highlight + auto-scroll helpers -------
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

    if (suppressScrollRef.current) return;

    const r = el.getBoundingClientRect(), vh = window.innerHeight || 0;
    const pad = Math.min(200, vh * 0.2);
    const inView = r.top >= pad && r.bottom <= vh - pad;
    if (!inView) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // single: RAF loop mapping currentTime -> active segment (only after activation)
  useEffect(() => {
    if (!isSingle) return;
    const a = audioRef.current; if (!a) return;
    let prev = -1, raf = 0;
    const tick = () => {
      if (playing && activated) {
        const t = a.currentTime;

        // binary search for segment
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
  }, [isSingle, playing, activated, segments]);

  // per-ayah: highlight when verse index changes (only after activation)
  useEffect(() => {
    if (!isSingle && activated) highlightAyah(currentAyah);
  }, [isSingle, currentAyah, activated]);

  // ------- Word-by-word highlighting based on word segments -------
  // Track the currently highlighted word to avoid redundant events
  const prevWordRef = useRef<{ verseNum: number; wordIndex: number } | null>(null);

  // Clear all word highlights
  const clearWordHighlights = useCallback(() => {
    if (prevWordRef.current) {
      emitWordHighlight(
        props.surah,
        prevWordRef.current.verseNum,
        prevWordRef.current.wordIndex,
        false
      );
      prevWordRef.current = null;
    }
  }, [props.surah]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id?: number };
      if (typeof detail?.id !== "number") return;
      if (detail.id === activeReciterId) return;

      const a = audioRef.current;
      const wasPlaying = playing;
      const targetAyah = currentAyah ?? prevWordRef.current?.verseNum;
      const targetWord = prevWordRef.current?.wordIndex;
      const targetTime = a?.currentTime;

      suppressScrollRef.current = true;
      setTimeout(() => {
        suppressScrollRef.current = false;
      }, 400);

      clearWordHighlights();
      if (isSingle) {
        setOverrideTrackUrl("");
        setOverrideSegments([]);
        setOverrideWordSegments([]);
      } else {
        setOverrideItems([]);
        setOverrideWordSegmentsByAyah({});
      }
      if (a) {
        a.pause();
        a.currentTime = 0;
        a.src = "";
        a.removeAttribute("src");
        a.load();
      }
      setPlaying(false);
      setReady(false);
      setActivated(true);

      resumeTargetRef.current = {
        ayah: targetAyah,
        wordIndex: targetWord,
        time: Number.isFinite(targetTime) ? targetTime : undefined,
        autoPlay: wasPlaying,
      };
      resumeAppliedRef.current = false;

      (async () => {
        if (isSingle) {
          const chapter = await fetchChapterRecitation(detail.id);
          if (!chapter) return;
          setOverrideTrackUrl(chapter.trackUrl);
          setOverrideSegments(chapter.segments);
          setOverrideWordSegments(chapter.wordSegments);
          if (a) {
            a.src = chapter.trackUrl;
            a.load();
          }
        } else {
          const perAyah = await fetchPerAyahData(detail.id);
          if (!perAyah) return;
          setOverrideItems(perAyah.items);
          setOverrideWordSegmentsByAyah(perAyah.wordSegmentsByAyah);
          if (a) {
            const verseIdx = targetAyah
              ? perAyah.items.findIndex((it) => it.n === targetAyah)
              : 0;
            const nextIdx = verseIdx >= 0 ? verseIdx : 0;
            setIdx(nextIdx);
            const nextSrc = perAyah.items[nextIdx]?.url ?? "";
            if (nextSrc) {
              a.src = nextSrc;
              a.load();
            }
          }
        }
        setActiveReciterId(detail.id);
      })();
    };

    window.addEventListener("qs-reciter-change", handler as EventListener);
    return () => window.removeEventListener("qs-reciter-change", handler as EventListener);
  }, [
    activeReciterId,
    playing,
    currentAyah,
    isSingle,
    clearWordHighlights,
    fetchChapterRecitation,
    fetchPerAyahData,
  ]);

  useEffect(() => {
    if (!isSingle) {
      return;
    }
  }, [isSingle, items.length, segments.length, wordSegments?.length, wordSegmentsByAyah]);

  // Word highlighting RAF loop for single mode with word segments
  useEffect(() => {
    if (!isSingle || !wordSegments?.length) return;
    const a = audioRef.current;
    if (!a) return;

    let raf = 0;

    const tick = () => {
      // Only highlight when playing and activated
      if (!playing || !activated) {
        // Clear highlight when not playing
        if (prevWordRef.current) {
          clearWordHighlights();
        }
        raf = requestAnimationFrame(tick);
        return;
      }

      const currentTime = a.currentTime;

      // Binary search to find current word segment
      // Segments are sorted by start time
      let lo = 0;
      let hi = wordSegments.length - 1;
      let foundSegment: WordSegment | null = null;

      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const seg = wordSegments[mid];

        if (currentTime >= seg.start && currentTime < seg.end) {
          // Found exact match
          foundSegment = seg;
          break;
        } else if (currentTime < seg.start) {
          hi = mid - 1;
        } else {
          lo = mid + 1;
        }
      }

      // Update highlight state
      const prev = prevWordRef.current;

      if (foundSegment) {
        const maxWords = wordCounts?.get(foundSegment.verseNum);
        if (typeof maxWords === "number" && foundSegment.wordIndex > maxWords) {
          console.warn("[AudioPlayerBar] Invalid word index:", {
            surah: props.surah,
            ayah: foundSegment.verseNum,
            wordIndex: foundSegment.wordIndex,
            maxWords,
          });
          raf = requestAnimationFrame(tick);
          return;
        }
        // Check if this is a different word than currently highlighted
        if (
          !prev ||
          prev.verseNum !== foundSegment.verseNum ||
          prev.wordIndex !== foundSegment.wordIndex
        ) {
          // Clear previous highlight first
          if (prev) {
            emitWordHighlight(props.surah, prev.verseNum, prev.wordIndex, false);
          }
          // Highlight new word
          emitWordHighlight(
            props.surah,
            foundSegment.verseNum,
            foundSegment.wordIndex,
            true
          );
          prevWordRef.current = {
            verseNum: foundSegment.verseNum,
            wordIndex: foundSegment.wordIndex,
          };
        }
      } else {
        // No segment found for current time - clear any existing highlight
        if (prev) {
          emitWordHighlight(props.surah, prev.verseNum, prev.wordIndex, false);
          prevWordRef.current = null;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      // Clear highlight on cleanup
      clearWordHighlights();
    };
  }, [isSingle, wordSegments, playing, activated, props.surah, clearWordHighlights]);

  // Word highlighting RAF loop for per-ayah mode (segments per verse)
  useEffect(() => {
    if (isSingle || !wordSegmentsByAyah) return;
    const a = audioRef.current;
    if (!a) return;

    let raf = 0;

    const tick = () => {
      if (!playing || !activated) {
        if (prevWordRef.current) {
          clearWordHighlights();
        }
        raf = requestAnimationFrame(tick);
        return;
      }

      const ayah = items[idx]?.n;
      const ayahSegments = ayah ? wordSegmentsByAyah[ayah] : undefined;

      if (!ayahSegments?.length) {
        if (prevWordRef.current) {
          clearWordHighlights();
        }
        raf = requestAnimationFrame(tick);
        return;
      }

      const currentTime = a.currentTime;
      let lo = 0;
      let hi = ayahSegments.length - 1;
      let foundSegment: WordSegment | null = null;

      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const seg = ayahSegments[mid];
        if (currentTime >= seg.start && currentTime < seg.end) {
          foundSegment = seg;
          break;
        } else if (currentTime < seg.start) {
          hi = mid - 1;
        } else {
          lo = mid + 1;
        }
      }

      const prev = prevWordRef.current;

      if (foundSegment) {
        const maxWords = wordCounts?.get(foundSegment.verseNum);
        if (typeof maxWords === "number" && foundSegment.wordIndex > maxWords) {
          console.warn("[AudioPlayerBar] Invalid word index:", {
            surah: props.surah,
            ayah: foundSegment.verseNum,
            wordIndex: foundSegment.wordIndex,
            maxWords,
          });
          raf = requestAnimationFrame(tick);
          return;
        }
        if (
          !prev ||
          prev.verseNum !== foundSegment.verseNum ||
          prev.wordIndex !== foundSegment.wordIndex
        ) {
          if (prev) {
            emitWordHighlight(props.surah, prev.verseNum, prev.wordIndex, false);
          }
          emitWordHighlight(
            props.surah,
            foundSegment.verseNum,
            foundSegment.wordIndex,
            true
          );
          prevWordRef.current = {
            verseNum: foundSegment.verseNum,
            wordIndex: foundSegment.wordIndex,
          };
        }
      } else if (prev) {
        emitWordHighlight(props.surah, prev.verseNum, prev.wordIndex, false);
        prevWordRef.current = null;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearWordHighlights();
    };
  }, [isSingle, wordSegmentsByAyah, items, idx, playing, activated, props.surah, clearWordHighlights]);

  // ------- play from verse (both modes) -------
  useEffect(() => {
    function handler(e: Event) {
      const d = (e as CustomEvent).detail as { n?: number; index?: number } || {};
      const n: number | undefined = typeof d.n === "number" ? d.n : undefined;
      const byIndex: number | undefined = typeof d.index === "number" ? d.index : undefined;

      const a = audioRef.current; if (!a) return;

      setVisible(true);
      setActivated(true);

      if (isSingle) {
        let k = -1;
        if (typeof n === "number") {
          k = segments.findIndex((s) => s.n === n);
        } else if (typeof byIndex === "number") {
          k = Math.max(0, Math.min(segments.length - 1, byIndex));
        }
        if (k < 0) return;
        setIdx(k);
        highlightAyah(segments[k]?.n);
        a.currentTime = Math.max(0, segments[k].start + 0.01);
        setTimeout(() => requestPlay(), 20);
      } else {
        let j = -1;
        if (typeof n === "number") {
          j = items.findIndex((it) => it.n === n);
        } else if (typeof byIndex === "number") {
          j = Math.max(0, Math.min(items.length - 1, byIndex));
        }
        if (j < 0) return;
        setIdx(j);
        highlightAyah(items[j]?.n);
        setTimeout(() => requestPlay(), 20);
      }
    }
    window.addEventListener("qs-play-ayah", handler as EventListener);
    return () => window.removeEventListener("qs-play-ayah", handler as EventListener);
  }, [isSingle, segments, items, requestPlay]);

  // ------- play/pause couple -------
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    if (playing) a.play().catch(() => setPlaying(false));
    else a.pause();
  }, [playing, requestPlay]);

  function playPause() {
    if (!ready) return;
    if (!playing) {
      setActivated(true);
    }
    setPlaying((p) => !p);
  }

  function prev() {
    const a = audioRef.current; if (!a) return;
    setActivated(true);
    if (isSingle) {
      const k = Math.max(0, idx - 1), seg = segments[k];
      if (seg) {
        setIdx(k); highlightAyah(seg.n);
        a.currentTime = Math.max(0, seg.start + 0.01);
        setTimeout(() => requestPlay(), 20);
      }
    } else {
      const k = Math.max(0, idx - 1);
      setIdx(k); highlightAyah(items[k]?.n);
      setTimeout(() => requestPlay(), 20);
    }
  }

  function next() {
    const a = audioRef.current; if (!a) return;
    setActivated(true);
    if (isSingle) {
      const k = Math.min(segments.length - 1, idx + 1), seg = segments[k];
      if (seg) {
        setIdx(k); highlightAyah(seg.n);
        a.currentTime = Math.max(0, seg.start + 0.01);
        setTimeout(() => requestPlay(), 20);
      }
    } else {
      const k = Math.min(items.length - 1, idx + 1);
      setIdx(k); highlightAyah(items[k]?.n);
      setTimeout(() => requestPlay(), 20);
    }
  }

  /** Seek on the global timeline (works in both modes). */
  function onSeekGlobal(pct: number) {
    const a = audioRef.current; if (!a) return;
    setActivated(true);

    // Stop any word audio that might be playing from a click
    getWordAudio()?.stop();
    // Clear word highlights - they'll be updated on next RAF tick
    clearWordHighlights();

    if (isSingle) {
      const total = (typeof totalOverride === "number" && totalOverride > 0) ? totalOverride : duration;
      if (!total) return;
      a.currentTime = Math.max(0, Math.min(total, total * pct));
      return;
    }

    // per-ayah -> compute target time and map it to verse+offset
    const durTotal = verseDur.reduce((s, v) => s + (Number.isFinite(v) ? v : DEFAULT_VERSE_SECONDS), 0);
    const target = Math.max(0, Math.min(durTotal, durTotal * pct));

    let acc = 0, k = 0;
    for (; k < verseDur.length; k++) {
      const d = Number.isFinite(verseDur[k]) ? verseDur[k] : DEFAULT_VERSE_SECONDS;
      if (acc + d >= target) {
        const offset = target - acc;
        setIdx(k);
        pendingSeek.current = { toIndex: k, toOffset: offset };
        setTimeout(() => {
          const src = items[k]?.url ?? "";
          if (audioRef.current && audioRef.current.src !== src) {
            audioRef.current.src = src;
          }
          audioRef.current?.load();
          requestPlay();
        }, 10);
        break;
      }
      acc += d;
    }
  }

  // close button: stop & unload audio, hide bar, clear highlight
  function handleClose() {
    const a = audioRef.current;
    try {
      a?.pause();
      if (a) {
        a.currentTime = 0;
        // unload source to fully stop network/decoding
        a.src = "";
        a.removeAttribute("src");
        a.load();
      }
    } catch {}
    setPlaying(false);
    setVisible(false);
    setActivated(false);
    clickPausedRef.current = false;

    // Stop word audio and clear word highlights
    stopWordAudio();
    clearWordHighlights();

    // remove verse highlight if any
    document.querySelectorAll<HTMLElement>("[data-active-ayah]").forEach((e) => {
      e.removeAttribute("data-active-ayah");
      e.classList.remove("active-ayah");
    });

    // remove word highlights if any
    document.querySelectorAll<HTMLElement>("[data-active-word]").forEach((e) => {
      e.removeAttribute("data-active-word");
      e.classList.remove("active-word");
    });
  }

  const label = `${props.surah}:${currentAyah ?? "--"}`;
  const total = isSingle
    ? ((typeof totalOverride === "number" && totalOverride > 0) ? totalOverride : duration)
    : verseDur.reduce((s, v) => s + (Number.isFinite(v) ? v : DEFAULT_VERSE_SECONDS), 0);

  const percent = total ? Math.min(1, time / total) : 0;
  const src = isSingle ? (props as SingleProps).trackUrl : (items[idx]?.url ?? "");

  return (
    <div
      className={[
        "fixed bottom-0 inset-x-0 z-40 glass-surface glass-sheet",
        "transition-transform duration-200",
        visible ? "translate-y-0" : "translate-y-full",
      ].join(" ")}
    >
      <div className="relative w-full">
        <div className="mx-auto max-w-5xl px-4 py-2">
          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-foreground/10"
              onClick={prev}
              aria-label="Previous verse"
              title="Previous verse"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded hover:bg-foreground/10"
              onClick={playPause}
              aria-label={playing ? "Pause" : "Play"}
              title={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>

            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-foreground/10"
              onClick={next}
              aria-label="Next verse"
              title="Next verse"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            {/* Audio timeline scrubber */}
            <div className="flex-1 flex items-center gap-3">
              <div
                className="relative w-full h-2 rounded bg-foreground/10 cursor-pointer"
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  onSeekGlobal(pct);
                }}
                aria-label="Seek"
                title="Seek"
              >
                <div
                  className="absolute inset-y-0 left-0 rounded bg-foreground/60"
                  style={{ width: `${percent * 100}%` }}
                />
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
                title="Volume"
              />
            </div>

            {/* close */}
            <button
              className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded hover:bg-foreground/10"
              onClick={handleClose}
              aria-label="Close"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {reciters && selectedReciterId ? (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <ReciterPicker
              reciters={reciters}
              selectedId={selectedReciterId}
              direction="up"
              align="right"
            />
          </div>
        ) : null}

        <audio ref={audioRef} src={src} preload="auto" />
      </div>
    </div>
  );
}
