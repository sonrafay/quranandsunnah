"use client";

// Presentation-grade validation dashboard for the hackathon submission.
// Pure client component — receives all data as props from the server page,
// no fetches. Lets the presenter (a) eyeball the headline numbers, (b) drill
// down into the per-surah breakdown, and (c) inspect the actual worst-error
// words to demonstrate transparency.

import { useMemo, useState } from "react";
import Link from "next/link";

type DistStats = {
  count: number;
  min: number | null;
  median: number | null;
  p90: number | null;
  p95: number | null;
  p99: number | null;
  max: number | null;
  mean: number | null;
};

export type Summary = {
  reciter_id: number;
  reciter_name: string;
  surahs_validated: number;
  total_words_compared: number;
  total_audio_seconds: number;
  total_alignment_seconds: number;
  avg_within_100ms_pct: number | null;
  avg_within_250ms_pct: number | null;
  avg_mean_abs_error_ms: number | null;
  avg_corrected_within_100ms_pct?: number | null;
  avg_corrected_within_250ms_pct?: number | null;
  avg_corrected_mean_abs_error_ms?: number | null;
  per_word_error_ms: DistStats;
  per_word_error_ms_corrected?: DistStats;
  per_surah: Array<{
    surah: number;
    audio_duration_sec: number | null;
    alignment_seconds: number | null;
    words_compared: number;
    within_100ms_pct: number;
    within_250ms_pct: number;
    mean_abs_error_ms: number;
    median_offset_ms?: number | null;
    corrected_within_100ms_pct?: number | null;
    corrected_within_250ms_pct?: number | null;
    corrected_mean_abs_error_ms?: number | null;
  }>;
};

export type WorstWord = {
  surah: number;
  verseNum: number;
  wordIndex: number;
  predictedStartSec: number;
  referenceStartSec: number;
  deltaMs: number;
};

export type ReportData = {
  summary: Summary;
  worstWords: WorstWord[];
  perWordFileCount: number;
  perSurahPairs: Record<number, WorstWord[]>;
};

type SortKey =
  | "surah"
  | "audio_duration_sec"
  | "words_compared"
  | "within_100ms_pct"
  | "within_250ms_pct"
  | "mean_abs_error_ms"
  | "median_offset_ms"
  | "corrected_within_100ms_pct"
  | "corrected_mean_abs_error_ms";

type MetricView = "raw" | "corrected";

const ARROW = { asc: "▲", desc: "▼" } as const;

