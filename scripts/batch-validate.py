#!/usr/bin/env python3
"""Batch-validate the forced-alignment pipeline across many surahs.

For each surah in the requested range, this script:
  1. Pulls QF's reference timings + audio for the chosen reciter.
  2. Runs scripts/align-audio.py on that audio with --reciter-id set so the
     [VALIDATION] line is emitted.
  3. Parses the [VALIDATION] line and appends one row to a CSV.

Output: scripts/output/batch-validation.csv with columns
  surah, reciter_id, audio_duration_sec, words_compared, within_100ms_pct,
  within_250ms_pct, mean_abs_error_ms, alignment_seconds, status, notes

Intended for an overnight run on the user's machine. Resumable — if the CSV
already has a row for (reciter_id, surah), that surah is skipped unless
--force is passed.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT_DIR = REPO_ROOT / "scripts"
ALIGN_SCRIPT = SCRIPT_DIR / "align-audio.py"
PYTHON_BIN = SCRIPT_DIR / ".venv" / "bin" / "python"
OUTPUT_DIR = SCRIPT_DIR / "output"
PER_WORD_DIR = OUTPUT_DIR / "per-word"
DEFAULT_CSV = OUTPUT_DIR / "batch-validation.csv"

QURAN_COM_BASE = "https://api.quran.com/api/v4"
USER_AGENT = "quran-align-batch/1.0"

VALIDATION_LINE_RE = re.compile(
    r"\[VALIDATION\]\s+words_compared=(?P<words>\d+)\s+"
    r"within_100ms_pct=(?P<p100>[\d.]+)\s+"
    r"within_250ms_pct=(?P<p250>[\d.]+)\s+"
    r"mean_abs_error_ms=(?P<mae>[\d.]+)"
)

CSV_FIELDS = [
    "surah",
    "reciter_id",
    "audio_duration_sec",
    "words_compared",
    "within_100ms_pct",
    "within_250ms_pct",
    "mean_abs_error_ms",
    "alignment_seconds",
    "status",
    "notes",
]


def fetch_audio_duration_sec(reciter_id: int, surah: int) -> float | None:
    """Best-effort: ask QF for the audio file metadata."""
    url = f"{QURAN_COM_BASE}/chapter_recitations/{reciter_id}/{surah}?segments=true"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
        d = data.get("audio_file", {}).get("duration")
        return float(d) if d else None
    except Exception:
        return None


def fetch_qf_reference_word_timings(reciter_id: int, surah: int) -> list[dict]:
    """Return list of {verseNum, wordIndex, start_ms, end_ms} from QF.

    Mirrors the segment-parsing logic in align-audio.py so the deltas we
    compute here use exactly the same reference frame the script does at
    runtime.
    """
    url = f"{QURAN_COM_BASE}/chapter_recitations/{reciter_id}/{surah}?segments=true"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
    except Exception:
        return []

    out: list[dict] = []
    for ts in (data.get("audio_file", {}).get("timestamps") or []):
        verse_key = ts.get("verse_key") or ""
        parts = verse_key.split(":")
        if len(parts) != 2:
            continue
        try:
            ayah = int(parts[1])
        except ValueError:
            continue
        for seg in (ts.get("segments") or []):
            nums = [int(x) for x in seg if isinstance(x, (int, float))]
            if len(nums) < 3:
                continue
            if len(nums) >= 4:
                _, word_idx, start_ms, end_ms = nums[0], nums[1], nums[2], nums[3]
            else:
                word_idx, start_ms, end_ms = nums[0], nums[1], nums[2]
            out.append({
                "verseNum": ayah,
                "wordIndex": max(1, int(word_idx)),
                "start_ms": int(start_ms),
                "end_ms": int(end_ms),
            })
    return out


def compute_per_word_deltas(predicted_path: Path, reference: list[dict]) -> dict:
    """Pair predicted word segments with reference timings; return a payload
    with every delta_ms plus aggregate stats."""
    try:
        with predicted_path.open() as f:
            pred = json.load(f)
    except Exception as e:
        return {"error": f"failed to load predicted: {e}"}

    predicted_words = pred.get("wordSegments", []) or []
    ref_by_key = {(r["verseNum"], r["wordIndex"]): r for r in reference}

    pairs: list[dict] = []
    matched = 0
    for p in predicted_words:
        key = (p["verseNum"], p["wordIndex"])
        ref = ref_by_key.get(key)
        if ref is None:
            pairs.append({
                "verseNum": p["verseNum"],
                "wordIndex": p["wordIndex"],
                "predicted_start": round(p["start"], 3),
                "predicted_end": round(p["end"], 3),
                "reference_start_ms": None,
                "reference_end_ms": None,
                "delta_ms": None,
            })
            continue
        delta_ms = abs(p["start"] * 1000.0 - ref["start_ms"])
        matched += 1
        pairs.append({
            "verseNum": p["verseNum"],
            "wordIndex": p["wordIndex"],
            "predicted_start": round(p["start"], 3),
            "predicted_end": round(p["end"], 3),
            "reference_start_ms": ref["start_ms"],
            "reference_end_ms": ref["end_ms"],
            "delta_ms": round(delta_ms, 1),
        })

    deltas = [pair["delta_ms"] for pair in pairs if pair["delta_ms"] is not None]
    deltas_sorted = sorted(deltas)

    def pct(values: list[float], p: float) -> float | None:
        if not values:
            return None
        k = max(0, min(len(values) - 1, int(round((p / 100.0) * (len(values) - 1)))))
        return round(values[k], 1)

    return {
        "matched": matched,
        "predicted_total": len(predicted_words),
        "reference_total": len(reference),
        "delta_stats": {
            "count": len(deltas),
            "min_ms": round(min(deltas), 1) if deltas else None,
            "median_ms": pct(deltas_sorted, 50),
            "p90_ms": pct(deltas_sorted, 90),
            "p95_ms": pct(deltas_sorted, 95),
            "p99_ms": pct(deltas_sorted, 99),
            "max_ms": round(max(deltas), 1) if deltas else None,
            "mean_ms": round(sum(deltas) / len(deltas), 1) if deltas else None,
        },
        "pairs": pairs,
    }


def dump_per_word(reciter_id: int, surah: int, payload: dict) -> Path:
    PER_WORD_DIR.mkdir(parents=True, exist_ok=True)
    out_path = PER_WORD_DIR / f"r{reciter_id}_s{surah:03d}.json"
    payload_with_meta = {"reciter_id": reciter_id, "surah": surah, **payload}
    with out_path.open("w") as f:
        json.dump(payload_with_meta, f, indent=2)
    return out_path


def already_done(csv_path: Path, reciter_id: int, surah: int) -> bool:
    if not csv_path.exists():
        return False
    with csv_path.open() as f:
        for row in csv.DictReader(f):
            if (
                row.get("status") == "ok"
                and int(row.get("reciter_id", -1)) == reciter_id
                and int(row.get("surah", -1)) == surah
            ):
                return True
    return False


def run_alignment_for_surah(reciter_id: int, surah: int) -> tuple[dict | None, float, str, str, Path | None]:
    """Run align-audio.py for one surah; return (metrics, elapsed_sec, status, notes, predicted_path)."""
    out_json = OUTPUT_DIR / f"r{reciter_id}_s{surah:03d}.json"
    out_json.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        str(PYTHON_BIN),
        str(ALIGN_SCRIPT),
        "--reciter-id", str(reciter_id),
        "--surah", str(surah),
        "--out", str(out_json),
    ]
    started = time.time()
    try:
        result = subprocess.run(
            cmd,
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=60 * 60 * 2,  # 2h ceiling — long surahs (Baqarah/Al-Imran) need it
        )
    except subprocess.TimeoutExpired:
        return None, time.time() - started, "timeout", "2h ceiling hit", None
    elapsed = time.time() - started

    combined = (result.stdout or "") + "\n" + (result.stderr or "")
    if result.returncode != 0:
        # Trim long script tracebacks to something CSV-friendly.
        notes = (result.stderr or "")[-300:].replace("\n", " | ").strip()
        return None, elapsed, "fail", notes or f"exit {result.returncode}", None

    match = VALIDATION_LINE_RE.search(combined)
    if not match:
        return None, elapsed, "no_validation_line", "[VALIDATION] line not found in output", out_json if out_json.exists() else None

    metrics = {
        "words_compared": int(match.group("words")),
        "within_100ms_pct": float(match.group("p100")),
        "within_250ms_pct": float(match.group("p250")),
        "mean_abs_error_ms": float(match.group("mae")),
    }
    return metrics, elapsed, "ok", "", out_json


def append_row(csv_path: Path, row: dict) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    file_exists = csv_path.exists()
    with csv_path.open("a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        if not file_exists:
            writer.writeheader()
        writer.writerow({k: row.get(k, "") for k in CSV_FIELDS})


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--reciter-id", type=int, default=7,
                    help="QF reciter to validate against. Default 7 (Mishari Al-Afasy).")
    ap.add_argument("--surahs", default="1,93-114",
                    help="Comma-separated list of surahs and/or A-B ranges. Default: 1,93-114 (short surahs).")
    ap.add_argument("--out-csv", default=str(DEFAULT_CSV),
                    help="Output CSV path. Default: scripts/output/batch-validation.csv. Resumed in-place.")
    ap.add_argument("--force", action="store_true",
                    help="Re-run surahs already marked ok in the CSV.")
    args = ap.parse_args()

    if not PYTHON_BIN.exists():
        print(f"[ERROR] Python venv not found at {PYTHON_BIN}", file=sys.stderr)
        print("        Run: cd scripts && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt",
              file=sys.stderr)
        return 2

    surahs: list[int] = []
    for part in args.surahs.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            surahs.extend(range(int(a), int(b) + 1))
        else:
            surahs.append(int(part))
    surahs = sorted({s for s in surahs if 1 <= s <= 114})
    if not surahs:
        print("[ERROR] No valid surahs after parsing --surahs", file=sys.stderr)
        return 3

    csv_path = Path(args.out_csv)
    print(f"[INFO] Validating reciter {args.reciter_id} across {len(surahs)} surahs -> {csv_path}",
          flush=True)

    total = len(surahs)
    started_total = time.time()
    for i, surah in enumerate(surahs, start=1):
        elapsed_total = time.time() - started_total
        print(f"\n[{i}/{total}] surah {surah} (elapsed {elapsed_total:.0f}s)...", flush=True)

        if not args.force and already_done(csv_path, args.reciter_id, surah):
            print(f"  ↳ already in CSV, skipping (pass --force to re-run)")
            continue

        duration = fetch_audio_duration_sec(args.reciter_id, surah)
        metrics, elapsed, status, notes, predicted_path = run_alignment_for_surah(args.reciter_id, surah)

        row = {
            "surah": surah,
            "reciter_id": args.reciter_id,
            "audio_duration_sec": round(duration, 1) if duration else "",
            "alignment_seconds": round(elapsed, 1),
            "status": status,
            "notes": notes,
        }
        if metrics:
            row.update(metrics)
        append_row(csv_path, row)

        # If alignment succeeded, dump per-word predicted/reference/delta detail
        # so the dashboard can show exact timings, not just summaries.
        if status == "ok" and predicted_path is not None:
            reference = fetch_qf_reference_word_timings(args.reciter_id, surah)
            payload = compute_per_word_deltas(predicted_path, reference)
            per_word_path = dump_per_word(args.reciter_id, surah, payload)
            print(f"  ↳ per-word: {per_word_path.relative_to(REPO_ROOT)}", flush=True)

        if metrics:
            print(
                f"  ↳ {status} | {metrics['words_compared']} words | "
                f"100ms={metrics['within_100ms_pct']}% 250ms={metrics['within_250ms_pct']}% "
                f"mae={metrics['mean_abs_error_ms']}ms | took {elapsed:.0f}s",
                flush=True,
            )
        else:
            print(f"  ↳ {status} ({notes}) | took {elapsed:.0f}s", flush=True)

    total_elapsed = time.time() - started_total
    print(f"\n[INFO] Done in {total_elapsed:.0f}s. Run plot-metrics.py to render charts.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
