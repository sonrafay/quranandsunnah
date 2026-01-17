"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getReadingSettings, ReadingSettingsDoc } from "@/lib/cloud";

type QuranFontVariant =
  | "uthmani-simple"
  | "indopak"
  | "qcf-v1"
  | "qcf-v2"
  | "qcf-v4-tajweed"
  | "qpc-uthmani-hafs";

type ReadingSettings = {
  quranFont: QuranFontVariant;
  quranFontSize: number;
  translationFontSize: number;
  transliterationFontSize: number;
  translationIds: number[];
  transliterationIds: number[];
  // Word-by-word settings (unified language, separate toggles)
  wordByWordLanguageId: number | null;
  showWordByWordTranslation: boolean;
  showWordByWordTransliteration: boolean;
};

function migrateLegacyFont(oldFont: any): QuranFontVariant {
  if (oldFont === "Uthmani") return "uthmani-simple";
  if (oldFont === "IndoPak") return "indopak";
  if (oldFont === "Tajweed" || oldFont === "tajweed") return "qcf-v4-tajweed";
  if (typeof oldFont === "string" && ["uthmani-simple", "indopak", "qcf-v1", "qcf-v2", "qcf-v4-tajweed", "qpc-uthmani-hafs"].includes(oldFont)) {
    return oldFont as QuranFontVariant;
  }
  return "uthmani-simple";
}

// List of valid setting keys - ignore any deprecated/unknown fields from Firestore
const VALID_SETTING_KEYS = new Set([
  "quranFont",
  "quranFontSize",
  "translationFontSize",
  "transliterationFontSize",
  "translationIds",
  "transliterationIds",
  "wordByWordLanguageId",
  "showWordByWordTranslation",
  "showWordByWordTransliteration",
  // Legacy fields (for migration)
  "wordByWordTranslationId",
  "wordByWordTransliterationId",
  "theme",
  "updatedAt",
]);

const defaultSettings: ReadingSettings = {
  quranFont: "uthmani-simple",
  quranFontSize: 1,
  translationFontSize: 1,
  transliterationFontSize: 1,
  translationIds: [],
  transliterationIds: [],
  wordByWordLanguageId: null,
  showWordByWordTranslation: false,
  showWordByWordTransliteration: false,
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

        // Filter out unknown/deprecated fields (e.g., overallScale)
        const filtered: Record<string, any> = {};
        if (stored) {
          for (const key of Object.keys(stored)) {
            if (VALID_SETTING_KEYS.has(key)) {
              filtered[key] = stored[key as keyof typeof stored];
            } else {
              console.log(`[ReadingSettingsProvider] Ignoring deprecated field: ${key}`);
            }
          }
        }

        // Migration: if old wordByWordTranslationId exists, migrate to new schema
        const migratedLanguageId = typeof filtered.wordByWordLanguageId === "number"
          ? filtered.wordByWordLanguageId
          : typeof filtered.wordByWordTranslationId === "number"
            ? filtered.wordByWordTranslationId
            : null;
        // Migration: if old wordByWordTranslationId was set, enable translation toggle
        const migratedShowTranslation = typeof filtered.showWordByWordTranslation === "boolean"
          ? filtered.showWordByWordTranslation
          : typeof filtered.wordByWordTranslationId === "number";
        // Migration: if old wordByWordTransliterationId was set, enable transliteration toggle
        const migratedShowTransliteration = typeof filtered.showWordByWordTransliteration === "boolean"
          ? filtered.showWordByWordTransliteration
          : typeof filtered.wordByWordTransliterationId === "number";

        const normalized: ReadingSettings = {
          ...defaultSettings,
          quranFont: migrateLegacyFont(filtered.quranFont),
          translationIds: Array.isArray(filtered.translationIds) ? filtered.translationIds : [],
          transliterationIds: Array.isArray(filtered.transliterationIds) ? filtered.transliterationIds : [],
          quranFontSize: typeof filtered.quranFontSize === "number" ? filtered.quranFontSize : defaultSettings.quranFontSize,
          translationFontSize:
            typeof filtered.translationFontSize === "number" ? filtered.translationFontSize : defaultSettings.translationFontSize,
          transliterationFontSize:
            typeof filtered.transliterationFontSize === "number"
              ? filtered.transliterationFontSize
              : defaultSettings.transliterationFontSize,
          wordByWordLanguageId: migratedLanguageId,
          showWordByWordTranslation: migratedShowTranslation,
          showWordByWordTransliteration: migratedShowTransliteration,
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
