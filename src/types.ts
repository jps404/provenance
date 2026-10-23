/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SpecimenKind = 'object' | 'building' | 'artwork' | 'natural' | 'unknown';
export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

export interface Tombstone {
  title: string;
  maker: string;
  date: string;
  materials: string;
  origin: string;
  classification: string;
}

export interface Hotspot {
  label: string;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  feature_story: string; // 2 sentences on what earlier failure/need this answered
  introduced: string; // approximate year or "uncertain"
}

export interface ObserveResponse {
  kind: SpecimenKind;
  tombstone: Tombstone;
  identification_confidence: ConfidenceLevel;
  vts_question: string;
  description: string;
  hotspots: Hotspot[];
  modelUsed?: string;
}

export interface LineageNode {
  year: string;
  title: string;
  note: string;
  is_specimen?: boolean;
}

export interface HiddenWorldItem {
  material: string;
  from_where: string;
  story: string;
}

export interface MythVsRecord {
  myth: string;
  record: string;
  confidence: string;
}

export interface PlaceLayer {
  period: string;
  what_was_here: string;
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface InterpretResponse {
  big_idea: string; // 75 words max, Serrell-style
  deduction: string; // Prown stage 2: what it reveals about the people who made/used it
  speculation: string[]; // Prown stage 3: 2 bullet strings
  lineage: LineageNode[]; // Chronological lineage leading to is_specimen node
  hidden_world: HiddenWorldItem[]; // 2-4 items
  myth_vs_record: MythVsRecord[]; // 0-2 items
  place_layers?: PlaceLayer[]; // for buildings
  provocation: string; // One question to sit with (Tilden)
  narration: string; // 60-90s spoken script in warm, precise docent voice
  overall_confidence: ConfidenceLevel;
  sources?: GroundingSource[];
  searchQueries?: string[]; // Grounding webSearchQueries
  isUnsourced?: boolean;
  modelUsed?: string;
}

export interface GeoLocationState {
  latitude: number;
  longitude: number;
  accuracy: number;
  label?: string;
  denied?: boolean;
}

export interface ExhibitRecord {
  id: string;
  accessionNumber: string; // e.g., "2026.10.1"
  createdAt: string; // ISO
  imageThumbnail: string; // 400px JPEG quality 0.6
  imageFull: string; // 900px JPEG quality 0.7
  imageNaturalWidth?: number;
  imageNaturalHeight?: number;
  observe: ObserveResponse;
  interpret?: InterpretResponse;
  location?: GeoLocationState;
  interpretError?: string;
  modelUsed?: string;
  isConfidenceGated?: boolean;
}

export type AppView = 'viewfinder' | 'look' | 'exhibit' | 'cabinet' | 'method';
