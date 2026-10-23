/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { ExhibitRecord } from '../types.ts';
import { HotspotImage } from './HotspotImage.tsx';
import { Timeline } from './Timeline.tsx';
import { ListenButton } from './ListenButton.tsx';
import { sharePlacard } from '../utils/placard-canvas.ts';
import { shouldGateConfidence, mapCuratorialErrorMessage } from '../utils/pure-logic.ts';
import {
  ArrowLeft,
  Globe,
  HelpCircle,
  Share2,
  ExternalLink,
  Sparkles,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Check,
  Camera,
  Cpu,
  Search,
  Download,
} from 'lucide-react';

interface ExhibitProps {
  exhibit: ExhibitRecord;
  isInterpreting?: boolean;
  interpretPhase?: string | null;
  interpretError?: string | null;
  onRetryInterpret?: () => void;
  onBack: () => void;
  onNewScan: () => void;
}

export const Exhibit: React.FC<ExhibitProps> = ({
  exhibit,
  isInterpreting = false,
  interpretPhase = null,
  interpretError = null,
  onRetryInterpret,
  onBack,
  onNewScan,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSharingPlacard, setIsSharingPlacard] = useState(false);

  const { observe, interpret, accessionNumber, imageFull } = exhibit;
  const tomb = observe.tombstone;
  const modelUsed = interpret?.modelUsed || observe.modelUsed;
  const isGated = shouldGateConfidence(observe) || exhibit.isConfidenceGated;
  const hasGrounding = !interpret?.isUnsourced && (interpret?.sources?.length ?? 0) > 0;

  const handleShareSummary = async () => {
    const textToShare = `${tomb.title} [Accession No. ${accessionNumber}]\n${tomb.maker} (${tomb.date})\n${interpret?.big_idea || observe.description}`;
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(textToShare);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // Fallback
      }
    }
  };

  const handleSharePlacardClick = async () => {
    setIsSharingPlacard(true);
    try {
      await sharePlacard(exhibit);
    } catch (err) {
      console.warn('Share placard error:', err);
    } finally {
      setIsSharingPlacard(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2EEE5] text-[#1C1B18] pb-28">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#F2EEE5]/95 backdrop-blur-md border-b border-[#D8D2C4] px-4 py-3 max-w-2xl mx-auto flex items-center justify-between">
        <button
          onClick={onBack}
          aria-label="Back to cabinet"
          className="flex items-center gap-1.5 text-sm font-medium text-[#1C1B18] hover:text-[#6E2B26] transition-colors min-h-[44px] min-w-[44px] cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Cabinet</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold px-2 py-1 bg-[#FAF7F0] border border-[#D8D2C4] text-[#6E2B26]">
            {accessionNumber}
          </span>
          <button
            onClick={handleSharePlacardClick}
            disabled={isSharingPlacard}
            aria-label="Share museum placard image"
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[#D8D2C4] bg-[#FAF7F0] hover:text-[#6E2B26] text-[#1C1B18] min-h-[44px] font-mono text-[11px] uppercase tracking-wider transition-colors cursor-pointer"
            title="Export high-res museum placard"
          >
            <Download className="w-3.5 h-3.5 text-[#6E2B26]" />
            <span className="hidden sm:inline">Placard</span>
          </button>
          <button
            onClick={handleShareSummary}
            aria-label="Copy museum catalog summary"
            className="p-2 border border-[#D8D2C4] bg-[#FAF7F0] hover:text-[#6E2B26] text-[#1C1B18] min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer"
            title="Copy catalog text"
          >
            {copied ? <Check className="w-4 h-4 text-[#6E2B26]" /> : <Share2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {/* Natural Aspect Ratio Photo with Hotspots (if present) */}
        <section aria-label="Specimen photograph with Petroski hotspots">
          <HotspotImage
            imageUrl={imageFull}
            hotspots={observe.hotspots || []}
            altText={`Specimen photo of ${tomb.title}`}
          />
        </section>

        <div className="px-4 py-6 space-y-8">
          {/* Tombstone Placard (Museum Placard Monospace Style) */}
          <section
            aria-label="Curatorial tombstone placard"
            className="p-5 bg-[#FAF7F0] border border-[#D8D2C4] shadow-xs"
          >
            <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-[#D8D2C4]/80">
              <span className="font-mono text-xs uppercase tracking-widest text-[#1C1B18]/70">
                Accession {accessionNumber}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 bg-[#6E2B26]/10 text-[#6E2B26] border border-[#6E2B26]/20 font-semibold">
                Confidence: {interpret?.overall_confidence || observe.identification_confidence}
              </span>
            </div>

            <h1 className="font-serif text-2xl md:text-3xl font-semibold text-[#1C1B18] mb-4">
              {tomb.title}
            </h1>

            {/* Monospace Placard Grid */}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 font-mono text-xs">
              <div>
                <dt className="text-[#1C1B18]/50 uppercase tracking-wider text-[10px]">Maker / Attribution</dt>
                <dd className="text-[#1C1B18] font-medium mt-0.5">{tomb.maker}</dd>
              </div>

              <div>
                <dt className="text-[#1C1B18]/50 uppercase tracking-wider text-[10px]">Date of Production</dt>
                <dd className="text-[#1C1B18] font-medium mt-0.5">{tomb.date}</dd>
              </div>

              <div>
                <dt className="text-[#1C1B18]/50 uppercase tracking-wider text-[10px]">Materials</dt>
                <dd className="text-[#1C1B18] font-medium mt-0.5">{tomb.materials}</dd>
              </div>

              <div>
                <dt className="text-[#1C1B18]/50 uppercase tracking-wider text-[10px]">Geographic Origin</dt>
                <dd className="text-[#1C1B18] font-medium mt-0.5">{tomb.origin}</dd>
              </div>

              <div className="sm:col-span-2 pt-1 border-t border-[#D8D2C4]/40">
                <dt className="text-[#1C1B18]/50 uppercase tracking-wider text-[10px]">Classification</dt>
                <dd className="text-[#1C1B18] font-medium mt-0.5">{tomb.classification}</dd>
              </div>
            </dl>

            {/* Audio Listen Button */}
            {!isGated && interpret?.narration && (
              <div className="mt-5 pt-4 border-t border-[#D8D2C4]/80 flex items-center justify-between">
                <ListenButton narration={interpret.narration} />
              </div>
            )}
          </section>

          {/* CONFIDENCE GATING: If confidence is Low or kind is unknown, gate interpret and show quiet suggestion */}
          {isGated ? (
            <section
              aria-label="Confidence notice"
              className="p-6 bg-[#FAF7F0] border border-[#D8D2C4] text-center space-y-3"
            >
              <AlertCircle className="w-6 h-6 text-[#6E2B26] mx-auto" />
              <h2 className="font-serif text-xl font-medium text-[#1C1B18]">
                Not enough to go on.
              </h2>
              <p className="text-sm text-[#1C1B18]/75 max-w-sm mx-auto font-sans leading-relaxed">
                Try a closer, well-lit photo of a single object. Historical lineage and supply chains require
                observable maker marks, joinery, or distinct silhouettes.
              </p>
              <div className="pt-2">
                <button
                  onClick={onNewScan}
                  className="px-5 py-2.5 bg-[#6E2B26] text-white font-mono text-xs uppercase tracking-wider inline-flex items-center gap-2 hover:bg-[#58221E] transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Try Another Scan</span>
                </button>
              </div>
            </section>
          ) : (
            <>
              {/* Streaming Progress Line if Call 2 is running */}
              {isInterpreting && (
                <div
                  role="status"
                  aria-live="polite"
                  className="p-4 bg-[#FAF7F0] border border-[#6E2B26]/30 flex items-center justify-between gap-3 text-xs font-mono text-[#6E2B26]"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#6E2B26] animate-ping" />
                    <span className="font-semibold">{interpretPhase || 'Researching sources and history...'}</span>
                  </div>
                  <span className="text-[#1C1B18]/50 uppercase tracking-widest text-[10px]">Grounded Call</span>
                </div>
              )}

              {/* Big Idea Label (Beverly Serrell: <= 75 words) */}
              {interpret ? (
                <section
                  aria-label="Serrell big idea label"
                  className="p-6 bg-[#FAF7F0] border-l-4 border-l-[#6E2B26] border-y border-r border-[#D8D2C4]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 font-mono text-[11px] text-[#6E2B26] uppercase tracking-widest">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>The Big Idea (Serrell)</span>
                    </div>
                    <span
                      className={`font-mono text-[9px] uppercase px-1.5 py-0.5 border ${
                        hasGrounding
                          ? 'bg-[#2E6B47]/10 text-[#2E6B47] border-[#2E6B47]/20 font-bold'
                          : 'bg-[#1C1B18]/5 text-[#1C1B18]/60 border-[#D8D2C4]'
                      }`}
                    >
                      {hasGrounding ? 'Sourced' : 'Unsourced'}
                    </span>
                  </div>
                  <p className="font-serif text-xl md:text-2xl text-[#1C1B18] leading-relaxed italic">
                    "{interpret.big_idea}"
                  </p>
                </section>
              ) : isInterpreting ? (
                <div className="p-6 bg-[#FAF7F0] border border-[#D8D2C4] animate-pulse space-y-2">
                  <div className="h-4 bg-[#D8D2C4] w-1/4" />
                  <div className="h-6 bg-[#D8D2C4]/60 w-full" />
                  <div className="h-6 bg-[#D8D2C4]/60 w-3/4" />
                </div>
              ) : null}

              {/* Jules Prown's Material-Culture Triad (Description -> Deduction -> Speculation) */}
              <section aria-label="Jules Prown material culture inquiry" className="space-y-4">
                <div className="border-b border-[#D8D2C4] pb-2 flex items-baseline justify-between">
                  <h2 className="font-serif text-2xl font-medium text-[#1C1B18]">
                    Material-Culture Reading
                  </h2>
                  <span className="font-mono text-xs text-[#1C1B18]/60 italic">
                    Jules Prown, 1982
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* Stage 1: Physical Description */}
                  <div className="p-4 bg-[#FAF7F0] border border-[#D8D2C4]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs uppercase tracking-wider text-[#6E2B26] font-semibold">
                        Stage 1 — Description
                      </span>
                      <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 bg-[#1C1B18]/5 text-[#1C1B18]/60 border border-[#D8D2C4]">
                        Observed
                      </span>
                    </div>
                    <p className="text-sm text-[#1C1B18]/85 leading-relaxed font-sans">
                      {observe.description}
                    </p>
                  </div>

                  {/* Stage 2: Cultural Deduction */}
                  {interpret ? (
                    <div className="p-4 bg-[#FAF7F0] border border-[#D8D2C4]">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-xs uppercase tracking-wider text-[#6E2B26] font-semibold">
                          Stage 2 — Deduction
                        </span>
                        <span
                          className={`font-mono text-[9px] uppercase px-1.5 py-0.5 border ${
                            hasGrounding
                              ? 'bg-[#2E6B47]/10 text-[#2E6B47] border-[#2E6B47]/20 font-bold'
                              : 'bg-[#1C1B18]/5 text-[#1C1B18]/60 border-[#D8D2C4]'
                          }`}
                        >
                          {hasGrounding ? 'Sourced' : 'Unsourced'}
                        </span>
                      </div>
                      <p className="text-sm text-[#1C1B18]/85 leading-relaxed font-sans">
                        {interpret.deduction}
                      </p>
                    </div>
                  ) : isInterpreting ? (
                    <div className="p-4 bg-[#FAF7F0] border border-[#D8D2C4] animate-pulse space-y-2">
                      <div className="h-4 bg-[#D8D2C4] w-1/3" />
                      <div className="h-4 bg-[#D8D2C4]/50 w-full" />
                    </div>
                  ) : null}

                  {/* Stage 3: Scholarly Speculation */}
                  {interpret ? (
                    <div className="p-4 bg-[#FAF7F0] border border-[#D8D2C4]">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-xs uppercase tracking-wider text-[#6E2B26] font-semibold">
                          Stage 3 — Speculation & Hypotheses
                        </span>
                        <span
                          className={`font-mono text-[9px] uppercase px-1.5 py-0.5 border ${
                            hasGrounding
                              ? 'bg-[#2E6B47]/10 text-[#2E6B47] border-[#2E6B47]/20 font-bold'
                              : 'bg-[#1C1B18]/5 text-[#1C1B18]/60 border-[#D8D2C4]'
                          }`}
                        >
                          {hasGrounding ? 'Sourced' : 'Unsourced'}
                        </span>
                      </div>
                      <ul className="space-y-2 mt-2">
                        {interpret.speculation.map((bullet, idx) => (
                          <li key={idx} className="text-sm text-[#1C1B18]/85 flex items-start gap-2 font-sans">
                            <span className="text-[#6E2B26] font-mono font-bold select-none">•</span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </section>

              {/* Lineage (Kopytoff Cultural Biography & Kubler Prime Object) */}
              {interpret && interpret.lineage && interpret.lineage.length > 0 && (
                <section aria-label="Cultural biography and technological lineage" className="space-y-4">
                  <div className="border-b border-[#D8D2C4] pb-2 flex items-baseline justify-between">
                    <div>
                      <h2 className="font-serif text-2xl font-medium text-[#1C1B18]">
                        Cultural Biography & Lineage
                      </h2>
                      <p className="font-mono text-xs text-[#1C1B18]/60 mt-0.5">
                        Kopytoff (1986) & Kubler (1962) Prime Object Continuum
                      </p>
                    </div>
                    <span
                      className={`font-mono text-[9px] uppercase px-1.5 py-0.5 border ${
                        hasGrounding
                          ? 'bg-[#2E6B47]/10 text-[#2E6B47] border-[#2E6B47]/20 font-bold'
                          : 'bg-[#1C1B18]/5 text-[#1C1B18]/60 border-[#D8D2C4]'
                      }`}
                    >
                      {hasGrounding ? 'Sourced' : 'Unsourced'}
                    </span>
                  </div>

                  <div className="pt-2">
                    <Timeline lineage={interpret.lineage} />
                  </div>
                </section>
              )}

              {/* Hidden World (Leonard Read "I, Pencil" Commodity History) */}
              {interpret && interpret.hidden_world && interpret.hidden_world.length > 0 && (
                <section aria-label="Leonard Read hidden world of materials" className="space-y-4">
                  <div className="border-b border-[#D8D2C4] pb-2 flex items-baseline justify-between">
                    <div>
                      <h2 className="font-serif text-2xl font-medium text-[#1C1B18]">
                        The Hidden World
                      </h2>
                      <p className="font-mono text-xs text-[#1C1B18]/60 mt-0.5">
                        Commodity genealogy & supply chains (Leonard Read, "I, Pencil")
                      </p>
                    </div>
                    <span
                      className={`font-mono text-[9px] uppercase px-1.5 py-0.5 border ${
                        hasGrounding
                          ? 'bg-[#2E6B47]/10 text-[#2E6B47] border-[#2E6B47]/20 font-bold'
                          : 'bg-[#1C1B18]/5 text-[#1C1B18]/60 border-[#D8D2C4]'
                      }`}
                    >
                      {hasGrounding ? 'Sourced' : 'Unsourced'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {interpret.hidden_world.map((item, idx) => (
                      <article key={idx} className="p-4 bg-[#FAF7F0] border border-[#D8D2C4] flex flex-col justify-between">
                        <div>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[#6E2B26] font-semibold">
                            {item.material}
                          </span>
                          <p className="font-mono text-xs text-[#1C1B18]/70 mt-0.5 flex items-center gap-1">
                            <Globe className="w-3 h-3 text-[#1C1B18]/40" />
                            <span>{item.from_where}</span>
                          </p>
                          <p className="text-xs text-[#1C1B18]/85 mt-2 leading-relaxed font-sans">
                            {item.story}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* Myth vs. Record (Wineburg Historical Thinking) */}
              {interpret && interpret.myth_vs_record && interpret.myth_vs_record.length > 0 && (
                <section aria-label="Myth vs archival record" className="space-y-4">
                  <div className="border-b border-[#D8D2C4] pb-2 flex items-baseline justify-between">
                    <div>
                      <h2 className="font-serif text-2xl font-medium text-[#1C1B18]">
                        Myth vs. Record
                      </h2>
                      <p className="font-mono text-xs text-[#1C1B18]/60 mt-0.5">
                        Historical thinking, sourcing & corroboration (Wineburg)
                      </p>
                    </div>
                    <span
                      className={`font-mono text-[9px] uppercase px-1.5 py-0.5 border ${
                        hasGrounding
                          ? 'bg-[#2E6B47]/10 text-[#2E6B47] border-[#2E6B47]/20 font-bold'
                          : 'bg-[#1C1B18]/5 text-[#1C1B18]/60 border-[#D8D2C4]'
                      }`}
                    >
                      {hasGrounding ? 'Sourced' : 'Unsourced'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {interpret.myth_vs_record.map((item, idx) => (
                      <div key={idx} className="p-4 bg-[#FAF7F0] border border-[#D8D2C4] space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="font-mono text-[10px] uppercase font-bold text-[#A84239] px-1.5 py-0.5 bg-[#A84239]/10">
                            Myth
                          </span>
                          <p className="text-xs text-[#1C1B18]/80 italic font-sans flex-1">
                            "{item.myth}"
                          </p>
                        </div>
                        <div className="flex items-start gap-2 pt-2 border-t border-[#D8D2C4]/50">
                          <span className="font-mono text-[10px] uppercase font-bold text-[#2E6B47] px-1.5 py-0.5 bg-[#2E6B47]/10">
                            Record
                          </span>
                          <p className="text-xs text-[#1C1B18] font-sans flex-1">
                            {item.record}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Place Layers (for Buildings with Location) */}
              {interpret && interpret.place_layers && interpret.place_layers.length > 0 && (
                <section aria-label="Historical layers of this place" className="space-y-4">
                  <div className="border-b border-[#D8D2C4] pb-2 flex items-baseline justify-between">
                    <div>
                      <h2 className="font-serif text-2xl font-medium text-[#1C1B18]">
                        Layers of This Place
                      </h2>
                      <p className="font-mono text-xs text-[#1C1B18]/60 mt-0.5">
                        Spatial archaeology & architectural palimpsest
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {interpret.place_layers.map((layer, idx) => (
                      <div key={idx} className="p-3 bg-[#FAF7F0] border border-[#D8D2C4] flex items-baseline justify-between gap-4">
                        <span className="font-mono text-xs font-semibold text-[#6E2B26] shrink-0">
                          {layer.period}
                        </span>
                        <span className="text-xs text-[#1C1B18]/85 text-right font-sans">
                          {layer.what_was_here}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Freeman Tilden Provocation (Set apart, large serif italic) */}
              {interpret && interpret.provocation && (
                <section
                  aria-label="Freeman Tilden curatorial provocation"
                  className="py-10 px-6 my-6 text-center border-y-2 border-[#D8D2C4] bg-[#FAF7F0]/60"
                >
                  <div className="flex items-center justify-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-[#6E2B26] mb-3">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Freeman Tilden Provocation</span>
                  </div>
                  <blockquote className="font-serif italic text-2xl md:text-3xl text-[#1C1B18] leading-relaxed max-w-lg mx-auto">
                    "{interpret.provocation}"
                  </blockquote>
                  <p className="font-mono text-[11px] text-[#1C1B18]/50 mt-3 uppercase tracking-wider">
                    Provocation, not instruction — a question to sit with.
                  </p>
                </section>
              )}

              {/* Sourcing & Corroboration */}
              {interpret && (
                <section aria-label="Corroborated sources" className="pt-2 border-t border-[#D8D2C4] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono text-[11px] text-[#1C1B18]/60 uppercase tracking-wider">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#2E6B47]" />
                      <span>{interpret.isUnsourced ? 'Source Corroboration' : 'Corroborated Archival & Search Sources'}</span>
                    </div>
                  </div>

                  {/* Visible Grounding: Search Queries Executed */}
                  {interpret.searchQueries && interpret.searchQueries.length > 0 && (
                    <div className="p-2.5 bg-[#FAF7F0] border border-[#D8D2C4]/80 space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#1C1B18]/60 uppercase tracking-wider">
                        <Search className="w-3 h-3 text-[#6E2B26]" />
                        <span>Google Search Queries Executed:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {interpret.searchQueries.map((q, idx) => (
                          <span
                            key={idx}
                            className="font-mono text-[11px] text-[#1C1B18]/85 px-1.5 py-0.5 bg-[#F2EEE5] border border-[#D8D2C4]"
                          >
                            Searched: {q}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {interpret.isUnsourced ? (
                    <p className="font-mono text-xs text-[#1C1B18]/60 italic">
                      Unsourced reading (grounding search tool unavailable or omitted on fallback model)
                    </p>
                  ) : interpret.sources && interpret.sources.length > 0 ? (
                    <ul className="space-y-1.5 font-mono text-xs">
                      {interpret.sources.map((src, idx) => (
                        <li key={idx}>
                          <a
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[#6E2B26] hover:underline"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-md">{src.title}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              )}

              {/* Graceful Fallback / Retry UI if Call 2 failed */}
              {interpretError && !interpret && (
                <div className="p-5 bg-[#FAF7F0] border border-[#6E2B26]/30 text-center space-y-3">
                  <AlertCircle className="w-6 h-6 text-[#6E2B26] mx-auto" />
                  <p className="text-xs text-[#1C1B18]/80 font-sans">
                    {mapCuratorialErrorMessage(interpretError)}
                  </p>
                  {onRetryInterpret && (
                    <button
                      onClick={onRetryInterpret}
                      className="px-4 py-2 bg-[#6E2B26] text-white font-mono text-xs uppercase tracking-wider inline-flex items-center gap-2 hover:bg-[#58221E] transition-colors min-h-[44px] cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry In-Depth Interpretation</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Model Attribution Footer */}
          {modelUsed && (
            <footer className="pt-4 border-t border-[#D8D2C4]/60 flex items-center justify-between text-xs font-mono text-[#1C1B18]/50">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                <span>Read by {modelUsed}</span>
              </span>
              <span>PROVENANCE RUNTIME</span>
            </footer>
          )}
        </div>
      </main>

      {/* Sticky Bottom Actions: New Scan & Cabinet Buttons */}
      <nav aria-label="Exhibit bottom navigation" className="fixed bottom-0 left-0 right-0 z-30 bg-[#F2EEE5]/95 backdrop-blur-md border-t border-[#D8D2C4] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-3 px-4 bg-[#FAF7F0] border border-[#D8D2C4] text-[#1C1B18] font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#EDE7DA] min-h-[44px] transition-colors cursor-pointer"
          >
            <span>Cabinet</span>
          </button>
          <button
            onClick={onNewScan}
            className="flex-1 py-3 px-4 bg-[#6E2B26] text-white font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#58221E] active:scale-98 min-h-[44px] shadow-sm transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>New Scan</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
