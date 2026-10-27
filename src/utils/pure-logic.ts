/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ObserveResponse,
  InterpretResponse,
  Hotspot,
  Tombstone,
  LineageNode,
  HiddenWorldItem,
  MythVsRecord,
  PlaceLayer,
  ConfidenceLevel,
  SpecimenKind,
} from '../types.ts';

/**
 * Computes a standard museum accession number in format YYYY.MM.N
 * where N is the sequential specimen index for that year and month.
 */
export function formatAccessionNumber(
  existingAccessionNumbers: string[],
  targetDate: Date = new Date()
): string {
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const prefix = `${year}.${month}.`;

  let maxN = 0;
  for (const acc of existingAccessionNumbers) {
    if (typeof acc === 'string' && acc.startsWith(prefix)) {
      const parts = acc.split('.');
      if (parts.length >= 3) {
        const n = parseInt(parts[2], 10);
        if (!isNaN(n) && n > maxN) {
          maxN = n;
        }
      }
    }
  }

  return `${prefix}${maxN + 1}`;
}

/**
 * Maps raw backend or API error messages into calm, user-facing museum notices.
 * Never exposes raw API error JSON, stack traces, or technical error blobs.
 */
export function mapCuratorialErrorMessage(rawError: unknown): string {
  if (!rawError) return 'The reading could not be completed.';

  let str = '';
  if (typeof rawError === 'string') {
    str = rawError;
  } else if (rawError instanceof Error) {
    str = rawError.message;
  } else if (typeof rawError === 'object' && rawError !== null) {
    try {
      str = JSON.stringify(rawError);
    } catch {
      str = String(rawError);
    }
  } else {
    str = String(rawError);
  }

  const lower = str.toLowerCase();

  if (
    str.includes('503') ||
    lower.includes('high demand') ||
    lower.includes('unavailable')
  ) {
    return 'The archive is busy right now. Trying again usually works.';
  }

  if (
    str.includes('429') ||
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit')
  ) {
    return 'The daily research quota is used up. Try again shortly.';
  }

  return 'The reading could not be completed.';
}

/**
 * Robustly parses a JSON string, stripping markdown fences, leading/trailing prose,
 * and handles slight syntax imperfections.
 */
export function cleanAndParseJson<T>(rawText: string, fallback: T): T {
  if (!rawText || typeof rawText !== 'string') {
    return fallback;
  }

  let text = rawText.trim();

  // Strip code block fences if present: ```json ... ``` or ``` ... ```
  if (text.startsWith('```')) {
    const firstNewline = text.indexOf('\n');
    if (firstNewline !== -1) {
      text = text.slice(firstNewline + 1);
    }
    if (text.endsWith('```')) {
      text = text.slice(0, -3).trim();
    }
  }

  // Also handle embedded ```json blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    text = jsonMatch[1].trim();
  }

  // Find outermost '{' and '}'
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    text = text.substring(start, end + 1);
  }

  try {
    return JSON.parse(text) as T;
  } catch (err) {
    // Attempt minor recovery: remove trailing commas before } or ]
    try {
      const sanitized = text.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(sanitized) as T;
    } catch {
      return fallback;
    }
  }
}

/**
 * Clamps and normalizes a hotspot bounding box [ymin, xmin, ymax, xmax] in 0-1000 scale.
 * Swaps min/max if inverted.
 * Returns null if the box is smaller than 0.2% of image area (2,000 / 1,000,000)
 * or covers more than 90% (900,000 / 1,000,000).
 */
export function normalizeHotspotBox(box: unknown): [number, number, number, number] | null {
  if (!Array.isArray(box) || box.length < 4) {
    return null;
  }

  let [ymin, xmin, ymax, xmax] = box.map((v) => {
    const num = Number(v);
    if (isNaN(num)) return 0;
    return Math.max(0, Math.min(1000, Math.round(num)));
  });

  // Swap if inverted
  if (ymin > ymax) {
    const temp = ymin;
    ymin = ymax;
    ymax = temp;
  }
  if (xmin > xmax) {
    const temp = xmin;
    xmin = xmax;
    xmax = temp;
  }

  const height = ymax - ymin;
  const width = xmax - xmin;
  const area = height * width;

  // Drop boxes smaller than 0.2% (2,000) or greater than 90% (900,000) of 1,000,000
  if (area < 2000 || area > 900000) {
    return null;
  }

  return [ymin, xmin, ymax, xmax];
}

