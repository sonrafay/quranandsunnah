"use client";

import { surahNameSrc } from "@/lib/surahNameSvg";

export default function SurahTitle({
  id,
  arabicName,
  englishNick,
}: {
  id: number;
  arabicName: string;
  englishNick?: string;
}) {
  const src = surahNameSrc(id);

  return (
    <div className="relative mb-8">
      {/* Calligraphy centered; taller by default */}
      <div className="flex justify-center items-center min-h-[4.5rem] md:min-h-[6rem]">
        {/* Prefer SVG; invert in LIGHT mode (so it's visible on white),
            keep normal in DARK mode */}
        <img
          src={src}
          alt={arabicName}
          className="
            h-20 md:h-28            /* bigger */
            object-contain
            invert dark:invert-0    /* invert in light; normal in dark */
            drop-shadow             /* subtle pop on light bg */
          "
          onError={(e) => {
            // Fallback to Arabic text if an SVG is missing
            (e.currentTarget as HTMLImageElement).style.display = "none";
            const fallback = document.getElementById(`surah-fallback-${id}`);
            if (fallback) fallback.style.display = "inline-block";
          }}
        />

        {/* Fallback badge (shows only if the SVG is missing) */}
        <span
          id={`surah-fallback-${id}`}
          className="
            hidden
            font-quran text-3xl md:text-4xl
            rounded-md px-4 py-1 shadow-sm
            bg-teal-600 text-white
            dark:bg-teal-600 dark:text-white
          "
        >
          {arabicName}
        </span>
      </div>

      {/* English nickname on the right */}
      {englishNick && (
        <div className="mt-2 flex items-center justify-end">
          <span className="text-sm md:text-base text-muted-foreground">
            {englishNick}
          </span>
        </div>
      )}
    </div>
  );
}
