#!/usr/bin/env python3
"""Forced-alignment for Quranic recitation.

Given an audio file (or URL) and a surah number, produces per-word
timestamps that match the WordSegment shape used by the existing player
(src/components/quran/AudioPlayerBar.tsx).

Validation mode (--reciter-id N): also fetches QF's reference timings for
that reciter+surah and prints a one-line accuracy report parseable by the
/goal evaluator:

    [VALIDATION] words_compared=<int> within_100ms_pct=<float> within_250ms_pct=<float> mean_abs_error_ms=<float>
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import torch
import torchaudio
from torchaudio.pipelines import MMS_FA as BUNDLE
from uroman import Uroman


QURAN_COM_BASE = "https://api.quran.com/api/v4"
USER_AGENT = "quran-align/1.0"
SAMPLE_RATE = BUNDLE.sample_rate  # 16000
DEVICE = "cpu"


def http_get_json(url: str, timeout: float = 30.0) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def fetch_verses_with_words(surah: int) -> list[dict]:
    """All verses for a surah with word-level data (public quran.com API)."""
    params = urllib.parse.urlencode(
        {
            "per_page": 300,
            "fields": "verse_key,verse_number,text_uthmani",
            "words": "true",
            "word_fields": "text_uthmani,qpc_uthmani_hafs,char_type_name",
        }
    )
    return http_get_json(f"{QURAN_COM_BASE}/verses/by_chapter/{surah}?{params}")["verses"]


def fetch_qf_reference_timings(reciter_id: int, surah: int) -> tuple[str, list[dict]]:
    """Returns (audio_url, [{verseNum, wordIndex, start_ms, end_ms}, ...]) from QF."""
    url = f"{QURAN_COM_BASE}/chapter_recitations/{reciter_id}/{surah}?segments=true"
    data = http_get_json(url)
    audio_file = data.get("audio_file") or {}
    audio_url = audio_file.get("audio_url") or ""
    if audio_url and not audio_url.startswith("http"):
        audio_url = f"https://audio.qurancdn.com/{audio_url.lstrip('/')}"

    out = []
    for ts in audio_file.get("timestamps", []) or []:
        verse_key = ts.get("verse_key") or ""
        parts = verse_key.split(":")
        if len(parts) != 2:
            continue
        try:
            ayah = int(parts[1])
        except ValueError:
            continue
        for seg in ts.get("segments", []) or []:
            nums = [int(x) for x in seg if isinstance(x, (int, float))]
            if len(nums) < 3:
                continue
            if len(nums) >= 4:
                word_index, start_ms, end_ms = nums[1], nums[2], nums[3]
            else:
                word_index, start_ms, end_ms = nums[0], nums[1], nums[2]
            if end_ms <= start_ms:
                continue
            out.append(
                {
                    "verseNum": ayah,
                    "wordIndex": max(1, word_index),
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                }
            )
    return audio_url, out


def download_audio(url_or_path: str) -> Path:
    if url_or_path.startswith(("http://", "https://")):
        suffix = Path(urllib.parse.urlparse(url_or_path).path).suffix or ".mp3"
        tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        req = urllib.request.Request(url_or_path, headers={"User-Agent": USER_AGENT})
        print(f"[INFO] Downloading audio: {url_or_path}", flush=True)
        with urllib.request.urlopen(req, timeout=180) as r:
            tmp.write(r.read())
        tmp.close()
        return Path(tmp.name)
    return Path(url_or_path)


def load_audio_as_16k_mono(path: Path) -> torch.Tensor:
    waveform, sr = torchaudio.load(str(path))
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    if sr != SAMPLE_RATE:
        waveform = torchaudio.functional.resample(waveform, sr, SAMPLE_RATE)
    return waveform


@dataclass
class WordEntry:
    verse_num: int
    word_index: int
    text: str


def build_word_list(verses: list[dict]) -> list[WordEntry]:
    out: list[WordEntry] = []
    for v in verses:
        verse_num = v["verse_number"]
        idx = 0
        for w in v.get("words") or []:
            if w.get("char_type_name") != "word":
                continue
            idx += 1
            text = (w.get("text_uthmani") or "").strip()
            if not text:
                continue
            out.append(WordEntry(verse_num=verse_num, word_index=idx, text=text))
    return out


def fetch_bismillah_words() -> list[WordEntry]:
    """The 4 words of Bismillah (Surah 1 verse 1). Marked with verse_num=0 so the
    output post-processing can drop them — they're for alignment only."""
    try:
        surah1 = fetch_verses_with_words(1)
    except Exception as exc:
        print(f"[WARN] Could not fetch bismillah words: {exc}", file=sys.stderr)
        return []
    verse1 = next((v for v in surah1 if v.get("verse_number") == 1), None)
    if not verse1:
        return []
    out: list[WordEntry] = []
    idx = 0
    for w in verse1.get("words") or []:
        if w.get("char_type_name") != "word":
            continue
        idx += 1
        text = (w.get("text_uthmani") or "").strip()
        if not text:
            continue
        out.append(WordEntry(verse_num=0, word_index=idx, text=text))
    return out


