#!/usr/bin/env python3
"""Render the batch-validation CSV + per-word JSONs into a presentation-grade
dashboard for the hackathon.

Reads:
  - scripts/output/batch-validation.csv (from batch-validate.py)
  - scripts/output/per-word/r{id}_s{NNN}.json (per-word deltas, also from batch-validate.py)

Writes:
  - scripts/output/batch-validation.png       : 4-panel dashboard (bars + histogram + CDF + scatter)
  - scripts/output/batch-validation-summary.json : machine-readable summary (read by /hackathon-helper/report)
  - scripts/output/batch-validation-summary.txt  : one-glance text summary

Requires matplotlib in the venv.
"""

from __future__ import annotations

import argparse
import csv
import json
import statistics
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "scripts" / "output"
PER_WORD_DIR = OUTPUT_DIR / "per-word"
DEFAULT_CSV = OUTPUT_DIR / "batch-validation.csv"
DEFAULT_PNG = OUTPUT_DIR / "batch-validation.png"
DEFAULT_TXT = OUTPUT_DIR / "batch-validation-summary.txt"
DEFAULT_JSON = OUTPUT_DIR / "batch-validation-summary.json"


def read_rows(csv_path: Path) -> list[dict]:
    rows: list[dict] = []
    with csv_path.open() as f:
        for row in csv.DictReader(f):
            if row.get("status") != "ok":
                continue
            try:
                rows.append({
                    "surah": int(row["surah"]),
                    "audio_duration_sec": float(row["audio_duration_sec"]) if row.get("audio_duration_sec") else None,
                    "alignment_seconds": float(row["alignment_seconds"]) if row.get("alignment_seconds") else None,
                    "within_100ms_pct": float(row["within_100ms_pct"]),
                    "within_250ms_pct": float(row["within_250ms_pct"]),
                    "mean_abs_error_ms": float(row["mean_abs_error_ms"]),
                    "words_compared": int(row["words_compared"]),
                })
            except (KeyError, ValueError):
                continue
    rows.sort(key=lambda r: r["surah"])
    return rows


