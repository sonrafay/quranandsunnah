// src/lib/wordAudio.ts
// Word-by-word audio service for canonical word audio playback
// This provides reciter-independent word timing and hover playback

/**
 * Word-by-word audio URL pattern from Quran.com CDN
 * Format: https://audio.qurancdn.com/wbw/{SSS}_{AAA}_{WWW}.mp3
 * Where SSS, AAA, WWW are zero-padded to 3 digits
 * wordIndex is 1-based
 */
export function getWordAudioUrl(surah: number, ayah: number, wordIndex: number): string {
  const sss = String(surah).padStart(3, "0");
  const aaa = String(ayah).padStart(3, "0");
  const www = String(wordIndex).padStart(3, "0");
  return `https://audio.qurancdn.com/wbw/${sss}_${aaa}_${www}.mp3`;
}

/**
 * WordAudioController manages sequential word-by-word audio playback
 * for a single verse. It can be used for:
 * - Word highlighting during verse playback (silent or audible)
 * - Hover playback of individual words
 */
export class WordAudioController {
  private audio: HTMLAudioElement;
  private currentSurah = 0;
  private currentAyah = 0;
  private currentWordIndex = 0;
  private wordCount = 0;
  private playing = false;
  private volume = 0; // Default silent for timing-only mode

  // Callbacks
  private onWordStart?: (wordIndex: number) => void;
  private onWordEnd?: (wordIndex: number) => void;
  private onSequenceEnd?: () => void;
  private onError?: (error: Error) => void;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = "auto";

    // Handle word audio end - advance to next word or signal sequence end
    this.audio.addEventListener("ended", () => {
      this.onWordEnd?.(this.currentWordIndex);

      if (this.playing && this.currentWordIndex < this.wordCount) {
        this.currentWordIndex++;
        this.playCurrentWord();
      } else {
        this.playing = false;
        this.onSequenceEnd?.();
      }
    });

    // Handle errors gracefully - skip to next word
    this.audio.addEventListener("error", () => {
      const error = new Error(`Failed to load word audio: ${this.audio.src}`);
      this.onError?.(error);

      // Try to continue with next word
      if (this.playing && this.currentWordIndex < this.wordCount) {
        this.onWordEnd?.(this.currentWordIndex);
        this.currentWordIndex++;
        this.playCurrentWord();
      } else {
        this.playing = false;
        this.onSequenceEnd?.();
      }
    });
  }

  /**
   * Set callbacks for word events
   */
  setCallbacks(callbacks: {
    onWordStart?: (wordIndex: number) => void;
    onWordEnd?: (wordIndex: number) => void;
    onSequenceEnd?: () => void;
    onError?: (error: Error) => void;
  }) {
    this.onWordStart = callbacks.onWordStart;
    this.onWordEnd = callbacks.onWordEnd;
    this.onSequenceEnd = callbacks.onSequenceEnd;
    this.onError = callbacks.onError;
  }

  /**
   * Set volume (0 = silent for timing, 1 = full for audible playback)
   */
  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.audio.volume = this.volume;
  }

  /**
   * Start playing word-by-word audio for a verse
   */
  startVerse(surah: number, ayah: number, wordCount: number, startFromWord = 1) {
    this.stop();

    this.currentSurah = surah;
    this.currentAyah = ayah;
    this.wordCount = wordCount;
    this.currentWordIndex = startFromWord;
    this.playing = true;

    this.playCurrentWord();
  }

  /**
   * Play the current word
   */
  private playCurrentWord() {
    if (!this.playing || this.currentWordIndex > this.wordCount) {
      this.playing = false;
      this.onSequenceEnd?.();
      return;
    }

    const url = getWordAudioUrl(this.currentSurah, this.currentAyah, this.currentWordIndex);
    this.audio.src = url;
    this.audio.volume = this.volume;

    this.onWordStart?.(this.currentWordIndex);

    this.audio.play().catch((err) => {
      // Ignore AbortError - this is expected when audio is interrupted
      if (err.name === "AbortError") {
        return;
      }
      // If autoplay blocked, still signal the word start for highlighting
      console.warn("[WordAudio] Playback blocked:", err);
      // Try to continue with next word after a short delay
      setTimeout(() => {
        if (this.playing && this.currentWordIndex < this.wordCount) {
          this.onWordEnd?.(this.currentWordIndex);
          this.currentWordIndex++;
          this.playCurrentWord();
        } else {
          this.playing = false;
          this.onSequenceEnd?.();
        }
      }, 300); // Approximate word duration fallback
    });
  }

  /**
   * Play a single word (for hover playback)
   * Returns a promise that resolves when playback completes
   */
  playSingleWord(surah: number, ayah: number, wordIndex: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // Stop any current sequence
      this.stop();

      const url = getWordAudioUrl(surah, ayah, wordIndex);
      this.audio.src = url;
      this.audio.volume = 1; // Always audible for single word playback

      const onEnded = () => {
        cleanup();
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error(`Failed to play word audio: ${url}`));
      };

      const cleanup = () => {
        this.audio.removeEventListener("ended", onEnded);
        this.audio.removeEventListener("error", onError);
      };

      this.audio.addEventListener("ended", onEnded, { once: true });
      this.audio.addEventListener("error", onError, { once: true });

      this.audio.play().catch((err) => {
        cleanup();
        // Ignore AbortError - this is expected when audio is interrupted
        if (err.name === "AbortError") {
          resolve();
          return;
        }
        reject(err);
      });
    });
  }

  /**
   * Pause the current sequence
   */
  pause() {
    this.playing = false;
    this.audio.pause();
  }

  /**
   * Resume the current sequence
   */
  resume() {
    if (this.currentWordIndex <= this.wordCount) {
      this.playing = true;
      this.audio.play().catch(() => {});
    }
  }

  /**
   * Stop and reset
   */
  stop() {
    this.playing = false;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.currentWordIndex = 0;
  }

  /**
   * Check if currently playing
   */
  isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Get current word index (1-based)
   */
  getCurrentWordIndex(): number {
    return this.currentWordIndex;
  }

  /**
   * Restart from beginning of current verse
   */
  restart() {
    if (this.currentSurah && this.currentAyah && this.wordCount) {
      this.startVerse(this.currentSurah, this.currentAyah, this.wordCount, 1);
    }
  }

  /**
   * Cleanup
   */
  dispose() {
    this.stop();
    this.audio.src = "";
  }
}

