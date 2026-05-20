"use client";

// HackathonHelperClient
//
// Form UI + SSE consumer for /api/hackathon-align. Kept deliberately simple:
// one form, one log stream, one "your demos" list. No global state, no router
// integration — this page is a hackathon-only sandbox.

import { useCallback, useMemo, useRef, useState } from "react";
import type { DemoRegistryEntry } from "@/lib/demoRegistry";
import { surahs } from "@/lib/quran-meta";

type LogLine = { kind: "stdout" | "stderr" | "info" | "error" | "done"; text: string };

type Props = {
  initialDemos: DemoRegistryEntry[];
};

// Surahs that don't get a leading Bismillah recitation: 1 (the Bismillah is the
// first ayah itself, so QF includes it natively) and 9 (no Bismillah at all).
// Everything else: default the toggle ON because most reciters prepend it.
function defaultPrependBismillah(surah: number): boolean {
  return surah !== 1 && surah !== 9;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export default function HackathonHelperClient({ initialDemos }: Props) {
  // -------- form state --------
  const [name, setName] = useState("");
  const [surah, setSurah] = useState(1);
  const [audioSource, setAudioSource] = useState<"file" | "youtube">("file");
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [prependBismillah, setPrependBismillah] = useState(defaultPrependBismillah(1));
  const [bismillahTouched, setBismillahTouched] = useState(false);

  // -------- run state --------
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<{
    slug: string;
    surah: number;
    reciterId: number;
    validation?: string;
  } | null>(null);
  const [demos, setDemos] = useState<DemoRegistryEntry[]>(initialDemos);
  const logEndRef = useRef<HTMLDivElement>(null);

  const derivedSlug = useMemo(() => slugify(name) || "untitled", [name]);

  const handleSurahChange = useCallback((v: number) => {
    setSurah(v);
    if (!bismillahTouched) setPrependBismillah(defaultPrependBismillah(v));
  }, [bismillahTouched]);

  const appendLog = useCallback((line: LogLine) => {
    setLogs((prev) => [...prev, line]);
    queueMicrotask(() => {
      logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setLogs([]);
    setError(null);
    setCompleted(null);
  }, []);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (running) return;
    if (!name.trim()) {
      setError("Reciter name is required.");
      return;
    }
    if (audioSource === "file" && !file) {
      setError("Pick an audio file or switch to a YouTube URL.");
      return;
    }
    if (audioSource === "youtube" && !youtubeUrl.trim()) {
      setError("YouTube URL is required.");
      return;
    }

    setRunning(true);
    setLogs([]);
    setError(null);
    setCompleted(null);

    const form = new FormData();
    form.append("name", name.trim());
    form.append("slug", derivedSlug);
    form.append("surah", String(surah));
    form.append("prependBismillah", prependBismillah ? "1" : "0");
    form.append("audioSource", audioSource);
    if (audioSource === "file" && file) form.append("audio", file);
    if (audioSource === "youtube") form.append("youtubeUrl", youtubeUrl.trim());

    try {
      const res = await fetch("/api/hackathon-align", { method: "POST", body: form });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const evt of lines) {
          if (!evt.startsWith("data:")) continue;
          const payload = evt.replace(/^data:\s?/, "");
          try {
            const parsed = JSON.parse(payload) as
              | { type: "log"; stream: "stdout" | "stderr"; text: string }
              | { type: "info"; text: string }
              | { type: "error"; text: string }
              | { type: "done"; entry: DemoRegistryEntry; surah: number; validation?: string };
            if (parsed.type === "log") {
              appendLog({ kind: parsed.stream, text: parsed.text });
            } else if (parsed.type === "info") {
              appendLog({ kind: "info", text: parsed.text });
            } else if (parsed.type === "error") {
              appendLog({ kind: "error", text: parsed.text });
              setError(parsed.text);
            } else if (parsed.type === "done") {
              appendLog({ kind: "done", text: "Alignment complete." });
              setCompleted({
                slug: parsed.entry.slug,
                surah: parsed.surah,
                reciterId: parsed.entry.id,
                validation: parsed.validation,
              });
              setDemos((prev) => {
                const existing = prev.find((d) => d.slug === parsed.entry.slug);
                if (existing) {
                  return prev.map((d) => (d.slug === parsed.entry.slug ? parsed.entry : d));
                }
                return [...prev, parsed.entry];
              });
            }
          } catch {
            appendLog({ kind: "stderr", text: payload });
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      appendLog({ kind: "error", text: msg });
    } finally {
      setRunning(false);
    }
  }, [running, name, derivedSlug, surah, prependBismillah, audioSource, file, youtubeUrl, appendLog]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-10">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            Quran.foundation Hackathon · Helper Tool
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Forced-Alignment Helper</h1>
          <p className="text-muted-foreground max-w-2xl">
            Upload any recitation audio (or paste a YouTube link), pick a surah, and we&apos;ll
            produce per-word timestamps that drop into the existing player&apos;s word-highlight
            system. Built on top of Meta&apos;s <code className="text-foreground">wav2vec2-mms</code>{" "}
            forced-alignment model with ground-truth Arabic from the public Quran.com API.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            See <code className="text-foreground">HACKATHON.md</code> at the repo root for architecture
            and edge-case handling. Source for this tool lives in{" "}
            <code className="text-foreground">scripts/align-audio.py</code>,{" "}
            <code className="text-foreground">src/app/hackathon-helper/</code>, and{" "}
            <code className="text-foreground">src/app/api/hackathon-align/</code>.
          </p>
          <div className="mt-3">
            <a
              href="/hackathon-helper/report"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
            >
              📊 View validation report dashboard →
            </a>
          </div>
        </header>

        <section className="rounded-2xl border border-border/60 bg-card/40 p-6 mb-10">
          <h2 className="text-lg font-semibold mb-4">Generate alignment</h2>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Reciter name */}
            <div className="md:col-span-1">
              <label className="block text-sm font-medium mb-1">Reciter name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Yasser Al-Dosari"
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                disabled={running}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Saved as <code className="text-foreground">public/demo/{derivedSlug}/</code>
              </p>
            </div>

            {/* Surah */}
            <div>
              <label className="block text-sm font-medium mb-1">Surah</label>
              <select
                value={surah}
                onChange={(e) => handleSurahChange(parseInt(e.target.value, 10))}
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                disabled={running}
              >
                {surahs.map((s) => (
                  <option key={s.number} value={s.number}>
                    {s.number}. {s.englishName}
                  </option>
                ))}
              </select>
            </div>

            {/* Audio source toggle */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Audio source</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAudioSource("file")}
                  disabled={running}
                  className={`flex-1 h-10 rounded-md border text-sm ${
                    audioSource === "file"
                      ? "bg-green-500/15 border-green-500/40 text-green-700 dark:text-green-400"
                      : "bg-background"
                  }`}
                >
                  Upload audio file
                </button>
                <button
                  type="button"
                  onClick={() => setAudioSource("youtube")}
                  disabled={running}
                  className={`flex-1 h-10 rounded-md border text-sm ${
                    audioSource === "youtube"
                      ? "bg-green-500/15 border-green-500/40 text-green-700 dark:text-green-400"
                      : "bg-background"
                  }`}
                >
                  YouTube URL
                </button>
              </div>
            </div>

            {/* File picker / YouTube URL */}
            <div className="md:col-span-2">
              {audioSource === "file" ? (
                <>
                  <label className="block text-sm font-medium mb-1">Audio file</label>
                  <input
                    type="file"
                    accept="audio/*,video/*,.mp3,.mp4,.wav,.webm,.m4a,.ogg,.mkv"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    disabled={running}
                    className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:bg-background file:text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    MP3, M4A, WAV, MP4, WebM, MKV — anything ffmpeg can read.
                  </p>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium mb-1">YouTube URL</label>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    disabled={running}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Audio is downloaded server-side with <code>yt-dlp</code>.
                  </p>
                </>
              )}
            </div>

            {/* Prepend Bismillah */}
            <div className="md:col-span-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prependBismillah}
                  onChange={(e) => {
                    setPrependBismillah(e.target.checked);
                    setBismillahTouched(true);
                  }}
                  disabled={running}
                  className="mt-1"
                />
                <span className="text-sm">
                  <span className="font-medium">Recording starts with Bismillah</span>
                  <span className="block text-xs text-muted-foreground">
                    Aligns the leading{" "}
                    <span dir="rtl" className="font-quran">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>{" "}
                    that most reciters say before non-Fatiha surahs. QF&apos;s word list omits it, so
                    this toggle prepends it before alignment. Auto-enabled for surahs other than
                    Al-Fatiha (1) and At-Tawbah (9).
                  </span>
                </span>
              </label>
            </div>

            <div className="md:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={running}
                className="h-10 px-5 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {running ? "Aligning…" : "Generate alignment"}
              </button>
              {(running || logs.length > 0) && (
                <button
                  type="button"
                  onClick={reset}
                  disabled={running}
                  className="h-10 px-4 rounded-md border text-sm disabled:opacity-50"
                >
                  Clear
                </button>
              )}
              {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
            </div>
          </form>
        </section>

        {/* Log stream */}
        {(running || logs.length > 0 || completed) && (
          <section className="rounded-2xl border border-border/60 bg-card/40 p-6 mb-10">
            <h2 className="text-lg font-semibold mb-3">Progress</h2>
            <div className="rounded-md bg-zinc-950 text-zinc-200 font-mono text-xs p-4 max-h-[420px] overflow-auto">
              {logs.length === 0 && running && <div className="text-zinc-500">Starting…</div>}
              {logs.map((l, i) => (
                <div key={i} className={logClass(l.kind)}>
                  {prefixForLog(l.kind)}
                  {l.text}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>

            {completed && (
              <div className="mt-4 rounded-md border border-green-500/40 bg-green-500/10 p-4">
                <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                  Alignment complete
                </div>
                {completed.validation && (
                  <div className="text-xs text-muted-foreground mb-2 font-mono">
                    {completed.validation}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/quran/${completed.surah}?r=${completed.reciterId}&ap=1`}
                    className="h-9 px-4 inline-flex items-center rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-medium"
                  >
                    Open in player (Surah {completed.surah})
                  </a>
                  <a
                    href={`/demo/${completed.slug}/${String(completed.surah).padStart(3, "0")}.json`}
                    target="_blank"
                    rel="noreferrer"
                    className="h-9 px-4 inline-flex items-center rounded-md border text-sm"
                  >
                    Inspect JSON
                  </a>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Existing demos */}
        <section className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <h2 className="text-lg font-semibold mb-1">Your demos</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Each entry is a forced-alignment JSON committed to{" "}
            <code className="text-foreground">public/demo/&lt;slug&gt;/</code>. Open in the main
            player to see word highlights follow the audio.
          </p>
          {demos.length === 0 ? (
            <div className="text-sm text-muted-foreground">No demos yet — generate one above.</div>
          ) : (
            <ul className="divide-y divide-border/60">
              {demos.map((d) => (
                <li key={d.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{d.displayName}</div>
                    <div className="text-xs text-muted-foreground">
                      slug: <code>{d.slug}</code> · id: {d.id} · surahs:{" "}
                      {d.surahs.length ? d.surahs.join(", ") : "—"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {d.surahs.map((s) => (
                      <a
                        key={s}
                        href={`/quran/${s}?r=${d.id}&ap=1`}
                        className="h-8 px-3 inline-flex items-center rounded-md border text-xs hover:bg-muted/50"
                      >
                        Play Surah {s}
                      </a>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function prefixForLog(kind: LogLine["kind"]): string {
  switch (kind) {
    case "stderr": return "! ";
    case "info":   return ">> ";
    case "error":  return "✗ ";
    case "done":   return "✓ ";
    default:       return "";
  }
}

function logClass(kind: LogLine["kind"]): string {
  switch (kind) {
    case "stderr": return "text-amber-300";
    case "info":   return "text-sky-300";
    case "error":  return "text-red-400 font-semibold";
    case "done":   return "text-green-400 font-semibold";
    default:       return "text-zinc-200";
  }
}
