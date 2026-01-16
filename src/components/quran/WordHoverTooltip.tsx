"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

type WordHoverTooltipProps = {
  children: React.ReactNode;
  translationText?: string;
  transliterationText?: string;
  showTranslation: boolean;
  showTransliteration: boolean;
  fontScale: number; // Scale factor for tooltip text size
  className?: string;
};

export default function WordHoverTooltip({
  children,
  translationText,
  transliterationText,
  showTranslation,
  showTransliteration,
  fontScale,
  className,
}: WordHoverTooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<"above" | "below">("above");
  const wordRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Check if we should show the tooltip at all
  const hasContent =
    (showTranslation && translationText) || (showTransliteration && transliterationText);

  const handleMouseEnter = useCallback(() => {
    if (!hasContent) return;
    setIsHovered(true);

    // Calculate if tooltip should appear above or below
    if (wordRef.current) {
      const rect = wordRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const tooltipEstimatedHeight = 80; // Rough estimate

      if (spaceAbove < tooltipEstimatedHeight) {
        setTooltipPosition("below");
      } else {
        setTooltipPosition("above");
      }
    }
  }, [hasContent]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  // If no content to show, just render children without tooltip
  if (!hasContent) {
    return <span className={className}>{children}</span>;
  }

  // Calculate tooltip font sizes based on scale
  const translationFontSize = `${0.875 * fontScale}rem`; // Base 14px
  const transliterationFontSize = `${0.75 * fontScale}rem`; // Base 12px

  return (
    <span
      ref={wordRef}
      className={cn(
        "relative inline-block cursor-pointer transition-colors",
        isHovered && "text-green-600 dark:text-green-400",
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {isHovered && (
        <div
          ref={tooltipRef}
          className={cn(
            "absolute z-50 px-3 py-2 rounded-lg glass-surface glass-readable shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            "min-w-max max-w-[280px]",
            // Position based on available space
            tooltipPosition === "above"
              ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
              : "top-full mt-2 left-1/2 -translate-x-1/2"
          )}
          dir="ltr"
        >
          {/* Arrow pointer */}
          <div
            className={cn(
              "absolute left-1/2 -translate-x-1/2 w-0 h-0",
              "border-l-[6px] border-l-transparent",
              "border-r-[6px] border-r-transparent",
              tooltipPosition === "above"
                ? "top-full border-t-[6px] border-t-[var(--glass-bg,rgba(255,255,255,0.1))]"
                : "bottom-full border-b-[6px] border-b-[var(--glass-bg,rgba(255,255,255,0.1))]"
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
