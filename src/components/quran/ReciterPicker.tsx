"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type Reciter = { id: number; name: string };

export default function ReciterPicker({
  reciters,
  selectedId,
}: {
  reciters: Reciter[];
  selectedId: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("r", next);
    else params.delete("r");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Reciter</span>
      <select
        className="h-9 rounded-md border bg-background px-3 text-sm"
        value={selectedId}
        onChange={onChange}
      >
        {reciters.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </div>
  );
}