def gather_all_deltas(per_word_dir: Path) -> tuple[list[float], dict[int, list[float]], dict[int, dict]]:
    """Walk per-word JSONs and return:
      - all_deltas: every |predicted - reference| in ms (raw)
      - deltas_by_surah: same but keyed by surah
      - per_surah_offset: { surah: { median_offset_ms, corrected_deltas, ... } }

    The "offset-corrected" deltas subtract the surah's median *signed* offset
    from each per-word signed delta, then take abs. This isolates the model's
    intrinsic precision from any surah-wide systematic offset in QF's reference
    timings (which we found vary from +88 ms to +2625 ms across surahs — a
    strong signal that QF marks word slots, not audible onsets).
    """
    all_deltas: list[float] = []
    by_surah: dict[int, list[float]] = {}
    per_surah_offset: dict[int, dict] = {}
    if not per_word_dir.exists():
        return all_deltas, by_surah, per_surah_offset
    for p in sorted(per_word_dir.glob("*.json")):
        try:
            data = json.loads(p.read_text())
        except Exception:
            continue
        surah = int(data.get("surah", 0))
        pairs = data.get("pairs", []) or []
        signed = [
            (pair["predicted_start"] * 1000.0 - pair["reference_start_ms"])
            for pair in pairs
            if pair.get("reference_start_ms") is not None
        ]
        if not signed:
            continue
        signed_sorted = sorted(signed)
        median_offset = signed_sorted[len(signed_sorted) // 2]
        raw_abs = [abs(s) for s in signed]
        corrected_abs = [abs(s - median_offset) for s in signed]
        by_surah.setdefault(surah, []).extend(raw_abs)
        all_deltas.extend(raw_abs)
        per_surah_offset[surah] = {
            "median_offset_ms": round(median_offset, 1),
            "corrected_deltas": corrected_abs,
            "raw_deltas": raw_abs,
            "n_words": len(signed),
        }
    return all_deltas, by_surah, per_surah_offset


def _pct_within(values: list[float], tol: float) -> float:
    if not values:
        return 0.0
    return round(100.0 * sum(1 for v in values if v <= tol) / len(values), 1)


def percentile(sorted_values: list[float], p: float) -> float | None:
    if not sorted_values:
        return None
    k = max(0, min(len(sorted_values) - 1, int(round((p / 100.0) * (len(sorted_values) - 1)))))
    return float(sorted_values[k])


def render(rows: list[dict], all_deltas: list[float], all_corrected: list[float], out_png: Path) -> None:
    import matplotlib.pyplot as plt
    import numpy as np

    if not rows:
        print("[WARN] No 'ok' rows in CSV; nothing to plot.", file=sys.stderr)
        return

    surahs = [r["surah"] for r in rows]
    p100 = [r["within_100ms_pct"] for r in rows]
    p250 = [r["within_250ms_pct"] for r in rows]
    mae = [r["mean_abs_error_ms"] for r in rows]
    durations = [r["audio_duration_sec"] for r in rows]

    fig = plt.figure(figsize=(max(13, len(rows) * 0.32), 12))
    gs = fig.add_gridspec(3, 2, height_ratios=[1.2, 1, 1], hspace=0.45, wspace=0.25)
    ax1 = fig.add_subplot(gs[0, :])
    ax2 = fig.add_subplot(gs[1, 0])
    ax3 = fig.add_subplot(gs[1, 1])
    ax4 = fig.add_subplot(gs[2, 0])
    ax5 = fig.add_subplot(gs[2, 1])

    # ---- (1) per-surah accuracy bars ----
    x = list(range(len(surahs)))
    width = 0.4
    ax1.bar([i - width / 2 for i in x], p100, width=width, label="within ±100 ms", color="#10b981")
    ax1.bar([i + width / 2 for i in x], p250, width=width, label="within ±250 ms", color="#3b82f6")
    ax1.set_xticks(x)
    ax1.set_xticklabels([str(s) for s in surahs], rotation=0, fontsize=7)
    ax1.set_ylim(0, 105)
    ax1.set_ylabel("Accuracy (%)")
    ax1.set_xlabel("Surah")
    ax1.set_title("Per-surah accuracy vs QF reference timings", loc="left", fontweight="bold")
    ax1.grid(axis="y", linestyle=":", alpha=0.5)
    ax1.legend(loc="lower right", framealpha=0.9)
    avg100 = statistics.mean(p100)
    avg250 = statistics.mean(p250)
    ax1.axhline(avg100, color="#065f46", linestyle="--", linewidth=1, alpha=0.7)
    ax1.text(len(surahs) - 0.4, avg100 - 4, f"avg ±100ms = {avg100:.1f}%",
             color="#065f46", fontsize=8, ha="right")
    ax1.axhline(avg250, color="#1e3a8a", linestyle="--", linewidth=1, alpha=0.7)
    ax1.text(len(surahs) - 0.4, avg250 + 1, f"avg ±250ms = {avg250:.1f}%",
             color="#1e3a8a", fontsize=8, ha="right")

    # ---- (2) per-surah MAE bars ----
    ax2.bar(x, mae, width=0.65, color="#f59e0b")
    ax2.set_xticks(x)
    ax2.set_xticklabels([str(s) for s in surahs], rotation=0, fontsize=6)
    ax2.set_ylabel("Mean abs error (ms)")
    ax2.set_xlabel("Surah")
    ax2.set_title("Per-surah mean absolute timing error", loc="left", fontweight="bold")
    ax2.grid(axis="y", linestyle=":", alpha=0.5)
    avg_mae = statistics.mean(mae)
    ax2.axhline(avg_mae, color="#7c2d12", linestyle="--", linewidth=1, alpha=0.7)
    ax2.text(len(surahs) - 0.4, avg_mae + max(mae) * 0.02, f"avg = {avg_mae:.1f} ms",
             color="#7c2d12", fontsize=8, ha="right")

    # ---- (3) overall error histogram ----
    if all_deltas:
        # Clip the histogram at 1000 ms so the tail doesn't dominate; we still
        # report p95/p99/max in the bar annotation.
        clip = 1000.0
        clipped = [min(d, clip) for d in all_deltas]
        bins = list(range(0, int(clip) + 25, 25))
        ax3.hist(clipped, bins=bins, color="#3b82f6", edgecolor="#1e3a8a", linewidth=0.5)
        ax3.set_xlabel("Per-word timing error (ms, clipped at 1000)")
        ax3.set_ylabel("Words")
        ax3.set_title(f"Error distribution across {len(all_deltas)} words", loc="left", fontweight="bold")
        ax3.grid(axis="y", linestyle=":", alpha=0.5)
        ax3.axvline(100, color="#10b981", linestyle="--", linewidth=1, label="±100 ms")
        ax3.axvline(250, color="#1e3a8a", linestyle="--", linewidth=1, label="±250 ms")
        ax3.legend(loc="upper right", framealpha=0.9)
    else:
        ax3.text(0.5, 0.5, "No per-word data — run batch-validate.py first.",
                 ha="center", va="center", fontsize=10, color="#999")
        ax3.set_axis_off()

    # ---- (4) CDF (raw vs offset-corrected) ----
    if all_deltas:
        sorted_d = sorted(all_deltas)
        n = len(sorted_d)
        ys = [100 * (i + 1) / n for i in range(n)]
        ax4.plot(sorted_d, ys, color="#f59e0b", linewidth=2,
                 label=f"Raw vs QF reference (n={n})")
        if all_corrected:
            sorted_c = sorted(all_corrected)
            nc = len(sorted_c)
            yc = [100 * (i + 1) / nc for i in range(nc)]
            ax4.plot(sorted_c, yc, color="#10b981", linewidth=2,
                     label=f"Offset-corrected (n={nc})")
        ax4.set_xscale("log")
        ax4.set_xlim(1, max(10000, max(sorted_d) + 100))
        ax4.set_xlabel("Per-word error (ms, log scale)")
        ax4.set_ylabel("Cumulative % of words")
        ax4.set_title("CDF: raw vs offset-corrected", loc="left", fontweight="bold")
        ax4.grid(linestyle=":", alpha=0.5)
        ax4.axvline(100, color="#065f46", linestyle="--", linewidth=1, alpha=0.5)
        ax4.axvline(250, color="#1e3a8a", linestyle="--", linewidth=1, alpha=0.5)
        ax4.legend(loc="lower right", framealpha=0.9, fontsize=8)
    else:
        ax4.text(0.5, 0.5, "No per-word data.", ha="center", va="center", color="#999")
        ax4.set_axis_off()

    # ---- (5) MAE vs audio duration scatter ----
    if any(d is not None for d in durations):
        valid = [(d, m, s) for d, m, s in zip(durations, mae, surahs) if d is not None]
        xs = [v[0] for v in valid]
        ys = [v[1] for v in valid]
        ax5.scatter(xs, ys, s=30, alpha=0.7, color="#f59e0b", edgecolor="#7c2d12")
        for d, m, s in valid:
            ax5.annotate(str(s), (d, m), xytext=(3, 3), textcoords="offset points", fontsize=6, color="#666")
        ax5.set_xlabel("Audio duration (s)")
        ax5.set_ylabel("Mean abs error (ms)")
        ax5.set_title("Does accuracy degrade with longer audio?", loc="left", fontweight="bold")
        ax5.grid(linestyle=":", alpha=0.5)
    else:
        ax5.set_axis_off()

    fig.suptitle(
        f"Forced-alignment validation — Mishari Al-Afasy (reciter 7) · "
        f"{len(rows)} surahs · {sum(r['words_compared'] for r in rows)} words compared",
        fontsize=12,
        y=0.995,
        fontweight="bold",
    )
    fig.tight_layout(rect=(0, 0, 1, 0.975))
    out_png.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_png, dpi=140)
    print(f"[INFO] Wrote {out_png}")


