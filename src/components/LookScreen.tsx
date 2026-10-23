/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import type { ObserveResponse } from '../types.ts';
import { ArrowRight, RotateCcw, Sparkles, Eye, AlertCircle } from 'lucide-react';

interface LookScreenProps {
  imageSrc: string;
  isObserving: boolean;
  observeData: ObserveResponse | null;
  observeError: string | null;
  onReveal: () => void;
  onRetake: () => void;
  onRetry: () => void;
}

export const LookScreen: React.FC<LookScreenProps> = ({
  imageSrc,
  isObserving,
  observeData,
  observeError,
  onReveal,
  onRetake,
  onRetry,
}) => {
  const [seconds, setSeconds] = useState(0);

  // Ticking timer for "Observing... Ns"
  useEffect(() => {
    if (!isObserving) {
      return;
    }
    setSeconds(0);
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isObserving]);

  return (
    <div className="relative min-h-screen bg-[#1C1B18] text-[#F2EEE5] flex flex-col justify-between">
      {/* Background frozen captured photo */}
      <div className="absolute inset-0 z-0">
        <img
          src={imageSrc}
          alt="Captured specimen"
          className="w-full h-full object-cover opacity-60 filter brightness-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1C1B18] via-[#1C1B18]/40 to-[#1C1B18]/70" />
      </div>

      {/* Top Bar */}
      <header className="relative z-10 px-4 pt-4 md:pt-6 flex items-center justify-between">
        <button
          onClick={onRetake}
          aria-label="Discard photo and retake"
          className="flex items-center gap-1.5 px-3 py-2 bg-black/40 backdrop-blur-md text-[#F2EEE5] border border-white/20 font-mono text-xs uppercase tracking-wider min-h-[44px] hover:bg-black/60 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Retake</span>
        </button>

        <div className="font-mono text-xs uppercase tracking-widest text-[#F2EEE5]/70 flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#6E2B26]" />
          <span>Step 1: Look First</span>
        </div>
      </header>

      {/* Central VTS Question / Observing Callout */}
      <main className="relative z-10 px-6 py-8 max-w-xl mx-auto w-full my-auto text-center">
        {observeError ? (
          <div className="p-6 bg-[#2B1B1A] border border-[#6E2B26] text-left">
            <div className="flex items-center gap-2 text-[#E57373] font-mono text-xs uppercase tracking-wider mb-2">
              <AlertCircle className="w-4 h-4" />
              <span>Observation Interrupted</span>
            </div>
            <p className="text-sm text-[#F2EEE5]/90 mb-4 font-sans">
              {observeError}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onRetry}
                className="px-4 py-2.5 bg-[#6E2B26] text-white font-mono text-xs uppercase tracking-wider min-h-[44px] hover:bg-[#8B3730] transition-colors"
              >
                Retry Reading
              </button>
              <button
                onClick={onRetake}
                className="px-4 py-2.5 bg-white/10 text-white font-mono text-xs uppercase tracking-wider min-h-[44px] hover:bg-white/20 transition-colors"
              >
                Retake Photo
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FAF7F0]/15 backdrop-blur-md border border-white/20 text-[#FAF7F0] font-mono text-[11px] uppercase tracking-widest">
              {isObserving ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#E88E75] animate-ping" />
                  <span>Observing... {seconds}s</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[#E88E75]" />
                  <span>Visual Thinking Strategies (Housen & Yenawine)</span>
                </>
              )}
            </div>

            {/* Docent Question */}
            <div className="min-h-[120px] flex items-center justify-center">
              {isObserving ? (
                <p className="font-serif italic text-2xl md:text-3xl text-[#F2EEE5]/90 leading-relaxed font-light">
                  "Look closely at the surfaces, wear, and physical balance before any facts are given..."
                </p>
              ) : (
                <blockquote className="font-serif italic text-2xl md:text-3xl lg:text-4xl text-[#F2EEE5] leading-snug font-normal drop-shadow-sm">
                  "{observeData?.vts_question}"
                </blockquote>
              )}
            </div>

            {!isObserving && (
              <p className="font-mono text-xs text-[#F2EEE5]/60 max-w-sm mx-auto uppercase tracking-wider">
                Take a moment to look with your own eyes. Then reveal the curatorial record.
              </p>
            )}
          </div>
        )}
      </main>

      {/* Bottom Action */}
      <footer className="relative z-10 p-6 max-w-xl mx-auto w-full">
        {observeData && !observeError && (
          <button
            onClick={onReveal}
            className="w-full py-4 px-6 bg-[#6E2B26] hover:bg-[#8B3730] active:scale-98 text-white font-mono text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all min-h-[52px] shadow-lg cursor-pointer"
          >
            <span>Reveal Exhibit</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </footer>
    </div>
  );
};
