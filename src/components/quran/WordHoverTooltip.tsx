"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  getWordAudioController,
  WORD_AUDIO_EVENTS,
} from "@/lib/wordAudio";

type WordHoverTooltipProps = {
  children: React.ReactNode;
  translationText?: string;
  transliterationText?: string;
  showTranslation: boolean;
  showTransliteration: boolean;
  fontScale: number; // Scale factor for tooltip text size
  className?: string;
  active?: boolean;
  // Audio context for word playback
  surah?: number;
  ayah?: number;
  wordIndex?: number; // 1-based index
};

export default function WordHoverTooltip({
  children,
  translationText,
  transliterationText,
  showTranslation,
  showTransliteration,
  fontScale,
  className,
  active,
  surah,
  ayah,
  wordIndex,
}: WordHoverTooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<"above" | "below">("above");
  const wordRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isPlayingClickAudio = useRef(false);
  const useExternalHighlight = typeof active === "boolean";
  const resolvedHighlight = useExternalHighlight ? active : isHighlighted;

  // Check if we should show the tooltip at all
  const hasContent =
    (showTranslation && translationText) || (showTransliteration && transliterationText);

  // Listen for word highlight events from audio playback
  useEffect(() => {
    if (useExternalHighlight) return;
    if (!surah || !ayah || !wordIndex) return;

    const handleHighlightStart = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (
        detail.surah === surah &&
        detail.ayah === ayah &&
        detail.wordIndex === wordIndex
      ) {
        setIsHighlighted(true);
      }
    };

    const handleHighlightEnd = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (
        detail.surah === surah &&
        detail.ayah === ayah &&
        detail.wordIndex === wordIndex
      ) {
        setIsHighlighted(false);
      }
    };

    window.addEventListener(WORD_AUDIO_EVENTS.WORD_HIGHLIGHT_START, handleHighlightStart);
    window.addEventListener(WORD_AUDIO_EVENTS.WORD_HIGHLIGHT_END, handleHighlightEnd);

    return () => {
      window.removeEventListener(WORD_AUDIO_EVENTS.WORD_HIGHLIGHT_START, handleHighlightStart);
      window.removeEventListener(WORD_AUDIO_EVENTS.WORD_HIGHLIGHT_END, handleHighlightEnd);
    };
  }, [surah, ayah, wordIndex, useExternalHighlight]);

  // Handle hover: show tooltip only, no audio
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);

    // Calculate if tooltip should appear above or below
    if (wordRef.current) {
      const rect = wordRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      // Estimate tooltip height: translation + transliteration + padding
      const tooltipEstimatedHeight = 100;

      if (spaceAbove < tooltipEstimatedHeight) {
        setTooltipPosition("below");
      } else {
        setTooltipPosition("above");
      }
    }
    // NOTE: Audio removed from hover - now click-only to avoid autoplay restrictions
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  // Handle click: play word audio (click requires user interaction, avoids NotAllowedError)
  const handleClick = useCallback(() => {
    if (!surah || !ayah || !wordIndex || isPlayingClickAudio.current) return;

    isPlayingClickAudio.current = true;

    const controller = getWordAudioController();
    controller.playSingleWord(surah, ayah, wordIndex)
      .catch((err) => {
        // Silently ignore AbortError (expected when audio is interrupted)
        if (err.name !== "AbortError") {
          console.warn("[WordHoverTooltip] Click audio error:", err.message || err);
        }
      })
      .finally(() => {
        isPlayingClickAudio.current = false;
      });
  }, [surah, ayah, wordIndex]);

  // If no content to show and no audio context, render plain children
  // But if we have audio context, we still want hover/highlight behavior
  const hasAudioContext = surah && ayah && wordIndex;

  if (!hasContent && !hasAudioContext) {
    return <span className={className}>{children}</span>;
  }

  // Calculate tooltip font sizes based on scale
  const translationFontSize = `${1.0 * fontScale}rem`; // Base 16px, scales with settings
  const transliterationFontSize = `${0.875 * fontScale}rem`; // Base 14px, scales with settings

  return (
    <span
      ref={wordRef}
      data-surah={surah}
      data-ayah={ayah}
      data-word-index={wordIndex}
      data-active-word={resolvedHighlight ? "1" : undefined}
      className={cn(
        "relative inline-block cursor-pointer transition-all duration-150",
        // Hover state (user hovering)
        isHovered && "text-green-600 dark:text-green-400",
        // Highlight state (from audio playback) - subtle glow effect
        resolvedHighlight && !isHovered && [
          "text-amber-600 dark:text-amber-400",
          "drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]",
        ],
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}

      {isHovered && hasContent && (
        <div
          ref={tooltipRef}
          className={cn(
            "absolute z-50 px-4 py-3 rounded-xl shadow-xl",
            "bg-background dark:bg-zinc-900 border border-border/50",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            "min-w-max max-w-[320px]",
            // Position based on available space
            tooltipPosition === "above"
              ? "bottom-full mb-3 left-1/2 -translate-x-1/2"
              : "top-full mt-3 left-1/2 -translate-x-1/2"
          )}
          dir="ltr"
        >
          {/* Arrow pointer */}
          <div
            className={cn(
              "absolute left-1/2 -translate-x-1/2 w-0 h-0",
              "border-l-[8px] border-l-transparent",
              "border-r-[8px] border-r-transparent",
              tooltipPosition === "above"
                ? "top-full border-t-[8px] border-t-background dark:border-t-zinc-900"
                : "bottom-full border-b-[8px] border-b-background dark:border-b-zinc-900"
            )}
          />

          {/* Translation */}
          {showTranslation && translationText && (
            <div
              className="text-foreground font-medium"
              style={{ fontSize: translationFontSize }}
            >
              {translationText}
            </div>
          )}

          {/* Transliteration */}
          {showTransliteration && transliterationText && (
            <div
              className={cn(
                "text-muted-foreground italic",
                showTranslation && translationText && "mt-1"
              )}
              style={{ fontSize: transliterationFontSize }}
            >
              {transliterationText}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