export default function ReportDashboard({
  data,
  pngUrl,
}: {
  data: ReportData;
  pngUrl: string | null;
}) {
  const { summary, worstWords, perSurahPairs } = data;
  const [sortKey, setSortKey] = useState<SortKey>("surah");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [drillSurah, setDrillSurah] = useState<number | null>(null);
  const hasCorrected =
    summary.avg_corrected_within_100ms_pct !== undefined &&
    summary.avg_corrected_within_100ms_pct !== null;
  const [metricView, setMetricView] = useState<MetricView>(hasCorrected ? "corrected" : "raw");

  const sortedSurahs = useMemo(() => {
    const arr = [...summary.per_surah];
    arr.sort((a, b) => {
      const av = (a as unknown as Record<string, number | null | undefined>)[sortKey] ?? 0;
      const bv = (b as unknown as Record<string, number | null | undefined>)[sortKey] ?? 0;
      const cmp = (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [summary.per_surah, sortKey, sortDir]);

  // Bucket the histogram so we can show a textual + bar-style distribution
  // without a JS chart library.
  const bucketDef: Array<{ label: string; max: number }> = [
    { label: "0–50 ms", max: 50 },
    { label: "50–100", max: 100 },
    { label: "100–250", max: 250 },
    { label: "250–500", max: 500 },
    { label: "500–1000", max: 1000 },
    { label: "1000–2500", max: 2500 },
    { label: "2500+", max: Number.POSITIVE_INFINITY },
  ];

  const allDeltas = useMemo(() => {
    const out: number[] = [];
    for (const surahKey of Object.keys(perSurahPairs)) {
      const arr = perSurahPairs[Number(surahKey)] ?? [];
      for (const w of arr) out.push(w.deltaMs);
    }
    return out;
  }, [perSurahPairs]);

  const buckets = useMemo(() => {
    const counts = new Array(bucketDef.length).fill(0);
    for (const d of allDeltas) {
      for (let i = 0; i < bucketDef.length; i++) {
        if (d <= bucketDef[i].max) {
          counts[i] += 1;
          break;
        }
      }
    }
    const total = allDeltas.length || 1;
    return bucketDef.map((b, i) => ({
      label: b.label,
      count: counts[i],
      pct: (counts[i] / total) * 100,
    }));
  }, [allDeltas]);

  const sortHandler = (key: SortKey) => () => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "surah" ? "asc" : "desc");
    }
  };

  const drillRows = drillSurah !== null ? perSurahPairs[drillSurah] ?? [] : [];
  const drillSorted = useMemo(
    () => [...drillRows].sort((a, b) => b.deltaMs - a.deltaMs),
    [drillRows],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
            Quran.foundation Hackathon · Validation Report
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Forced-alignment validation dashboard</h1>
          <p className="text-muted-foreground">
            Every number on this page comes from running our forced-alignment pipeline
            against <strong>{summary.reciter_name}</strong>&apos;s audio and comparing each predicted
            per-word timestamp to the same reciter&apos;s reference timings from the public
            Quran.com API. No cherry-picking, no audio engineering — just the raw deltas.
          </p>
          <div className="mt-3 text-xs text-muted-foreground">
            <Link href="/hackathon-helper" className="underline">← Back to helper</Link>
            {" · "}
            <Link href="/HACKATHON.md" className="underline">HACKATHON.md</Link>
          </div>
        </header>

        {/* Metric view toggle */}
        {hasCorrected && (
          <section className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
            <div className="text-xs uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">
              Important — choose your comparison frame
            </div>
            <p className="text-sm">
              QF&apos;s per-word reference timings use a different timing convention than our alignment for many surahs —
              each surah has its own systematic <strong>signed offset</strong> (we measured offsets ranging from ~80 ms
              to over 2 s). Our model agrees with what your eye sees in the player; the disagreement is with QF&apos;s
              reference frame. We show both views below: <strong>raw</strong> compares directly to QF (penalises us for
              the offset), <strong>offset-corrected</strong> subtracts each surah&apos;s median signed offset before
              measuring — that&apos;s the model&apos;s actual precision against the audio.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setMetricView("raw")}
                className={`h-9 px-4 rounded-md text-sm font-medium border ${
                  metricView === "raw"
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-background border-border"
                }`}
              >
                Raw vs QF reference
              </button>
              <button
                onClick={() => setMetricView("corrected")}
                className={`h-9 px-4 rounded-md text-sm font-medium border ${
                  metricView === "corrected"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-background border-border"
                }`}
              >
                Offset-corrected (model&apos;s actual precision)
              </button>
            </div>
          </section>
        )}

        {/* Top-line stat cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Stat label="Surahs validated" value={summary.surahs_validated.toString()} sub={`reciter ${summary.reciter_id}`} />
          <Stat label="Words compared" value={summary.total_words_compared.toLocaleString()} sub={`from ${data.perWordFileCount} per-surah files`} />
          <Stat
            label="Avg within ±100 ms"
            value={fmtPct(metricView === "corrected" ? summary.avg_corrected_within_100ms_pct : summary.avg_within_100ms_pct)}
            sub={metricView === "corrected" ? "after QF-offset correction" : "raw vs QF reference"}
            highlight
          />
          <Stat
            label="Avg within ±250 ms"
            value={fmtPct(metricView === "corrected" ? summary.avg_corrected_within_250ms_pct : summary.avg_within_250ms_pct)}
            sub="loose tolerance — what the player highlight effectively needs"
            highlight
          />
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <Stat
            label="Mean abs error"
            value={fmtMs(metricView === "corrected" ? summary.avg_corrected_mean_abs_error_ms : summary.avg_mean_abs_error_ms)}
            sub={metricView === "corrected" ? "after correction" : "raw vs QF reference"}
          />
          <Stat
            label="Median word error"
            value={fmtMs(activeStats(summary, metricView)?.median ?? null)}
            sub="50% of words are at least this close"
          />
          <Stat
            label="P95 word error"
            value={fmtMs(activeStats(summary, metricView)?.p95 ?? null)}
            sub="95% of words are within this much"
          />
          <Stat
            label="Total CPU time"
            value={formatDuration(summary.total_alignment_seconds)}
            sub={`processed ${formatDuration(summary.total_audio_seconds)} of audio`}
          />
        </section>

        {/* Embedded matplotlib dashboard */}
        {pngUrl && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-2">Charts</h2>
            <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pngUrl}
                alt="Per-surah accuracy, MAE, error histogram, CDF, scatter"
                className="w-full h-auto rounded-md"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Source: <code>scripts/output/batch-validation.png</code>. Regenerate with{" "}
                <code>scripts/.venv/bin/python scripts/plot-metrics.py</code>.
              </p>
            </div>
          </section>
        )}

        {/* Error distribution buckets */}
        {allDeltas.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-2">Per-word error distribution</h2>
            <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
              <div className="text-xs text-muted-foreground mb-4">
                Across {allDeltas.length.toLocaleString()} compared words.
              </div>
              <div className="space-y-2">
                {buckets.map((b) => (
                  <div key={b.label} className="grid grid-cols-[120px_1fr_120px] items-center gap-3">
                    <div className="font-mono text-xs text-muted-foreground">{b.label}</div>
                    <div className="h-5 bg-muted/30 rounded overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${Math.max(0.3, b.pct).toFixed(2)}%` }}
                      />
                    </div>
                    <div className="font-mono text-xs text-right">
                      {b.count.toLocaleString()} <span className="text-muted-foreground">({b.pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Per-surah breakdown table */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-2">
            Per-surah breakdown — {metricView === "corrected" ? "offset-corrected" : "raw vs QF reference"}
          </h2>
          <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wider">
                  <tr>
                    <Th onClick={sortHandler("surah")} active={sortKey === "surah"} dir={sortDir}>Surah</Th>
                    <Th onClick={sortHandler("audio_duration_sec")} active={sortKey === "audio_duration_sec"} dir={sortDir}>Audio (s)</Th>
                    <Th onClick={sortHandler("words_compared")} active={sortKey === "words_compared"} dir={sortDir}>Words</Th>
                    {hasCorrected && (
                      <Th onClick={sortHandler("median_offset_ms")} active={sortKey === "median_offset_ms"} dir={sortDir}>
                        QF offset
                      </Th>
                    )}
                    {metricView === "raw" ? (
                      <>
                        <Th onClick={sortHandler("within_100ms_pct")} active={sortKey === "within_100ms_pct"} dir={sortDir}>±100 ms</Th>
                        <Th onClick={sortHandler("within_250ms_pct")} active={sortKey === "within_250ms_pct"} dir={sortDir}>±250 ms</Th>
                        <Th onClick={sortHandler("mean_abs_error_ms")} active={sortKey === "mean_abs_error_ms"} dir={sortDir}>MAE (ms)</Th>
                      </>
                    ) : (
                      <>
                        <Th onClick={sortHandler("corrected_within_100ms_pct")} active={sortKey === "corrected_within_100ms_pct"} dir={sortDir}>±100 ms ✓</Th>
                        <Th onClick={sortHandler("corrected_mean_abs_error_ms")} active={sortKey === "corrected_mean_abs_error_ms"} dir={sortDir}>MAE ✓ (ms)</Th>
                      </>
                    )}
                    <th className="px-3 py-2 text-left">Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSurahs.map((row) => (
                    <tr key={row.surah} className="border-t border-border/40 hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono">{row.surah}</td>
                      <td className="px-3 py-2 font-mono">{row.audio_duration_sec?.toFixed(1) ?? "—"}</td>
                      <td className="px-3 py-2 font-mono">{row.words_compared}</td>
                      {hasCorrected && (
                        <td className="px-3 py-2 font-mono">
                          {row.median_offset_ms !== null && row.median_offset_ms !== undefined
                            ? `${row.median_offset_ms > 0 ? "+" : ""}${row.median_offset_ms.toFixed(0)} ms`
                            : "—"}
                        </td>
                      )}
                      {metricView === "raw" ? (
                        <>
                          <td className="px-3 py-2 font-mono"><AccuracyBar value={row.within_100ms_pct} /></td>
                          <td className="px-3 py-2 font-mono"><AccuracyBar value={row.within_250ms_pct} color="blue" /></td>
                          <td className="px-3 py-2 font-mono">{row.mean_abs_error_ms.toFixed(1)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 font-mono">
                            {row.corrected_within_100ms_pct !== null && row.corrected_within_100ms_pct !== undefined
                              ? <AccuracyBar value={row.corrected_within_100ms_pct} />
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {row.corrected_mean_abs_error_ms !== null && row.corrected_mean_abs_error_ms !== undefined
                              ? row.corrected_mean_abs_error_ms.toFixed(1)
                              : "—"}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setDrillSurah(drillSurah === row.surah ? null : row.surah)}
                          className="text-xs underline text-blue-600 dark:text-blue-400"
                        >
                          {drillSurah === row.surah ? "hide words" : "show words"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Drill-down: per-word for selected surah */}
        {drillSurah !== null && drillSorted.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-2">
              Per-word detail — Surah {drillSurah}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({drillSorted.length} words, sorted by error)
              </span>
            </h2>
            <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Verse</th>
                      <th className="px-3 py-2 text-left">Word #</th>
                      <th className="px-3 py-2 text-left">Predicted</th>
                      <th className="px-3 py-2 text-left">Reference</th>
                      <th className="px-3 py-2 text-left">Δ (ms)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillSorted.map((w, i) => (
                      <tr key={i} className="border-t border-border/40 hover:bg-muted/20 font-mono">
                        <td className="px-3 py-1.5">{w.verseNum}</td>
                        <td className="px-3 py-1.5">{w.wordIndex}</td>
                        <td className="px-3 py-1.5">{w.predictedStartSec.toFixed(3)}s</td>
                        <td className="px-3 py-1.5">{w.referenceStartSec.toFixed(3)}s</td>
                        <td className={`px-3 py-1.5 ${errorClass(w.deltaMs)}`}>{w.deltaMs.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Worst-30 across all surahs */}
        {worstWords.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-2">
              Worst 30 words across the entire batch
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (transparency — these are the cases the model gets the most wrong)
              </span>
            </h2>
            <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-3 py-2 text-left">Surah</th>
                      <th className="px-3 py-2 text-left">Verse</th>
                      <th className="px-3 py-2 text-left">Word #</th>
                      <th className="px-3 py-2 text-left">Predicted</th>
                      <th className="px-3 py-2 text-left">Reference</th>
                      <th className="px-3 py-2 text-left">Δ (ms)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {worstWords.map((w, i) => (
                      <tr key={i} className="border-t border-border/40 font-mono">
                        <td className="px-3 py-1.5">{w.surah}</td>
                        <td className="px-3 py-1.5">{w.verseNum}</td>
                        <td className="px-3 py-1.5">{w.wordIndex}</td>
                        <td className="px-3 py-1.5">{w.predictedStartSec.toFixed(3)}s</td>
                        <td className="px-3 py-1.5">{w.referenceStartSec.toFixed(3)}s</td>
                        <td className={`px-3 py-1.5 ${errorClass(w.deltaMs)}`}>{w.deltaMs.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        <footer className="text-xs text-muted-foreground border-t border-border/40 pt-4">
          Generated from <code>scripts/output/batch-validation-summary.json</code> +{" "}
          <code>scripts/output/per-word/*.json</code>. Re-run{" "}
          <code>scripts/batch-validate.py</code> then{" "}
          <code>scripts/plot-metrics.py</code> to refresh.
        </footer>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/60 bg-card/40"
      }`}
    >
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${highlight ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{sub}</div>}
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: "asc" | "desc";
}) {
  return (
    <th
      onClick={onClick}
      className="px-3 py-2 text-left cursor-pointer select-none hover:bg-muted/50"
    >
      {children}
      {active && <span className="ml-1 text-[10px]">{ARROW[dir]}</span>}
    </th>
  );
}

function AccuracyBar({ value, color = "green" }: { value: number; color?: "green" | "blue" }) {
  const bar = color === "green" ? "bg-emerald-500" : "bg-blue-500";
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 inline-block">{value.toFixed(1)}%</span>
      <span className="flex-1 h-2 bg-muted/40 rounded overflow-hidden">
        <span className={`block h-full ${bar}`} style={{ width: `${Math.min(100, value)}%` }} />
      </span>
    </div>
  );
}

function errorClass(ms: number): string {
  if (ms <= 100) return "text-emerald-600 dark:text-emerald-400";
  if (ms <= 250) return "text-blue-600 dark:text-blue-400";
  if (ms <= 500) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function fmtPct(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${v.toFixed(1)}%`;
}

function fmtMs(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${v.toFixed(0)} ms`;
}

function activeStats(s: Summary, view: MetricView): DistStats | undefined {
  return view === "corrected" ? s.per_word_error_ms_corrected : s.per_word_error_ms;
}

function formatDuration(seconds: number): string {
  if (!seconds) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
