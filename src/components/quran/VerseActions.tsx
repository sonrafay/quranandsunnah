// src/components/quran/VerseActions.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  setQuranBookmarkColor,
  BookmarkColor,
  getQuranNote,
  saveQuranNote,
  deleteQuranNote,
} from "@/lib/cloud";
import useNotesIndex from "@/components/quran/notesIndex";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ClipboardCopy, Bookmark, StickyNote, Play, Check } from "lucide-react";

type Props = {
  surah: number;
  ayah: number;
  textToCopy: string;
  compact?: boolean;
  onPlay?: () => void; // optional direct-control hook
};

const COLOR_ICON: Record<BookmarkColor, string> = {
  p1: "text-emerald-500",
  p2: "text-sky-500",
  p3: "text-amber-500",
  p4: "text-rose-500",
  p5: "text-violet-500",
};

const COLORS: { key: BookmarkColor; label: string; dot: string }[] = [
  { key: "p1", label: "Mint",   dot: "bg-emerald-400" },
  { key: "p2", label: "Sky",    dot: "bg-sky-400" },
  { key: "p3", label: "Amber",  dot: "bg-amber-300" },
  { key: "p4", label: "Rose",   dot: "bg-rose-300" },
  { key: "p5", label: "Violet", dot: "bg-violet-300" },
];

