"use client";

import { ReadingSettingsProvider, useReadingSettings } from "./ReadingSettingsProvider";
import VerseDisplay from "./VerseDisplay";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WORD_AUDIO_EVENTS } from "@/lib/wordAudio";
import ScrollProgressBar from "@/components/ScrollProgressBar";

type Verse = {
  n: number;
  key: string;
  arabic: string;
  translations: { text: string; source?: string; resourceId?: number }[];
  transliterations: { text: string; source?: string; resourceId?: number }[];
};

type ActiveReciterWord = {
  surah: number;
  ayah: number;
  wordIndex: number;
} | null;

function SurahContentInner({
  chapter,
  verses,
}: {
  chapter: number;
  verses: Verse[];
}) {
  const settings = useReadingSettings();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeReciterWord, setActiveReciterWord] = useState<ActiveReciterWord>(null);

  // Sync URL with settings to fetch correct translations/transliterations/word-by-word
  useEffect(() => {
    const currentTParam = searchParams.get("t");
    const currentTLParam = searchParams.get("tl");
    const currentWTParam = searchParams.get("wt");
    const currentRParam = searchParams.get("r");

    // Build what current URL has
    const currentT = currentTParam?.split(",").map(Number).sort().join(",") || "";
    const currentTL = currentTLParam?.split(",").map(Number).sort().join(",") || "";
    const currentWT = currentWTParam || "";

    // Build what settings say we need
    const settingsT = settings.translationIds.sort().join(",");
    const settingsTL = settings.transliterationIds.sort().join(",");
    // Only sync word-by-word language when translation is enabled (API uses language for word translations)
    const settingsWT = (settings.wordByWordLanguageId !== null && settings.showWordByWordTranslation)
      ? settings.wordByWordLanguageId.toString()
      : "";

    // Check if URL needs updating
    const needsUpdate =
      (settings.translationIds.length > 0 && currentT !== settingsT) ||
      currentTL !== settingsTL ||
      currentWT !== settingsWT;

    if (needsUpdate && (settings.translationIds.length > 0 || settingsWT)) {
      const params = new URLSearchParams();

      // Preserve translations
      if (settings.translationIds.length > 0) {
        params.set("t", settings.translationIds.join(","));
      } else if (currentTParam) {
        params.set("t", currentTParam);
      }

      // Set transliterations if any
      if (settings.transliterationIds.length > 0) {
        params.set("tl", settings.transliterationIds.join(","));
      }

      // Set word-by-word language if translation is enabled
      if (settings.wordByWordLanguageId !== null && settings.showWordByWordTranslation) {
        params.set("wt", settings.wordByWordLanguageId.toString());
      }

      // Preserve reciter
      if (currentRParam) {
        params.set("r", currentRParam);
      }

      // Update URL to trigger server refetch with correct IDs
      router.replace(`?${params.toString()}`);
    }
  }, [settings.translationIds, settings.transliterationIds, settings.wordByWordLanguageId, settings.showWordByWordTranslation, searchParams, router]);

  useEffect(() => {
    const handleHighlightStart = (e: Event) => {
      const detail = (e as CustomEvent).detail as ActiveReciterWord;
      if (detail?.surah == null || detail?.ayah == null || detail?.wordIndex == null) return;
      setActiveReciterWord({
        surah: detail.surah,
        ayah: detail.ayah,
        wordIndex: detail.wordIndex,
      });
    };

    const handleHighlightEnd = (e: Event) => {
      const detail = (e as CustomEvent).detail as ActiveReciterWord;
      if (detail?.surah == null || detail?.ayah == null || detail?.wordIndex == null) return;
      setActiveReciterWord((prev) => {
        if (!prev) return prev;
        if (
          prev.surah === detail.surah &&
          prev.ayah === detail.ayah &&
          prev.wordIndex === detail.wordIndex
        ) {
          return null;
        }
        return prev;
      });
    };

    window.addEventListener(WORD_AUDIO_EVENTS.WORD_HIGHLIGHT_START, handleHighlightStart);
    window.addEventListener(WORD_AUDIO_EVENTS.WORD_HIGHLIGHT_END, handleHighlightEnd);

    return () => {
      window.removeEventListener(WORD_AUDIO_EVENTS.WORD_HIGHLIGHT_START, handleHighlightStart);
      window.removeEventListener(WORD_AUDIO_EVENTS.WORD_HIGHLIGHT_END, handleHighlightEnd);
    };
  }, []);

  return (
    <div className="space-y-8">
      <ScrollProgressBar height={2} />
      {verses.map((v) => (
        <VerseDisplay
          key={v.key}
          verse={v}
          chapter={chapter}
          activeReciterWord={activeReciterWord}
        />
      ))}
    </div>
  );
}

export default function SurahContentWrapper({
  chapter,
  verses,
}: {
  chapter: number;
  verses: Verse[];
}) {
  return (
    <ReadingSettingsProvider>
      <SurahContentInner chapter={chapter} verses={verses} />
    </ReadingSettingsProvider>
  );
}
