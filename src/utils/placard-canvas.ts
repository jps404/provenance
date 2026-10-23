/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ExhibitRecord } from '../types.ts';

/**
 * Renders an archival museum placard image to a canvas and triggers
 * native mobile sharing (navigator.share) or PNG download.
 */
export async function sharePlacard(exhibit: ExhibitRecord): Promise<void> {
  const canvas = document.createElement('canvas');
  const width = 1080;
  const height = 1350;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Warm gallery paper background
  ctx.fillStyle = '#F2EEE5';
  ctx.fillRect(0, 0, width, height);

  // 2. Hairline inner frame
  ctx.strokeStyle = '#D8D2C4';
  ctx.lineWidth = 4;
  ctx.strokeRect(36, 36, width - 72, height - 72);

  // 3. Header: Provenance wordmark & Accession Number
  ctx.fillStyle = '#6E2B26';
  ctx.font = 'bold 24px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('PROVENANCE', 60, 80);

  ctx.fillStyle = '#1C1B18';
  ctx.font = '500 20px "IBM Plex Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`ACCESSION ${exhibit.accessionNumber}`, width - 60, 80);

  // Divider
  ctx.beginPath();
  ctx.moveTo(60, 100);
  ctx.lineTo(width - 60, 100);
  ctx.strokeStyle = '#D8D2C4';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 4. Specimen Image
  const photo = new Image();
  photo.crossOrigin = 'anonymous';

  await new Promise<void>((resolve) => {
    photo.onload = () => resolve();
    photo.onerror = () => resolve();
    photo.src = exhibit.imageFull || exhibit.imageThumbnail;
  });

  const photoAreaX = 60;
  const photoAreaY = 124;
  const photoAreaW = width - 120;
  const photoAreaH = 620;

  ctx.fillStyle = '#1C1B18';
  ctx.fillRect(photoAreaX, photoAreaY, photoAreaW, photoAreaH);

  if (photo.width > 0 && photo.height > 0) {
    const scale = Math.min(photoAreaW / photo.width, photoAreaH / photo.height);
    const sw = photo.width * scale;
    const sh = photo.height * scale;
    const sx = photoAreaX + (photoAreaW - sw) / 2;
    const sy = photoAreaY + (photoAreaH - sh) / 2;
    ctx.drawImage(photo, sx, sy, sw, sh);
  }

  // 5. Specimen Classification & Confidence
  const tomb = exhibit.observe.tombstone;
  const textStartY = 780;

  ctx.fillStyle = '#6E2B26';
  ctx.font = 'bold 18px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(
    `${(exhibit.observe.kind || 'OBJECT').toUpperCase()} / ${(tomb.classification || 'MATERIAL CULTURE').toUpperCase()}`,
    60,
    textStartY
  );

  // Title
  ctx.fillStyle = '#1C1B18';
  ctx.font = 'bold 44px "Cormorant Garamond", Georgia, serif';

  // Word wrap title
  const words = (tomb.title || 'Specimen Record').split(' ');
  let line = '';
  let lineY = textStartY + 48;
  for (const word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > width - 120 && line !== '') {
      ctx.fillText(line.trim(), 60, lineY);
      line = word + ' ';
      lineY += 48;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), 60, lineY);

  // Maker, Date & Origin
  lineY += 36;
  ctx.fillStyle = '#1C1B18';
  ctx.font = '500 22px "IBM Plex Mono", monospace';
  ctx.fillText(`${tomb.maker} (${tomb.date}) — ${tomb.origin}`, 60, lineY);

  lineY += 28;
  ctx.fillStyle = '#1C1B18';
  ctx.font = '400 18px "IBM Plex Mono", monospace';
  ctx.fillText(`Materials: ${tomb.materials}`, 60, lineY);

  // 6. The Big Idea Label (Serrell)
  const bigIdea = exhibit.interpret?.big_idea || exhibit.observe.description;
  if (bigIdea) {
    lineY += 40;
    // Box accent
    ctx.beginPath();
    ctx.moveTo(60, lineY);
    ctx.lineTo(60, lineY + 140);
    ctx.strokeStyle = '#6E2B26';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.fillStyle = '#1C1B18';
    ctx.font = 'italic 28px "Cormorant Garamond", Georgia, serif';

    const ideaWords = `"${bigIdea}"`.split(' ');
    let ideaLine = '';
    let ideaY = lineY + 30;
    for (const w of ideaWords) {
      const testLine = ideaLine + w + ' ';
      if (ctx.measureText(testLine).width > width - 160 && ideaLine !== '') {
        ctx.fillText(ideaLine.trim(), 80, ideaY);
        ideaLine = w + ' ';
        ideaY += 34;
        if (ideaY > lineY + 130) break; // keep in bounds
      } else {
        ideaLine = testLine;
      }
    }
    if (ideaY <= lineY + 130) {
      ctx.fillText(ideaLine.trim(), 80, ideaY);
    }
  }

  // 7. Footer Tagline
  ctx.fillStyle = '#1C1B18';
  ctx.font = 'italic 20px "Cormorant Garamond", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('"Every object has a history."', width / 2, height - 55);

  // Share or Download
  canvas.toBlob(async (blob) => {
    if (!blob) return;

    const fileName = `provenance-${exhibit.accessionNumber.replace(/\./g, '-')}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `${tomb.title} — Provenance`,
          text: `Curatorial record for ${tomb.title} [Accession No. ${exhibit.accessionNumber}]`,
        });
        return;
      } catch {
        // Fall back to direct download if share was canceled or rejected
      }
    }

    // Direct download fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
}
