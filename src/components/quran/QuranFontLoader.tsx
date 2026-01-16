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

/**
 * Dynamically loads page-specific Quran fonts for glyph-based rendering.
 * QCF V1/V2/V4 fonts are page-specific (e.g., p001-v1, p002-v1).
 * This component injects @font-face declarations for required pages.
 */
export default function QuranFontLoader({ fontVariant, words }: QuranFontLoaderProps) {
  useEffect(() => {
    if (!words || words.length === 0) return;

    const isQCFV1 = fontVariant === "qcf-v1";
    const isQCFV2 = fontVariant === "qcf-v2" || fontVariant === "qcf-v4-tajweed";
    const isQPC = fontVariant === "qpc-uthmani-hafs";

    if (!isQCFV1 && !isQCFV2 && !isQPC) return;

    // Collect unique page numbers
    const pages = new Set<number>();
    words.forEach((word) => {
      if (isQCFV1 && word.v1_page) pages.add(word.v1_page);
      if (isQCFV2 && word.v2_page) pages.add(word.v2_page);
    });

    if (pages.size === 0) return;

    // Create or get style element for dynamic fonts
    let styleEl = document.getElementById("quran-dynamic-fonts") as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "quran-dynamic-fonts";
      document.head.appendChild(styleEl);
    }

    // Generate @font-face declarations for each page
    const fontFaces: string[] = [];
    pages.forEach((page) => {
      // IMPORTANT: Quran.com uses non-padded page numbers (p1.woff2, not p001.woff2)

      if (isQCFV1) {
        // QCF V1 fonts from verses.quran.foundation CDN (official)
        fontFaces.push(`
          @font-face {
            font-family: 'p${page}-v1';
            src: url('https://verses.quran.foundation/fonts/quran/hafs/v1/woff2/p${page}.woff2') format('woff2');
            font-display: swap;
          }
        `);
      } else if (isQCFV2) {
        // QCF V2/V4 fonts from verses.quran.foundation CDN (official)
        // V4 uses COLRv1 for colored tajweed glyphs
        const fontPath = fontVariant === "qcf-v4-tajweed"
          ? `https://verses.quran.foundation/fonts/quran/hafs/v4/colrv1/woff2/p${page}.woff2`
          : `https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p${page}.woff2`;

        fontFaces.push(`
          @font-face {
            font-family: 'p${page}-v2';
            src: url('${fontPath}') format('woff2');
            font-display: swap;
          }
        `);
      }
    });

    // QPC Uthmani Hafs (single font file)
    if (isQPC) {
      fontFaces.push(`
        @font-face {
          font-family: 'qpc-hafs';
          src: url('https://verses.quran.foundation/fonts/quran/qpc/woff2/hafs.woff2') format('woff2');
          font-display: swap;
        }
      `);
    }

    styleEl.textContent = fontFaces.join("\n");

    // Cleanup function
    return () => {
      // Don't remove style element on unmount - fonts might be needed by other verses
      // The browser will cache them anyway
    };
  }, [fontVariant, words]);

  return null; // This is a side-effect-only component
}
