// src/lib/demoRegistry.ts
//
// Client-safe registry types + helpers for the hackathon helper.
// SERVER-ONLY code (filesystem reads) lives in demoRegistry.server.ts.
// Keep this file free of `node:fs` / `node:path` imports — it's bundled into
// client components (see AudioPlayerBar.tsx).

export type DemoRegistryEntry = {
  id: number;          // Stable internal ID. Helper assigns 9100+ for dynamic entries.
  name: string;        // Short name shown in lists ("John Doe")
  displayName: string; // Full picker label ("Demo — John Doe")
  slug: string;        // Filesystem-safe slug. Maps to public/demo/{slug}/
  surahs: number[];    // Which surahs have aligned JSON committed under this slug
  createdAt?: string;  // ISO timestamp set by the helper API
};

export type DemoRegistry = { demos: DemoRegistryEntry[] };

export const DEMO_ID_START = 9100;
export const DEMO_REGISTRY_GLOBAL = "__qsDemoRegistry";

const EMPTY: DemoRegistry = { demos: [] };

/**
 * Client-side lookup. Reads the JSON blob the server inlined into the page
 * (see the <script id="__demo-registry__"> tag in src/app/quran/[surah]/page.tsx).
 * Returns an empty registry on the server or if the script tag is missing.
 */
export function getClientDemoRegistry(): DemoRegistry {
  if (typeof window === "undefined") return EMPTY;
  const cached = (window as unknown as Record<string, unknown>)[DEMO_REGISTRY_GLOBAL];
  if (cached && typeof cached === "object" && Array.isArray((cached as DemoRegistry).demos)) {
    return cached as DemoRegistry;
  }
  if (typeof document !== "undefined") {
    const el = document.getElementById("__demo-registry__");
    if (el?.textContent) {
      try {
        const parsed = JSON.parse(el.textContent) as DemoRegistry;
        if (Array.isArray(parsed.demos)) {
          (window as unknown as Record<string, unknown>)[DEMO_REGISTRY_GLOBAL] = parsed;
          return parsed;
        }
      } catch {
        /* fall through */
      }
    }
  }
  return EMPTY;
}

export function findDemoById(registry: DemoRegistry, id: number): DemoRegistryEntry | undefined {
  return registry.demos.find((d) => d.id === id);
}

export function findDemoBySlug(registry: DemoRegistry, slug: string): DemoRegistryEntry | undefined {
  return registry.demos.find((d) => d.slug === slug);
}

/**
 * Allocate the next free ID for a new demo. Starts at DEMO_ID_START and walks
 * forward over any existing entries. Keeps dynamic IDs out of the curated
 * 9001–9004 range so collisions are impossible.
 */
export function allocateDemoId(registry: DemoRegistry): number {
  let id = DEMO_ID_START;
  const taken = new Set(registry.demos.map((d) => d.id));
  while (taken.has(id)) id += 1;
  return id;
}
