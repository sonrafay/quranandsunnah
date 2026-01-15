"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getReadingSettings, ReadingSettingsDoc } from "@/lib/cloud";

type ReadingSettings = {
  quranFont: "Uthmani" | "IndoPak" | "Tajweed";
  quranFontSize: number;
  translationFontSize: number;
  transliterationFontSize: number;
  overallScale: number;
  translationIds: number[];
  transliterationIds: number[];
  showTranslation: boolean;
  showTransliteration: boolean;
};

const defaultSettings: ReadingSettings = {
  quranFont: "Uthmani",
  quranFontSize: 1,
  translationFontSize: 1,
  transliterationFontSize: 1,
  overallScale: 1,
  translationIds: [],
  transliterationIds: [],
  showTranslation: true,
  showTransliteration: false,
};

const ReadingSettingsContext = createContext<ReadingSettings>(defaultSettings);

export function useReadingSettings() {
  return useContext(ReadingSettingsContext);
}

export function ReadingSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ReadingSettings>(defaultSettings);

  useEffect(() => {
    if (!user) {
      setSettings(defaultSettings);
      return;
    }

    let active = true;

    (async () => {
      try {
        const stored = await getReadingSettings(user.uid);
        if (!active) return;

        console.log("[ReadingSettingsProvider] Raw Firestore data:", stored);
        console.log("[ReadingSettingsProvider] Font size check:", {
          raw: stored?.quranFontSize,
          type: typeof stored?.quranFontSize,
          isNumber: typeof stored?.quranFontSize === "number"
        });

        const normalized: ReadingSettings = {
          ...defaultSettings,
          ...stored,
          translationIds: Array.isArray(stored?.translationIds) ? stored.translationIds : [],
          transliterationIds: Array.isArray(stored?.transliterationIds) ? stored.transliterationIds : [],
          quranFontSize: typeof stored?.quranFontSize === "number" ? stored.quranFontSize : defaultSettings.quranFontSize,
          translationFontSize:
            typeof stored?.translationFontSize === "number" ? stored.translationFontSize : defaultSettings.translationFontSize,
          transliterationFontSize:
            typeof stored?.transliterationFontSize === "number"
              ? stored.transliterationFontSize
              : defaultSettings.transliterationFontSize,
          overallScale: typeof stored?.overallScale === "number" ? stored.overallScale : defaultSettings.overallScale,
        };

        console.log("[ReadingSettingsProvider] Normalized settings:", normalized);
        setSettings(normalized);
      } catch (error) {
        console.error("[ReadingSettingsProvider] Error loading settings:", error);
        if (active) setSettings(defaultSettings);
      }
    })();

    return () => {
      active = false;
    };
  }, [user]);

  return <ReadingSettingsContext.Provider value={settings}>{children}</ReadingSettingsContext.Provider>;
}
