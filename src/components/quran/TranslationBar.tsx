"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type T = { id: number; title: string; lang: string };

export default function TranslationBar({
  translations,
  currentId,
}: {
  translations: T[];
  currentId?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("t", next);
    else params.delete("t");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-center gap-3 my-4">
      <label className="text-sm text-muted-foreground">Translation</label>
      <select
        className="h-9 rounded-md border bg-background px-3 text-sm"
        value={currentId ?? ""}
        onChange={onChange}
      >
        {/* Put English first, then everything else */}
        {translations
          .slice()
          .sort((a, b) => {
            const ae = a.lang.toLowerCase() === "english" ? 0 : 1;
            const be = b.lang.toLowerCase() === "english" ? 0 : 1;
            return ae - be || a.title.localeCompare(b.title);
          })
          .map((t) => (
            <option key={t.id} value={t.id}>
              {t.lang}: {t.title}
            </option>
          ))}
      </select>
    </div>
  );
}
