/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowLeft, BookOpen, ExternalLink } from 'lucide-react';

interface MethodScreenProps {
  onBack: () => void;
}

interface MethodItem {
  name: string;
  citation: string;
  summary: string;
}

const METHODS: MethodItem[] = [
  {
    name: 'Visual Thinking Strategies (VTS)',
    citation: 'Abigail Housen & Philip Yenawine (1991)',
    summary:
      'Look before being told. Every scan opens with an open-ended docent inquiry focused purely on visual evidence in your photo before any facts or attributions are unveiled.',
  },
  {
    name: 'Material Culture Triad',
    citation: 'Jules David Prown, "Mind in Matter: An Introduction to Material Culture Theory and Method" (1982)',
    summary:
      'Structured empirical reading progressing through three disciplined stages: physical Description (observable geometry/surfaces), cultural Deduction (makers/users), and historical Speculation (hypotheses).',
  },
  {
    name: 'Form Follows Failure',
    citation: 'Henry Petroski, "The Evolution of Useful Things" (1992)',
    summary:
      'Tappable visual pins reveal how every design feature—from pencil erasers to knurled dials—evolved specifically to answer a documented mechanical flaw or vulnerability in earlier iterations.',
  },
  {
    name: 'The Cultural Biography of Things',
    citation: 'Igor Kopytoff (1986) & George Kubler, "The Shape of Time" (1962)',
    summary:
      'Every specimen is situated on an evolutionary continuum from its earliest ancestral "prime object" down to the individual specimen held in your hand today.',
  },
  {
    name: 'Hidden Commodity History',
    citation: 'Leonard E. Read, "I, Pencil: My Family Tree as Told to Leonard E. Read" (1958)',
    summary:
      'Surfacing the invisible global supply chains, mining basins, and chemical syntheses bound inside everyday plastics, alloys, adhesives, and pigments.',
  },
  {
    name: 'Historical Thinking: Sourcing & Corroboration',
    citation: 'Sam Wineburg, "Historical Thinking and Other Unnatural Acts" (2001)',
    summary:
      'Myth versus Record. Separating popular marketing lore from primary patent registers, corroborated by live verifiable Google Search sources.',
  },
  {
    name: 'Interpretation as Provocation',
    citation: 'Freeman Tilden, "Interpreting Our Heritage" (1957)',
    summary:
      'The chief aim of interpretation is not instruction, but provocation. Every specimen concludes with an unanswered question to sit with rather than a tidy summary.',
  },
  {
    name: 'The Big Idea Label',
    citation: 'Beverly Serrell, "Exhibit Labels: An Interpretive Approach" (1996)',
    summary:
      'Restrained label discipline: a concise tombstone placard paired with a single big-idea takeaway of 75 words or fewer.',
  },
  {
    name: 'Museum Accessioning & The Wunderkammer',
    citation: 'International Council of Museums (ICOM) Cataloging Standards',
    summary:
      'Cataloged into your personal cabinet of curiosities under archival museum accession numbers formatted by year, month, and sequence (YYYY.MM.N).',
  },
];

export const MethodScreen: React.FC<MethodScreenProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-[#F2EEE5] text-[#1C1B18] px-4 py-6 md:py-10 max-w-2xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between pb-4 border-b border-[#D8D2C4]">
        <button
          onClick={onBack}
          aria-label="Back to previous screen"
          className="flex items-center gap-2 text-sm font-medium text-[#1C1B18] hover:text-[#6E2B26] transition-colors min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <span className="font-mono text-xs uppercase tracking-widest text-[#1C1B18]/60">
          Curatorial Framework
        </span>
      </header>

      {/* Title */}
      <div className="mt-8 mb-8">
        <div className="flex items-center gap-2 text-[#6E2B26] mb-2 font-mono text-xs uppercase tracking-wider">
          <BookOpen className="w-4 h-4" />
          <span>The Provenance Method</span>
        </div>
        <h1 className="font-serif text-3xl md:text-4xl font-normal leading-tight">
          How a docent reads the physical world.
        </h1>
        <p className="mt-3 text-sm text-[#1C1B18]/80 leading-relaxed font-sans">
          Provenance is not a generic chatbot. It translates physical specimens through nine established
          methods from material culture, museum interpretation, and the history of technology.
        </p>
      </div>

      {/* Methods List */}
      <div className="space-y-6">
        {METHODS.map((item, idx) => (
          <article
            key={idx}
            className="p-5 bg-[#FAF7F0] rounded-none border border-[#D8D2C4] shadow-xs relative"
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-mono text-[11px] text-[#6E2B26] font-semibold">
                Principle 0{idx + 1}
              </span>
            </div>
            <h2 className="font-serif text-xl font-medium text-[#1C1B18] mt-1 mb-1">
              {item.name}
            </h2>
            <p className="font-mono text-xs text-[#1C1B18]/65 mb-3 italic">
              {item.citation}
            </p>
            <p className="text-sm text-[#1C1B18]/85 leading-relaxed font-sans">
              {item.summary}
            </p>
          </article>
        ))}
      </div>

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-[#D8D2C4] text-center">
        <p className="font-serif italic text-base text-[#1C1B18]/70">
          "Every object is an archive waiting to be read."
        </p>
        <p className="font-mono text-[11px] text-[#1C1B18]/50 mt-2">
          PROVENANCE SYSTEM — v1.0 ARCHIVAL RUNTIME
        </p>
      </footer>
    </div>
  );
};
