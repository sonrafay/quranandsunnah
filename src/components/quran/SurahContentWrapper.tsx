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

  // Sync URL with settings to fetch correct translations/transliterations
  useEffect(() => {
    const hasTranslationParam = searchParams.get("t");
    const hasTransliterationParam = searchParams.get("tl");

    // Only update URL if we have settings loaded and they differ from current URL
    if (settings.translationIds.length > 0) {
      const currentT = hasTranslationParam?.split(",").map(Number).sort().join(",");
      const settingsT = settings.translationIds.sort().join(",");
      const currentTL = hasTransliterationParam?.split(",").map(Number).sort().join(",") || "";
      const settingsTL = settings.transliterationIds.sort().join(",");

      if (currentT !== settingsT || currentTL !== settingsTL) {
        const params = new URLSearchParams();
        params.set("t", settings.translationIds.join(","));

        if (settings.transliterationIds.length > 0) {
          params.set("tl", settings.transliterationIds.join(","));
        }

        console.log("[SurahContentWrapper] Syncing URL with settings:", {
          translationIds: settings.translationIds,
          transliterationIds: settings.transliterationIds
        });

        // Update URL to trigger server refetch with correct IDs
        router.replace(`?${params.toString()}`);
      }
    }
  }, [settings.translationIds, settings.transliterationIds, searchParams, router]);

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