def build_summary(rows: list[dict], all_deltas: list[float], per_surah_offset: dict[int, dict]) -> dict:
    sorted_d = sorted(all_deltas)
    all_corrected: list[float] = []
    for v in per_surah_offset.values():
        all_corrected.extend(v.get("corrected_deltas", []))
    sorted_c = sorted(all_corrected)

    per_surah_out = []
    for r in rows:
        s = r["surah"]
        off = per_surah_offset.get(s, {})
        corrected = off.get("corrected_deltas", [])
        per_surah_out.append({
            "surah": s,
            "audio_duration_sec": r["audio_duration_sec"],
            "alignment_seconds": r["alignment_seconds"],
            "words_compared": r["words_compared"],
            # raw = predicted_start - reference_start, abs
            "within_100ms_pct": r["within_100ms_pct"],
            "within_250ms_pct": r["within_250ms_pct"],
            "mean_abs_error_ms": r["mean_abs_error_ms"],
            # offset-corrected = after subtracting this surah's median signed offset
            "median_offset_ms": off.get("median_offset_ms"),
            "corrected_within_100ms_pct": _pct_within(corrected, 100) if corrected else None,
            "corrected_within_250ms_pct": _pct_within(corrected, 250) if corrected else None,
            "corrected_mean_abs_error_ms": round(sum(corrected) / len(corrected), 1) if corrected else None,
        })

    def avg(field: str) -> float | None:
        vals = [r[field] for r in per_surah_out if r.get(field) is not None]
        return round(sum(vals) / len(vals), 2) if vals else None

    return {
        "reciter_id": 7,
        "reciter_name": "Mishari Rashid al-`Afasy",
        "surahs_validated": len(rows),
        "total_words_compared": sum(r["words_compared"] for r in rows),
        "total_audio_seconds": round(sum(r["audio_duration_sec"] or 0 for r in rows), 1),
        "total_alignment_seconds": round(sum(r["alignment_seconds"] or 0 for r in rows), 1),
        "avg_within_100ms_pct": round(statistics.mean(r["within_100ms_pct"] for r in rows), 2) if rows else None,
        "avg_within_250ms_pct": round(statistics.mean(r["within_250ms_pct"] for r in rows), 2) if rows else None,
        "avg_mean_abs_error_ms": round(statistics.mean(r["mean_abs_error_ms"] for r in rows), 2) if rows else None,
        # Offset-corrected aggregate — what the model's actual precision looks
        # like once each surah's median signed offset (a QF reference quirk) is
        # subtracted. This is closer to what the user observes visually.
        "avg_corrected_within_100ms_pct": avg("corrected_within_100ms_pct"),
        "avg_corrected_within_250ms_pct": avg("corrected_within_250ms_pct"),
        "avg_corrected_mean_abs_error_ms": avg("corrected_mean_abs_error_ms"),
        "per_word_error_ms": {
            "count": len(sorted_d),
            "min": round(sorted_d[0], 1) if sorted_d else None,
            "median": round(percentile(sorted_d, 50), 1) if sorted_d else None,
            "p90": round(percentile(sorted_d, 90), 1) if sorted_d else None,
            "p95": round(percentile(sorted_d, 95), 1) if sorted_d else None,
            "p99": round(percentile(sorted_d, 99), 1) if sorted_d else None,
            "max": round(sorted_d[-1], 1) if sorted_d else None,
            "mean": round(sum(sorted_d) / len(sorted_d), 1) if sorted_d else None,
        },
        "per_word_error_ms_corrected": {
            "count": len(sorted_c),
            "min": round(sorted_c[0], 1) if sorted_c else None,
            "median": round(percentile(sorted_c, 50), 1) if sorted_c else None,
            "p90": round(percentile(sorted_c, 90), 1) if sorted_c else None,
            "p95": round(percentile(sorted_c, 95), 1) if sorted_c else None,
            "p99": round(percentile(sorted_c, 99), 1) if sorted_c else None,
            "max": round(sorted_c[-1], 1) if sorted_c else None,
            "mean": round(sum(sorted_c) / len(sorted_c), 1) if sorted_c else None,
        },
        "per_surah": per_surah_out,
    }


