"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { getAllQuranBookmarks, setQuranBookmarkColor, BookmarkColor } from "@/lib/cloud";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { surahs } from "@/lib/quran-meta";
import AppSubnav from "@/components/AppSubnav";

type Row = {
  id: string;
  surah: number;
  ayah: number;
  color?: BookmarkColor | null; // may be missing in legacy docs
  createdAt?: { seconds: number; nanoseconds: number };
};

const COLOR_META: Record<BookmarkColor, { name: string; dot: string }> = {
  p1: { name: "Mint",   dot: "bg-emerald-400" },
  p2: { name: "Sky",    dot: "bg-sky-400" },
  p3: { name: "Amber",  dot: "bg-amber-300" },
  p4: { name: "Rose",   dot: "bg-rose-300" },
  p5: { name: "Violet", dot: "bg-violet-300" },
};

// Safe meta (fallback for rows with no color)
function metaForColor(c?: BookmarkColor | null) {
  return c ? COLOR_META[c] : { name: "None", dot: "bg-muted-foreground/40" };
}

export default function BookmarksPage() {
  const { user, loading, signInGoogle } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [fetching, setFetching] = useState(false);

  const [filters, setFilters] = useState<BookmarkColor[]>([]);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "surah" | "color">("newest");

  useEffect(() => {
    if (loading) return;
    if (!user) return; // show sign-in UI below
    (async () => {
      setFetching(true);
      try {
        const data = await getAllQuranBookmarks(user.uid);
        setRows(data as Row[]);
      } finally {
        setFetching(false);
      }
    })();
  }, [user, loading]);

  const filtered = useMemo(() => {
    let out = rows.slice();

    // filter by selected colors (ignore rows with no color)
    if (filters.length) out = out.filter((r) => r.color && filters.includes(r.color));

    // sort
    switch (sortBy) {
      case "newest":
        out.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        break;
      case "oldest":
        out.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        break;
      case "surah":
        out.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
        break;
      case "color":
        out.sort((a, b) =>
          (a.color ?? "").toString().localeCompare((b.color ?? "").toString()) ||
          a.surah - b.surah ||
          a.ayah - b.ayah
        );
        break;
    }
    return out;
  }, [rows, filters, sortBy]);

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-32 pb-8 sm:pt-28 sm:pb-12">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-32 pb-8 sm:pt-28 sm:pb-12 space-y-4 text-center">
        <AppSubnav />
        <h1 className="text-2xl font-bold">Bookmarks</h1>
        <p className="text-muted-foreground">Sign in to view your saved highlights.</p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={signInGoogle}>Continue with Google</Button>
          <Button variant="outline" onClick={() => router.push("/signin?next=/bookmarks")}>
            Use email instead
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-32 pb-8 sm:pt-28 sm:pb-12">
      <AppSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bookmarks</h1>
          <p className="text-muted-foreground">Color-coded verses you’ve highlighted.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm opacity-80">Sort</label>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="surah">Surah</option>
            <option value="color">Color</option>
          </select>
        </div>
      </div>

      {/* color filter chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(COLOR_META) as BookmarkColor[]).map((c) => {
          const active = filters.includes(c);
          return (
            <button
              key={c}
              onClick={() =>
                setFilters((prev) =>
                  prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                )
              }
              className={cn(
                "inline-flex items-center gap-2 rounded-full glass-surface glass-interactive px-3 py-1.5 text-sm transition hover:scale-[1.02]",
                active ? "glass-readable" : ""
              )}
            >
              <span className={cn("h-3 w-3 rounded-full", COLOR_META[c].dot)} />
              {COLOR_META[c].name}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {fetching ? (
          <div>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-muted-foreground">No bookmarks yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((r) => {
              const s = surahs.find((x) => x.number === r.surah);
              const labelLeft = s
                ? `#${String(r.surah).padStart(3, "0")} • ${s.englishName}`
                : `Surah ${r.surah}`;
              const link = `/quran/${r.surah}#ayah-${r.ayah}`;
              const meta = metaForColor(r.color);

              return (
                <div
                  key={r.id}
                  className="rounded-xl glass-surface glass-readable glass-interactive p-4 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm opacity-80">{labelLeft}</div>
                    <span className={cn("h-3 w-3 rounded-full", meta.dot)} />
                  </div>
                  <div className="mt-1 font-medium">
                    Ayah {r.surah}:{r.ayah}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Link href={link} className="text-sm underline underline-offset-4">
                      Open
                    </Link>
                    <button
                      onClick={() =>
                        setQuranBookmarkColor(user.uid, r.surah, r.ayah, null).then(() =>
                          setRows((prev) => prev.filter((x) => x.id !== r.id))
                        )
                      }
                      className="text-sm text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
