"use client";

import { useReadingSettings } from "./ReadingSettingsProvider";
import { cn } from "@/lib/utils";
import VerseActions from "./VerseActions";
import QuranFontLoader from "./QuranFontLoader";
import WordHoverTooltip from "./WordHoverTooltip";

type QFWord = {
  transliteration?: { text?: string; language_name?: string };
  translation?: { text?: string; language_name?: string };
  code_v1?: string;
  code_v2?: string;
  v1_page?: number;
  v2_page?: number;
  qpc_uthmani_hafs?: string;
  text_uthmani?: string;
  char_type_name?: string; // "word" or "end"
};

type Verse = {
  n: number;
  key: string;
  arabic: string;
  textIndopak?: string;
  textTajweed?: string;
  words?: QFWord[];
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

  // Determine rendering strategy and text/glyphs to use
  const fontVariant = settings.quranFont;

  // Text-based rendering (simple)
  const isTextBased = ["uthmani-simple", "indopak"].includes(fontVariant);

  // Glyph-based rendering (QCF/QPC)
  const isGlyphBased = ["qcf-v1", "qcf-v2", "qcf-v4-tajweed", "qpc-uthmani-hafs"].includes(fontVariant);

  // Select text based on font variant
  let arabicText = verse.arabic; // Default to text_uthmani
  if (fontVariant === "indopak" && verse.textIndopak) {
    arabicText = verse.textIndopak;
  }

  // Determine font class for text-based rendering
  const quranFontClass =
    fontVariant === "indopak" ? "font-quran-indopak" : "font-quran"; // Default Uthmani

  // Word-by-word settings (unified language, separate toggles)
  // Only show if language is selected AND toggle is on
  const hasWordByWordLanguage = settings.wordByWordLanguageId !== null;
  const showWordTranslation = hasWordByWordLanguage && settings.showWordByWordTranslation;
  const showWordTransliteration = hasWordByWordLanguage && settings.showWordByWordTransliteration;
  const wordByWordEnabled = showWordTranslation || showWordTransliteration;

  // Debug logging (only for first verse)
  if (verse.n === 1) {
    console.log("[VerseDisplay] Applied settings:", {
      quranFont: settings.quranFont,
      quranFontClass,
      quranFontScale,
      translationFontScale,
      transliterationFontScale,
      translationIds: settings.translationIds,
      transliterationIds: settings.transliterationIds,
      wordByWordLanguageId: settings.wordByWordLanguageId,
      showWordByWordTranslation: settings.showWordByWordTranslation,
      showWordByWordTransliteration: settings.showWordByWordTransliteration,
      wordByWordEnabled,
    });
  }

  return (
    <>
      {/* Load page-specific fonts for glyph-based rendering */}
      <QuranFontLoader fontVariant={fontVariant} words={verse.words} />

      <article
        key={verse.key}
        id={`ayah-${verse.n}`}
        data-ayah={verse.n}
        className="
          relative scroll-mt-28 md:scroll-mt-36
          rounded-2xl glass-surface glass-readable
          pt-14 pb-6 px-5 md:pt-16 md:pb-8 md:px-6 pl-14 md:pl-16
          flex flex-col justify-center
          overflow-visible
        "
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

      {/* Arabic - Text-based or Glyph-based rendering */}
      {isTextBased && wordByWordEnabled && verse.words ? (
        // Text-based with word-by-word hover support
        <div
          className={cn(
            quranFontClass,
            "leading-relaxed break-words flex flex-wrap gap-x-3"
          )}
          dir="rtl"
          style={{
            fontSize: `${2.5 * quranFontScale}rem`,
            lineHeight: 2.0,
          }}
        >
          {verse.words.map((word, idx) => {
            const isEndMarker = word.char_type_name === "end";
            const displayText = fontVariant === "indopak"
              ? (word.text_uthmani || "") // IndoPak text not available per-word, use uthmani
              : (word.text_uthmani || "");

            if (!displayText) return null;

            if (!isEndMarker) {
              return (
                <WordHoverTooltip
                  key={`${verse.key}-w${idx}`}
                  translationText={word.translation?.text}
                  transliterationText={word.transliteration?.text}
                  showTranslation={showWordTranslation}
                  showTransliteration={showWordTransliteration}
                  fontScale={quranFontScale}
                >
                  <span>{displayText}</span>
                </WordHoverTooltip>
              );
            }

            return <span key={`${verse.key}-w${idx}`}>{displayText}</span>;
          })}
        </div>
      ) : isTextBased ? (
        // Text-based without word-by-word
        <div
          className={cn(
            quranFontClass,
            "leading-relaxed break-words"
          )}
          dir="rtl"
          style={{
            fontSize: `${2.5 * quranFontScale}rem`,
            lineHeight: 2.0,
          }}
        >
          {arabicText}
        </div>
      ) : isGlyphBased && verse.words ? (
        <div
          className="leading-relaxed break-words flex flex-wrap gap-x-2 text-foreground"
          dir="rtl"
          style={{
            fontSize: `${2.5 * quranFontScale}rem`,
            lineHeight: 2.0,
          }}
        >
          {verse.words.map((word, idx) => {
            let glyphCode: string | undefined;
            let fontPage: number | undefined;
            let fontFamily = "monospace"; // Fallback

            // Select glyph code and page based on font variant
            if (fontVariant === "qcf-v1") {
              glyphCode = word.code_v1;
              fontPage = word.v1_page;
              fontFamily = fontPage ? `p${fontPage}-v1` : "monospace";
            } else if (fontVariant === "qcf-v2" || fontVariant === "qcf-v4-tajweed") {
              glyphCode = word.code_v2;
              fontPage = word.v2_page;
              fontFamily = fontPage ? `p${fontPage}-v2` : "monospace";
            } else if (fontVariant === "qpc-uthmani-hafs") {
              glyphCode = word.qpc_uthmani_hafs;
              fontFamily = "qpc-hafs";
            }

            // Fallback to text if glyph code unavailable
            const displayText = glyphCode || word.text_uthmani || "";

            // Add class for COLRv1 font-palette support
            const isCOLRv1 = fontVariant === "qcf-v4-tajweed";
            const glyphClass = cn(
              "inline-block",
              isCOLRv1 && "tajweed-colrv1"
            );

            // Skip word-by-word tooltip for end of ayah markers
            const isEndMarker = word.char_type_name === "end";

            // Word content element
            const wordContent = (
              <span
                style={{
                  fontFamily,
                  // For COLRv1 fonts, don't set color to let embedded glyph colors show
                  // For other fonts, inherit theme color
                  ...(isCOLRv1 ? {} : { color: "inherit" })
                }}
                className={glyphClass}
              >
                {displayText}
              </span>
            );

            // If word-by-word is enabled and this is not an end marker, wrap with tooltip
            if (wordByWordEnabled && !isEndMarker) {
              return (
                <WordHoverTooltip
                  key={`${verse.key}-w${idx}`}
                  translationText={word.translation?.text}
                  transliterationText={word.transliteration?.text}
                  showTranslation={showWordTranslation}
                  showTransliteration={showWordTransliteration}
                  fontScale={quranFontScale}
                >
                  {wordContent}
                </WordHoverTooltip>
              );
            }

            // Otherwise render without tooltip
            return (
              <span key={`${verse.key}-w${idx}`}>
                {wordContent}
              </span>
            );
          })}
        </div>
      ) : (
        // Fallback to simple text if no words data
        <div
          className={cn(quranFontClass, "leading-relaxed break-words")}
          dir="rtl"
          style={{
            fontSize: `${2.5 * quranFontScale}rem`,
            lineHeight: 2.0,
          }}
        >
          {arabicText}
        </div>
      )}

      {/* Translations (stacked) - shown if translationIds has selections */}
      {settings.translationIds.length > 0 && verse.translations.map((t, i) => (
        <div
          key={`t-${i}`}
          className="mt-6 leading-relaxed text-muted-foreground break-words"
          dir="ltr"
          style={{
            fontSize: `${1.25 * translationFontScale}rem`,
            lineHeight: 1.8,
          }}
        >
          {t.text}
          {t.source && <span className="ml-2 opacity-70 text-sm">— {t.source}</span>}
        </div>
      ))}

      {/* Transliterations (stacked) - shown if transliterationIds has selections */}
      {settings.transliterationIds.length > 0 && verse.transliterations.map((tl, i) => (
        <div
          key={`tl-${i}`}
          className="mt-4 leading-relaxed text-muted-foreground/80 italic break-words"
          dir="ltr"
          style={{
            fontSize: `${1.125 * transliterationFontScale}rem`,
            lineHeight: 1.8,
          }}
        >
          {tl.text}
        </div>
      ))}
      </article>
    </>
  );
}
