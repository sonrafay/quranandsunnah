"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { toggleQuranBookmark, saveNote } from "@/lib/cloud";
import { ClipboardCopy, Bookmark, StickyNote, Play } from "lucide-react";

type Props = {
  surah: number;
  ayah: number;
  textToCopy: string;
  compact?: boolean;
  index?: number;        // zero-based index in the current list
  onPlay?: () => void;   // optional direct cb
};

export default function VerseActions({
  surah,
  ayah,
  textToCopy,
  compact,
  index,
  onPlay,
}: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const base =
    "inline-grid place-items-center rounded transition hover:bg-foreground/10 focus:outline-none focus:ring-2 focus:ring-ring/40";
  const small = "h-6 w-6";
  const className = compact ? `${base} ${small}` : base;

  async function doCopy() {
    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch {}
  }

  async function doBookmark() {
    if (!user) return alert("Please sign in to bookmark.");
    setBusy(true);
    try {
      await toggleQuranBookmark(user.uid, surah, ayah);
    } finally {
      setBusy(false);
    }
  }

  async function doNote() {
    if (!user) return alert("Please sign in to add notes.");
    const content = prompt("Note for this verse:", "");
    if (!content) return;
    setBusy(true);
    try {
      await saveNote(user.uid, { scope: "quran", keyRef: `${surah}:${ayah}`, content });
    } finally {
      setBusy(false);
    }
  }

  function doPlay() {
    if (onPlay) return onPlay();
    // Tell the global audio bar to start from this ayah
    window.dispatchEvent(new CustomEvent("qs-play-ayah", { detail: { n: ayah } }));
  }

  return (
    <div className="flex flex-col items-center gap-1 opacity-80">
      {/* Small badge: surah:ayah */}
      <span
        className="mb-0.5 text-[10px] leading-none font-mono tabular-nums
                   px-1 py-0.5 rounded bg-foreground/10 text-foreground/70"
        title={`Surah ${surah}, Ayah ${ayah}`}
      >
        {surah}:{ayah}
      </span>

      <button aria-label="Copy" title="Copy" className={className} onClick={doCopy}>
        <ClipboardCopy className="h-3.5 w-3.5" />
      </button>

      <button
        aria-label="Bookmark"
        title="Bookmark"
        className={className}
        onClick={doBookmark}
        disabled={busy}
      >
        <Bookmark className="h-3.5 w-3.5" />
      </button>

      <button aria-label="Note" title="Note" className={className} onClick={doNote} disabled={busy}>
        <StickyNote className="h-3.5 w-3.5" />
      </button>

      <button aria-label="Play" title="Play" className={className} onClick={doPlay}>
        <Play className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
