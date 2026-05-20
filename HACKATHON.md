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
- [How we used the Quran Foundation APIs](#how-we-used-the-quran-foundation-apis)
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

## How we used the Quran Foundation APIs

The Quran Foundation APIs are the **single source of truth** the whole helper
sits on. Without them there is no canonical word list to align against, no
ground-truth timings to validate against, and no reciter catalogue to register
new entries into. We use the APIs in two distinct ways: the **production app**
talks to the authenticated `apis.quran.foundation` content endpoint, and the
**hackathon helper / validation scripts** talk to the public `api.quran.com/v4`
mirror (same data, no auth header, easier for a reproducible CLI demo).

### Endpoints and what each one is doing for us

| Endpoint | Where we call it | What we do with the response |
| --- | --- | --- |
| `GET /chapters` | `src/app/quran/page.tsx`, `src/app/api/qf/chapters/route.ts` | Build the surah picker in the main reader (114 surah metadata records). |
| `GET /chapters/{id}` | `src/app/quran/[surah]/page.tsx` | Page title, verse count, revelation place shown on each surah page. |
| `GET /verses/by_chapter/{surah}?words=true&word_fields=qpc_uthmani_hafs` | `scripts/align-audio.py`, `scripts/batch-validate.py`, `src/app/quran/[surah]/page.tsx`, `src/app/api/qf/verses/[chapter]/route.ts` | **The core input to forced alignment.** We pull every word for the surah (skipping `char_type_name === "end"` separators), keep the `qpc_uthmani_hafs` Arabic text, and feed it to the aligner as the known token sequence. The same response drives the reader's verse rendering. |
| `GET /verses/by_chapter/1?words=true` | `scripts/align-audio.py` (bismillah prefix path) | When `--prepend-bismillah` is set we re-use Surah 1's first four words (Bismillah) as a "throwaway" alignment prefix so non-Fatiha recordings with a Bismillah intro don't stretch verse 1's first word across the intro. |
| `GET /chapter_recitations/{reciter_id}/{surah}?segments=true` | `scripts/align-audio.py` (validation mode), `scripts/batch-validate.py`, `src/components/quran/AudioPlayerBar.tsx`, `src/app/api/qf/audio/[reciterId]/[chapter]/route.ts` | (1) Fetches the MP3 URL for the audio we then align. (2) Parses the `segments` array (`[verseNum, wordStart, wordEnd, msStart, msEnd]`) into per-word reference timings used as **ground truth** in the validation dashboard. Every "QF reference" number on `/hackathon-helper/report` comes from this endpoint. |
| `GET /recitations/{reciter_id}/by_chapter/{surah}?fields=segments` | `src/components/quran/AudioPlayerBar.tsx`, `src/app/quran/[surah]/page.tsx` | Per-verse alignment fallback for reciters that publish per-verse rather than per-chapter audio. |
| `GET /chapter_reciters/{reciter}/audio_files` | `src/app/api/qf/recitations/[reciter]/chapter/[chapter]/route.ts` | Lists the per-surah audio files for a reciter so the picker can offer all 114 surahs without an extra round-trip per surah. |
| `GET /resources/translations`, `GET /resources/languages` | `src/app/api/qf/translations/route.ts`, `src/app/api/qf/word-translations/route.ts`, settings page | Populate the translation / word-by-word language pickers in settings. Not used by the aligner itself, but they're part of the broader QF integration. |

### Where the QF data flows through the helper

1. **Word list ingestion.** When a user opens `/hackathon-helper`, picks a surah, and clicks **Generate alignment**, the API route at `src/app/api/hackathon-align/route.ts` spawns `scripts/align-audio.py` which calls `/verses/by_chapter/{surah}?words=true` first. That response **defines** the alignment target — we never invent or normalise Arabic text ourselves.
2. **Audio URL resolution.** In validation mode (`--reciter-id`), the script hits `/chapter_recitations/{reciter_id}/{surah}?segments=true`, pulls `audio_url`, and streams the MP3 from QF's CDN into a temp file. No QF audio is committed to the repo.
3. **Reference timings = ground truth.** The same `?segments=true` response contains QF's published per-word timings (`[verseNum, wordStart, wordEnd, msStart, msEnd]`). The validation harness pairs every predicted word start against `msStart` from this array — that's where the per-word `delta_ms` values in `scripts/output/per-word/*.json` come from.
4. **Reader integration.** The output JSON our aligner writes (`public/demo/<slug>/<surah>.json`) matches the **exact shape** that `AudioPlayerBar.tsx` already builds from QF's `/recitations/{id}/by_chapter/{surah}?fields=segments` response. That's why no player changes were needed — we hand the existing QF code path a QF-shaped payload.

### Authentication and the two hosts

Because the official QF content API (`apis.quran.foundation/content/api/v4`) requires
an OAuth client-credentials token, the production app gets one server-side via
`src/lib/server/qf.ts` (helper `qfGet()`) using `QF_CLIENT_ID` / `QF_CLIENT_SECRET`
environment variables, and proxies safe routes through `src/app/api/qf/*` so
client-side code never sees the token. The hackathon CLI scripts deliberately
hit the **public** `api.quran.com/api/v4` mirror instead — same data, no
credentials needed — so anyone cloning the repo can reproduce the validation
run without setting up secrets.

### What we did *not* re-implement

We did not roll our own Quran text, our own word index, our own verse
segmentation, or our own reciter catalogue. Every one of those came directly
from a Quran Foundation endpoint. The hackathon contribution is the bridge
between **arbitrary audio in** and **QF-shaped word timings out**, so an audio
file outside QF's catalogue can flow through the rest of the app exactly as
if QF had timed it itself.

---

## Validation results

### Live dashboard

Run `npm run dev` and open **[`/hackathon-helper/report`](http://localhost:3000/hackathon-helper/report)**.
The dashboard reads `scripts/output/batch-validation-summary.json` +
`scripts/output/per-word/*.json` and renders:

- Top-line stat cards (surahs validated, words compared, avg accuracy, median/p95 error, total CPU time).
- A 5-panel matplotlib chart: per-surah accuracy bars, per-surah MAE bars, overall per-word error histogram, cumulative distribution function, and an MAE-vs-audio-duration scatter to verify we don't degrade on long surahs.
- A bucketed per-word error distribution (0–50 ms, 50–100, 100–250, …, 2500+).
- A sortable per-surah table where every cell is clickable to drill down into the exact verse / word / predicted timestamp / reference timestamp / delta for that surah.
- The **30 worst words across the entire batch** — full transparency on where the model still misses.

### How to reproduce

```bash
# 1. Generate per-word + summary data (Mishari = QF reciter 7).
scripts/.venv/bin/python scripts/batch-validate.py \
  --reciter-id 7 \
  --surahs 1,36,49,55,56,67,78-114

# 2. Render charts + summary JSON the dashboard reads.
scripts/.venv/bin/python scripts/plot-metrics.py

# 3. Open the dashboard.
npm run dev
# → http://localhost:3000/hackathon-helper/report
```

### What the metrics mean

| Metric | Definition |
| --- | --- |
| **within ±100 ms %** | % of words whose predicted `start` lands in a 100 ms window around QF's reference. The strict accuracy bar — anything inside is imperceptible to a viewer. |
| **within ±250 ms %** | Loose tolerance. This is the effective threshold the player highlight needs: at 250 ms you'd visually notice misalignment, beyond it the word is wrong. |
| **mean absolute error (MAE)** | Average per-word `|predicted - reference|` in ms. Single-number summary. |
| **median / p90 / p95 / p99 / max** | Percentiles of per-word error across the entire batch. p95 is the honest "worst-case typical" number — only 5% of words are worse. |
| **alignment seconds** | Wall-clock CPU time the alignment script took, per surah. Roughly real-time on CPU. |
| **QF offset (per-surah median signed delta)** | The systematic shift between our predicted word starts and QF's reference word starts for that surah. Used to derive the offset-corrected metrics. |
| **offset-corrected ±100 / ±250 / MAE** | Same accuracy metrics, but computed after subtracting each surah's median signed offset from every per-word delta. Removes the surah-specific QF convention bias and reveals the model's intrinsic precision. |

### Why two sets of numbers (raw vs offset-corrected)

When we first ran the batch we saw something puzzling: visually the alignment was
near-perfect (the highlight on `/quran/95` lands on each word as it's said), but
the raw accuracy numbers were modest (typical `~30 % within ±100 ms`). Inspecting
the per-word JSONs surfaced the explanation — **every surah has its own
systematic signed offset** between our predicted word starts and QF's
reference word starts. We measured surah-by-surah offsets ranging from
`+88 ms` to `+2625 ms`.

That's not random noise — it's a consistent direction-and-magnitude shift per
surah. The most likely cause is a convention mismatch: QF appears to mark
each word's "start" at the end of the previous word's slot (so all inter-word
silence is absorbed into the previous word), while we mark "start" at the
audible onset of the word itself. For surahs with long pauses (Mishari's
deliberate tajwid style on, e.g., An-Naba) the gap is large; for tight
recitation it's small.

The dashboard shows both views via a toggle so judges can see (a) what raw
agreement with QF's reference looks like, and (b) what the model's actual
precision is once that systematic surah-level shift is normalised out.
The **offset-corrected** numbers are the honest indicator of how well the
highlight tracks the audio you actually hear. We don't hide the raw view —
it's there to make the data transparent.

### Underlying files committed to the repo

- `scripts/output/batch-validation.csv` — one row per surah (summary).
- `scripts/output/batch-validation-summary.json` — machine-readable aggregate the dashboard reads.
- `scripts/output/batch-validation.png` — the matplotlib dashboard (also embedded in the live page).
- `scripts/output/per-word/r7_s{NNN}.json` — every predicted vs reference word pair with `delta_ms` for surah `NNN`.
- `public/demo/afasy-validation/001.report.json` — single-surah report from the original `/goal` evaluator run.

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
