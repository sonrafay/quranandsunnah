"use client";

import { useEffect } from "react";

type QuranFontVariant =
  | "uthmani-simple"
  | "indopak"
  | "tajweed"
  | "qcf-v1"
  | "qcf-v2"
  | "qcf-v4-tajweed"
  | "qpc-uthmani-hafs";

type QFWord = {
  v1_page?: number;
  v2_page?: number;
};

interface QuranFontLoaderProps {
  fontVariant: QuranFontVariant;
  words?: QFWord[];
}

// Track which fonts have already been loaded to avoid duplicates
const loadedFonts = new Set<string>();

/**
 * Dynamically loads page-specific Quran fonts for glyph-based rendering.
 * QCF V1/V2/V4 fonts are page-specific (e.g., p1-v1, p2-v1).
 * This component injects @font-face declarations for required pages.
 */
export default function QuranFontLoader({ fontVariant, words }: QuranFontLoaderProps) {
  useEffect(() => {
    if (!words || words.length === 0) return;

    const isQCFV1 = fontVariant === "qcf-v1";
    const isQCFV2 = fontVariant === "qcf-v2";
    const isQCFV4 = fontVariant === "qcf-v4-tajweed";
    const isQPC = fontVariant === "qpc-uthmani-hafs";

    if (!isQCFV1 && !isQCFV2 && !isQCFV4 && !isQPC) return;

    // Collect unique page numbers that need to be loaded
    const pagesToLoad = new Set<number>();
    words.forEach((word) => {
      if (isQCFV1 && word.v1_page) {
        const fontKey = `v1-p${word.v1_page}`;
        if (!loadedFonts.has(fontKey)) {
          pagesToLoad.add(word.v1_page);
        }
      }
      if ((isQCFV2 || isQCFV4) && word.v2_page) {
        // V2 and V4 use different font files but same page structure
        const fontKey = isQCFV4 ? `v4-p${word.v2_page}` : `v2-p${word.v2_page}`;
        if (!loadedFonts.has(fontKey)) {
          pagesToLoad.add(word.v2_page);
        }
      }
    });

    // Check if QPC needs loading
    const needsQPC = isQPC && !loadedFonts.has("qpc-hafs");

    if (pagesToLoad.size === 0 && !needsQPC) return;

    // Create or get style element for dynamic fonts
    let styleEl = document.getElementById("quran-dynamic-fonts") as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "quran-dynamic-fonts";
      document.head.appendChild(styleEl);
    }

    // Generate NEW @font-face declarations only for pages not yet loaded
    const newFontFaces: string[] = [];

    pagesToLoad.forEach((page) => {
      if (isQCFV1) {
        const fontKey = `v1-p${page}`;
        loadedFonts.add(fontKey);
        newFontFaces.push(`
          @font-face {
            font-family: 'p${page}-v1';
            src: url('https://verses.quran.foundation/fonts/quran/hafs/v1/woff2/p${page}.woff2') format('woff2');
            font-display: swap;
          }
        `);
      } else if (isQCFV2) {
        const fontKey = `v2-p${page}`;
        loadedFonts.add(fontKey);
        newFontFaces.push(`
          @font-face {
            font-family: 'p${page}-v2';
            src: url('https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p${page}.woff2') format('woff2');
            font-display: swap;
          }
        `);
      } else if (isQCFV4) {
        const fontKey = `v4-p${page}`;
        loadedFonts.add(fontKey);
        // V4 COLRv1 Tajweed fonts - use v2 font-family name for compatibility with VerseDisplay
        newFontFaces.push(`
          @font-face {
            font-family: 'p${page}-v2';
            src: url('https://verses.quran.foundation/fonts/quran/hafs/v4/colrv1/woff2/p${page}.woff2') format('woff2');
            font-display: swap;
          }
        `);
      }
    });

    // QPC Uthmani Hafs (single font file)
    if (needsQPC) {
      loadedFonts.add("qpc-hafs");
      newFontFaces.push(`
        @font-face {
          font-family: 'qpc-hafs';
          src: url('https://verses.quran.foundation/fonts/quran/qpc/woff2/hafs.woff2') format('woff2');
          font-display: swap;
        }
      `);
    }

    // APPEND new font faces instead of replacing
    if (newFontFaces.length > 0) {
      styleEl.textContent += newFontFaces.join("\n");
    }

  }, [fontVariant, words]);

  return null; // This is a side-effect-only component
}
