"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export type TranslationItem = {
  id: number;
  title: string;
  lang: string;
  translator?: string | null;
};

export default function TranslationMultiPicker({
  translations,
  selectedIds,
  buttonClassName = "",
}: {
  translations: TranslationItem[];
  selectedIds: number[];
  buttonClassName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState<number[]>(selectedIds);

  useEffect(() => setSel(selectedIds), [selectedIds.join(",")]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return translations;
    return translations.filter((t) => {
      return (
        t.title.toLowerCase().includes(q) ||
        t.lang.toLowerCase().includes(q) ||
        (t.translator ?? "").toLowerCase().includes(q)
      );
    });
  }, [translations, query]);

  function apply() {
    const params = new URLSearchParams(searchParams.toString());
    if (sel.length) params.set("t", sel.join(","));
    else params.delete("t");
    router.replace(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  function reset() {
    setSel([]);
  }

  function toggle(id: number) {
    setSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // small pill showing count
  const count = sel.length;

  return (
    <div className="relative inline-block">
      <button
        className={
          buttonClassName ||
          "h-9 rounded-full glass-surface glass-interactive px-3 text-sm transition"
        }
        onClick={() => setOpen((o) => !o)}
      >
        Translations{count ? ` (${count})` : ""}
      </button>

      {open && (
        <>
          {/* light overlay for outside click */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute z-40 mt-2 w-[320px] rounded-xl glass-surface glass-readable p-3">
            <div className="mb-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search (e.g. English, Urdu, Haleem)"
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
              />
            </div>

            <div className="max-h-72 overflow-auto pr-1 space-y-1">
              {filtered.map((t) => {
                const checked = sel.includes(t.id);
                return (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(t.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">
                      <span className="font-medium">{t.lang}</span>: {t.title}
                      {t.translator ? <span className="opacity-70"> — {t.translator}</span> : null}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                className="text-xs underline opacity-80 hover:opacity-100"
                onClick={reset}
              >
                Clear
              </button>
              <div className="flex gap-2">
                <button
                  className="h-8 rounded-md border px-3 text-sm hover:bg-muted"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="h-8 rounded-md border px-3 text-sm bg-muted hover:opacity-90"
                  onClick={apply}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
