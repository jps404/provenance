/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ExhibitRecord } from '../types.ts';
import { formatAccessionNumber, trimStorageList } from '../utils/pure-logic.ts';
import { resizeBase64Image } from './camera.ts';

const STORAGE_KEY = 'provenance_cabinet_v1';
const MAX_EXHIBITS = 25;

/**
 * Loads all cataloged exhibits from localStorage.
 * Starts empty: no invented or unverified facts.
 */
export function getSavedExhibits(): ExhibitRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.warn('Failed to read cabinet storage:', err);
    return [];
  }
}

/**
 * Saves a new or updated exhibit to localStorage.
 * Keeps up to 25 items, automatically handles QuotaExceededError by trimming oldest.
 */
export async function saveExhibit(exhibit: ExhibitRecord): Promise<void> {
  try {
    const existing = getSavedExhibits();

    // Prepare downscaled images for storage if needed
    const thumbnail = await resizeBase64Image(exhibit.imageThumbnail || exhibit.imageFull, 400, 0.6);
    const full = await resizeBase64Image(exhibit.imageFull, 900, 0.7);

    const recordToSave: ExhibitRecord = {
      ...exhibit,
      imageThumbnail: thumbnail,
      imageFull: full,
    };

    // Filter out existing copy with same ID if updating
    const remaining = existing.filter((e) => e.id !== exhibit.id);
    let updatedList = [recordToSave, ...remaining];
    updatedList = trimStorageList(updatedList, MAX_EXHIBITS);

    // Attempt to store with quota error retry
    let success = false;
    let attempts = 0;
    while (!success && attempts < 5 && updatedList.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
        success = true;
      } catch (quotaErr) {
        attempts++;
        console.warn(`Storage quota exceeded (attempt ${attempts}), dropping oldest record...`, quotaErr);
        updatedList.pop();
      }
    }
  } catch (err) {
    console.error('Fatal error saving exhibit to cabinet:', err);
  }
}

/**
 * Deletes an exhibit by ID.
 */
export function deleteExhibit(id: string): ExhibitRecord[] {
  try {
    const existing = getSavedExhibits();
    const updated = existing.filter((e) => e.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to delete exhibit:', err);
    return getSavedExhibits();
  }
}

/**
 * Generates the next sequential accession number based on existing stored specimens.
 */
export function generateNextAccessionNumber(targetDate = new Date()): string {
  const existing = getSavedExhibits();
  const existingNumbers = existing.map((e) => e.accessionNumber);
  return formatAccessionNumber(existingNumbers, targetDate);
}
