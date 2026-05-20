# scripts/align-audio — Forced alignment for Quranic recitation

Helper tool for the Quran.foundation hackathon. Takes a surah + an audio file
and produces per-word timestamps that drop into the existing player's
highlight system (`WordSegment` shape in `src/components/quran/AudioPlayerBar.tsx`).

## What it does

1. Fetches ground-truth Arabic words for the surah from the public Quran.com
   API (`/verses/by_chapter/{surah}?words=true`).
2. Romanizes each word with [`uroman`](https://github.com/isi-nlp/uroman).
3. Runs CTC forced alignment with the torchaudio `MMS_FA` bundle (Meta's
   Massively Multilingual Speech model for alignment) to find where each
   romanized word occurs in the audio.
4. Writes a JSON file that matches the `WordSegment` shape the player
   already consumes.
5. **Validation mode** (`--reciter-id` provided): also pulls the same
   reciter's reference timings from `/chapter_recitations/{id}/{surah}?segments=true`,
   compares per-word, and prints a single `[VALIDATION]` line with accuracy
   metrics — used both for manual eyeballing and by the `/goal` evaluator.

Forced alignment beats blind Whisper transcription here because we already
*know* the exact text — we just need to find where each known word sits in
the audio. No fuzzy text matching needed.

## One-time setup

```bash
cd scripts
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
# CPU torch wheels (smaller, no CUDA): add this if torch pulls a GPU build:
# .venv/bin/pip install --force-reinstall --index-url https://download.pytorch.org/whl/cpu torch torchaudio
```

First alignment run downloads the MMS_FA model (~1 GB) into the HuggingFace /
torchaudio cache. Subsequent runs are fast.

## Usage

```bash
# Validation: align Mishari Al-Afasy Surah 1, compare to QF reference.
node scripts/align.mjs --reciter-id 7 --surah 1 \
  --out public/demo/afasy-validation/001.json

# Or call Python directly:
.venv/bin/python scripts/align-audio.py --reciter-id 7 --surah 1 \
  --out public/demo/afasy-validation/001.json

# Custom audio (no validation):
node scripts/align.mjs --audio path/to/my-recitation.mp3 --surah 1 \
  --out public/demo/custom/001.json \
  --public-audio-url /demo/audio/my-recitation.mp3
```

### Flags

| Flag | Required | Notes |
| --- | --- | --- |
| `--surah` | yes | 1–114 |
| `--out` | yes | Output JSON path |
| `--audio` | sometimes | Path or URL to MP3/WAV. Defaults to `auto` (uses the QF audio for `--reciter-id`) |
| `--reciter-id` | optional | When set, enables validation mode and prints `[VALIDATION]` line |
| `--public-audio-url` | optional | Overrides the `audioUrl` baked into the output JSON (useful when committing a local MP3 under `public/demo/audio/...`) |

## Output JSON shape

```jsonc
{
  "audioUrl": "https://...",
  "surah": 1,
  "wordSegments": [
    { "verseNum": 1, "wordIndex": 1, "start": 0.012, "end": 0.601 },
    { "verseNum": 1, "wordIndex": 2, "start": 0.601, "end": 1.412 }
  ],
  "segments": [
    { "verse": 1, "start": 0.012, "end": 5.840 }
  ]
}
```

Drops directly into the player via the `local_demo` reciter source type
wired up in `src/lib/reciters.ts` and `src/components/quran/AudioPlayerBar.tsx`.

## Notes / gotchas

- **wordIndex is 1-based and resets per ayah.** Matches the convention in
  the existing `WordSegment` type.
- Only QF words with `char_type_name === "word"` are counted (end-of-ayah
  separators excluded).
- The MMS model expects 16 kHz mono. Stereo / other sample rates are
  resampled automatically.
- Very long surahs (Al-Baqarah etc.) may take several minutes to align on
  CPU. The forced alignment itself is fast; the model emission step is the
  bottleneck.
