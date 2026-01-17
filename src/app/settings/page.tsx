"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useThemeTransition } from "@/hooks/use-theme-transition";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { getReadingSettings, ReadingSettingsDoc, saveReadingSettings } from "@/lib/cloud";

type QuranFontVariant =
  | "uthmani-simple"      // text_uthmani (text-based)
  | "indopak"             // text_indopak (text-based)
  | "qcf-v1"              // King Fahad Complex V1 (glyph-based)
  | "qcf-v2"              // King Fahad Complex V2 (glyph-based)
  | "qcf-v4-tajweed"      // King Fahad Complex V4 Tajweed (glyph-based) - default for "Tajweed"
  | "qpc-uthmani-hafs";   // QPC Uthmani Hafs (glyph-based)

type Settings = {
  theme: "light" | "dark" | "sepia";
  quranFont: QuranFontVariant;
  quranFontSize: number; // 1.0 = base
  translationFontSize: number;
  transliterationFontSize: number;
  translationIds: number[];
  transliterationIds: number[];
  // Word-by-word settings (unified language, separate toggles)
  wordByWordLanguageId: number | null;
  showWordByWordTranslation: boolean;
  showWordByWordTransliteration: boolean;
};

type CatalogItem = {
  id: number;
  title: string;
  lang: string;
  translator?: string | null;
  slug?: string;
};

type WordLanguageItem = {
  id: number;
  title: string;
  nativeName: string;
  isoCode: string;
  direction: string;
};

type SimpleOption = { value: string; label: string; shortLabel?: string };

// Curated list of supported word-by-word translation languages (matching Quran.com)
// These are the ISO codes that the API actually supports for word translations
const SUPPORTED_WORD_LANGUAGES = new Set([
  "ar",  // Arabic
  "en",  // English
  "id",  // Indonesian
  "bn",  // Bangla
  "de",  // Deutsch
  "sq",  // Shqip (Albanian)
  "ur",  // اردو (Urdu)
  "ru",  // русский (Russian)
  "tr",  // Türkçe (Turkish)
  "fa",  // فارسی (Persian)
  "hi",  // हिन्दी (Hindi)
  "ta",  // தமிழ் (Tamil)
  "zh",  // 简体中文 (Chinese)
  "fr",  // Français (French)
  "ml",  // മലയാളം (Malayalam)
]);

const defaultSettings: Settings = {
  theme: "dark",
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

function migrateLegacyFont(oldFont: any): QuranFontVariant {
  if (oldFont === "Uthmani") return "uthmani-simple";
  if (oldFont === "IndoPak") return "indopak";
  if (oldFont === "Tajweed" || oldFont === "tajweed") return "qcf-v4-tajweed";
  // If already using new format, return as-is
  if (typeof oldFont === "string" && ["uthmani-simple", "indopak", "qcf-v1", "qcf-v2", "qcf-v4-tajweed", "qpc-uthmani-hafs"].includes(oldFont)) {
    return oldFont as QuranFontVariant;
  }
  return "uthmani-simple";
}

function normalizeSettings(data: ReadingSettingsDoc | null): Settings {
  const safe = data ?? {};
  // Migration: if old wordByWordTranslationId exists, migrate to new schema
  const migratedLanguageId = typeof safe.wordByWordLanguageId === "number"
    ? safe.wordByWordLanguageId
    : typeof (safe as any).wordByWordTranslationId === "number"
      ? (safe as any).wordByWordTranslationId
      : null;
  // Migration: if old wordByWordTranslationId was set, enable translation toggle
  const migratedShowTranslation = typeof safe.showWordByWordTranslation === "boolean"
    ? safe.showWordByWordTranslation
    : typeof (safe as any).wordByWordTranslationId === "number";
  // Migration: if old wordByWordTransliterationId was set, enable transliteration toggle
  const migratedShowTransliteration = typeof safe.showWordByWordTransliteration === "boolean"
    ? safe.showWordByWordTransliteration
    : typeof (safe as any).wordByWordTransliterationId === "number";

  return {
    ...defaultSettings,
    ...safe,
    quranFont: migrateLegacyFont(safe.quranFont),
    translationIds: Array.isArray(safe.translationIds) ? safe.translationIds : [],
    transliterationIds: Array.isArray(safe.transliterationIds) ? safe.transliterationIds : [],
    quranFontSize: typeof safe.quranFontSize === "number" ? safe.quranFontSize : defaultSettings.quranFontSize,
    translationFontSize:
      typeof safe.translationFontSize === "number" ? safe.translationFontSize : defaultSettings.translationFontSize,
    transliterationFontSize:
      typeof safe.transliterationFontSize === "number"
        ? safe.transliterationFontSize
        : defaultSettings.transliterationFontSize,
    wordByWordLanguageId: migratedLanguageId,
    showWordByWordTranslation: migratedShowTranslation,
    showWordByWordTransliteration: migratedShowTransliteration,
  };
}

function scaleToPercent(value: number) {
  return Math.round(value * 100);
}

function percentToScale(value: number) {
  return value / 100;
}

function ChevronDown() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4 text-muted-foreground transition-transform group-hover:text-foreground"
    >
      <path
        fill="currentColor"
        d="M5.7 7.7a1 1 0 0 1 1.4 0L10 10.6l2.9-2.9a1 1 0 1 1 1.4 1.4l-3.6 3.6a1 1 0 0 1-1.4 0L5.7 9.1a1 1 0 0 1 0-1.4z"
      />
    </svg>
  );
}

