// src/lib/demoRegistry.server.ts
//
// Server-only loader for public/demo/registry.json. Kept in a separate file
// from demoRegistry.ts because client components transitively import the
// shared types/helpers — pulling in node:fs from that path breaks the client
// bundle.

// Filename convention (`.server.ts`) + the `node:fs` import below ensure this
// module is server-only — webpack will hard-fail any client component that
// tries to import it.
import { promises as fs } from "node:fs";
import path from "node:path";
import type { DemoRegistry, DemoRegistryEntry } from "./demoRegistry";

const REGISTRY_PATH = path.join(process.cwd(), "public", "demo", "registry.json");
const EMPTY: DemoRegistry = { demos: [] };

function isValidEntry(e: unknown): e is DemoRegistryEntry {
  if (!e || typeof e !== "object") return false;
  const x = e as Record<string, unknown>;
  return (
    typeof x.id === "number" &&
    typeof x.name === "string" &&
    typeof x.displayName === "string" &&
    typeof x.slug === "string" &&
    Array.isArray(x.surahs)
  );
}

/**
 * Read public/demo/registry.json at request time so newly generated demos
 * appear without rebuilds. Returns an empty registry if the file is missing
 * or malformed.
 */
export async function loadDemoRegistry(): Promise<DemoRegistry> {
  try {
    const raw = await fs.readFile(REGISTRY_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DemoRegistry>;
    if (!parsed || !Array.isArray(parsed.demos)) return EMPTY;
    return { demos: parsed.demos.filter(isValidEntry) };
  } catch {
    return EMPTY;
  }
}

export const REGISTRY_FILE_PATH = REGISTRY_PATH;
