# Quran.foundation Hackathon — Forced-Alignment Helper

This document is the **entry point for the hackathon submission**. The rest of
this repository is a working Next.js Quran-reader product; the **forced-alignment
helper** described here is a layer added on top so any recitation audio — your
own recording, a YouTube clip, or an MP3 from a non-QF reciter — can be turned
into per-word timestamps that drive the player's existing word-highlight
system.

> **Judges, start here.** Section [Where the code lives](#where-the-code-lives)
> has every hackathon file in one table. Everything else in the repo
> (Firestore rules, friends system, prayer-time UI, etc.) is the underlying
> product and was not built for this hackathon.

## Contents
- [TL;DR — what we built](#tldr--what-we-built)
- [Costs, fees, and dependencies](#costs-fees-and-dependencies)
- [Where the code lives](#where-the-code-lives)
- [How to run it](#how-to-run-it)
- [Architecture](#architecture)
- [Why forced alignment (and not Whisper)](#why-forced-alignment-and-not-whisper)
- [Edge cases the script handles](#edge-cases-the-script-handles)
- [Validation results](#validation-results)
- [Known limitations](#known-limitations)
- [Credits](#credits)

---

## TL;DR — what we built

A standalone helper, runnable from a browser, that:

1. Accepts a recitation as either a **file upload** or a **YouTube URL**.
2. Lets you set the **reciter name**, **surah number**, and a **"recording starts with Bismillah"** toggle.
3. Pulls the canonical Arabic word list for that surah from the public Quran.com API.
4. Runs CTC forced alignment (`wav2vec2-mms` via `torchaudio.pipelines.MMS_FA`) to find where each known word sits in the audio.
5. Writes a JSON file matching the existing player's `WordSegment` shape into `public/demo/<slug>/<surahPadded>.json`.
6. Registers the new reciter so the **same player** the rest of the app uses now highlights words in sync with the new audio.

Validation against Mishari Al-Afasy + Surah 1 (29 words, QF reference timings as ground truth) shows **93.1 % within ±100 ms** and **100 % within ±250 ms**, mean absolute error ≈ 42 ms.

---

## Costs, fees, and dependencies

**Total recurring cost to run this: $0.** Nothing in the pipeline calls a paid
API.

| What | Cost | Notes |
| --- | --- | --- |
| `wav2vec2-mms` alignment model | Free | Downloaded once from HuggingFace (~1 GB), runs locally on CPU. |
| `uroman` (Arabic→Latin romanizer) | Free | Pure-Python library. |
| Public Quran.com API (`/verses/by_chapter`, `/chapter_recitations`) | Free | Unauthenticated public mirror — no key needed. |
| `yt-dlp` / `ffmpeg` | Free | OSS binaries the user installs locally. |
| Hosting | None | Helper runs in the same `npm run dev` process as the app. No cloud functions, no managed services, no database writes. |

No OpenAI / Whisper API keys, no Google Cloud Speech, no AssemblyAI — we
deliberately picked an offline forced-alignment model so the demo is fully
reproducible and runs the same on any laptop.

**System deps the host machine needs** (all free, OSS):

- Python 3.10+ (for the venv)
- ffmpeg (audio normalization, available via apt/brew/winget)
- yt-dlp (only if you want the YouTube path; pip install)
- Node 18+ (already required by the Next.js app)

The MMS model download is ~1 GB and is the only "heavy" thing. After the
first run it's cached forever in `~/.cache/torch/hub/torchaudio/`.

---

## Where the code lives

Everything specific to the hackathon helper is in these paths. The rest of the
tree is the existing Quran app and is not part of the submission.

| Path | What's there |
| --- | --- |
| `scripts/align-audio.py` | Forced-alignment script. Self-contained Python CLI; the core of the submission. |
| `scripts/align.mjs` | Thin Node wrapper that spawns the Python script (for terminal users). |
| `scripts/requirements.txt`, `scripts/README.md` | Python deps + one-page CLI docs. |
| `scripts/batch-validate.py` | Loops a chosen reciter across many surahs, builds a CSV of accuracy metrics. |
| `scripts/plot-metrics.py` | Renders the CSV to PNG charts for the final presentation. |
| `src/app/hackathon-helper/page.tsx` | Server entry for the helper UI. |
| `src/app/hackathon-helper/HackathonHelperClient.tsx` | The actual form + SSE log viewer + demo list (`/hackathon-helper`). |
| `src/app/api/hackathon-align/route.ts` | API route: accepts uploads, downloads YouTube audio, spawns the aligner, streams progress over SSE, updates the registry. |
| `src/lib/demoRegistry.ts` | Client-safe registry types + lookup helpers. |
| `src/lib/demoRegistry.server.ts` | Server-only loader for `public/demo/registry.json`. |
| `public/demo/registry.json` | Source of truth for dynamic demos (added by the helper at runtime). |
| `public/demo/<slug>/<NNN>.json` | One forced-alignment output per `<reciter, surah>` pair. |
| `public/demo/<slug>/<NNN>.mp3` | The audio that the JSON references. |

Files in the rest of the app that received small additions to let the new
reciters flow into the player:

- `src/lib/reciters.ts` — adds the `"local_demo"` source type and four pre-baked demo entries (9001–9004).
- `src/app/quran/[surah]/page.tsx` — merges the runtime registry into the picker list, reads the JSON for `local_demo` reciters, and inlines the registry as a `<script>` so the client can resolve dynamic IDs.
- `src/components/quran/AudioPlayerBar.tsx` — adds the `local_demo` branch in the reciter-change handler so swapping to a demo reciter loads the local audio + per-word timings.

Everything else (UI, Firestore, fonts, translations, search, friends system…)
is the underlying product and was not touched for this hackathon.

---

## How to run it

### 1. One-time setup

```bash
cd scripts
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

The first alignment downloads the `MMS_FA` model (~1 GB) into the torchaudio /
HuggingFace cache. Subsequent runs are fast.

You'll also want `ffmpeg` and `yt-dlp` on `PATH`:

```bash
sudo apt-get install ffmpeg          # or brew install ffmpeg
pip install --user yt-dlp            # or brew install yt-dlp
```

### 2. Start the app

```bash
npm install
npm run dev
# open http://localhost:3000/hackathon-helper
```

### 3. Use the helper UI

1. Enter a reciter name (e.g. `Yasser Al-Dosari`). A slug is derived automatically.
2. Pick a surah.
3. Choose `Upload audio file` or `YouTube URL` and supply the source.
4. The "**Recording starts with Bismillah**" checkbox defaults ON for every surah except 1 and 9. Leave it on for the typical case where the reciter says بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ before the first verse — QF's word list omits it and we need to absorb those seconds.
5. Click **Generate alignment**. The script runs server-side; its stdout/stderr stream live into the log panel.
6. On completion, click **Open in player (Surah N)** to see the new reciter selected on `/quran/{surah}` with words highlighting in time with the audio.

### 4. Run the same pipeline from the terminal

```bash
node scripts/align.mjs \
  --audio path/to/recitation.mp3 \
  --surah 93 \
  --out public/demo/dosari/093.json \
  --public-audio-url /demo/dosari/093.mp3 \
  --prepend-bismillah
```

Validation mode (compares against QF's reference timings):

```bash
node scripts/align.mjs \
  --reciter-id 7 \
  --surah 1 \
  --out public/demo/afasy-validation/001.json
# prints: [VALIDATION] words_compared=29 within_100ms_pct=93.1 within_250ms_pct=100.0 mean_abs_error_ms=42
```

---

## Architecture

```
┌─────────────────────────┐
│  /hackathon-helper      │   Next.js page with one form
│  (client component)     │
└─────────────┬───────────┘
              │  FormData (name, surah, audio | url, bismillah)
              ▼
┌─────────────────────────┐
│  /api/hackathon-align   │   Node route handler
│  (Route Handler)        │
└─────────────┬───────────┘
              │  spawn
              ▼
   ┌──────────────────────┐       ┌──────────────────────┐
   │  yt-dlp (optional)   │──────▶│  ffmpeg → mp3        │
   └──────────────────────┘       └──────────┬───────────┘
                                             ▼
                                  ┌────────────────────────┐
                                  │  scripts/align-audio.py│
                                  │  forced alignment      │
                                  └──────────┬─────────────┘
                                             │ writes
                                             ▼
                          public/demo/<slug>/<surahPadded>.json + .mp3
                                             │
                                             ▼
                          public/demo/registry.json   (helper appends entry)
                                             │
                                             ▼
                          /quran/<surah>             ── new reciter is selectable
                          AudioPlayerBar fetches the JSON,
                          binary-searches `wordSegments` each
                          requestAnimationFrame tick to highlight
                          the active word.
```

The Python script's I/O is deliberately small: text in → audio in → JSON out.
The Next.js side is just glue. No external auth, no shared state, no database.

---

## Why forced alignment (and not Whisper)

The naive "ASR + match to ground truth" pipeline (Whisper → fuzzy-match against
verse text) loses on Quranic Arabic. Tajwid rules, prolonged mads, hamzat
al-wasl, idgham — all of these systematically distort phonemes and produce
transcripts the model "improves" toward modern Arabic spelling. Mapping that
back to the canonical text is a fragile, fuzzy-match problem.

Forced alignment flips the framing. We already **know** the words; we just need
to find **where** each one sits in the audio. The model emits a phoneme-level
probability lattice and a Viterbi pass finds the best monotonic path through
the known token sequence. No transcription, no fuzzy matching.

We use `wav2vec2-mms` (`torchaudio.pipelines.MMS_FA`) — Meta's Massively
Multilingual Speech alignment model, which supports Arabic and runs on CPU.
Text is romanized with [`uroman`](https://github.com/isi-nlp/uroman) before
alignment so it lands in the model's token space.

---

## Edge cases the script handles

Each of these was a real failure mode on the test recordings; the comments in
`scripts/align-audio.py` document the specific incident that triggered the fix.

### 1. Recordings that start with Bismillah on non-Fatiha surahs

QF's per-chapter word list for, say, Surah 95 starts at verse 1. But almost
every reciter precedes it with بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ. If we
align verse 1 against audio that has bismillah in it, the model stretches
word 1 across the whole bismillah segment.

**Fix:** `--prepend-bismillah` fetches the four bismillah words from QF's
*Al-Fatiha* word data, prepends them to the alignment-time word list, then
drops them from the output. The aligner happily absorbs the intro; verse 1
times come out correct.

### 2. Long pauses / intros / outros stretching real words

Without help, the aligner is forced to map every word in the transcript to
some span of audio. If there's a 4-second silence before the recitation, that
silence has to belong to **some** word — usually word 1.

**Fix:** `MMS_FA.get_model(with_star=True)` enables a special star token that
can absorb non-speech regions. We additionally insert `*` placeholders at the
start, end, and between every pair of adjacent verses (`insert_star_spacers`),
so inter-verse silences also have somewhere to go.

### 3. Held words / smooth transitions

Reciters hold the final letter of one word into the start of the next. The raw
CTC end times cut the highlight at the model's last frame for that word,
which can be ~200 ms before the audible end.

**Fix:** `smooth_word_ends` extends each word's `end` toward the next word's
`start` **only** when the gap is small (≤ 1.0 s by default). Real pauses
(longer gaps) are preserved so the highlight cuts during silence and resumes
when the next word begins.

### 4. Repeated verses

Some reciters repeat a verse for emphasis (Yasser Al-Dosari on Surah Ad-Duha
v4 was the test case). The aligner locks onto the **second** occurrence, so
the first pass plays unhighlighted.

**Fix:** `inject_repetition_segments` scans for unusually large pre-verse
gaps. If the gap before a verse is ≥ 70 % of the verse's own duration **and**
≥ 1.5 s, we copy that verse's word segments into the gap as "ghost" entries
ending just before the original starts. The player's RAF binary search fires
the highlight twice, once for each pass.

### 5. Mismatched audio formats

Uploads come in as MP3, M4A, WAV, MP4, WebM, MKV — whatever the user has.

**Fix:** the API route always pipes the upload through `ffmpeg -ar 44100 -ac 2`
to a normalized MP3 before invoking the aligner, so the Python side only ever
sees clean MP3 input.

### 6. Validation transparency

We pre-emptively support a `--reciter-id` flag that fetches **QF's own**
reference timings for the same audio and compares per-word. The script prints
a single grep-able line:

```
[VALIDATION] words_compared=29 within_100ms_pct=93.1 within_250ms_pct=100.0 mean_abs_error_ms=42
```

This is what the overnight batch validation harness reads. We are deliberately
not hiding the numbers.

---

## Validation results

Generated by `scripts/batch-validate.py` against Mishari Al-Afasy (QF reciter
ID 7). Each row is one surah; the metric compares the helper's per-word
`start` against QF's reference `start_ms` for the same audio.

See `scripts/output/batch-validation.csv` (CSV) and `scripts/output/batch-validation.png`
(chart) once the overnight run completes. Single-surah validation already
committed under `public/demo/afasy-validation/001.report.json` and `001.json`.

---

## Known limitations

- **CPU only.** Alignment takes ~10–20 s per minute of audio. A GPU would be much faster but isn't needed for the demo.
- **Single-pass repetition.** `inject_repetition_segments` catches the typical "say verse, pause, say it again" pattern but won't handle a verse said three or more times, nor a partial-verse repetition.
- **YouTube downloader is best-effort.** Some videos are region-locked or require login; yt-dlp will fail loudly in the log stream.
- **No authentication on `/hackathon-helper`.** This is a local-only demo tool; the route is unlisted from the app navigation and assumes a trusted single user.

---

## Credits

- [Meta MMS — Massively Multilingual Speech](https://ai.meta.com/blog/multilingual-model-speech-recognition/) and the [`torchaudio` `MMS_FA` bundle](https://docs.pytorch.org/audio/main/generated/torchaudio.pipelines.MMS_FA.html) for the forced-alignment model.
- [`uroman`](https://github.com/isi-nlp/uroman) for Arabic→Latin romanization.
- [Quran.foundation / quran.com API](https://api-docs.quran.foundation/) for the canonical word list and reference timings used during validation.
- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) and [`ffmpeg`](https://ffmpeg.org/) for audio acquisition and normalization.
