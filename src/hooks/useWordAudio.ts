// src/hooks/useWordAudio.ts
// React hook for managing word-by-word audio and highlighting

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getWordAudioController,
  emitWordHighlight,
  emitHoverPlaybackState,
  WORD_AUDIO_EVENTS,
  WordAudioController,
} from "@/lib/wordAudio";

type UseWordAudioOptions = {
  enabled: boolean;
  silent?: boolean; // If true, word audio plays silently (for timing only)
};

type UseWordAudioReturn = {
  // Current highlighted word (1-based index, 0 = none)
  activeWordIndex: number;
  // Start word-by-word playback for a verse
  startVerseWords: (surah: number, ayah: number, wordCount: number) => void;
  // Pause word audio
  pauseWordAudio: () => void;
  // Resume word audio
  resumeWordAudio: () => void;
  // Stop word audio
  stopWordAudio: () => void;
  // Restart from beginning of verse
  restartWordAudio: () => void;
  // Play single word on hover (returns promise)
  playWordOnHover: (surah: number, ayah: number, wordIndex: number) => Promise<void>;
  // Check if word audio is playing
  isWordAudioPlaying: boolean;
};

export function useWordAudio(options: UseWordAudioOptions): UseWordAudioReturn {
  const { enabled, silent = true } = options;
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [isWordAudioPlaying, setIsWordAudioPlaying] = useState(false);
  const controllerRef = useRef<WordAudioController | null>(null);
  const currentVerseRef = useRef<{ surah: number; ayah: number } | null>(null);

  // Initialize controller
  useEffect(() => {
    if (!enabled) return;

    const controller = getWordAudioController();
    controllerRef.current = controller;

    // Set volume based on silent mode
    controller.setVolume(silent ? 0 : 1);

    // Set up callbacks
    controller.setCallbacks({
      onWordStart: (wordIndex) => {
        setActiveWordIndex(wordIndex);
        if (currentVerseRef.current) {
          emitWordHighlight(
            currentVerseRef.current.surah,
            currentVerseRef.current.ayah,
            wordIndex,
            true
          );
        }
      },
      onWordEnd: (wordIndex) => {
        if (currentVerseRef.current) {
          emitWordHighlight(
            currentVerseRef.current.surah,
            currentVerseRef.current.ayah,
            wordIndex,
            false
          );
        }
      },
      onSequenceEnd: () => {
        setActiveWordIndex(0);
        setIsWordAudioPlaying(false);
      },
      onError: (error) => {
        console.warn("[useWordAudio] Error:", error.message);
      },
    });

    return () => {
      controller.stop();
    };
  }, [enabled, silent]);

  // Update volume when silent mode changes
  useEffect(() => {
    if (controllerRef.current && enabled) {
      controllerRef.current.setVolume(silent ? 0 : 1);
    }
  }, [silent, enabled]);

  const startVerseWords = useCallback(
    (surah: number, ayah: number, wordCount: number) => {
      if (!enabled || !controllerRef.current) return;

      currentVerseRef.current = { surah, ayah };
      setIsWordAudioPlaying(true);
      controllerRef.current.startVerse(surah, ayah, wordCount);
    },
    [enabled]
  );

  const pauseWordAudio = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.pause();
      setIsWordAudioPlaying(false);
    }
  }, []);

  const resumeWordAudio = useCallback(() => {
    if (controllerRef.current && enabled) {
      controllerRef.current.resume();
      setIsWordAudioPlaying(true);
    }
  }, [enabled]);

  const stopWordAudio = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.stop();
      setActiveWordIndex(0);
      setIsWordAudioPlaying(false);
      currentVerseRef.current = null;
    }
  }, []);

  const restartWordAudio = useCallback(() => {
    if (controllerRef.current && enabled) {
      controllerRef.current.restart();
      setIsWordAudioPlaying(true);
    }
  }, [enabled]);

  const playWordOnHover = useCallback(
    async (surah: number, ayah: number, wordIndex: number): Promise<void> => {
      if (!enabled || !controllerRef.current) return;

      // Signal that hover playback is starting (verse audio should pause)
      emitHoverPlaybackState(true);

      try {
        await controllerRef.current.playSingleWord(surah, ayah, wordIndex);
      } finally {
        // Signal that hover playback ended (verse audio can resume)
        emitHoverPlaybackState(false);
      }
    },
    [enabled]
  );

  return {
    activeWordIndex,
    startVerseWords,
    pauseWordAudio,
    resumeWordAudio,
    stopWordAudio,
    restartWordAudio,
    playWordOnHover,
    isWordAudioPlaying,
  };
}

/**
 * Hook to listen for word highlight events (used by word components)
 */
export function useWordHighlightListener(
  surah: number,
  ayah: number,
  wordIndex: number,
  onHighlight: (active: boolean) => void
) {
  useEffect(() => {
    const handleStart = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (
        detail.surah === surah &&
        detail.ayah === ayah &&
        detail.wordIndex === wordIndex
      ) {
        onHighlight(true);
      }
    };

    const handleEnd = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (
        detail.surah === surah &&
        detail.ayah === ayah &&
        detail.wordIndex === wordIndex
      ) {
        onHighlight(false);
      }
    };

    window.addEventListener(WORD_AUDIO_EVENTS.WORD_HIGHLIGHT_START, handleStart);
    window.addEventListener(WORD_AUDIO_EVENTS.WORD_HIGHLIGHT_END, handleEnd);

    return () => {
      window.removeEventListener(WORD_AUDIO_EVENTS.WORD_HIGHLIGHT_START, handleStart);
      window.removeEventListener(WORD_AUDIO_EVENTS.WORD_HIGHLIGHT_END, handleEnd);
    };
  }, [surah, ayah, wordIndex, onHighlight]);
}
