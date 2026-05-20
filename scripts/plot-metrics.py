#!/usr/bin/env python3
"""Render the batch-validation CSV into a PNG dashboard for the hackathon
presentation.

Reads scripts/output/batch-validation.csv (produced by batch-validate.py) and
writes:
  - scripts/output/batch-validation.png       : main dashboard
  - scripts/output/batch-validation-summary.txt : one-line averages

Requires matplotlib (install with `scripts/.venv/bin/pip install matplotlib`).
"""

from __future__ import annotations

import argparse
import csv
import statistics
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CSV = REPO_ROOT / "scripts" / "output" / "batch-validation.csv"
DEFAULT_PNG = REPO_ROOT / "scripts" / "output" / "batch-validation.png"
DEFAULT_TXT = REPO_ROOT / "scripts" / "output" / "batch-validation-summary.txt"


def read_rows(csv_path: Path) -> list[dict]:
    rows: list[dict] = []
    with csv_path.open() as f:
        for row in csv.DictReader(f):
            if row.get("status") != "ok":
                continue
            try:
                rows.append({
                    "surah": int(row["surah"]),
                    "within_100ms_pct": float(row["within_100ms_pct"]),
                    "within_250ms_pct": float(row["within_250ms_pct"]),
                    "mean_abs_error_ms": float(row["mean_abs_error_ms"]),
                    "words_compared": int(row["words_compared"]),
                })
            except (KeyError, ValueError):
                continue
    rows.sort(key=lambda r: r["surah"])
    return rows


def render(rows: list[dict], out_png: Path) -> None:
    import matplotlib.pyplot as plt  # imported lazily so the script works without matplotlib for read_rows only

    if not rows:
        print("[WARN] No 'ok' rows in CSV; nothing to plot.", file=sys.stderr)
        return

    surahs = [r["surah"] for r in rows]
    p100 = [r["within_100ms_pct"] for r in rows]
    p250 = [r["within_250ms_pct"] for r in rows]
    mae = [r["mean_abs_error_ms"] for r in rows]

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(max(10, len(rows) * 0.35), 8), sharex=False)

    # ---- per-surah accuracy bars ----
    x = list(range(len(surahs)))
    width = 0.4
    ax1.bar([i - width / 2 for i in x], p100, width=width, label="within ±100 ms", color="#10b981")
    ax1.bar([i + width / 2 for i in x], p250, width=width, label="within ±250 ms", color="#3b82f6")
    ax1.set_xticks(x)
    ax1.set_xticklabels([str(s) for s in surahs], rotation=0, fontsize=8)
    ax1.set_ylim(0, 105)
    ax1.set_ylabel("Accuracy (%)")
    ax1.set_xlabel("Surah")
    ax1.set_title("Per-surah accuracy vs QF reference timings (forced alignment, helper)", loc="left")
    ax1.grid(axis="y", linestyle=":", alpha=0.5)
    ax1.legend(loc="lower right")

    avg100 = statistics.mean(p100)
    avg250 = statistics.mean(p250)
    ax1.axhline(avg100, color="#065f46", linestyle="--", linewidth=1, alpha=0.6)
    ax1.text(len(surahs) - 0.5, avg100 + 1, f"avg 100ms = {avg100:.1f}%",
             color="#065f46", fontsize=8, ha="right")
    ax1.axhline(avg250, color="#1e3a8a", linestyle="--", linewidth=1, alpha=0.6)
    ax1.text(len(surahs) - 0.5, avg250 + 1, f"avg 250ms = {avg250:.1f}%",
             color="#1e3a8a", fontsize=8, ha="right")

    # ---- mean absolute error ----
    ax2.bar(x, mae, width=0.65, color="#f59e0b")
    ax2.set_xticks(x)
    ax2.set_xticklabels([str(s) for s in surahs], rotation=0, fontsize=8)
    ax2.set_ylabel("Mean absolute error (ms)")
    ax2.set_xlabel("Surah")
    ax2.set_title("Per-word mean absolute timing error", loc="left")
    ax2.grid(axis="y", linestyle=":", alpha=0.5)
    avg_mae = statistics.mean(mae)
    ax2.axhline(avg_mae, color="#7c2d12", linestyle="--", linewidth=1, alpha=0.6)
    ax2.text(len(surahs) - 0.5, avg_mae + max(mae) * 0.02, f"avg = {avg_mae:.1f} ms",
             color="#7c2d12", fontsize=8, ha="right")

    fig.suptitle(
        f"Forced-alignment validation — {len(rows)} surahs, "
        f"{sum(r['words_compared'] for r in rows)} words compared",
        fontsize=12,
        y=0.99,
    )
    fig.tight_layout(rect=(0, 0, 1, 0.97))
    out_png.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_png, dpi=140)
    print(f"[INFO] Wrote {out_png}")


def write_summary(rows: list[dict], out_txt: Path) -> None:
    if not rows:
        return
    p100 = statistics.mean(r["within_100ms_pct"] for r in rows)
    p250 = statistics.mean(r["within_250ms_pct"] for r in rows)
    mae = statistics.mean(r["mean_abs_error_ms"] for r in rows)
    total_words = sum(r["words_compared"] for r in rows)
    out_txt.parent.mkdir(parents=True, exist_ok=True)
    out_txt.write_text(
        f"Surahs validated: {len(rows)}\n"
        f"Words compared:   {total_words}\n"
        f"Avg within ±100ms: {p100:.1f}%\n"
        f"Avg within ±250ms: {p250:.1f}%\n"
        f"Avg mean abs err:  {mae:.1f} ms\n"
    )
    print(f"[INFO] Wrote {out_txt}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--csv", default=str(DEFAULT_CSV))
    ap.add_argument("--out-png", default=str(DEFAULT_PNG))
    ap.add_argument("--out-txt", default=str(DEFAULT_TXT))
    args = ap.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f"[ERROR] CSV not found at {csv_path}. Run batch-validate.py first.", file=sys.stderr)
        return 2

    rows = read_rows(csv_path)
    write_summary(rows, Path(args.out_txt))
    render(rows, Path(args.out_png))
    return 0


if __name__ == "__main__":
    sys.exit(main())