/**
 * Filters and validates a collection of hotspots.
 * Caps at 5 valid hotspots (area >= 2,000 and <= 900,000).
 * If fewer than 2 valid hotspots survive, keeps the top 2 by area (area > 0 and <= 900,000)
 * rather than showing 0-1.
 */
export function filterValidHotspots(rawHotspots: unknown[]): Hotspot[] {
  if (!Array.isArray(rawHotspots)) return [];

  interface Candidate {
    hotspot: Hotspot;
    area: number;
    isValid: boolean;
  }

  const candidates: Candidate[] = [];

  for (let idx = 0; idx < rawHotspots.length; idx++) {
    const item = rawHotspots[idx];
    const h = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;

    if (!Array.isArray(h.box_2d) || h.box_2d.length < 4) {
      continue;
    }

    let [ymin, xmin, ymax, xmax] = h.box_2d.map((v) => {
      const num = Number(v);
      if (isNaN(num)) return 0;
      return Math.max(0, Math.min(1000, Math.round(num)));
    });

    if (ymin > ymax) {
      const temp = ymin;
      ymin = ymax;
      ymax = temp;
    }
    if (xmin > xmax) {
      const temp = xmin;
      xmin = xmax;
      xmax = temp;
    }

    const height = ymax - ymin;
    const width = xmax - xmin;
    const area = height * width;

    // Discard zero-area boxes or boxes covering > 90% of image
    if (area <= 0 || area > 900000) {
      continue;
    }

    const hotspot: Hotspot = {
      label: String(h.label || `Feature ${candidates.length + 1}`).trim(),
      box_2d: [ymin, xmin, ymax, xmax],
      feature_story: String(
        h.feature_story ||
          'This detail evolved directly in response to earlier functional vulnerabilities or material constraints.'
      ).trim(),
      introduced: String(h.introduced || 'uncertain').trim(),
    };

    candidates.push({
      hotspot,
      area,
      isValid: area >= 2000,
    });
  }

  const valid = candidates.filter((c) => c.isValid).map((c) => c.hotspot);

  // If 2 or more valid hotspots survive, return up to 5
  if (valid.length >= 2) {
    return valid.slice(0, 5);
  }

  // If fewer than 2 valid hotspots survive, keep the top 2 by area rather than showing 0-1
  if (candidates.length > 0) {
    const sortedByArea = [...candidates].sort((a, b) => b.area - a.area);
    return sortedByArea.slice(0, 2).map((c) => c.hotspot);
  }

  return [];
}

/**
 * Calculates pin center percentage coordinates for photo overlay.
 * Coordinates are in 0-100% scale.
 */
export function calculatePinCenter(box_2d: [number, number, number, number]): {
  topPercent: number;
  leftPercent: number;
  widthPercent: number;
  heightPercent: number;
} {
  const [ymin, xmin, ymax, xmax] = box_2d;
  const topPercent = ymin / 10;
  const leftPercent = xmin / 10;
  const widthPercent = (xmax - xmin) / 10;
  const heightPercent = (ymax - ymin) / 10;
  const centerTop = (ymin + ymax) / 20;
  const centerLeft = (xmin + xmax) / 20;

  return {
    topPercent: centerTop,
    leftPercent: centerLeft,
    widthPercent,
    heightPercent,
  };
}

/**
 * Trims a list of stored items to the maximum allowed (default 25), dropping oldest.
 */
export function trimStorageList<T extends { id: string }>(items: T[], maxItems = 25): T[] {
  if (!Array.isArray(items)) return [];
  if (items.length <= maxItems) return items;
  return items.slice(0, maxItems);
}

/**
 * Extracts a 4-digit year number from strings like "1977", "c. 1895", "circa 1950", or returns null.
 */