export default function VerseActions({
  surah,
  ayah,
  textToCopy,
  compact,
  onPlay,
}: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  // Live note index (for icon tint)
  const notesSet = useNotesIndex(surah);
  const hasNote = useMemo(() => notesSet.has(ayah), [notesSet, ayah]);

  // --- Bookmark icon tint: keep in sync with DOM attribute applied by BookmarksLayer ---
  const [curColor, setCurColor] = useState<BookmarkColor | null>(null);
  useEffect(() => {
    let raf = 0;
    let observer: MutationObserver | null = null;

    const readAttr = (el: HTMLElement | null) => {
      const val = (el?.getAttribute("data-bookmark") as BookmarkColor | null) ?? null;
      setCurColor(val);
    };

    const attach = () => {
      const el =
        document.getElementById(`ayah-${ayah}`) ||
        document.querySelector<HTMLElement>(`article[data-ayah="${ayah}"]`);
      if (!el) {
        // Verse card not in DOM yet; try again next frame
        raf = requestAnimationFrame(attach);
        return;
      }
      // Initial read (in case BookmarksLayer already painted)
      readAttr(el);

      // Watch for future changes when BookmarksLayer updates attributes
      observer = new MutationObserver((mut) => {
        // Only care about data-bookmark changes
        for (const m of mut) {
          if (m.type === "attributes" && (m.attributeName === "data-bookmark")) {
            readAttr(el);
            break;
          }
        }
      });
      observer.observe(el, { attributes: true, attributeFilter: ["data-bookmark"] });
    };

    raf = requestAnimationFrame(attach);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [ayah]);

  // --- Audio ---
  const emitPlay = useCallback(() => {
    if (onPlay) { onPlay(); return; }
    window.dispatchEvent(new CustomEvent("qs-play-ayah", { detail: { n: ayah } }));
  }, [onPlay, ayah]);

  // --- Copy ---
  const doCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(textToCopy); } catch {}
  }, [textToCopy]);

  // --- Helpers to fully prevent lingering focus outlines ---
  const blurActive = () => {
    const el = document.activeElement as HTMLElement | null;
    if (el && typeof el.blur === "function") el.blur();
  };
  const killFocusOnMouseDown = (e: React.MouseEvent) => {
    // Prevent the browser from focusing this button at all
    e.preventDefault();
  };

  // --- Bookmark (Popover) ---
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const announceBookmarkOpen = useCallback(() => {
    window.dispatchEvent(new CustomEvent("qs-open-bookmark", { detail: { surah, ayah } }));
  }, [surah, ayah]);

  const setColor = useCallback(async (color: BookmarkColor | null) => {
    if (!user) {
      location.assign(`/signin?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    setBusy(true);
    try {
      await setQuranBookmarkColor(user.uid, surah, ayah, color);
      // curColor will also be updated by MutationObserver when BookmarksLayer paints,
      // but set it immediately for instant UI feedback:
      setCurColor(color);
    } finally {
      setBusy(false);
    }
  }, [user, surah, ayah]);

  // --- Notes Popover ---
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const savingRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  const loadNote = useCallback(async () => {
    if (!user) return;
    const existing = await getQuranNote(user.uid, surah, ayah);
    setDraft(existing?.content ?? "");
  }, [user, surah, ayah]);

  const scheduleSave = useCallback(() => {
    if (!user) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const content = draft.trim();
      savingRef.current = true;
      try {
        if (content) {
          await saveQuranNote(user.uid!, surah, ayah, content);
        } else {
          await deleteQuranNote(user.uid!, surah, ayah);
          window.dispatchEvent(new CustomEvent("qs-note-deleted", { detail: { surah, ayah } }));
        }
      } finally {
        savingRef.current = false;
      }
    }, 400);
  }, [draft, user, surah, ayah]);

  // Close notes on external bookmark-open, and close other notes when this one opens
  useEffect(() => {
    const onBookmarkOpen = () => setNoteOpen(false);
    const onOtherNoteOpen = (e: CustomEvent<{ surah: number; ayah: number }>) => {
      if (e.detail.surah !== surah || e.detail.ayah !== ayah) setNoteOpen(false);
    };
    window.addEventListener("qs-open-bookmark", onBookmarkOpen as any);
    window.addEventListener("qs-open-note-inline", onOtherNoteOpen as any);
    return () => {
      window.removeEventListener("qs-open-bookmark", onBookmarkOpen as any);
      window.removeEventListener("qs-open-note-inline", onOtherNoteOpen as any);
    };
  }, [surah, ayah]);

  const openNote = async () => {
    if (!user) {
      location.assign(`/signin?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    window.dispatchEvent(new CustomEvent("qs-open-note-inline", { detail: { surah, ayah } }));
    await loadNote();
    setNoteOpen(true);
  };

  const onNoteOpenChange = async (open: boolean) => {
    if (!open) {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      if (!savingRef.current && user) {
        const content = draft.trim();
        try {
          if (content) {
            await saveQuranNote(user.uid!, surah, ayah, content);
          } else {
            await deleteQuranNote(user.uid!, surah, ayah);
            window.dispatchEvent(new CustomEvent("qs-note-deleted", { detail: { surah, ayah } }));
          }
        } catch { /* ignore */ }
      }
      blurActive(); // ensure no outline remains
    }
    setNoteOpen(open);
  };

  // Base button styles: NO ring at all, only hover tint
  const base =
    "inline-grid place-items-center rounded transition hover:bg-foreground/10 focus:outline-none focus-visible:outline-none focus:ring-0";
  const small = "h-6 w-6";
  const btnClass = compact ? `${base} ${small}` : base;

  const noteTint = hasNote ? "text-emerald-600" : "";
  const bookmarkTint = curColor ? COLOR_ICON[curColor] : "";

  return (
    <div className="flex flex-col items-center gap-1 opacity-80">
      {/* Copy */}
      <button
        type="button"
        aria-label="Copy"
        title="Copy"
        className={btnClass}
        onMouseDown={(e) => e.preventDefault()}
        onClick={doCopy}
      >
        <ClipboardCopy className="h-3.5 w-3.5" />
      </button>

      {/* BOOKMARK: Popover (left) */}
      <Popover
        open={bookmarkOpen}
        onOpenChange={(open) => {
          if (open) window.dispatchEvent(new CustomEvent("qs-open-bookmark", { detail: { surah, ayah } }));
          else blurActive(); // clear any focus when closing
          setBookmarkOpen(open);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Bookmark color"
            title="Bookmark color"
            className={`${btnClass} ${bookmarkTint}`}
            disabled={busy}
            onMouseDown={(e) => e.preventDefault()} // prevent focus so no ring ever appears
            onClick={() => {
              window.dispatchEvent(new CustomEvent("qs-open-bookmark", { detail: { surah, ayah } }));
            }}
          >
            <Bookmark className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="left"
          sideOffset={10}
          collisionPadding={16}
          className="w-[min(240px,90vw)] p-2"
          onCloseAutoFocus={(e) => { e.preventDefault(); blurActive(); }}
        >
          <div className="px-1 pb-2 text-xs font-medium opacity-80 border-b border-border/60">
            Highlight color
          </div>
          <ul className="mt-2 space-y-1">
            {COLORS.map((c) => {
              const selected = curColor === c.key;
              return (
                <li key={c.key}>
                  <button
                    className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={async () => {
                      await setColor(c.key);
                      setBookmarkOpen(false); // close immediately after choosing
                      blurActive();            // and clear any focus
                    }}
                  >
                    <span className={`h-3.5 w-3.5 rounded-full ${c.dot}`} />
                    <span>{c.label}</span>
                    {selected && <Check className="ml-auto h-3.5 w-3.5 opacity-80" />}
                  </button>
                </li>
              );
            })}
            <li className="pt-1 mt-1 border-t border-border/60">
              <button
                className="w-full rounded px-2 py-1.5 text-sm text-destructive hover:bg-accent hover:text-accent-foreground/90"
                onMouseDown={(e) => e.preventDefault()}
                onClick={async () => {
                  await setColor(null);
                  setBookmarkOpen(false);
                  blurActive();
                }}
              >
                Remove highlight
              </button>
            </li>
          </ul>
        </PopoverContent>
      </Popover>

      {/* NOTES: Popover (left, wider) */}
      <Popover open={noteOpen} onOpenChange={onNoteOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={hasNote ? "Edit note" : "Add note"}
            title={hasNote ? "Edit note" : "Add note"}
            className={`${btnClass} ${noteTint}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={openNote}
          >
            <StickyNote className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="left"
          sideOffset={10}
          collisionPadding={16}
          className="w-[min(400px,90vw)] p-2"
          onCloseAutoFocus={(e) => { e.preventDefault(); blurActive(); }}
        >
          <div className="flex items-center justify-between px-1 pb-2 border-b border-border/60">
            <div className="text-xs opacity-75">Surah {surah} • Ayah {ayah}</div>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onNoteOpenChange(false)}
              className="px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground text-xs"
            >
              ✕
            </button>
          </div>

          <div className="pt-2">
            {!user && (
              <div className="text-xs p-2 mb-2 rounded bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                Please sign in to write and sync notes across devices.
              </div>
            )}

            <textarea
              className="
                w-full h-40
                resize-none rounded border border-border/60 bg-transparent p-2
                outline-none text-sm
              "
              placeholder={user ? "Write your reflection here…" : "Sign in to edit"}
              disabled={!user || busy}
              value={draft}
              onChange={(e) => { setDraft(e.target.value); scheduleSave(); }}
            />

            <div className="mt-2 flex items-center gap-2">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={async () => { await onNoteOpenChange(false); }}
                disabled={!user || busy}
                className="px-3 py-1.5 text-xs rounded bg-indigo-600 text-white disabled:opacity-50"
              >
                Save
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onNoteOpenChange(false)}
                className="px-3 py-1.5 text-xs rounded border"
              >
                Cancel
              </button>
              <div className="flex-1" />
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={async () => {
                  if (!user) return;
                  await deleteQuranNote(user.uid!, surah, ayah);
                  window.dispatchEvent(new CustomEvent("qs-note-deleted", { detail: { surah, ayah } }));
                  setDraft("");
                  setNoteOpen(false);
                  blurActive();
                }}
                disabled={!user || busy}
                className="px-3 py-1.5 text-xs rounded border border-red-300 text-red-700 dark:border-red-800 dark:text-red-300 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Play */}
      <button
        type="button"
        aria-label="Play"
        title="Play"
        className={base + (compact ? ` ${small}` : "")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={emitPlay}
      >
        <Play className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