// Singleton instance for global word audio control
let globalWordAudioController: WordAudioController | null = null;

/**
 * Get the global word audio controller (client-side only)
 * Returns a singleton instance for managing word-by-word audio
 */
export function getWordAudioController(): WordAudioController {
  // Guard against SSR - Audio is not available on the server
  if (typeof window === "undefined") {
    // Return a no-op controller for SSR
    // This should never be used in practice since all usage is client-side
    throw new Error("getWordAudioController should only be called on the client");
  }

  if (!globalWordAudioController) {
    globalWordAudioController = new WordAudioController();
  }
  return globalWordAudioController;
}

/**
 * Event types for word audio communication
 */
export const WORD_AUDIO_EVENTS = {
  // Emitted when word highlighting should start
  WORD_HIGHLIGHT_START: "qs-word-highlight-start",
  // Emitted when word highlighting should end
  WORD_HIGHLIGHT_END: "qs-word-highlight-end",
  // Emitted when hover playback starts (to pause verse audio)
  HOVER_PLAYBACK_START: "qs-hover-playback-start",
  // Emitted when hover playback ends (to resume verse audio)
  HOVER_PLAYBACK_END: "qs-hover-playback-end",
} as const;

/**
 * Emit a word highlight event
 */
export function emitWordHighlight(surah: number, ayah: number, wordIndex: number, active: boolean) {
  const eventName = active ? WORD_AUDIO_EVENTS.WORD_HIGHLIGHT_START : WORD_AUDIO_EVENTS.WORD_HIGHLIGHT_END;
  window.dispatchEvent(new CustomEvent(eventName, {
    detail: { surah, ayah, wordIndex }
  }));
}

/**
 * Emit hover playback events
 */
export function emitHoverPlaybackState(playing: boolean) {
  const eventName = playing ? WORD_AUDIO_EVENTS.HOVER_PLAYBACK_START : WORD_AUDIO_EVENTS.HOVER_PLAYBACK_END;
  window.dispatchEvent(new CustomEvent(eventName));
}
