"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Toast = { id: string; title?: string; body?: string; duration?: number };

const ToastCtx = createContext<{ push: (t: Omit<Toast,"id">) => void } | null>(null);

export function useToaster() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToaster must be used within <ToasterProvider>");
  return ctx;
}

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast,"id">) => {
    const id = Math.random().toString(36).slice(2);
    const duration = t.duration ?? 5000;
    setList((prev) => [...prev, { id, ...t }]);
    window.setTimeout(() => {
      setList((prev) => prev.filter((x) => x.id !== id));
    }, duration);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2">
        {list.map((t) => (
          <div
            key={t.id}
            className={cn(
              "w-[min(340px,90vw)] rounded-xl glass-surface glass-readable p-3"
            )}
          >
            {t.title && <div className="text-sm font-semibold">{t.title}</div>}
            {t.body && <div className="mt-0.5 text-sm text-muted-foreground whitespace-pre-wrap">{t.body}</div>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