def inject_repetition_segments(
    word_segments: list[dict],
    min_repetition_ratio: float = 0.7,
    min_absolute_gap_sec: float = 1.5,
) -> list[dict]:
    """If the gap before a verse is roughly as long as the verse itself, the
    reciter likely said that verse twice and our alignment locked onto the
    second occurrence. Inject a ghost copy of the verse's word segments into
    the gap so the highlight also fires during the first recitation.

    The ghost segments share the same (verseNum, wordIndex) as the originals;
    the player's binary search finds whichever covers currentTime, so the
    highlight runs through the verse twice — once for each recitation.
    """
    if len(word_segments) < 2:
        return word_segments

    by_verse: dict[int, list[dict]] = {}
    for w in word_segments:
        by_verse.setdefault(w["verseNum"], []).append(w)

    verses_sorted = sorted(by_verse.keys())
    additions: list[dict] = []
    buffer = 0.05

    for i, v in enumerate(verses_sorted):
        cur = by_verse[v]
        v_start = min(w["start"] for w in cur)
        v_end = max(w["end"] for w in cur)
        v_duration = v_end - v_start
        if v_duration <= 0:
            continue

        prev_end = (
            max(w["end"] for w in by_verse[verses_sorted[i - 1]])
            if i > 0
            else 0.0
        )
        pre_gap = v_start - prev_end

        if pre_gap < min_absolute_gap_sec:
            continue
        if pre_gap < v_duration * min_repetition_ratio:
            continue

        # Place the ghost ending right before the second occurrence so the
        # highlight has a tiny visual gap, then a fresh run-through.
        ghost_end = v_start - buffer
        ghost_start = ghost_end - v_duration
        scale = 1.0
        if ghost_start < prev_end + buffer:
            available = pre_gap - 2 * buffer
            scale = available / v_duration
            if scale <= 0.3:
                continue
            ghost_start = prev_end + buffer
            ghost_end = ghost_start + v_duration * scale

        for w in cur:
            rel_start = (w["start"] - v_start) * scale
            rel_end = (w["end"] - v_start) * scale
            additions.append(
                {
                    "verseNum": w["verseNum"],
                    "wordIndex": w["wordIndex"],
                    "start": round(ghost_start + rel_start, 3),
                    "end": round(ghost_start + rel_end, 3),
                }
            )

    if not additions:
        return word_segments

    return sorted(word_segments + additions, key=lambda w: (w["start"], w["verseNum"], w["wordIndex"]))


def smooth_word_ends(
    word_segments: list[dict],
    max_extension_sec: float = 1.0,
    buffer_sec: float = 0.03,
) -> list[dict]:
    """Extend each word's `end` toward the next word's `start` ONLY when the gap
    is small (the reciter is holding the word / smooth transition). Real pauses
    (gap > max_extension_sec) are preserved so the highlight cuts during silence."""
    if len(word_segments) < 2:
        return word_segments
    out = [dict(w) for w in word_segments]
    for i in range(len(out) - 1):
        next_start = out[i + 1]["start"]
        gap = next_start - out[i]["end"]
        if 0 < gap <= max_extension_sec:
            out[i]["end"] = round(next_start - buffer_sec, 3)
    return out


STAR_MARKER = "__STAR__"  # special internal marker for star/wildcard spacer entries


def romanize_words(words: list[WordEntry], uroman: Uroman) -> list[str]:
    out: list[str] = []
    for w in words:
        if w.text == STAR_MARKER:
            out.append("*")
            continue
        r = uroman.romanize_string(w.text).lower()
        r = re.sub(r"[^a-z]", "", r)
        out.append(r or "x")
    return out


def insert_star_spacers(words: list[WordEntry]) -> list[WordEntry]:
    """Insert a star spacer at the start, end, and between adjacent verses.
    Lets the aligner absorb intro/outro/inter-verse silence instead of stretching
    real words across it. Spacer entries are marked verseNum=-1 and dropped from output."""
    if not words:
        return words
    out: list[WordEntry] = [WordEntry(verse_num=-1, word_index=0, text=STAR_MARKER)]  # leading
    prev_verse = words[0].verse_num
    for w in words:
        if w.verse_num != prev_verse:
            out.append(WordEntry(verse_num=-1, word_index=0, text=STAR_MARKER))
            prev_verse = w.verse_num
        out.append(w)
    out.append(WordEntry(verse_num=-1, word_index=0, text=STAR_MARKER))  # trailing
    return out


