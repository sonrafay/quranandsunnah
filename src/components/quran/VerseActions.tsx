// src/components/quran/VerseActions.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { setQuranBookmarkColor, BookmarkColor, saveNote } from "@/lib/cloud";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ClipboardCopy, Bookmark, StickyNote, Play } from "lucide-react";

type Props = {
  surah: number;
  ayah: number;
  textToCopy: string;
  compact?: boolean;
  onPlay?: () => void;    // for direct-control (optional)
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

  // read current bookmark color from DOM dataset (keeps icon state in sync with BookmarksLayer)
  const [curColor, setCurColor] = useState<BookmarkColor | null>(null);
  useEffect(() => {
    const el = document.getElementById(`ayah-${ayah}`);
    const c = (el?.getAttribute("data-bookmark") as BookmarkColor | null) ?? null;
    setCurColor(c);
  }, [ayah]);

  function emitPlay() {
    if (onPlay) return onPlay();
    window.dispatchEvent(new CustomEvent("qs-play-ayah", { detail: { n: ayah } }));
  }

  async function doCopy() {
    try { await navigator.clipboard.writeText(textToCopy); } catch {}
  }

  async function doNote() {
    if (!user) return location.assign(`/signin?next=${encodeURIComponent(location.pathname + location.search)}`);
    const content = prompt("Note for this verse:", "");
    if (!content) return;
    setBusy(true);
    try {
      await saveNote(user.uid, { scope: "quran", keyRef: `${surah}:${ayah}`, content });
    } finally {
      setBusy(false);
    }
  }

  async function setColor(color: BookmarkColor | null) {
    if (!user) return location.assign(`/signin?next=${encodeURIComponent(location.pathname + location.search)}`);
    setBusy(true);
    try {
      await setQuranBookmarkColor(user.uid, surah, ayah, color);
      setCurColor(color);
    } finally {
      setBusy(false);
    }
  }

  const base =
    "inline-grid place-items-center rounded transition hover:bg-foreground/10 focus:outline-none focus:ring-2 focus:ring-ring/40";
  const small = "h-6 w-6";
  const className = compact ? `${base} ${small}` : base;

  // subtle ring on the bookmark icon if currently colored
  const bookmarkRing =
    curColor ? "ring-2 ring-offset-0 ring-foreground/30 rounded" : "";

  return (
    <div className="flex flex-col items-center gap-1 opacity-80">
      <button aria-label="Copy" title="Copy" className={className} onClick={doCopy}>
        <ClipboardCopy className="h-3.5 w-3.5" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Bookmark color"
            title="Bookmark color"
            className={`${className} ${bookmarkRing}`}
            disabled={busy}
          >
            <Bookmark className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          <DropdownMenuLabel>Highlight color</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {COLORS.map((c) => (
            <DropdownMenuItem
              key={c.key}
              onClick={() => setColor(c.key)}
              className="flex items-center gap-2"
            >
              <span className={`h-3.5 w-3.5 rounded-full ${c.dot}`} />
              <span>{c.label}</span>
              {curColor === c.key && <span className="ml-auto text-xs opacity-70">Selected</span>}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setColor(null)}>Remove highlight</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button aria-label="Note" title="Note" className={className} onClick={doNote} disabled={busy}>
        <StickyNote className="h-3.5 w-3.5" />
      </button>

      <button aria-label="Play" title="Play" className={className} onClick={emitPlay}>
        <Play className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
