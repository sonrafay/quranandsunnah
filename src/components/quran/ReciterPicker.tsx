"use client";

import { useState, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

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
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const currentReciter = reciters.find((r) => r.id === selectedId);

  const filteredReciters = useMemo(() => {
    if (!searchTerm) return reciters;
    const q = searchTerm.toLowerCase();
    return reciters.filter((r) => r.name.toLowerCase().includes(q));
  }, [reciters, searchTerm]);

  function selectReciter(id: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("r", String(id));
    router.replace(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "group flex items-center gap-2 h-10 px-4 rounded-xl",
          "glass-surface glass-readable",
          "text-sm font-medium transition-all duration-200",
          "hover:brightness-[0.92] dark:hover:brightness-[0.85]",
          open && "brightness-[0.92] dark:brightness-[0.85]"
        )}
      >
        <span className={cn(
          "transition-all duration-200",
          "group-hover:text-green-600 dark:group-hover:text-green-400",
          "group-hover:drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
        )}>
          {currentReciter?.name || "Select Reciter"}
        </span>
        <ChevronDown className={cn(
          "h-4 w-4 transition-transform duration-200",
          open && "rotate-180"
        )} />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* Dropdown panel */}
          <div className="absolute right-0 z-40 mt-2 w-[300px] rounded-xl glass-surface glass-readable p-3">
            {/* Search */}
            <div className="mb-2">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search reciter..."
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                autoFocus
              />
            </div>

            {/* Reciter list */}
            <div className="max-h-72 overflow-auto pr-1 space-y-0.5">
              {filteredReciters.map((reciter) => (
                <button
                  key={reciter.id}
                  onClick={() => selectReciter(reciter.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm",
                    "transition-all duration-150",
                    reciter.id === selectedId
                      ? "bg-green-500/15 text-green-600 dark:text-green-400"
                      : "hover:bg-muted/50 hover:text-green-600 dark:hover:text-green-400"
                  )}
                >
                  {reciter.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
