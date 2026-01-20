"use client";

import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export type Reciter = { id: number; name: string };

export default function ReciterPicker({
  reciters,
  selectedId,
  direction = "down",
  align = "right",
}: {
  reciters: Reciter[];
  selectedId: number;
  direction?: "down" | "up";
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeId, setActiveId] = useState(selectedId);

  const currentReciter = reciters.find((r) => r.id === activeId);

  const filteredReciters = useMemo(() => {
    if (!searchTerm) return reciters;
    const q = searchTerm.toLowerCase();
    return reciters.filter((r) => r.name.toLowerCase().includes(q));
  }, [reciters, searchTerm]);

  useEffect(() => {
    setActiveId(selectedId);
  }, [selectedId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id?: number };
      if (typeof detail?.id !== "number") return;
      setActiveId(detail.id);
    };
    window.addEventListener("qs-reciter-change", handler as EventListener);
    return () => window.removeEventListener("qs-reciter-change", handler as EventListener);
  }, []);

  function selectReciter(id: number) {
    setActiveId(id);
    setOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("qs-reciter-change", { detail: { id } }));
    }
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
          direction === "up" ? "rotate-180" : "",
          open && direction === "down" && "rotate-180"
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
          <div
            className={cn(
              "absolute z-40 w-[300px] rounded-xl glass-surface glass-readable p-3",
              "animate-in fade-in-0 zoom-in-95",
              direction === "up" ? "bottom-full mb-2 slide-in-from-bottom-2" : "top-full mt-2 slide-in-from-top-2",
              align === "left" ? "left-0" : "right-0"
            )}
          >
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
                    reciter.id === activeId
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
