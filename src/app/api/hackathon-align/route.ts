// src/app/api/hackathon-align/route.ts
//
// Hackathon helper: accepts a recitation audio (upload or YouTube URL) + a
// surah number and produces a forced-alignment JSON under public/demo/<slug>/.
// Streams script progress to the client as Server-Sent Events.
//
// NOT a production-grade endpoint. No auth, no rate limiting, single concurrent
// job assumption. Lives behind /hackathon-helper which is excluded from the
// app's main navigation. See HACKATHON.md.

import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { allocateDemoId, type DemoRegistryEntry } from "@/lib/demoRegistry";
import { loadDemoRegistry } from "@/lib/demoRegistry.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600; // align-audio.py can take minutes on CPU

const REPO_ROOT = process.cwd();
const PYTHON_BIN = path.join(REPO_ROOT, "scripts", ".venv", "bin", "python");
const ALIGN_SCRIPT = path.join(REPO_ROOT, "scripts", "align-audio.py");
const REGISTRY_PATH = path.join(REPO_ROOT, "public", "demo", "registry.json");
const DEMO_ROOT = path.join(REPO_ROOT, "public", "demo");
const YT_DLP_BIN = process.env.YT_DLP_BIN || "yt-dlp";
const FFMPEG_BIN = process.env.FFMPEG_BIN || "ffmpeg";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

