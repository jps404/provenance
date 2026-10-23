/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Text-to-speech narration service using the browser's native SpeechSynthesis API.
 * iOS Safari hardened:
 * 1. Loads voices with 'voiceschanged' event listener.
 * 2. Splits narration into sentence-sized utterances queued in order to prevent iOS Safari 15s cutoff.
 * 3. Supports clean pause, resume, and cancellation.
 */

type SpeechCallback = () => void;

class SpeechService {
  private voices: SpeechSynthesisVoice[] = [];
  private isVoicesLoaded = false;
  private queue: string[] = [];
  private currentUtteranceIndex = 0;
  private isUserPlaying = false;
  private isUserPaused = false;
  private onStartCallback: SpeechCallback | null = null;
  private onEndCallback: SpeechCallback | null = null;
  private onErrorCallback: ((err: unknown) => void) | null = null;

  constructor() {
    this.initVoices();
  }

  private initVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const populate = () => {
      this.voices = window.speechSynthesis.getVoices();
      if (this.voices.length > 0) {
        this.isVoicesLoaded = true;
      }
    };

    populate();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = populate;
    }
  }

  public isAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  private getPreferredVoice(): SpeechSynthesisVoice | undefined {
    if (!this.isVoicesLoaded) {
      this.voices = window.speechSynthesis.getVoices();
    }

    return (
      this.voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') ||
            v.name.includes('Samantha') ||
            v.name.includes('Daniel') ||
            v.name.includes('Google') ||
            v.name.includes('Premium'))
      ) ||
      this.voices.find((v) => v.lang === 'en-GB' || v.lang === 'en-US') ||
      this.voices.find((v) => v.lang.startsWith('en'))
    );
  }

  /**
   * Splits a narration paragraph into clean, sentence-sized chunks for iOS Safari queueing.
   */
  private splitSentences(text: string): string[] {
    const raw = text.replace(/[\n\r]+/g, ' ').trim();
    if (!raw) return [];

    // Match sentences ending in punctuation
    const matches = raw.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
    if (!matches) return [raw];

    const sentences: string[] = [];
    for (const s of matches) {
      const trimmed = s.trim();
      if (trimmed.length > 0) {
        sentences.push(trimmed);
      }
    }
    return sentences.length > 0 ? sentences : [raw];
  }

  /**
   * Speaks the text. Must be invoked inside a user click handler.
   */
  public speak(
    text: string,
    onStart?: SpeechCallback,
    onEnd?: SpeechCallback,
    onError?: (err: unknown) => void
  ): void {
    if (!this.isAvailable()) {
      if (onError) onError(new Error('Speech synthesis is not supported on this browser.'));
      return;
    }

    this.stop();

    const sentences = this.splitSentences(text);
    if (sentences.length === 0) return;

    this.queue = sentences;
    this.currentUtteranceIndex = 0;
    this.isUserPlaying = true;
    this.isUserPaused = false;
    this.onStartCallback = onStart || null;
    this.onEndCallback = onEnd || null;
    this.onErrorCallback = onError || null;

    if (this.onStartCallback) {
      this.onStartCallback();
    }

    this.playNextUtterance();
  }

  private playNextUtterance(): void {
    if (!this.isUserPlaying || this.currentUtteranceIndex >= this.queue.length) {
      this.isUserPlaying = false;
      this.isUserPaused = false;
      if (this.onEndCallback) {
        this.onEndCallback();
      }
      return;
    }

    const sentence = this.queue[this.currentUtteranceIndex];
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.rate = 0.95;
    utterance.pitch = 0.98;

    const voice = this.getPreferredVoice();
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => {
      this.currentUtteranceIndex++;
      if (this.isUserPlaying && !this.isUserPaused) {
        this.playNextUtterance();
      }
    };

    utterance.onerror = (e) => {
      // In iOS Safari, canceled utterances emit error 'canceled' or 'interrupted'
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('SpeechSynthesis error:', e);
        if (this.onErrorCallback) {
          this.onErrorCallback(e);
        }
      }
      this.currentUtteranceIndex++;
      if (this.isUserPlaying && !this.isUserPaused) {
        this.playNextUtterance();
      }
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      if (this.onErrorCallback) this.onErrorCallback(err);
    }
  }

  public pause(): void {
    if (this.isAvailable() && this.isUserPlaying) {
      this.isUserPaused = true;
      window.speechSynthesis.pause();
    }
  }

  public resume(): void {
    if (this.isAvailable() && this.isUserPlaying && this.isUserPaused) {
      this.isUserPaused = false;
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      } else {
        this.playNextUtterance();
      }
    }
  }

  public stop(): void {
    if (this.isAvailable()) {
      this.isUserPlaying = false;
      this.isUserPaused = false;
      this.queue = [];
      this.currentUtteranceIndex = 0;
      window.speechSynthesis.cancel();
      if (this.onEndCallback) {
        this.onEndCallback();
      }
    }
  }

  public isSpeaking(): boolean {
    return this.isAvailable() && this.isUserPlaying && !this.isUserPaused;
  }

  public isPaused(): boolean {
    return this.isAvailable() && this.isUserPaused;
  }
}

export const speechService = new SpeechService();
