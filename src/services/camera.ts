/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Camera and image preprocessing service.
 * Handles rear-camera stream acquisition, frame capture, EXIF orientation rendering,
 * and high-efficiency downscaling for fast multi-stage Gemini processing.
 */

export interface CameraStreamResult {
  stream: MediaStream;
  videoTrack: MediaStreamTrack;
}

/**
 * Requests the device's rear environment camera.
 */
export async function startCamera(): Promise<CameraStreamResult> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Camera access is not supported by this browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  });

  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) {
    throw new Error('No video track available from camera.');
  }

  return { stream, videoTrack };
}

/**
 * Stops all tracks in a media stream.
 */
export function stopCamera(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Ignore errors when stopping
    }
  });
}

/**
 * Captures the current video frame to a downscaled, compressed JPEG base64 string.
 * Resizes max edge to 1280px at 0.85 quality.
 */
export function captureVideoFrame(
  video: HTMLVideoElement,
  maxEdge = 1280,
  quality = 0.85
): {
  base64: string;
  width: number;
  height: number;
} {
  const naturalWidth = video.videoWidth || 640;
  const naturalHeight = video.videoHeight || 480;

  let targetWidth = naturalWidth;
  let targetHeight = naturalHeight;

  if (targetWidth > targetHeight) {
    if (targetWidth > maxEdge) {
      targetHeight = Math.round((targetHeight * maxEdge) / targetWidth);
      targetWidth = maxEdge;
    }
  } else {
    if (targetHeight > maxEdge) {
      targetWidth = Math.round((targetWidth * maxEdge) / targetHeight);
      targetHeight = maxEdge;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available.');
  }

  ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);

  return {
    base64: dataUrl,
    width: targetWidth,
    height: targetHeight,
  };
}

/**
 * Processes a File or Blob from `<input type="file">` by drawing it to an offscreen
 * Image and Canvas to respect native EXIF orientation and downscale to max 1280px.
 */
export function processImageFile(
  file: File | Blob,
  maxEdge = 1280,
  quality = 0.85
): Promise<{
  base64: string;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image into memory.'));
      img.onload = () => {
        let targetWidth = img.naturalWidth || img.width;
        let targetHeight = img.naturalHeight || img.height;

        if (targetWidth > targetHeight) {
          if (targetWidth > maxEdge) {
            targetHeight = Math.round((targetHeight * maxEdge) / targetWidth);
            targetWidth = maxEdge;
          }
        } else {
          if (targetHeight > maxEdge) {
            targetWidth = Math.round((targetWidth * maxEdge) / targetHeight);
            targetHeight = maxEdge;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get 2D rendering context.'));
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({
          base64: dataUrl,
          width: targetWidth,
          height: targetHeight,
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Resizes an existing base64 image string to specific dimensions and JPEG quality.
 */
export function resizeBase64Image(
  dataUrl: string,
  maxEdge: number,
  quality: number
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let targetWidth = img.naturalWidth;
      let targetHeight = img.naturalHeight;

      if (targetWidth > targetHeight) {
        if (targetWidth > maxEdge) {
          targetHeight = Math.round((targetHeight * maxEdge) / targetWidth);
          targetWidth = maxEdge;
        }
      } else {
        if (targetHeight > maxEdge) {
          targetWidth = Math.round((targetWidth * maxEdge) / targetHeight);
          targetHeight = maxEdge;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