def run_alignment(
    waveform: torch.Tensor,
    romanized_words: list[str],
    with_star: bool = True,
) -> list[Optional[tuple[float, float]]]:
    """Run forced alignment. with_star=True lets silence/non-speech be absorbed
    by a star token instead of being attributed to neighboring real words —
    important for recordings with intros, long pauses, or repetitions."""
    print(
        f"[INFO] Loading MMS_FA model (downloads ~1GB on first run, with_star={with_star})...",
        flush=True,
    )
    model = BUNDLE.get_model(with_star=with_star).to(DEVICE)
    model.eval()
    tokenizer = BUNDLE.get_tokenizer()
    aligner = BUNDLE.get_aligner()

    print(f"[INFO] Running emissions on {waveform.shape[1] / SAMPLE_RATE:.1f}s audio...", flush=True)
    with torch.inference_mode():
        emission, _ = model(waveform.to(DEVICE))

    print(f"[INFO] Tokenizing {len(romanized_words)} words and aligning...", flush=True)
    tokens = tokenizer(romanized_words)
    token_spans = aligner(emission[0], tokens)

    total_samples = waveform.shape[1]
    total_frames = emission.shape[1]
    samples_per_frame = total_samples / total_frames
    seconds_per_frame = samples_per_frame / SAMPLE_RATE

    out: list[Optional[tuple[float, float]]] = []
    for spans in token_spans:
        if not spans:
            out.append(None)
            continue
        start_sec = spans[0].start * seconds_per_frame
        end_sec = spans[-1].end * seconds_per_frame
        out.append((float(start_sec), float(end_sec)))
    return out