function SingleSelectPopover({
  id,
  isOpen,
  onToggle,
  onClose,
  label,
  value,
  options,
  onChange,
  emptyLabel,
  buttonClassName,
}: {
  id: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
  label: string;
  value: string;
  options: SimpleOption[];
  onChange: (next: string) => void;
  emptyLabel: string;
  buttonClassName?: string;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const currentOption = options.find((opt) => opt.value === value);
  const current = currentOption?.shortLabel ?? currentOption?.label ?? value;

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(opt =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  return (
    <div className="relative">
      <button
        aria-label={label}
        className={cn(
          "group h-10 w-full min-w-0 rounded-xl glass-surface glass-readable px-3 text-sm flex items-center justify-between gap-3",
          buttonClassName
        )}
        onClick={() => onToggle(id)}
      >
        <span className="truncate">{current}</span>
        <span className="ml-4 flex items-center">
          <ChevronDown />
        </span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
          <div className="absolute left-0 top-full mt-2 z-50 w-full min-w-[400px] max-w-[calc(100vw-2rem)] rounded-xl glass-surface glass-readable p-4 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 px-3 mb-3 rounded-lg glass-surface glass-readable text-sm border-0 focus:outline-none hover:bg-muted/30 transition-colors"
            />
            <div className="max-h-80 overflow-auto pr-1 space-y-1">
              {filteredOptions.length ? (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.value}
                    className={cn(
                      "w-full text-left rounded-md px-3 py-2 hover:bg-muted transition-colors",
                      opt.value === value ? "bg-green-500/20 text-green-600 dark:text-green-400" : ""
                    )}
                    onClick={() => {
                      onChange(opt.value);
                      setSearchTerm("");
                      onClose();
                    }}
                  >
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                ))
              ) : (
                <div className="text-sm text-muted-foreground py-2">{searchTerm ? "No results found" : emptyLabel}</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MultiSelectPopover({
  id,
  isOpen,
  onToggle,
  onClose,
  label,
  valueLabel,
  options,
  selectedIds,
  onChange,
  loading,
  emptyLabel,
  buttonClassName,
  closeOnSelect = false,
}: {
  id: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
  label: string;
  valueLabel: string;
  options: CatalogItem[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  loading: boolean;
  emptyLabel: string;
  buttonClassName?: string;
  closeOnSelect?: boolean;
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = useMemo(() => {
    if (!searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(opt =>
      opt.title.toLowerCase().includes(term) ||
      opt.lang.toLowerCase().includes(term) ||
      opt.translator?.toLowerCase().includes(term)
    );
  }, [options, searchTerm]);

  function toggle(id: number) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
      if (closeOnSelect) onClose();
      return;
    }
    onChange([...selectedIds, id]);
    if (closeOnSelect) onClose();
  }

  return (
    <div className="relative">
      <button
        aria-label={label}
        className={cn(
          "group h-10 w-full min-w-0 rounded-xl glass-surface glass-readable px-3 text-sm flex items-center justify-between gap-3",
          buttonClassName
        )}
        onClick={() => onToggle(id)}
      >
        <span className="truncate">{valueLabel}</span>
        <span className="ml-4 flex items-center">
          <ChevronDown />
        </span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
          <div className="absolute left-0 top-full mt-2 z-50 w-full min-w-[500px] max-w-[calc(100vw-2rem)] rounded-xl glass-surface glass-readable p-4 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
            <input
              type="text"
              placeholder="Search translations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 px-3 mb-3 rounded-lg glass-surface glass-readable text-sm border-0 focus:outline-none hover:bg-muted/30 transition-colors"
            />
            <div className="max-h-44 overflow-auto pr-1 space-y-1">
              {loading ? (
                <div className="text-sm text-muted-foreground py-2">Loading options...</div>
              ) : filtered.length ? (
                filtered.map((t) => {
                  const checked = selectedIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      className={cn(
                        "w-full text-left rounded-md px-3 py-2.5 hover:bg-muted transition-colors",
                        checked ? "bg-green-500/20 text-green-600 dark:text-green-400" : ""
                      )}
                      onClick={() => toggle(t.id)}
                    >
                      <div className="text-sm">
                        <span className="font-semibold">{t.lang}</span>: {t.title}
                        {t.translator ? <span className="opacity-70"> - {t.translator}</span> : null}
                      </div>
                      {checked ? <span className="text-xs opacity-80 mt-1 block">✓ Selected</span> : null}
                    </button>
                  );
                })
              ) : (
                <div className="text-sm text-muted-foreground py-2">{searchTerm ? "No results found" : emptyLabel}</div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
              <button
                className="text-sm underline opacity-80 hover:opacity-100 hover:text-green-500 transition-colors"
                onClick={() => {
                  onChange([]);
                  setSearchTerm("");
                }}
              >
                Clear All
              </button>
              <button
                className="h-9 rounded-lg glass-surface glass-readable px-4 text-sm font-medium hover:bg-green-500/10 transition-colors"
                onClick={() => {
                  setSearchTerm("");
                  onClose();
                }}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NullableSingleSelectPopover({
  id,
  isOpen,
  onToggle,
  onClose,
  label,
  value,
  options,
  onChange,
  loading,
  emptyLabel,
  placeholder,
  buttonClassName,
}: {
  id: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
  label: string;
  value: number | null;
  options: WordLanguageItem[];
  onChange: (next: number | null) => void;
  loading: boolean;
  emptyLabel: string;
  placeholder: string;
  buttonClassName?: string;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const current = options.find((opt) => opt.id === value);
  const displayLabel = current ? `${current.title} (${current.nativeName})` : placeholder;

  const filtered = useMemo(() => {
    if (!searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.title.toLowerCase().includes(term) ||
        opt.nativeName.toLowerCase().includes(term) ||
        opt.isoCode.toLowerCase().includes(term)
    );
  }, [options, searchTerm]);

  return (
    <div className="relative">
      <button
        aria-label={label}
        className={cn(
          "group h-10 w-full min-w-0 rounded-xl glass-surface glass-readable px-3 text-sm flex items-center justify-between gap-3",
          buttonClassName
        )}
        onClick={() => onToggle(id)}
      >
        <span className={cn("truncate", !current && "text-muted-foreground")}>{displayLabel}</span>
        <span className="ml-4 flex items-center">
          <ChevronDown />
        </span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
          <div className="absolute left-0 top-full mt-2 z-50 w-full min-w-[400px] max-w-[calc(100vw-2rem)] rounded-xl glass-surface glass-readable p-4 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
            <input
              type="text"
              placeholder="Search languages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 px-3 mb-3 rounded-lg glass-surface glass-readable text-sm border-0 focus:outline-none hover:bg-muted/30 transition-colors"
            />
            <div className="max-h-64 overflow-auto pr-1 space-y-1">
              {loading ? (
                <div className="text-sm text-muted-foreground py-2">Loading options...</div>
              ) : filtered.length ? (
                filtered.map((opt) => {
                  const isSelected = opt.id === value;
                  return (
                    <button
                      key={opt.id}
                      className={cn(
                        "w-full text-left rounded-md px-3 py-2 hover:bg-muted transition-colors",
                        isSelected ? "bg-green-500/20 text-green-600 dark:text-green-400" : ""
                      )}
                      onClick={() => {
                        onChange(opt.id);
                        setSearchTerm("");
                        onClose();
                      }}
                    >
                      <span className="text-sm font-medium">{opt.title}</span>
                      <span className="text-sm opacity-70 ml-2">({opt.nativeName})</span>
                    </button>
                  );
                })
              ) : (
                <div className="text-sm text-muted-foreground py-2">
                  {searchTerm ? "No results found" : emptyLabel}
                </div>
              )}
            </div>

            {value !== null && (
              <div className="mt-4 border-t border-border/50 pt-3">
                <button
                  className="text-sm underline opacity-80 hover:opacity-100 hover:text-red-500 transition-colors"
                  onClick={() => {
                    onChange(null);
                    setSearchTerm("");
                    onClose();
                  }}
                >
                  Clear Selection (Disable)
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { setTheme } = useThemeTransition();
  const { user } = useAuth();

  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);
  const skipSaveRef = useRef(true);
  const [openPopover, setOpenPopover] = useState<string | null>(null);

  const [translations, setTranslations] = useState<CatalogItem[]>([]);
  const [transliterations, setTransliterations] = useState<CatalogItem[]>([]);
  const [wordLanguages, setWordLanguages] = useState<WordLanguageItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadCatalog() {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const [translationsRes, transliterationsRes, wordLangsRes] = await Promise.all([
          fetch("/api/qf/translations"),
          fetch("/api/qf/transliterations"),
          fetch("/api/qf/word-translations"),
        ]);
        const translationsJson = translationsRes.ok ? await translationsRes.json() : null;
        const transliterationsJson = transliterationsRes.ok ? await transliterationsRes.json() : null;
        const wordLangsJson = wordLangsRes.ok ? await wordLangsRes.json() : null;
        if (!active) return;
        setTranslations(Array.isArray(translationsJson?.translations) ? translationsJson.translations : []);
        setTransliterations(
          Array.isArray(transliterationsJson?.transliterations) ? transliterationsJson.transliterations : []
        );
        setWordLanguages(Array.isArray(wordLangsJson?.languages) ? wordLangsJson.languages : []);
        if (!translationsRes.ok || !transliterationsRes.ok || !wordLangsRes.ok) {
          setCatalogError("Some options could not be loaded.");
        }
      } catch {
        if (active) setCatalogError("Unable to load options right now.");
      } finally {
        if (active) setCatalogLoading(false);
      }
    }
    loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) {
      setLoaded(true);
      skipSaveRef.current = true;
      return () => {
        active = false;
      };
    }

    (async () => {
      try {
        const stored = await getReadingSettings(user.uid);
        if (!active) return;
        const normalized = normalizeSettings(stored);
        setSettings(normalized);
        setTheme(normalized.theme);
      } catch {
        if (active) setSettings(defaultSettings);
      } finally {
        if (active) {
          setLoaded(true);
          skipSaveRef.current = true;
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [user, setTheme]);

  useEffect(() => {
    if (!user || !loaded) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    saveReadingSettings(user.uid, settings).catch(() => {});
  }, [user, loaded, settings]);

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function togglePopover(id: string) {
    setOpenPopover((prev) => (prev === id ? null : id));
  }

  function closePopover() {
    setOpenPopover(null);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-32 pb-64 sm:pt-28 sm:pb-80 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Theme and reading preferences.</p>
      </header>

      {/* THEME */}
      <section className="rounded-xl glass-surface glass-readable p-4">
        <h2 className="font-semibold">Theme</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { key: "dark", label: "Dark" },
            { key: "light", label: "Light" },
            { key: "sepia", label: "Sepia" },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={cn(
                "h-9 px-4 rounded-lg glass-surface glass-readable text-sm font-medium transition-all",
                settings.theme === key && "bg-green-500/20 text-green-600 dark:text-green-400"
              )}
              onClick={() => {
                setTheme(key as Settings["theme"]);
                updateSetting("theme", key as Settings["theme"]);
              }}
            >
              {label}
            </button>
          ))}
          <div className="text-xs text-muted-foreground self-center ml-2">
            Current: {settings.theme}
          </div>
        </div>
      </section>

      {/* FONT & SIZE */}
      <section className="rounded-xl glass-surface glass-readable p-4 space-y-6 relative z-10">
        <div>
          <h2 className="font-semibold">Font & Size</h2>
          {catalogError ? <p className="text-xs text-amber-500 mt-1">{catalogError}</p> : null}
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)] md:items-center">
            <div className="flex items-center gap-4 md:pr-6">
              <div className="text-sm font-medium w-32">Quran (Arabic)</div>
              <SingleSelectPopover
                id="quranFont"
                isOpen={openPopover === "quranFont"}
                onToggle={togglePopover}
                onClose={closePopover}
                label="Quran font"
                value={settings.quranFont}
                options={[
                  { value: "uthmani-simple", label: "QPC Uthmani Hafs", shortLabel: "Uthmani 1" },
                  { value: "qcf-v1", label: "Uthmani (King Fahad Complex V1)", shortLabel: "Uthmani 2" },
                  { value: "qcf-v2", label: "Uthmani (King Fahad Complex V2)", shortLabel: "Uthmani 3" },
                  { value: "indopak", label: "IndoPak" },
                  { value: "qcf-v4-tajweed", label: "Tajweed (King Fahad Complex V4)", shortLabel: "Tajweed" },
                ]}
                onChange={(next) => updateSetting("quranFont", next as Settings["quranFont"])}
                emptyLabel="No fonts available."
              />
            </div>
            <div className="flex items-center gap-3 md:justify-end">
              <Slider
                value={[scaleToPercent(settings.quranFontSize)]}
                onValueChange={(value: number[]) => updateSetting("quranFontSize", percentToScale(value[0]))}
                min={50}
                max={200}
                step={5}
                className="w-full md:w-[320px]"
              />
              <span className="text-sm opacity-70 w-12 text-right">
                {scaleToPercent(settings.quranFontSize)}%
              </span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)] md:items-center">
            <div className="flex items-center gap-4 md:pr-6">
              <div className="text-sm font-medium w-32">Translation</div>
              <MultiSelectPopover
                id="translation"
                isOpen={openPopover === "translation"}
                onToggle={togglePopover}
                onClose={closePopover}
                label="Translations"
                valueLabel={
                  settings.translationIds.length
                    ? `${settings.translationIds.length} selected`
                    : "Select"
                }
                options={translations}
                selectedIds={settings.translationIds}
                onChange={(ids) => updateSetting("translationIds", ids)}
                loading={catalogLoading}
                emptyLabel="No translations available."
                closeOnSelect
              />
            </div>
            <div className="flex items-center gap-3 md:justify-end">
              <Slider
                value={[scaleToPercent(settings.translationFontSize)]}
                onValueChange={(value: number[]) => updateSetting("translationFontSize", percentToScale(value[0]))}
                min={50}
                max={200}
                step={5}
                className="w-full md:w-[320px]"
              />
              <span className="text-sm opacity-70 w-12 text-right">
                {scaleToPercent(settings.translationFontSize)}%
              </span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)] md:items-center">
            <div className="flex items-center gap-4 md:pr-6">
              <div className="text-sm font-medium w-32">Transliteration</div>
              <MultiSelectPopover
                id="transliteration"
                isOpen={openPopover === "transliteration"}
                onToggle={togglePopover}
                onClose={closePopover}
                label="Transliterations"
                valueLabel={
                  settings.transliterationIds.length
                    ? `${settings.transliterationIds.length} selected`
                    : "Select"
                }
                options={transliterations}
                selectedIds={settings.transliterationIds}
                onChange={(ids) => updateSetting("transliterationIds", ids)}
                loading={catalogLoading}
                emptyLabel="No transliterations available."
                closeOnSelect
              />
            </div>
            <div className="flex items-center gap-3 md:justify-end">
              <Slider
                value={[scaleToPercent(settings.transliterationFontSize)]}
                onValueChange={(value: number[]) => updateSetting("transliterationFontSize", percentToScale(value[0]))}
                min={50}
                max={200}
                step={5}
                className="w-full md:w-[320px]"
              />
              <span className="text-sm opacity-70 w-12 text-right">
                {scaleToPercent(settings.transliterationFontSize)}%
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* WORD BY WORD */}
      <section className="rounded-xl glass-surface glass-readable p-4 space-y-6 relative z-[5]">
        <div>
          <h2 className="font-semibold">Word by Word</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Hover over Arabic words to see translation and transliteration. Size scales with your font settings.
          </p>
        </div>

        <div className="space-y-5">
          {/* Language selector - filtered to supported languages only */}
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium w-40">Language</div>
            <NullableSingleSelectPopover
              id="wbwLanguage"
              isOpen={openPopover === "wbwLanguage"}
              onToggle={togglePopover}
              onClose={closePopover}
              label="Word-by-word language"
              value={settings.wordByWordLanguageId}
              options={wordLanguages.filter(lang => SUPPORTED_WORD_LANGUAGES.has(lang.isoCode))}
              onChange={(id) => updateSetting("wordByWordLanguageId", id)}
              loading={catalogLoading}
              emptyLabel="No languages available."
              placeholder="Select a language"
            />
          </div>

          {/* Pill-style toggle buttons */}
          <div className="flex justify-center gap-3">
            <button
              className={cn(
                "h-11 px-6 rounded-full glass-surface glass-readable text-sm font-medium transition-colors",
                settings.showWordByWordTranslation
                  ? "bg-green-500/25 text-green-500 dark:text-green-400 shadow-[0_0_12px_rgba(34,197,94,0.3)]"
                  : "hover:text-green-500/80 dark:hover:text-green-400/80"
              )}
              onClick={() => updateSetting("showWordByWordTranslation", !settings.showWordByWordTranslation)}
            >
              Translation
            </button>

            <button
              className={cn(
                "h-11 px-6 rounded-full glass-surface glass-readable text-sm font-medium transition-colors",
                settings.showWordByWordTransliteration
                  ? "bg-green-500/25 text-green-500 dark:text-green-400 shadow-[0_0_12px_rgba(34,197,94,0.3)]"
                  : "hover:text-green-500/80 dark:hover:text-green-400/80"
              )}
              onClick={() => updateSetting("showWordByWordTransliteration", !settings.showWordByWordTransliteration)}
            >
              Transliteration
            </button>
          </div>

          {/* Info text about current state */}
          {!settings.wordByWordLanguageId && (settings.showWordByWordTranslation || settings.showWordByWordTransliteration) && (
            <p className="text-xs text-amber-500">
              Select a language above to enable word-by-word features.
            </p>
          )}
        </div>
      </section>

    </div>
  );
}
