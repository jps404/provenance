/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Pause, Play, RotateCcw } from 'lucide-react';
import { speechService } from '../services/speech.ts';

interface ListenButtonProps {
  narration: string;
}

export const ListenButton: React.FC<ListenButtonProps> = ({ narration }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    return () => {
      speechService.stop();
    };
  }, []);

  const handleToggle = () => {
    if (isPlaying) {
      if (isPaused) {
        speechService.resume();
        setIsPaused(false);
      } else {
        speechService.pause();
        setIsPaused(true);
      }
    } else {
      speechService.speak(
        narration,
        () => {
          setIsPlaying(true);
          setIsPaused(false);
        },
        () => {
          setIsPlaying(false);
          setIsPaused(false);
        },
        (err) => {
          console.warn('Speech error:', err);
          setIsPlaying(false);
          setIsPaused(false);
        }
      );
    }
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    speechService.stop();
    setIsPlaying(false);
    setIsPaused(false);
  };

  if (!narration) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleToggle}
        aria-label={
          isPlaying
            ? isPaused
              ? 'Resume docent audio'
              : 'Pause docent audio'
            : 'Listen to docent narration'
        }
        className="flex items-center gap-2.5 px-4 py-2.5 bg-[#6E2B26] text-white hover:bg-[#58221E] active:scale-98 transition-all font-mono text-xs uppercase tracking-wider min-h-[44px] cursor-pointer shadow-xs"
      >
        {isPlaying ? (
          isPaused ? (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Resume Narration</span>
            </>
          ) : (
            <>
              <Pause className="w-4 h-4 fill-white" />
              <span>Pause Docent</span>
              {/* Subtle audio pulse bars */}
              <span className="flex items-end gap-0.5 h-3 ml-1">
                <span className="w-0.5 bg-white h-3 animate-pulse" />
                <span className="w-0.5 bg-white h-2 animate-pulse" style={{ animationDelay: '150ms' }} />
                <span className="w-0.5 bg-white h-3.5 animate-pulse" style={{ animationDelay: '300ms' }} />
              </span>
            </>
          )
        ) : (
          <>
            <Volume2 className="w-4 h-4" />
            <span>Listen (Docent Audio)</span>
          </>
        )}
      </button>

      {isPlaying && (
        <button
          onClick={handleStop}
          aria-label="Stop docent narration"
          className="p-2.5 bg-[#FAF7F0] border border-[#D8D2C4] text-[#1C1B18] hover:bg-[#EDE7DA] min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
          title="Stop narration"
        >
          <VolumeX className="w-4 h-4 text-[#6E2B26]" />
        </button>
      )}
    </div>
  );
};
