#!/usr/bin/env node
// Thin Node wrapper around scripts/align-audio.py.
// Resolves the venv python, forwards all args, streams stdout/stderr.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const venvPython =
  process.platform === "win32"
    ? join(here, ".venv", "Scripts", "python.exe")
    : join(here, ".venv", "bin", "python");
const script = join(here, "align-audio.py");

if (!existsSync(venvPython)) {
  console.error(
    `[align.mjs] No venv at ${venvPython}. Create it once with:\n` +
      `  cd ${here} && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
  );
  process.exit(127);
}
if (!existsSync(script)) {
  console.error(`[align.mjs] Missing ${script}`);
  process.exit(127);
}

const child = spawn(venvPython, [script, ...process.argv.slice(2)], {
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (err) => {
  console.error("[align.mjs] failed to spawn:", err);
  process.exit(1);
});
