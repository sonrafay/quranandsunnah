"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { surahs } from "@/lib/quran-meta";

export default function QuranIndexPage() {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return surahs;
    return surahs.filter((x) =>
      x.englishName.toLowerCase().includes(s) || String(x.number) === s
    );
  }, [q]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-28">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Quran</h1>
        <p className="text-muted-foreground mt-1">
          Choose a Surah or search by name/number.
        </p>
      </div>

      <div className="mt-6 flex justify-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Surah name or number…"
          className="max-w-md h-11"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filtered.map((s) => (
          <Link
            key={s.number}
            href={`/quran/${s.number}`}
            className="rounded-xl border p-4 hover:bg-muted/40 transition"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm opacity-70">#{s.number}</div>
              {s.revelation && (
                <span className="text-xs opacity-60">{s.revelation}</span>
              )}
            </div>
            <div className="font-semibold mt-1">{s.englishName}</div>
            {s.arabicName && (
              <div className="text-sm mt-0.5" dir="rtl">
                {s.arabicName}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
