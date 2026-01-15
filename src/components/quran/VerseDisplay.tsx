"use client";

import { useReadingSettings } from "./ReadingSettingsProvider";
import { cn } from "@/lib/utils";
import VerseActions from "./VerseActions";

type Verse = {
  n: number;
  key: string;
  arabic: string;
  translations: { text: string; source?: string; resourceId?: number }[];
  transliterations: { text: string; source?: string; resourceId?: number }[];
};

export default function VerseDisplay({
  verse,
  chapter,
}: {
  verse: Verse;
  chapter: number;
}) {
  const settings = useReadingSettings();

  // Apply font size scaling
  const quranFontScale = settings.quranFontSize;
  const translationFontScale = settings.translationFontSize;
  const transliterationFontScale = settings.transliterationFontSize;
  const overallScale = settings.overallScale;

  // Determine which font class to use
  const quranFontClass = settings.quranFont === "Tajweed"
    ? "font-quran-tajweed"
    : settings.quranFont === "IndoPak"
    ? "font-quran-indopak"
    : "font-quran"; // Default Uthmani

  // Debug logging (only for first verse)
  if (verse.n === 1) {
    console.log("[VerseDisplay] Applied settings:", {
      quranFont: settings.quranFont,
      quranFontClass,
      quranFontScale,
      translationFontScale,
      transliterationFontScale,
      overallScale,
      showTranslation: settings.showTranslation,
      showTransliteration: settings.showTransliteration,
    });
  }

  return (
    <article
      key={verse.key}
      id={`ayah-${verse.n}`}
      data-ayah={verse.n}
      className="
        relative scroll-mt-28 md:scroll-mt-36
        rounded-2xl glass-surface glass-readable
        p-5 md:p-6 pl-14 md:pl-16
        min-h-44 md:min-h-52
        flex flex-col justify-center
      "
      style={{
        transform: `scale(${overallScale})`,
        transformOrigin: "top left",
        marginBottom: overallScale !== 1 ? `${(overallScale - 1) * 100}%` : undefined,
      }}
    >
      {/* Action column + tiny verse label */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center">
        {/* Small "chapter:verse" label */}
        <div className="mb-1 rounded px-1.5 py-0.5 text-[10px] leading-none font-medium text-foreground/70 bg-foreground/5">
          {chapter}:{verse.n}
        </div>

        <VerseActions
          compact
          surah={chapter}
          ayah={verse.n}
          textToCopy={[
            verse.arabic,
            ...verse.transliterations.map((t) => t.text),
            ...verse.translations.map((t) => t.text),
          ]
            .filter(Boolean)
            .join("\n")}
        />
      </div>

      {/* Arabic */}
      <div
        className={cn(
          quranFontClass,
          "text-4xl md:text-5xl leading-[3rem] md:leading-[3.5rem]"
        )}
        dir="rtl"
        style={{
          fontSize: `${quranFontScale}em`,
        }}
      >
        {verse.arabic}
      </div>

      {/* Translations (stacked) */}
      {settings.showTranslation && verse.translations.map((t, i) => (
        <div
          key={`t-${i}`}
          className="mt-4 text-base md:text-lg leading-relaxed text-muted-foreground"
          dir="ltr"
          style={{
            fontSize: `${translationFontScale}em`,
          }}
        >
          {t.text}
          {t.source && <span className="ml-2 opacity-70">— {t.source}</span>}
        </div>
      ))}

      {/* Transliterations (stacked, shown after translations) */}
      {settings.showTransliteration && verse.transliterations.map((tl, i) => (
        <div
          key={`tl-${i}`}
          className="mt-3 text-base md:text-lg leading-relaxed text-muted-foreground/80 italic"
          dir="ltr"
          style={{
            fontSize: `${transliterationFontScale}em`,
          }}
        >
          {tl.text}
          {tl.source && <span className="ml-2 opacity-70 text-sm">— {tl.source}</span>}
        </div>
      ))}
    </article>
  );
}
