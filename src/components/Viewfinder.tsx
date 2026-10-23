/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  startCamera,
  stopCamera,
  captureVideoFrame,
  processImageFile,
} from '../services/camera.ts';
import type { GeoLocationState } from '../types.ts';
import {
  Camera,
  Image as ImageIcon,
  BookOpen,
  Archive,
  Compass,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';

interface ViewfinderProps {
  cabinetCount: number;
  locationState?: GeoLocationState;
  onCapture: (captured: { base64: string }) => void;
  onOpenCabinet: () => void;
  onOpenMethod: () => void;
}

export const Viewfinder: React.FC<ViewfinderProps> = ({
  cabinetCount,
  locationState,
  onCapture,
  onOpenCabinet,
  onOpenMethod,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(true);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);

  // Initialize camera with 8-second timeout notice (does not discard late stream)
  const initCamera = useCallback(async () => {
    setCameraError(null);
    setIsStartingCamera(true);
    setAutoplayBlocked(false);

    if (streamRef.current) {
      stopCamera(streamRef.current);
      streamRef.current = null;
    }

    const timeoutId = setTimeout(() => {
      setIsStartingCamera(false);
      // Show unavailable panel with fallback if camera has not activated yet,
      // but do NOT abort or stop a stream that might resolve after 8s
      if (!streamRef.current) {
        setCameraError(
          'Camera feed did not start or permission was pending. You can use the photo button below to capture or select an image directly.'
        );
      }
    }, 8000);

    try {
      const { stream } = await startCamera();
      clearTimeout(timeoutId);

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
          setAutoplayBlocked(false);
        } catch (playErr) {
          console.warn('Autoplay blocked:', playErr);
          setAutoplayBlocked(true);
        }
      }
      setCameraActive(true);
      setIsStartingCamera(false);
      setCameraError(null);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      setIsStartingCamera(false);
      setCameraActive(false);

      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission') || msg.includes('NotAllowedError')) {
        setCameraError(
          'Camera access was denied. To enable live scanning, allow camera permissions in your browser, or use the photo button below.'
        );
      } else {
        setCameraError(
          'Live camera feed is unavailable on this device or session. You can use the photo picker button below to capture or select an image.'
        );
      }
    }
  }, []);

  // Safety net: re-attach stream to video element whenever cameraActive becomes true
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch((playErr) => {
        console.warn('Re-attached play blocked:', playErr);
        setAutoplayBlocked(true);
      });
    }
  }, [cameraActive]);

  // Camera lifecycle: start on mount, stop on unmount or tab hide
  useEffect(() => {
    initCamera();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (streamRef.current) {
          stopCamera(streamRef.current);
          streamRef.current = null;
          setCameraActive(false);
        }
      } else if (document.visibilityState === 'visible') {
        initCamera();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (streamRef.current) {
        stopCamera(streamRef.current);
        streamRef.current = null;
      }
    };
  }, [initCamera]);

  // Shutter action
  const handleShutter = () => {
    if (!videoRef.current || !cameraActive || isCapturing) return;

    // Fall back to opening the file input instead of capturing a blank frame
    if (videoRef.current.videoWidth === 0) {
      fileInputRef.current?.click();
      return;
    }

    setIsCapturing(true);

    try {
      const { base64 } = captureVideoFrame(videoRef.current, 1280, 0.85);
      onCapture({ base64 });
    } catch (err) {
      console.error('Shutter frame capture failed:', err);
      setIsCapturing(false);
    }
  };

  // Fallback file input change
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCapturing(true);

    try {
      const { base64 } = await processImageFile(file, 1280, 0.85);
      onCapture({ base64 });
    } catch (err) {
      console.error('File process failed:', err);
      alert('Could not process the selected image. Please try another.');
      setIsCapturing(false);
    }
  };

  return (
    <div className="relative w-full h-[100dvh] bg-black text-[#F2EEE5] overflow-hidden flex flex-col justify-between select-none">
      {/* Hidden File Input for Fallback / Standard Mobile Capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        id="provenance-file-capture"
      />

      {/* Camera Video Surface or Fallback */}
      <div className="absolute inset-0 z-0 bg-[#121110] flex items-center justify-center overflow-hidden">
        {/* Always rendered in DOM to guarantee ref is attached */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            cameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* Autoplay blocked overlay button */}
        {cameraActive && autoplayBlocked && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <button
              onClick={async () => {
                if (videoRef.current) {
                  try {
                    await videoRef.current.play();
                    setAutoplayBlocked(false);
                  } catch (e) {
                    console.error('Manual start tap failed:', e);
                  }
                }
              }}
              className="py-3 px-6 bg-[#6E2B26] text-white font-mono text-xs uppercase tracking-wider rounded shadow-lg flex items-center justify-center gap-2 hover:bg-[#8B3730] transition-colors min-h-[48px]"
            >
              <Camera className="w-4 h-4" />
              <span>Tap to start camera</span>
            </button>
          </div>
        )}

        {/* Error or Starting Panels rendered on top when camera is inactive */}
        {!cameraActive && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-[#121110]/90">
            <div className="text-center max-w-sm mx-auto">
              {cameraError ? (
                <div className="bg-[#242321]/95 border border-[#6E2B26] p-5 backdrop-blur-md">
                  <AlertTriangle className="w-8 h-8 text-[#E57373] mx-auto mb-3" />
                  <h3 className="font-serif text-lg font-medium text-white mb-2">
                    Camera Unavailable
                  </h3>
                  <p className="text-xs text-[#F2EEE5]/80 leading-relaxed font-sans mb-4">
                    {cameraError}
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-3 px-4 bg-[#6E2B26] text-white font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#8B3730] transition-colors min-h-[44px]"
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span>Choose or Take Photo</span>
                    </button>
                    <button
                      onClick={initCamera}
                      className="w-full py-2.5 px-4 bg-white/10 text-white font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-white/20 transition-colors min-h-[44px]"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Retry Camera</span>
                    </button>
                  </div>
                </div>
              ) : isStartingCamera ? (
                <div className="space-y-3">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-[#6E2B26] rounded-full animate-spin mx-auto" />
                  <p className="font-mono text-xs uppercase tracking-widest text-[#F2EEE5]/70">
                    Starting Viewfinder...
                  </p>
                  <p className="font-sans text-[11px] text-[#F2EEE5]/50 mb-3">
                    Or tap "Photo" below to scan immediately
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2 px-4 bg-white/10 border border-white/20 text-[#F2EEE5] font-mono text-xs uppercase tracking-wider hover:bg-white/20 transition-colors min-h-[40px]"
                  >
                    Choose Photo Now
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Framing Reticle Overlay */}
        {cameraActive && (
          <div className="absolute inset-10 md:inset-20 border border-white/20 pointer-events-none flex flex-col justify-between p-2">
            <div className="flex justify-between">
              <div className="w-4 h-4 border-t-2 border-l-2 border-white/60" />
              <div className="w-4 h-4 border-t-2 border-r-2 border-white/60" />
            </div>
            <div className="flex justify-between">
              <div className="w-4 h-4 border-b-2 border-l-2 border-white/60" />
              <div className="w-4 h-4 border-b-2 border-r-2 border-white/60" />
            </div>
          </div>
        )}
      </div>

      {/* Top Controls Overlay */}
      <header className="relative z-20 px-4 pt-4 md:pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-serif text-xl tracking-wide font-bold drop-shadow-md text-[#F2EEE5]">
            Provenance
          </span>
          {/* Location Status Pill */}
          <div className="px-2.5 py-1 bg-black/50 backdrop-blur-md border border-white/20 rounded-full font-mono text-[10px] uppercase tracking-wider text-[#F2EEE5]/90 flex items-center gap-1.5 shadow-sm">
            <Compass className={`w-3 h-3 ${locationState?.latitude ? 'text-[#6E2B26]' : 'text-white/40'}`} />
            <span>{locationState?.label || 'Location ready'}</span>
          </div>
        </div>

        {/* Top Right: Method & Cabinet Icons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenMethod}
            aria-label="Provenance Method and Academic Framework"
            className="p-2.5 bg-black/50 backdrop-blur-md border border-white/20 hover:bg-black/70 text-[#F2EEE5] rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
            title="Academic Methodology"
          >
            <BookOpen className="w-4 h-4 text-[#F2EEE5]" />
          </button>

          <button
            onClick={onOpenCabinet}
            aria-label={`Open Cabinet of Curiosities (${cabinetCount} items)`}
            className="relative p-2.5 bg-black/50 backdrop-blur-md border border-white/20 hover:bg-black/70 text-[#F2EEE5] rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
            title="Cabinet of Curiosities"
          >
            <Archive className="w-4 h-4 text-[#F2EEE5]" />
            {cabinetCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-[#6E2B26] text-white font-mono text-[9px] rounded-full font-bold">
                {cabinetCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Bottom Controls Overlay */}
      <footer className="relative z-20 px-4 pb-8 md:pb-10 pt-4 flex flex-col items-center gap-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        {/* Shutter and Fallback Row */}
        <div className="w-full max-w-sm flex items-center justify-between px-4">
          {/* Always Accessible Fallback Photo Picker */}
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="Choose or take photo from library"
            className="flex flex-col items-center gap-1 text-[#F2EEE5]/80 hover:text-white p-2 min-h-[44px] min-w-[44px] transition-colors cursor-pointer"
          >
            <div className="p-3 bg-black/50 backdrop-blur-md border border-white/20 rounded-full hover:border-white transition-colors">
              <ImageIcon className="w-5 h-5" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider">Photo</span>
          </button>

          {/* Large Shutter Button */}
          <button
            onClick={handleShutter}
            disabled={!cameraActive || isCapturing}
            aria-label="Capture specimen photo"
            className="group relative flex items-center justify-center p-2 min-h-[72px] min-w-[72px] disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:scale-95"
          >
            {/* Outer Ring */}
            <div className="w-[72px] h-[72px] rounded-full border-4 border-white/80 group-hover:border-white transition-all flex items-center justify-center">
              {/* Inner Oxblood Disc */}
              <div
                className={`w-[56px] h-[56px] rounded-full bg-[#6E2B26] group-hover:bg-[#8B3730] transition-all ${
                  isCapturing ? 'scale-75 animate-pulse' : 'scale-100'
                }`}
              />
            </div>
          </button>

          {/* Cabinet Quick Access */}
          <button
            onClick={onOpenCabinet}
            aria-label="View Saved Specimens in Cabinet"
            className="flex flex-col items-center gap-1 text-[#F2EEE5]/80 hover:text-white p-2 min-h-[44px] min-w-[44px] transition-colors cursor-pointer"
          >
            <div className="p-3 bg-black/50 backdrop-blur-md border border-white/20 rounded-full hover:border-white transition-colors">
              <Archive className="w-5 h-5" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider">Cabinet</span>
          </button>
        </div>

        <p className="font-serif italic text-xs text-[#F2EEE5]/70 text-center">
          "Every object has a history."
        </p>
      </footer>
    </div>
  );
};
