"use client";

import { ReadingSettingsProvider, useReadingSettings } from "./ReadingSettingsProvider";
import VerseDisplay from "./VerseDisplay";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Verse = {
  n: number;
  key: string;
  arabic: string;
  translations: { text: string; source?: string; resourceId?: number }[];
  transliterations: { text: string; source?: string; resourceId?: number }[];
};

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

      console.log("[SurahContentWrapper] Syncing URL with settings:", {
        translationIds: settings.translationIds,
        transliterationIds: settings.transliterationIds,
        wordByWordLanguageId: settings.wordByWordLanguageId,
        showWordByWordTranslation: settings.showWordByWordTranslation,
        showWordByWordTransliteration: settings.showWordByWordTransliteration,
      });

      // Update URL to trigger server refetch with correct IDs
      router.replace(`?${params.toString()}`);
    }
  }, [settings.translationIds, settings.transliterationIds, settings.wordByWordLanguageId, settings.showWordByWordTranslation, searchParams, router]);

  return (
    <div className="space-y-8">
      {verses.map((v) => (
        <VerseDisplay key={v.key} verse={v} chapter={chapter} />
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
