"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type Settings = {
  wordByWord: { translation: boolean; transliteration: boolean; recitation: boolean };
  fontSize: number; // 1.0 = base
  translationLang: string;
  quranFont: "Uthmani" | "IndoPak" | "Tajweed";
};

export default function SettingsPage() {
  const { theme, setTheme, systemTheme } = useTheme();

  const [pref, setPref] = useState<Settings>({
    wordByWord: { translation: true, transliteration: false, recitation: false },
    fontSize: 1.0,
    translationLang: "English",
    quranFont: "Uthmani",
  });

  useEffect(() => {
    const raw = localStorage.getItem("qs-settings");
    if (raw) {
      try { setPref(JSON.parse(raw)); } catch {}
    }
    // If any sepia flag/class was left from earlier experiments, clear it.
    localStorage.removeItem("qs-sepia");
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("sepia");
    }
  }, []);

  function save() {
    localStorage.setItem("qs-settings", JSON.stringify(pref));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-28 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Theme and reading preferences.</p>
      </header>

      {/* THEME */}
      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Theme</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { key: "system", label: "Auto" },
            { key: "light",  label: "Light" },
            { key: "dark",   label: "Dark"  },
          ].map(({ key, label }) => (
            <Button
              key={key}
              variant={theme === key || (key === "system" && theme === "system") ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme(key as any)}
            >
              {label}
            </Button>
          ))}
          <div className="text-xs text-muted-foreground self-center ml-2">
            Current: {theme} {theme === "system" ? `(${systemTheme})` : ""}
          </div>
        </div>
      </section>

      {/* QURAN FONT */}
      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Quran Font</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["Uthmani","IndoPak","Tajweed"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setPref(p => ({ ...p, quranFont: k }))}
              className={cn(
                "px-3 py-1.5 rounded-full border text-sm",
                pref.quranFont === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <div className="flex items-center gap-3">
            <span className="text-sm">Font size</span>
            <Slider
              value={[Math.round(pref.fontSize * 100)]}
              onValueChange={(value: number[]) =>
                setPref(p => ({ ...p, fontSize: value[0] / 100 }))
              }
              min={80}
              max={160}
              step={5}
              className="w-60"
            />
            <span className="text-sm opacity-70">{Math.round(pref.fontSize * 100)}%</span>
          </div>
        </div>
      </section>

      {/* WORD BY WORD */}
      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Word By Word</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { key: "translation", label: "Translation" },
            { key: "transliteration", label: "Transliteration" },
            { key: "recitation", label: "Recitation" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={(pref.wordByWord as any)[key]}
                onChange={(e) =>
                  setPref(p => ({ ...p, wordByWord: { ...p.wordByWord, [key]: e.target.checked } }))
                }
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      {/* TRANSLATION */}
      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Translation Language</h2>
        <select
          className="mt-3 w-full md:w-64 rounded-md border bg-background p-2"
          value={pref.translationLang}
          onChange={(e) => setPref(p => ({ ...p, translationLang: e.target.value }))}
        >
          <option>English</option>
          <option>Urdu</option>
          <option>Arabic</option>
          <option>French</option>
          <option>Indonesian</option>
        </select>
      </section>

      <div>
        <Button onClick={save}>Save settings</Button>
      </div>
    </div>
  );
}
