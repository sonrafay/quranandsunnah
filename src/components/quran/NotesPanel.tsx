"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { getQuranNote, saveQuranNote, deleteQuranNote } from "@/lib/cloud";

/**
 * Notes popup:
 * - Visuals match shadcn DropdownMenuContent (same as bookmark popup)
 * - Positions to the LEFT of the trigger, just like bookmark menu — but WIDER
 * - Auto-saves & closes when:
 *      a) Opening a different note
 *      b) Opening the bookmark menu anywhere
 * - Esc to close
 */
export default function NotesPanel() {
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [surah, setSurah] = useState<number | null>(null);
  const [ayah, setAyah] = useState<number | null>(null);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  // Position from anchor (note button)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Tunables to mimic bookmark popup while giving more width
  const GAP = 10;                 // same gap as bookmark `sideOffset`
  const NOTES_WIDTH = 520;        // wider for comfy typing
  const SCREEN_PAD = 12;          // don't hug the edge
  const HEIGHT_PX = 320;          // same "feel" height; adjust if your bookmark box differs

  // Track last-opened note to auto-save when switching
  const lastRef = useRef<{ surah: number; ayah: number; value: string } | null>(null);

  const hasContext = useMemo(() => !!surah && !!ayah, [surah, ayah]);

  // --- helpers ---
  const closePanel = () => {
    setOpen(false);
    setPos(null);
    setSurah(null);
    setAyah(null);
    setValue("");
  };

  async function maybeAutosavePrevious() {
    const prev = lastRef.current;
    if (!prev || !user) return;
    const trimmed = prev.value.trim();
    if (!trimmed) return;
    try {
      await saveQuranNote(user.uid, prev.surah, prev.ayah, trimmed);
    } catch {
      // ignore for now; best-effort autosave
    }
  }

  async function loadAndOpen(target: { surah: number; ayah: number; anchorRect?: any }) {
    // If another note is open, autosave first
    await maybeAutosavePrevious();

    setSurah(target.surah);
    setAyah(target.ayah);
    setOpen(true);

    // Position: to the LEFT of the anchor, just like bookmark; align to top of trigger
    if (target.anchorRect) {
      const { top, left, width, height } = target.anchorRect;
      let popupLeft = left - GAP - NOTES_WIDTH; // left of the trigger, with gap
      // Clamp from screen edge
      const minLeft = SCREEN_PAD + window.scrollX;
      if (popupLeft < minLeft) popupLeft = minLeft;

      const popupTop = top + (height / 2) - (HEIGHT_PX / 2); // vertically centered to trigger
      setPos({ top: popupTop, left: popupLeft, width: NOTES_WIDTH });
    } else {
      // Fallback safe spot
      setPos({ top: window.scrollY + 100, left: SCREEN_PAD + window.scrollX, width: NOTES_WIDTH });
    }

    if (!user) return;

    setLoading(true);
    try {
      const existing = await getQuranNote(user.uid, target.surah, target.ayah);
      setValue(existing?.content ?? "");
    } finally {
      setLoading(false);
    }

    // Track for autosave
    lastRef.current = { surah: target.surah, ayah: target.ayah, value: "" };
  }

  // Keep lastRef updated with current draft while editing
  useEffect(() => {
    if (open && hasContext) {
      lastRef.current = { surah: surah!, ayah: ayah!, value };
    }
  }, [open, hasContext, surah, ayah, value]);

  // Listeners: open-note (with anchor), open-bookmark (any verse), Esc
  useEffect(() => {
  const onOpenNote = async (ev: any) => {
    const detail = ev?.detail;
    if (!detail?.surah || !detail?.ayah) return;

    // If same verse is already open, just reposition
    if (open && surah === detail.surah && ayah === detail.ayah) {
      if (detail.anchorRect) {
        const { top, left, height } = detail.anchorRect;
        let popupLeft = left - GAP - NOTES_WIDTH;
        const minLeft = SCREEN_PAD + window.scrollX;
        if (popupLeft < minLeft) popupLeft = minLeft;

        // Align like the bookmark popup (top-aligned with trigger)
        setPos({ top, left: popupLeft, width: NOTES_WIDTH });
      }
      return;
    }

    await loadAndOpen({ surah: detail.surah, ayah: detail.ayah, anchorRect: detail.anchorRect });
  };

  const onOpenBookmark = async (_ev: any) => {
    if (!open) return;
    await maybeAutosavePrevious();
    closePanel();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) closePanel();
  };

  // 🔊 Listen on both document & window
  document.addEventListener("qs-open-note", onOpenNote as any);
  window.addEventListener("qs-open-note", onOpenNote as any);
  window.addEventListener("qs-open-bookmark", onOpenBookmark as any);
  window.addEventListener("keydown", onKey);

  return () => {
    document.removeEventListener("qs-open-note", onOpenNote as any);
    window.removeEventListener("qs-open-note", onOpenNote as any);
    window.removeEventListener("qs-open-bookmark", onOpenBookmark as any);
    window.removeEventListener("keydown", onKey);
  };
}, [open, surah, ayah]);


  const onSave = async () => {
    if (!user || !hasContext) return;
    const trimmed = value.trim();
    if (!trimmed) { await onDelete(); return; }
    setLoading(true);
    try {
      await saveQuranNote(user.uid, surah!, ayah!, trimmed);
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    if (!user || !hasContext) return;
    setLoading(true);
    try {
      await deleteQuranNote(user.uid, surah!, ayah!);
      window.dispatchEvent(new CustomEvent("qs-note-deleted", { detail: { surah: surah!, ayah: ayah! } }));
      closePanel();
    } finally {
      setLoading(false);
    }
  };

  if (!open || !pos) return null;

  return createPortal(
    <div
      // Same styling as shadcn DropdownMenuContent (= bookmark box)
      className="
        fixed z-[9999]
        rounded-md border bg-popover p-2 text-popover-foreground shadow-md
      "
      data-no-swipe
      style={{
        top: pos.top,
        left: pos.left,
        width: Math.min(NOTES_WIDTH, window.innerWidth - SCREEN_PAD * 2),
        height: HEIGHT_PX,
      }}
      role="dialog"
      aria-label="Quran note editor"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header (matches dropdown tone) */}
      <div className="flex items-center justify-between px-1 pb-2 border-b border-border/60">
        <div className="text-xs opacity-75">
          {hasContext ? <span>Surah {surah} • Ayah {ayah}</span> : <span>Note</span>}
        </div>
        <button
          onClick={closePanel}
          className="px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground text-xs"
        >
          ✕
        </button>
      </div>

      {/* Editor */}
      <div className="pt-2">
        {!user && (
          <div className="text-xs p-2 mb-2 rounded bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            Please sign in to write and sync notes across devices.
          </div>
        )}

        <textarea
          className="
            w-full
            h-[220px]
            resize-none rounded border border-border/60 bg-transparent p-2
            outline-none focus:ring-2 focus:ring-indigo-500 text-sm
          "
          placeholder={user ? "Write your reflection here…" : "Sign in to edit"}
          disabled={!user || loading}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />

        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={!user || loading}
            className="px-3 py-1.5 text-xs rounded bg-indigo-600 text-white disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={closePanel}
            className="px-3 py-1.5 text-xs rounded border"
          >
            Cancel
          </button>
          <div className="flex-1" />
          <button
            onClick={onDelete}
            disabled={!user || !hasContext || loading}
            className="px-3 py-1.5 text-xs rounded border border-red-300 text-red-700 dark:border-red-800 dark:text-red-300 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
