"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { surahs } from "@/lib/quran-meta";
import { sixCollections } from "@/lib/hadith-meta";

export default function SearchPage() {
  const [q, setQ] = useState("");

  const surahResults = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return surahs
      .filter((x) => x.englishName.toLowerCase().includes(s) || String(x.number) === s)
      .slice(0, 10);
  }, [q]);

  const hadithResults = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return sixCollections
      .filter(
        (c) =>
          c.englishName.toLowerCase().includes(s) ||
          c.arabicName?.toLowerCase().includes(s) ||
          c.alias?.some((a) => a.includes(s))
      )
      .slice(0, 10);
  }, [q]);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-28">
      <h1 className="text-2xl font-bold text-center">Search</h1>
      <div className="mt-6 flex justify-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Surah name/number, or Hadith collection…"
          className="h-11"
          autoFocus
        />
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="font-semibold">Surahs</h2>
          <div className="mt-3 space-y-2">
            {surahResults.length === 0 && <p className="text-sm text-muted-foreground">No results yet.</p>}
            {surahResults.map((s) => (
              <Link key={s.number} href={`/quran/${s.number}`} className="block rounded-lg border p-3 hover:bg-muted/40">
                <div className="text-sm opacity-70">#{s.number}</div>
                <div className="font-medium">{s.englishName}</div>
                {s.arabicName && <div className="text-sm" dir="rtl">{s.arabicName}</div>}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-semibold">Hadith Collections</h2>
          <div className="mt-3 space-y-2">
            {hadithResults.length === 0 && <p className="text-sm text-muted-foreground">No results yet.</p>}
            {hadithResults.map((c) => (
              <Link key={c.id} href={`/hadith/${c.id}`} className="block rounded-lg border p-3 hover:bg-muted/40">
                <div className="font-medium">{c.englishName}</div>
                {c.arabicName && <div className="text-sm opacity-80" dir="rtl">{c.arabicName}</div>}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
