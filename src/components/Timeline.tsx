/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { LineageNode } from '../types.ts';

interface TimelineProps {
  lineage: LineageNode[];
}

export const Timeline: React.FC<TimelineProps> = ({ lineage }) => {
  if (!lineage || lineage.length === 0) return null;

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-[#D8D2C4]">
      {lineage.map((node, idx) => {
        const isSpecimen = node.is_specimen === true;
        const isFirst = idx === 0 && !isSpecimen;

        return (
          <div key={idx} className="relative group">
            {/* Timeline Node Icon */}
            <div
              className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                isSpecimen
                  ? 'border-[#6E2B26] bg-[#6E2B26] text-white shadow-xs'
                  : isFirst
                  ? 'border-[#1C1B18] bg-[#F2EEE5]'
                  : 'border-[#D8D2C4] bg-[#FAF7F0]'
              }`}
            >
              {isSpecimen ? (
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              ) : isFirst ? (
                <div className="w-1.5 h-1.5 rounded-full bg-[#1C1B18]" />
              ) : null}
            </div>

            {/* Year & Badge */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-semibold tracking-wider text-[#1C1B18]/70">
                {node.year}
              </span>
              {isFirst && (
                <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-[#1C1B18]/10 text-[#1C1B18]">
                  Prime Object (Kubler)
                </span>
              )}
              {isSpecimen && (
                <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-[#6E2B26] text-white font-medium">
                  This Specimen
                </span>
              )}
            </div>

            {/* Title */}
            <h4
              className={`font-serif text-lg leading-snug ${
                isSpecimen ? 'text-[#6E2B26] font-bold' : 'text-[#1C1B18] font-medium'
              }`}
            >
              {node.title}
            </h4>

            {/* Note */}
            {node.note && (
              <p className="mt-1 text-sm text-[#1C1B18]/80 leading-relaxed font-sans">
                {node.note}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
