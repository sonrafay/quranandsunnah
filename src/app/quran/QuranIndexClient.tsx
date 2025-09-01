"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";

type Chapter = {
  id: number;
  arabicName: string;
  englishName: string;
  englishNick: string;
  verses: number;
  place: string;
};

export default function QuranIndexClient({ chapters }: { chapters: Chapter[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return chapters;
    return chapters.filter((c) =>
      c.englishName.toLowerCase().includes(s) ||
      c.englishNick.toLowerCase().includes(s) ||
      String(c.id) === s
    );
  }, [q, chapters]);

  return (
    <>
      <div className="mt-6 flex justify-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Surah name, nickname, or number…"
          className="max-w-md h-11"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <Link
            key={c.id}
            href={`/quran/${c.id}`}
            className="group rounded-xl border bg-card/50 hover:bg-card/70 transition p-4"
          >
            <div className="flex items-center justify-between gap-4">
              {/* LEFT: diamond + English name/nick */}
              <div className="flex items-center gap-3 min-w-0">
                {/* Diamond background is rotated; number overlay is NOT rotated */}
                <div className="relative shrink-0 h-10 w-10">
                  <div className="absolute inset-0 rotate-45 rounded-md border bg-foreground/10 shadow-inner" />
                  <div className="absolute inset-0 grid place-items-center text-sm font-medium">
                    {c.id}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="truncate font-semibold">{c.englishName}</div>
                  {c.englishNick && (
                    <div className="truncate text-xs text-muted-foreground">
                      {c.englishNick}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Arabic calligraphy + ayah count */}
              <div className="text-right">
                <div className="font-quran text-xl leading-6">{c.arabicName}</div>
                <div className="text-xs text-muted-foreground">
                  {c.verses} Ayah{c.verses === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
