/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import type {
  AppView,
  ExhibitRecord,
  ObserveResponse,
  InterpretResponse,
  GeoLocationState,
} from './types.ts';
import { Viewfinder } from './components/Viewfinder.tsx';
import { LookScreen } from './components/LookScreen.tsx';
import { Exhibit } from './components/Exhibit.tsx';
import { Cabinet } from './components/Cabinet.tsx';
import { MethodScreen } from './components/MethodScreen.tsx';
import { observeSpecimen, interpretSpecimen } from './services/gemini.ts';
import {
  getSavedExhibits,
  saveExhibit,
  generateNextAccessionNumber,
} from './services/storage.ts';
import { speechService } from './services/speech.ts';
import { getDeviceLocationWithTimeout } from './services/location.ts';
import { shouldGateConfidence } from './utils/pure-logic.ts';

export default function App() {
  const [view, setView] = useState<AppView>('viewfinder');
  const [cabinet, setCabinet] = useState<ExhibitRecord[]>([]);

  // Capture & Scanning State
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<GeoLocationState | undefined>(undefined);

  // Call 1 (Observe) State
  const [isObserving, setIsObserving] = useState<boolean>(false);
  const [observeData, setObserveData] = useState<ObserveResponse | null>(null);
  const [observeError, setObserveError] = useState<string | null>(null);

  // Call 2 (Interpret) State
  const [isInterpreting, setIsInterpreting] = useState<boolean>(false);
  const [interpretPhase, setInterpretPhase] = useState<string | null>(null);
  const [interpretData, setInterpretData] = useState<InterpretResponse | null>(null);
  const [interpretError, setInterpretError] = useState<string | null>(null);

  // Active Exhibit (from Cabinet or current scan)
  const [activeExhibit, setActiveExhibit] = useState<ExhibitRecord | null>(null);

  // Load cabinet on mount (starts empty)
  useEffect(() => {
    const saved = getSavedExhibits();
    setCabinet(saved);

    // Support ?view=cabinet
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'cabinet') {
      setView('cabinet');
    }
  }, []);

  // Cancel speech on view transition
  const navigateTo = useCallback((nextView: AppView) => {
    speechService.stop();
    setView(nextView);
  }, []);

  // Trigger Call 2 (Interpret) with streaming progress
  const triggerInterpret = useCallback(
    async (
      photo: string,
      obs: ObserveResponse,
      loc?: GeoLocationState,
      currentRecord?: ExhibitRecord
    ) => {
      setIsInterpreting(true);
      setInterpretPhase('Researching sources and history...');
      setInterpretError(null);

      try {
        const interpretResult = await interpretSpecimen(
          {
            imageBase64: photo,
            observe: obs,
            location: loc,
          },
          (phase) => {
            setInterpretPhase(phase);
          }
        );

        setInterpretData(interpretResult);
        setIsInterpreting(false);
        setInterpretPhase(null);

        // Update the active exhibit with Call 2 results
        if (currentRecord) {
          const completedExhibit: ExhibitRecord = {
            ...currentRecord,
            interpret: interpretResult,
            modelUsed: interpretResult.modelUsed || currentRecord.modelUsed,
          };
          setActiveExhibit(completedExhibit);
          await saveExhibit(completedExhibit);
          setCabinet(getSavedExhibits());
        }
      } catch (err: unknown) {
        console.warn('Interpret call error:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setInterpretError(msg);
        setIsInterpreting(false);
        setInterpretPhase(null);
      }
    },
    []
  );

  // Trigger Call 1 (Observe) on captured photo
  // Request geolocation only on shutter tap, racing 4s max to never block scan
  const handleCapture = useCallback(
    async ({ base64 }: { base64: string }) => {
      setCurrentPhoto(base64);
      setObserveData(null);
      setObserveError(null);
      setInterpretData(null);
      setInterpretError(null);
      setInterpretPhase(null);
      setIsObserving(true);
      setActiveExhibit(null);

      setView('look');

      // Request geolocation in parallel without blocking scan
      let location: GeoLocationState | undefined = currentLocation;
      try {
        location = await getDeviceLocationWithTimeout(4000);
        setCurrentLocation(location);
      } catch {
        // Continue silently without location
      }

      try {
        const obs = await observeSpecimen({
          imageBase64: base64,
          location,
        });

        setObserveData(obs);
        setIsObserving(false);

        // Pre-create accession number and draft exhibit record
        const nextAccession = generateNextAccessionNumber();
        const isGated = shouldGateConfidence(obs);

        const draftExhibit: ExhibitRecord = {
          id: `scan-${Date.now()}`,
          accessionNumber: nextAccession,
          createdAt: new Date().toISOString(),
          imageThumbnail: base64,
          imageFull: base64,
          observe: obs,
          location,
          modelUsed: obs.modelUsed,
          isConfidenceGated: isGated,
        };

        setActiveExhibit(draftExhibit);
        await saveExhibit(draftExhibit);
        setCabinet(getSavedExhibits());

        // Confidence Gating: if Low confidence or unknown, skip Interpret entirely!
        if (!isGated) {
          triggerInterpret(base64, obs, location, draftExhibit);
        }
      } catch (err: unknown) {
        console.error('Observe call failed:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setObserveError(msg);
        setIsObserving(false);
      }
    },
    [currentLocation, triggerInterpret]
  );

  // User taps "Reveal Exhibit" on LookScreen
  const handleReveal = () => {
    if (activeExhibit) {
      navigateTo('exhibit');
    }
  };

  // Retake photo: return to viewfinder
  const handleRetake = () => {
    setCurrentPhoto(null);
    setObserveData(null);
    setObserveError(null);
    setInterpretData(null);
    setInterpretError(null);
    setInterpretPhase(null);
    setActiveExhibit(null);
    navigateTo('viewfinder');
  };

  // Retry Call 1
  const handleRetryObserve = () => {
    if (currentPhoto) {
      handleCapture({ base64: currentPhoto });
    }
  };

  // Retry Call 2
  const handleRetryInterpret = () => {
    if (currentPhoto && observeData && activeExhibit && !shouldGateConfidence(observeData)) {
      triggerInterpret(currentPhoto, observeData, currentLocation, activeExhibit);
    }
  };

  // Open an exhibit from the Cabinet
  const handleSelectExhibit = (exhibit: ExhibitRecord) => {
    setActiveExhibit(exhibit);
    navigateTo('exhibit');
  };

  return (
    <div className="min-h-screen bg-[#F2EEE5] text-[#1C1B18] font-sans">
      {view === 'viewfinder' && (
        <Viewfinder
          cabinetCount={cabinet.length}
          locationState={currentLocation}
          onCapture={handleCapture}
          onOpenCabinet={() => navigateTo('cabinet')}
          onOpenMethod={() => navigateTo('method')}
        />
      )}

      {view === 'look' && (
        <LookScreen
          imageSrc={currentPhoto || ''}
          isObserving={isObserving}
          observeData={observeData}
          observeError={observeError}
          onReveal={handleReveal}
          onRetake={handleRetake}
          onRetry={handleRetryObserve}
        />
      )}

      {view === 'exhibit' && activeExhibit && (
        <Exhibit
          exhibit={activeExhibit}
          isInterpreting={isInterpreting}
          interpretPhase={interpretPhase}
          interpretError={interpretError}
          onRetryInterpret={handleRetryInterpret}
          onBack={() => navigateTo('cabinet')}
          onNewScan={() => navigateTo('viewfinder')}
        />
      )}

      {view === 'cabinet' && (
        <Cabinet
          exhibits={cabinet}
          onSelectExhibit={handleSelectExhibit}
          onNewScan={() => navigateTo('viewfinder')}
          onOpenMethod={() => navigateTo('method')}
          onExhibitsChange={(updated) => setCabinet(updated)}
        />
      )}

      {view === 'method' && (
        <MethodScreen onBack={() => navigateTo('viewfinder')} />
      )}
    </div>
  );
}