def compute_validation_report(
    predicted: list[dict], reference: list[dict]
) -> dict:
    ref_by_key = {(r["verseNum"], r["wordIndex"]): r for r in reference}
    deltas: list[float] = []
    for p in predicted:
        key = (p["verseNum"], p["wordIndex"])
        ref = ref_by_key.get(key)
        if not ref:
            continue
        delta_ms = abs(p["start"] * 1000.0 - ref["start_ms"])
        deltas.append(delta_ms)
    if not deltas:
        return {
            "words_compared": 0,
            "within_100ms_pct": 0.0,
            "within_250ms_pct": 0.0,
            "mean_abs_error_ms": 0.0,
        }
    return {
        "words_compared": len(deltas),
        "within_100ms_pct": round(100.0 * sum(1 for d in deltas if d <= 100) / len(deltas), 1),
        "within_250ms_pct": round(100.0 * sum(1 for d in deltas if d <= 250) / len(deltas), 1),
        "mean_abs_error_ms": round(sum(deltas) / len(deltas), 1),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Forced-alignment for Quranic recitation")
    ap.add_argument("--audio", default="auto",
                    help="Path or URL to audio. 'auto' (default) requires --reciter-id and downloads from QF.")
    ap.add_argument("--surah", type=int, required=True, help="Chapter number 1-114")
    ap.add_argument("--reciter-id", type=int, default=None,
                    help="If set, fetch QF reference timings and emit validation report.")
    ap.add_argument("--out", required=True, help="Output JSON path")
    ap.add_argument("--public-audio-url", default=None,
                    help="URL to embed in output JSON as audioUrl (defaults to --audio if URL).")
    ap.add_argument("--prepend-bismillah", action="store_true",
                    help="Prepend the 4 bismillah words for alignment, then drop them from output. "
                         "Use for non-Fatiha surahs whose recordings start with 'Bismillah ar-Rahman ar-Rahim'.")
    ap.add_argument("--no-smooth", action="store_true",
                    help="Disable word-end extension smoothing (keep raw CTC end times).")
    ap.add_argument("--no-star-spacers", action="store_true",
                    help="Disable star-token spacers between verses. Off by default; spacers help when "
                         "recordings have intros, outros, or pauses between verses.")
    ap.add_argument("--no-repetition-detection", action="store_true",
                    help="Disable injecting ghost segments for verses that appear to have been recited twice.")
    args = ap.parse_args()

    if not 1 <= args.surah <= 114:
        print(f"[ERROR] --surah must be 1..114, got {args.surah}", file=sys.stderr)
        return 2

    print(f"[INFO] Fetching verses for surah {args.surah}...", flush=True)
    verses = fetch_verses_with_words(args.surah)
    words = build_word_list(verses)
    print(f"[INFO] Got {len(verses)} verses, {len(words)} words", flush=True)
    if not words:
        print("[ERROR] No words returned from QF for this surah", file=sys.stderr)
        return 3

    if args.prepend_bismillah:
        if args.surah == 1:
            print("[INFO] --prepend-bismillah ignored for Al-Fatiha (bismillah is verse 1)", flush=True)
        elif args.surah == 9:
            print("[INFO] --prepend-bismillah ignored for At-Tawbah (no bismillah)", flush=True)
        else:
            bismillah = fetch_bismillah_words()
            if bismillah:
                words = bismillah + words
                print(f"[INFO] Prepended {len(bismillah)} bismillah words for alignment (will be dropped from output)", flush=True)

    if not args.no_star_spacers:
        words = insert_star_spacers(words)
        star_count = sum(1 for w in words if w.text == STAR_MARKER)
        print(f"[INFO] Inserted {star_count} star spacers to absorb silence between verses/intro/outro", flush=True)

    ref_timings: list[dict] = []
    ref_audio_url: Optional[str] = None
    if args.reciter_id is not None:
        print(f"[INFO] Fetching reference timings for reciter {args.reciter_id}...", flush=True)
        ref_audio_url, ref_timings = fetch_qf_reference_timings(args.reciter_id, args.surah)
        print(f"[INFO] Got {len(ref_timings)} reference word entries", flush=True)

    audio_input = args.audio
    if audio_input == "auto":
        if not ref_audio_url:
            print("[ERROR] --audio=auto requires --reciter-id with a QF audio URL", file=sys.stderr)
            return 4
        audio_input = ref_audio_url

    audio_path = download_audio(audio_input)
    waveform = load_audio_as_16k_mono(audio_path)
    duration_sec = waveform.shape[1] / SAMPLE_RATE
    print(f"[INFO] Audio duration: {duration_sec:.2f}s", flush=True)

    print("[INFO] Romanizing transcript with uroman...", flush=True)
    uroman = Uroman()
    romanized = romanize_words(words, uroman)

    time_spans = run_alignment(waveform, romanized)

    word_segments: list[dict] = []
    for word, span in zip(words, time_spans):
        if span is None:
            continue
        if word.verse_num == 0:
            # Bismillah-prepend marker — used for alignment only, not emitted.
            continue
        if word.verse_num == -1 or word.text == STAR_MARKER:
            # Star spacer — used to absorb silence; not emitted.
            continue
        start_sec, end_sec = span
        word_segments.append(
            {
                "verseNum": word.verse_num,
                "wordIndex": word.word_index,
                "start": round(start_sec, 3),
                "end": round(end_sec, 3),
            }
        )

    word_segments.sort(key=lambda s: (s["start"], s["verseNum"], s["wordIndex"]))

    if not args.no_smooth:
        word_segments = smooth_word_ends(word_segments)

    if not args.no_repetition_detection:
        before = len(word_segments)
        word_segments = inject_repetition_segments(word_segments)
        injected = len(word_segments) - before
        if injected:
            print(f"[INFO] Injected {injected} ghost segments for repeated verses", flush=True)

    # Build verse-level segments AFTER smoothing so verse end follows the smoothed word end.
    verse_spans: dict[int, list[float]] = {}
    for w in word_segments:
        v = w["verseNum"]
        existing = verse_spans.get(v)
        if existing is None:
            verse_spans[v] = [w["start"], w["end"]]
        else:
            existing[0] = min(existing[0], w["start"])
            existing[1] = max(existing[1], w["end"])
    segments = [
        {"verse": v, "start": round(s, 3), "end": round(e, 3)}
        for v, (s, e) in sorted(verse_spans.items())
    ]

    embed_audio_url = (
        args.public_audio_url
        if args.public_audio_url
        else (audio_input if audio_input.startswith(("http://", "https://")) else f"/demo/audio/{Path(audio_input).name}")
    )

    out_payload = {
        "audioUrl": embed_audio_url,
        "surah": args.surah,
        "wordSegments": word_segments,
        "segments": segments,
    }
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out_payload, indent=2, ensure_ascii=False))
    print(f"[INFO] Wrote {len(word_segments)} word segments to {out_path}", flush=True)

    if args.reciter_id is not None:
        report = compute_validation_report(word_segments, ref_timings)
        # Also write a sidecar report file
        report_path = out_path.with_suffix(".report.json")
        report_path.write_text(json.dumps(report, indent=2))
        print(
            f"[VALIDATION] words_compared={report['words_compared']} "
            f"within_100ms_pct={report['within_100ms_pct']} "
            f"within_250ms_pct={report['within_250ms_pct']} "
            f"mean_abs_error_ms={report['mean_abs_error_ms']}",
            flush=True,
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
