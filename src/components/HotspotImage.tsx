/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { Hotspot } from '../types.ts';
import { calculatePinCenter } from '../utils/pure-logic.ts';
import { X, Wrench, Calendar, Info } from 'lucide-react';

interface HotspotImageProps {
  imageUrl: string;
  hotspots: Hotspot[];
  altText?: string;
}

export const HotspotImage: React.FC<HotspotImageProps> = ({
  imageUrl,
  hotspots,
  altText = 'Specimen photograph with analytical hotspots',
}) => {
  const [selectedPinIndex, setSelectedPinIndex] = useState<number | null>(null);

  const selectedHotspot = selectedPinIndex !== null ? hotspots[selectedPinIndex] : null;

  return (
    <div className="relative w-full select-none">
      {/* Photo with Natural Aspect Ratio */}
      <div className="relative w-full overflow-hidden bg-[#242321] border-b border-[#D8D2C4]">
        <img
          src={imageUrl}
          alt={altText}
          className="w-full h-auto block object-contain max-h-[70vh] mx-auto pointer-events-none"
        />

        {/* Hotspot bounding box overlay for active pin */}
        {selectedHotspot && (() => {
          const { topPercent, leftPercent, widthPercent, heightPercent } = calculatePinCenter(
            selectedHotspot.box_2d
          );
          const ymin = selectedHotspot.box_2d[0] / 10;
          const xmin = selectedHotspot.box_2d[1] / 10;
          return (
            <div
              className="absolute pointer-events-none border-2 border-[#6E2B26] bg-[#6E2B26]/15 transition-all duration-200"
              style={{
                top: `${ymin}%`,
                left: `${xmin}%`,
                width: `${widthPercent}%`,
                height: `${heightPercent}%`,
              }}
            >
              <div className="absolute -top-6 left-0 bg-[#6E2B26] text-white font-mono text-[10px] px-1.5 py-0.5 tracking-wider uppercase">
                {selectedHotspot.label}
              </div>
            </div>
          );
        })()}

        {/* Numbered Pins */}
        {hotspots.map((hotspot, idx) => {
          const { topPercent, leftPercent } = calculatePinCenter(hotspot.box_2d);
          const isSelected = selectedPinIndex === idx;

          return (
            <div
              key={idx}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
              style={{
                top: `${topPercent}%`,
                left: `${leftPercent}%`,
                animationDelay: `${idx * 140}ms`,
              }}
            >
              <button
                onClick={() => setSelectedPinIndex(isSelected ? null : idx)}
                aria-label={`Hotspot pin ${idx + 1}: ${hotspot.label}`}
                aria-expanded={isSelected}
                className={`group relative flex items-center justify-center min-w-[44px] min-h-[44px] p-2 transition-transform active:scale-95`}
              >
                {/* Visual Pin Bubble */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all shadow-md ${
                    isSelected
                      ? 'bg-[#6E2B26] text-white ring-4 ring-white/90 scale-110'
                      : 'bg-[#6E2B26] text-white ring-2 ring-white/80 hover:scale-105'
                  }`}
                >
                  {idx + 1}
                </div>

                {/* Subtitle label tooltip on desktop */}
                <span className="hidden md:group-hover:block absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-[#1C1B18] text-[#F2EEE5] font-mono text-[10px] whitespace-nowrap rounded-none z-30 pointer-events-none">
                  {hotspot.label}
                </span>
              </button>
            </div>
          );
        })}

        {/* Instructions helper overlay on image */}
        <div className="absolute bottom-2 right-2 bg-[#1C1B18]/70 backdrop-blur-xs text-[#F2EEE5] font-mono text-[10px] px-2 py-1 tracking-wider pointer-events-none flex items-center gap-1.5">
          <Info className="w-3 h-3 text-[#D8D2C4]" />
          <span>Tap pins to inspect failure-driven form</span>
        </div>
      </div>

      {/* Petroski "Form Follows Failure" Drawer / Sheet */}
      {selectedHotspot && (
        <div
          role="dialog"
          aria-label={`Hotspot detail: ${selectedHotspot.label}`}
          className="p-4 bg-[#FAF7F0] border-b border-[#D8D2C4] animate-fade-up relative"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#6E2B26] text-white font-mono text-xs font-bold flex items-center justify-center">
                  {(selectedPinIndex ?? 0) + 1}
                </span>
                <span className="font-mono text-xs text-[#6E2B26] uppercase tracking-wider font-semibold">
                  Form Follows Failure (Petroski)
                </span>
              </div>
              <h3 className="font-serif text-lg font-bold text-[#1C1B18] mt-1">
                {selectedHotspot.label}
              </h3>
            </div>
            <button
              onClick={() => setSelectedPinIndex(null)}
              aria-label="Close hotspot detail"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#1C1B18]/60 hover:text-[#1C1B18]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="mt-2 text-sm text-[#1C1B18]/85 leading-relaxed font-sans">
            {selectedHotspot.feature_story}
          </p>

          <div className="mt-3 pt-2 border-t border-[#D8D2C4]/60 flex items-center gap-2 text-xs font-mono text-[#1C1B18]/70">
            <Calendar className="w-3.5 h-3.5 text-[#6E2B26]" />
            <span>Introduced: {selectedHotspot.introduced}</span>
          </div>
        </div>
      )}
    </div>
  );
};