export function parseYearNumber(yearStr: string): number | null {
  if (!yearStr) return null;
  const match = yearStr.match(/\b(1\d{3}|20\d{2})\b/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Checks if an identification should be confidence-gated (Low confidence or unknown kind).
 */
export function shouldGateConfidence(observe: {
  kind?: SpecimenKind;
  identification_confidence?: ConfidenceLevel;
}): boolean {
  if (!observe) return true;
  if (observe.kind === 'unknown') return true;
  if (observe.identification_confidence === 'Low') return true;
  return false;
}

/**
 * Sanitizes the technological lineage timeline:
 * 1. Finds the specimen node (marked with is_specimen: true or "this specimen" title).
 * 2. Parses year numbers, sorts ancestors chronologically ascending.
 * 3. Drops any node dated AFTER the specimen.
 * 4. Places the specimen node strictly as the final node, labeled with is_specimen: true.
 */
export function sanitizeTimeline(nodes: LineageNode[], specimenDateHint?: string): LineageNode[] {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];

  // Determine hint year if available
  const hintYear = specimenDateHint ? parseYearNumber(specimenDateHint) : null;

  // Identify the specimen node
  let specimenIndex = -1;

  // Check explicit is_specimen flag first
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].is_specimen === true) {
      specimenIndex = i;
      break;
    }
  }

  // Check title or note text
  if (specimenIndex === -1) {
    for (let i = 0; i < nodes.length; i++) {
      const text = `${nodes[i].title} ${nodes[i].note}`.toLowerCase();
      if (text.includes('this specimen') || text.includes('specimen in hand')) {
        specimenIndex = i;
        break;
      }
    }
  }

  // If still not identified, take the last node
  if (specimenIndex === -1) {
    specimenIndex = nodes.length - 1;
  }

  const rawSpecimen = nodes[specimenIndex];
  const specimenYearNum = parseYearNumber(rawSpecimen.year) || hintYear || 9999;

  const specimenNode: LineageNode = {
    year: rawSpecimen.year || (hintYear ? String(hintYear) : 'Present'),
    title: rawSpecimen.title.toLowerCase().includes('specimen')
      ? rawSpecimen.title
      : `${rawSpecimen.title} (This Specimen)`,
    note: rawSpecimen.note || 'The specimen in hand.',
    is_specimen: true,
  };

  // Filter ancestor nodes: must not be the specimen, and must not have a year after the specimen
  const ancestors: Array<{ node: LineageNode; yearNum: number }> = [];

  for (let i = 0; i < nodes.length; i++) {
    if (i === specimenIndex) continue;
    const n = nodes[i];
    const yNum = parseYearNumber(n.year) || 0;

    // Drop if dated AFTER specimen
    if (yNum > specimenYearNum && specimenYearNum !== 9999) {
      continue;
    }

    ancestors.push({
      node: {
        year: n.year,
        title: n.title,
        note: n.note,
        is_specimen: false,
      },
      yearNum: yNum,
    });
  }

  // Sort ancestors chronologically ascending
  ancestors.sort((a, b) => a.yearNum - b.yearNum);

  return [...ancestors.map((a) => a.node), specimenNode];
}

/**
 * Runtime validation and safe default fallback for Call 1 (Observe).
 */
export function validateObserveResponse(data: unknown, modelUsed?: string): ObserveResponse {
  const obj = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;

  const rawKind = String(obj.kind || '').toLowerCase();
  const validKinds: SpecimenKind[] = ['object', 'building', 'artwork', 'natural', 'unknown'];
  const kind: SpecimenKind = validKinds.includes(rawKind as SpecimenKind)
    ? (rawKind as SpecimenKind)
    : 'object';

  const rawConfidence = String(obj.identification_confidence || '').toLowerCase();
  let identification_confidence: ConfidenceLevel = 'Medium';
  if (rawConfidence.includes('high')) identification_confidence = 'High';
  else if (rawConfidence.includes('low')) identification_confidence = 'Low';

  const rawTomb = (typeof obj.tombstone === 'object' && obj.tombstone !== null
    ? obj.tombstone
    : {}) as Record<string, unknown>;

  const tombstone: Tombstone = {
    title: String(rawTomb.title || 'Unidentified Specimen').trim(),
    maker: String(rawTomb.maker || 'Attribution uncertain').trim(),
    date: String(rawTomb.date || 'Date uncertain').trim(),
    materials: String(rawTomb.materials || 'Mixed materials').trim(),
    origin: String(rawTomb.origin || 'Origin unrecorded').trim(),
    classification: String(rawTomb.classification || 'Material Culture').trim(),
  };

  const vts_question = String(
    obj.vts_question ||
      'What do you notice first about the surface, wear, and physical proportions of this object?'
  ).trim();

  const description = String(
    obj.description ||
      'A specimen exhibiting observable physical qualities of industrial or artisan craftsmanship, marked by specific geometries and signs of functional purpose.'
  ).trim();

  const rawHotspots = Array.isArray(obj.hotspots) ? obj.hotspots : [];
  const hotspots = filterValidHotspots(rawHotspots);

  return {
    kind,
    tombstone,
    identification_confidence,
    vts_question,
    description,
    hotspots,
    modelUsed: modelUsed || (obj.modelUsed as string | undefined),
  };
}

