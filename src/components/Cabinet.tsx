/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { ExhibitRecord } from '../types.ts';
import { deleteExhibit } from '../services/storage.ts';
import { Camera, Trash2, Calendar, BookOpen, Layers } from 'lucide-react';

interface CabinetProps {
  exhibits: ExhibitRecord[];
  onSelectExhibit: (exhibit: ExhibitRecord) => void;
  onNewScan: () => void;
  onOpenMethod: () => void;
  onExhibitsChange: (updated: ExhibitRecord[]) => void;
}

export const Cabinet: React.FC<CabinetProps> = ({
  exhibits,
  onSelectExhibit,
  onNewScan,
  onOpenMethod,
  onExhibitsChange,
}) => {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = deleteExhibit(id);
    onExhibitsChange(updated);
    setDeleteConfirmId(null);
  };

  return (
    <div className="min-h-screen bg-[#F2EEE5] text-[#1C1B18] px-4 py-6 md:py-10 max-w-2xl mx-auto flex flex-col justify-between">
      <div>
        {/* Top bar */}
        <header className="flex items-center justify-between pb-4 border-b border-[#D8D2C4]">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-[#6E2B26] font-semibold">
                Cabinet of Curiosities
              </span>
            </div>
            <h1 className="font-serif text-3xl font-medium mt-1">
              Your Cabinet
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenMethod}
              aria-label="View Provenance Method"
              className="p-2.5 text-[#1C1B18]/70 hover:text-[#6E2B26] border border-[#D8D2C4] bg-[#FAF7F0] min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
              title="Methodology"
            >
              <BookOpen className="w-5 h-5" />
            </button>
            <button
              onClick={onNewScan}
              aria-label="Open Camera Viewfinder to scan an object"
              className="flex items-center gap-1.5 px-3 py-2 bg-[#1C1B18] text-[#F2EEE5] hover:bg-[#33322E] min-h-[44px] font-mono text-xs uppercase tracking-wider transition-colors"
            >
              <Camera className="w-4 h-4 text-white" />
              <span>Scan</span>
            </button>
          </div>
        </header>

        {/* Catalog stats */}
        <div className="my-4 flex items-center justify-between font-mono text-xs text-[#1C1B18]/60">
          <span>{exhibits.length} {exhibits.length === 1 ? 'Specimen' : 'Specimens'} Cataloged</span>
          <span>Archival Format: YYYY.MM.N</span>
        </div>

        {/* Grid of Exhibits or Quiet Empty State */}
        {exhibits.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-[#D8D2C4] bg-[#FAF7F0] p-8 my-6">
            <Layers className="w-8 h-8 mx-auto text-[#6E2B26]/60 mb-4" />
            <h2 className="font-serif text-2xl font-medium text-[#1C1B18] max-w-md mx-auto leading-snug">
              Your cabinet is empty.
            </h2>
            <p className="mt-3 text-sm text-[#1C1B18]/75 max-w-sm mx-auto font-serif italic">
              "Every object has a history; begin with the one nearest you."
            </p>
            <button
              onClick={onNewScan}
              className="mt-8 px-6 py-3 bg-[#6E2B26] text-white font-mono text-xs uppercase tracking-wider inline-flex items-center gap-2 hover:bg-[#58221E] transition-colors shadow-xs"
            >
              <Camera className="w-4 h-4" />
              <span>Scan First Specimen</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-12">
            {exhibits.map((item) => {
              const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '';
              const isConfirming = deleteConfirmId === item.id;

              return (
                <article
                  key={item.id}
                  onClick={() => onSelectExhibit(item)}
                  className="group cursor-pointer bg-[#FAF7F0] border border-[#D8D2C4] hover:border-[#6E2B26] transition-all flex flex-col justify-between relative shadow-2xs"
                >
                  {/* Thumbnail Container */}
                  <div className="relative aspect-4/3 w-full bg-[#1C1B18] overflow-hidden border-b border-[#D8D2C4]">
                    <img
                      src={item.imageThumbnail || item.imageFull}
                      alt={item.observe?.tombstone?.title || 'Cataloged specimen'}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                    />

                    {/* Accession tag */}
                    <div className="absolute top-2 left-2 bg-[#1C1B18]/85 text-[#F2EEE5] font-mono text-[10px] px-2 py-0.5 tracking-widest backdrop-blur-xs">
                      {item.accessionNumber}
                    </div>

                    {/* Confidence badge */}
                    <div className="absolute top-2 right-2 bg-[#FAF7F0]/90 text-[#6E2B26] border border-[#D8D2C4] font-mono text-[9px] px-1.5 py-0.5 uppercase tracking-wider font-semibold">
                      {item.observe?.identification_confidence || 'Medium'} Conf.
                    </div>
                  </div>

                  {/* Placard Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <span className="font-mono text-[10px] text-[#1C1B18]/60 uppercase tracking-widest">
                        {item.observe?.kind || 'Object'} / {item.observe?.tombstone?.classification || 'Material Culture'}
                      </span>
                      <h2 className="font-serif text-lg font-medium text-[#1C1B18] mt-1 group-hover:text-[#6E2B26] transition-colors line-clamp-2">
                        {item.observe?.tombstone?.title || 'Untitled Specimen'}
                      </h2>
                      <p className="font-mono text-xs text-[#1C1B18]/70 mt-1 line-clamp-1">
                        {item.observe?.tombstone?.maker} ({item.observe?.tombstone?.date})
                      </p>
                    </div>

                    {/* Footer with date & delete button */}
                    <div className="mt-4 pt-3 border-t border-[#D8D2C4]/60 flex items-center justify-between text-[11px] font-mono text-[#1C1B18]/60">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#1C1B18]/40" />
                        <span>{dateStr}</span>
                      </div>

                      {isConfirming ? (
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[#6E2B26] font-bold">Remove?</span>
                          <button
                            onClick={(e) => handleDelete(e, item.id)}
                            aria-label={`Confirm delete ${item.observe?.tombstone?.title}`}
                            className="text-[#6E2B26] underline font-bold px-1 py-0.5"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            aria-label="Cancel delete"
                            className="text-[#1C1B18]/70 px-1 py-0.5"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(item.id);
                          }}
                          aria-label={`Delete ${item.observe?.tombstone?.title}`}
                          className="p-1 text-[#1C1B18]/40 hover:text-[#6E2B26] transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                          title="Delete from Cabinet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Persistent Scan button at bottom on mobile */}
      <div className="sticky bottom-4 pt-4 border-t border-[#D8D2C4]/80 bg-[#F2EEE5]/95 backdrop-blur-xs flex items-center justify-between gap-3">
        <button
          onClick={onNewScan}
          className="flex-1 py-3 px-4 bg-[#6E2B26] text-white font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#58221E] active:scale-98 transition-all min-h-[44px] shadow-sm"
        >
          <Camera className="w-4 h-4" />
          <span>Point Camera at New Object</span>
        </button>
      </div>
    </div>
  );
};
