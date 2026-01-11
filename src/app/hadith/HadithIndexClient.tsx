"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { sixCollections } from "@/lib/hadith-meta";
import { BookOpen } from "lucide-react";
import ReadingShelf from "@/components/reading/ReadingShelf";

export default function HadithIndexClient() {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return sixCollections;
    return sixCollections.filter(
      (c) =>
        c.englishName.toLowerCase().includes(s) ||
        c.arabicName?.toLowerCase().includes(s) ||
        c.alias?.some((a) => a.includes(s))
    );
  }, [q]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-32 pb-8 sm:pt-28 sm:pb-12">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold">Hadith</h1>
        <p className="text-muted-foreground mt-1">
          The Six Books. Choose a collection or search by name.
        </p>
      </div>

      <div className="mt-6 flex justify-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search e.g. Bukhari, Tirmidhi…"
          className="max-w-md h-11"
        />
      </div>

      <ReadingShelf kind="hadith" />

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {results.map((c) => (
          <Link
            key={c.id}
            href={`/hadith/${c.id}`}
            className="rounded-xl border p-4 hover:bg-muted/40 transition"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 opacity-70" />
              <div className="font-semibold">{c.englishName}</div>
            </div>
            {c.arabicName && (
              <div className="text-sm mt-1 opacity-80" dir="rtl">
                {c.arabicName}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