function sseEncode(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

type AlignmentRequest = {
  name: string;
  slug: string;
  surah: number;
  prependBismillah: boolean;
  audioSource: "file" | "youtube";
  audioFile?: File;
  youtubeUrl?: string;
};

async function parseRequest(req: Request): Promise<AlignmentRequest> {
  const form = await req.formData();
  const name = (form.get("name") as string | null)?.trim() ?? "";
  const slug = (form.get("slug") as string | null)?.trim() ?? "";
  const surah = parseInt((form.get("surah") as string | null) ?? "", 10);
  const prependBismillah = (form.get("prependBismillah") as string | null) === "1";
  const audioSource = (form.get("audioSource") as string | null) === "youtube" ? "youtube" : "file";

  if (!name) throw new Error("Reciter name is required");
  if (!slug || !SLUG_RE.test(slug)) {
    throw new Error(`Invalid slug "${slug}" — must be lowercase, alphanumeric, hyphens (max 60 chars)`);
  }
  if (!Number.isFinite(surah) || surah < 1 || surah > 114) {
    throw new Error(`Invalid surah ${surah} — must be 1–114`);
  }

  const out: AlignmentRequest = { name, slug, surah, prependBismillah, audioSource };
  if (audioSource === "file") {
    const f = form.get("audio");
    if (!(f instanceof File) || f.size === 0) throw new Error("Audio file is required");
    out.audioFile = f;
  } else {
    const url = (form.get("youtubeUrl") as string | null)?.trim() ?? "";
    if (!url || !/^https?:\/\//.test(url)) throw new Error("Valid YouTube URL is required");
    out.youtubeUrl = url;
  }
  return out;
}

type SsePush = (event:
  | { type: "info"; text: string }
  | { type: "log"; stream: "stdout" | "stderr"; text: string }
  | { type: "error"; text: string }
  | { type: "done"; entry: DemoRegistryEntry; surah: number; validation?: string }
) => void;

/**
 * Run a child process and forward its line-buffered stdout/stderr through the
 * SSE push function. Resolves when the process exits cleanly; rejects on
 * non-zero exit. We tee stderr to the validation buffer so the [VALIDATION]
 * line printed by align-audio.py is captured for the final done payload.
 */
function runStreaming(
  cmd: string,
  args: string[],
  push: SsePush,
  label: string,
  validationOut?: { line?: string },
): Promise<void> {
  return new Promise((resolve, reject) => {
    push({ type: "info", text: `$ ${label}` });
    const child = spawn(cmd, args, { cwd: REPO_ROOT });

    let stdoutBuf = "";
    let stderrBuf = "";

    const flush = (which: "stdout" | "stderr", chunk: string) => {
      const lines = chunk.split(/\r?\n/);
      for (const line of lines) {
        if (!line) continue;
        push({ type: "log", stream: which, text: line });
        if (validationOut && line.startsWith("[VALIDATION]")) {
          validationOut.line = line;
        }
      }
    };

    child.stdout.on("data", (data: Buffer) => {
      stdoutBuf += data.toString("utf-8");
      const idx = stdoutBuf.lastIndexOf("\n");
      if (idx >= 0) {
        flush("stdout", stdoutBuf.slice(0, idx));
        stdoutBuf = stdoutBuf.slice(idx + 1);
      }
    });
    child.stderr.on("data", (data: Buffer) => {
      stderrBuf += data.toString("utf-8");
      const idx = stderrBuf.lastIndexOf("\n");
      if (idx >= 0) {
        flush("stderr", stderrBuf.slice(0, idx));
        stderrBuf = stderrBuf.slice(idx + 1);
      }
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (stdoutBuf) flush("stdout", stdoutBuf);
      if (stderrBuf) flush("stderr", stderrBuf);
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with code ${code}`));
    });
  });
}

async function pathExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

async function appendToRegistry(entry: DemoRegistryEntry): Promise<DemoRegistryEntry> {
  const existing = await loadDemoRegistry();
  // Merge by slug — surahs accumulate, id stays stable across re-alignments.
  const sameSlug = existing.demos.find((d) => d.slug === entry.slug);
  let merged: DemoRegistryEntry;
  if (sameSlug) {
    const surahsSet = new Set([...sameSlug.surahs, ...entry.surahs]);
    merged = {
      ...sameSlug,
      name: entry.name,
      displayName: entry.displayName,
      surahs: Array.from(surahsSet).sort((a, b) => a - b),
      createdAt: sameSlug.createdAt ?? entry.createdAt,
    };
    const next = existing.demos.map((d) => (d.slug === entry.slug ? merged : d));
    await fs.writeFile(REGISTRY_PATH, JSON.stringify({ demos: next }, null, 2));
  } else {
    merged = entry;
    const next = [...existing.demos, entry];
    await fs.writeFile(REGISTRY_PATH, JSON.stringify({ demos: next }, null, 2));
  }
  return merged;
}

export async function POST(req: Request): Promise<Response> {
  // Parse the request BEFORE opening the stream so validation errors return as
  // a normal 400 response rather than mid-stream noise.
  let parsed: AlignmentRequest;
  try {
    parsed = await parseRequest(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bad request";
    return new Response(msg, { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push: SsePush = (event) => controller.enqueue(sseEncode(event));

      try {
        const surahPadded = pad3(parsed.surah);
        const outDir = path.join(DEMO_ROOT, parsed.slug);
        await fs.mkdir(outDir, { recursive: true });

        const mp3Path = path.join(outDir, `${surahPadded}.mp3`);
        const jsonPath = path.join(outDir, `${surahPadded}.json`);
        const publicMp3Url = `/demo/${parsed.slug}/${surahPadded}.mp3`;

        // -------- Stage 1: get audio onto disk as a clean mp3 --------
        if (parsed.audioSource === "youtube") {
          push({ type: "info", text: `Downloading audio with yt-dlp from ${parsed.youtubeUrl}` });
          // -x = extract audio, --audio-format mp3 ensures a portable file
          await runStreaming(
            YT_DLP_BIN,
            [
              "-x", "--audio-format", "mp3",
              "--audio-quality", "0",
              "--no-playlist",
              "-o", mp3Path,
              parsed.youtubeUrl as string,
            ],
            push,
            "yt-dlp",
          );
        } else {
          // Save upload to a temp file then ffmpeg-convert to mp3 (handles any input format).
          const f = parsed.audioFile!;
          const ext = (() => {
            const name = f.name || "audio";
            const dot = name.lastIndexOf(".");
            return dot >= 0 ? name.slice(dot) : ".bin";
          })();
          const tmpPath = path.join(outDir, `.upload-${surahPadded}${ext}`);
          push({ type: "info", text: `Saving upload (${(f.size / 1024 / 1024).toFixed(1)} MB) to ${path.relative(REPO_ROOT, tmpPath)}` });
          const buf = Buffer.from(await f.arrayBuffer());
          await fs.writeFile(tmpPath, buf);

          push({ type: "info", text: `Normalizing to MP3 with ffmpeg` });
          await runStreaming(
            FFMPEG_BIN,
            ["-y", "-i", tmpPath, "-vn", "-ar", "44100", "-ac", "2", "-b:a", "192k", "-loglevel", "error", mp3Path],
            push,
            "ffmpeg",
          );
          await fs.unlink(tmpPath).catch(() => {});
        }

        if (!(await pathExists(mp3Path))) {
          throw new Error(`Expected audio at ${mp3Path} but it doesn't exist`);
        }

        // -------- Stage 2: run forced alignment --------
        const args = [
          ALIGN_SCRIPT,
          "--audio", mp3Path,
          "--surah", String(parsed.surah),
          "--out", jsonPath,
          "--public-audio-url", publicMp3Url,
        ];
        if (parsed.prependBismillah) args.push("--prepend-bismillah");

        const validationOut: { line?: string } = {};
        await runStreaming(PYTHON_BIN, args, push, "align-audio.py", validationOut);

        if (!(await pathExists(jsonPath))) {
          throw new Error(`align-audio.py exited cleanly but ${jsonPath} was not written`);
        }

        // -------- Stage 3: registry update --------
        const registry = await loadDemoRegistry();
        const existing = registry.demos.find((d) => d.slug === parsed.slug);
        const id = existing?.id ?? allocateDemoId(registry);
        const entry: DemoRegistryEntry = {
          id,
          slug: parsed.slug,
          name: parsed.name,
          displayName: `Demo — ${parsed.name}`,
          surahs: existing
            ? Array.from(new Set([...existing.surahs, parsed.surah])).sort((a, b) => a - b)
            : [parsed.surah],
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        };
        const merged = await appendToRegistry(entry);

        push({ type: "done", entry: merged, surah: parsed.surah, validation: validationOut.line });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        push({ type: "error", text: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