def write_summary_txt(summary: dict, out_txt: Path) -> None:
    pwd = summary["per_word_error_ms"]
    pwdc = summary.get("per_word_error_ms_corrected", {})
    lines = [
        f"Reciter:         {summary['reciter_name']} (id {summary['reciter_id']})",
        f"Surahs:          {summary['surahs_validated']}",
        f"Words compared:  {summary['total_words_compared']}",
        f"Total audio:     {summary['total_audio_seconds']}s",
        f"Total CPU time:  {summary['total_alignment_seconds']}s",
        "",
        "RAW (predicted_start − QF reference_start):",
        f"  within ±100ms     : {summary['avg_within_100ms_pct']}%",
        f"  within ±250ms     : {summary['avg_within_250ms_pct']}%",
        f"  mean abs error    : {summary['avg_mean_abs_error_ms']} ms",
        f"  per-word median   : {pwd.get('median')} ms · p95 {pwd.get('p95')} ms",
        "",
        "OFFSET-CORRECTED (each surah's median signed offset subtracted —",
        "isolates model precision from QF's surah-specific timing convention):",
        f"  within ±100ms     : {summary.get('avg_corrected_within_100ms_pct')}%",
        f"  within ±250ms     : {summary.get('avg_corrected_within_250ms_pct')}%",
        f"  mean abs error    : {summary.get('avg_corrected_mean_abs_error_ms')} ms",
        f"  per-word median   : {pwdc.get('median')} ms · p95 {pwdc.get('p95')} ms",
    ]
    out_txt.parent.mkdir(parents=True, exist_ok=True)
    out_txt.write_text("\n".join(lines) + "\n")
    print(f"[INFO] Wrote {out_txt}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--csv", default=str(DEFAULT_CSV))
    ap.add_argument("--per-word-dir", default=str(PER_WORD_DIR))
    ap.add_argument("--out-png", default=str(DEFAULT_PNG))
    ap.add_argument("--out-txt", default=str(DEFAULT_TXT))
    ap.add_argument("--out-json", default=str(DEFAULT_JSON))
    args = ap.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f"[ERROR] CSV not found at {csv_path}. Run batch-validate.py first.", file=sys.stderr)
        return 2

    rows = read_rows(csv_path)
    all_deltas, _by_surah, per_surah_offset = gather_all_deltas(Path(args.per_word_dir))
    all_corrected: list[float] = []
    for v in per_surah_offset.values():
        all_corrected.extend(v.get("corrected_deltas", []))

    summary = build_summary(rows, all_deltas, per_surah_offset)
    Path(args.out_json).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out_json).write_text(json.dumps(summary, indent=2))
    print(f"[INFO] Wrote {args.out_json}")

    write_summary_txt(summary, Path(args.out_txt))
    render(rows, all_deltas, all_corrected, Path(args.out_png))
    return 0


if __name__ == "__main__":
    sys.exit(main())