/**
 * Runtime validation and safe default fallback for Call 2 (Interpret).
 */
export function validateInterpretResponse(
  data: unknown,
  isUnsourced = false,
  modelUsed?: string,
  searchQueries?: string[],
  specimenDateHint?: string
): InterpretResponse {
  const obj = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;

  const big_idea = String(
    obj.big_idea ||
      'Every everyday object is a crystallized repository of human habit, manufacturing trade-offs, and social values.'
  ).trim();

  const deduction = String(
    obj.deduction ||
      'The materials and construction reveal a society balancing durability against production speed and ergonomic utility.'
  ).trim();

  let speculation: string[] = [];
  if (Array.isArray(obj.speculation) && obj.speculation.length > 0) {
    speculation = obj.speculation.map((s) => String(s).trim()).filter(Boolean);
  } else if (typeof obj.speculation === 'string') {
    speculation = [obj.speculation];
  }
  if (speculation.length === 0) {
    speculation = [
      'Did this specimen reflect everyday workshop usage or specialized status display?',
      'How did changes in trade tariffs and regional metallurgy influence its production run?',
    ];
  }

  const rawLineage = Array.isArray(obj.lineage) ? (obj.lineage as LineageNode[]) : [];
  const lineage = sanitizeTimeline(rawLineage, specimenDateHint);

  const rawHidden = Array.isArray(obj.hidden_world) ? obj.hidden_world : [];
  const hidden_world: HiddenWorldItem[] = rawHidden.map((item) => {
    const h = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    return {
      material: String(h.material || 'Primary Material').trim(),
      from_where: String(h.from_where || 'Global supply network').trim(),
      story: String(h.story || 'Extracted, refined, and transported through multi-stage industrial supply chains.').trim(),
    };
  });

  const rawMyth = Array.isArray(obj.myth_vs_record) ? obj.myth_vs_record : [];
  const myth_vs_record: MythVsRecord[] = rawMyth.map((item) => {
    const m = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    return {
      myth: String(m.myth || '').trim(),
      record: String(m.record || '').trim(),
      confidence: String(m.confidence || 'Documented record').trim(),
    };
  }).filter((m) => m.myth && m.record);

  let place_layers: PlaceLayer[] | undefined = undefined;
  if (Array.isArray(obj.place_layers) && obj.place_layers.length > 0) {
    place_layers = obj.place_layers.map((item) => {
      const p = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
      return {
        period: String(p.period || 'Historical Era').trim(),
        what_was_here: String(p.what_was_here || '').trim(),
      };
    });
  }

  const provocation = String(
    obj.provocation ||
      'If this specimen were unearthed five hundred years from now, what single conclusion would future excavators draw about the civilization that held it?'
  ).trim();

  const narration = String(
    obj.narration ||
      'Take a close look at this specimen. What appears ordinary at first glance represents centuries of accumulated problem-solving...'
  ).trim();

  const rawConfidence = String(obj.overall_confidence || '').toLowerCase();
  let overall_confidence: ConfidenceLevel = 'Medium';
  if (rawConfidence.includes('high')) overall_confidence = 'High';
  else if (rawConfidence.includes('low')) overall_confidence = 'Low';

  // If call is unsourced, cap confidence at Medium
  if (isUnsourced && overall_confidence === 'High') {
    overall_confidence = 'Medium';
  }

  const rawSources = Array.isArray(obj.sources) ? obj.sources : [];
  const sources = rawSources.map((s) => {
    const item = (typeof s === 'object' && s !== null ? s : {}) as Record<string, unknown>;
    return {
      uri: String(item.uri || '').trim(),
      title: String(item.title || item.uri || 'Historical source').trim(),
    };
  }).filter((s) => s.uri);

  return {
    big_idea,
    deduction,
    speculation,
    lineage,
    hidden_world,
    myth_vs_record,
    place_layers,
    provocation,
    narration,
    overall_confidence,
    sources,
    searchQueries: searchQueries || (obj.searchQueries as string[] | undefined),
    isUnsourced,
    modelUsed: modelUsed || (obj.modelUsed as string | undefined),
  };
}
