"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { STORE_KEYS, QuranLastRead, QuranBookmark, HadithLastRead, HadithBookmark, getJSON, setJSON } from "@/lib/storage";
import { surahs } from "@/lib/quran-meta";
import { sixCollections } from "@/lib/hadith-meta";

type Kind = "quran" | "hadith";

type Props = { kind: Kind };

export default function ReadingShelf({ kind }: Props) {
  const K = STORE_KEYS[kind];

  // state
  const [last, setLast] = useState<QuranLastRead | HadithLastRead | null>(null);
  const [bookmarks, setBookmarks] = useState<(QuranBookmark | HadithBookmark)[]>([]);
  const [notes, setNotes] = useState("");

  // load once
  useEffect(() => {
    setLast(getJSON<typeof last>(K.last, null));
    setBookmarks(getJSON<typeof bookmarks>(K.bookmarks, []));
    setNotes(getJSON<string>(K.notes, ""));
  }, [K.last, K.bookmarks, K.notes]);

  // autosave notes (debounced)
  useEffect(() => {
    const id = setTimeout(() => setJSON(K.notes, notes), 400);
    return () => clearTimeout(id);
  }, [K.notes, notes]);

  // helpers
  const lastLabel = useMemo(() => {
    if (!last) return null;
    if (kind === "quran") {
      const L = last as QuranLastRead;
      const meta = surahs.find((s) => s.number === L.surah);
      const name = meta ? `${meta.englishName}` : `Surah ${L.surah}`;
      return `${name}${L.ayah ? ` • Ayah ${L.ayah}` : ""}`;
    } else {
      const L = last as HadithLastRead;
      const coll = sixCollections.find((c) => c.id === L.collectionId);
      const name = coll ? coll.englishName : L.collectionId;
      return `${name}${L.number ? ` • #${L.number}` : ""}`;
    }
  }, [kind, last]);

  function linkForLast() {
    if (!last) return "#";
    if (kind === "quran") {
      const L = last as QuranLastRead;
      return `/quran/${L.surah}${L.ayah ? `#ayah-${L.ayah}` : ""}`;
    } else {
      const L = last as HadithLastRead;
      return `/hadith/${L.collectionId}${L.number ? `/${L.number}` : ""}`;
    }
  }

  function removeBookmark(idx: number) {
    const next = [...bookmarks];
    next.splice(idx, 1);
    setBookmarks(next);
    setJSON(K.bookmarks, next);
  }

  return (
    <section className="mt-8 space-y-6" aria-label="Reading shelf">
      {/* Continue card */}
      <div className="rounded-2xl border p-4 md:p-6 bg-background/60 backdrop-blur flex flex-col md:flex-row items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">Continue reading</div>
          <div className="text-lg md:text-xl font-semibold">{last ? lastLabel : "Nothing yet"}</div>
        </div>
        <div className="flex items-center gap-2">
          {last ? (
            <Button asChild>
              <Link href={linkForLast()}>Continue</Link>
            </Button>
          ) : (
            <div className="text-sm text-muted-foreground">Open a {kind === "quran" ? "Surah" : "collection"} to get started.</div>
          )}
        </div>
      </div>

      {/* Bookmarks + Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border p-4 bg-background/50">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Bookmarks</h3>
            {bookmarks.length > 0 && (
              <div className="text-xs text-muted-foreground">{bookmarks.length}</div>
            )}
          </div>

          {bookmarks.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No bookmarks yet. You’ll be able to add them from the reader pages.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {bookmarks.slice(0, 6).map((bm, i) => {
                const key = kind === "quran"
                  ? `S${(bm as QuranBookmark).surah}:${(bm as QuranBookmark).ayah}`
                  : `${(bm as HadithBookmark).collectionId} #${(bm as HadithBookmark).id}`;

                const href = kind === "quran"
                  ? `/quran/${(bm as QuranBookmark).surah}#ayah-${(bm as QuranBookmark).ayah}`
                  : `/hadith/${(bm as HadithBookmark).collectionId}/${(bm as HadithBookmark).id}`;

                return (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-md border p-2">
                    <Link href={href} className="text-sm hover:underline">
                      {key}
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => removeBookmark(i)}>
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border p-4 bg-background/50">
          <h3 className="font-semibold">Notes</h3>
          <p className="text-xs text-muted-foreground mt-1">Personal notes (saved locally).</p>
          <textarea
            className={cn(
              "mt-3 w-full min-h-[120px] rounded-md border bg-background p-3",
              "focus:outline-none focus:ring-1 focus:ring-ring"
            )}
            maxLength={5000}
            placeholder={`Write notes about your ${kind === "quran" ? "Quran" : "Hadith"} study…`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
    </section>
  );
}
