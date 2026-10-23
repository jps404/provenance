/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GeoLocationState } from '../types.ts';

/**
 * Requests device GPS location.
 * Failures or permission denials fall back gracefully to "Location off".
 */
export async function getDeviceLocation(): Promise<GeoLocationState> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return {
      latitude: 0,
      longitude: 0,
      accuracy: 0,
      label: 'Location off',
      denied: true,
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const accuracyMeters = Math.round(pos.coords.accuracy || 25);
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: accuracyMeters,
          label: `Located ±${accuracyMeters} m`,
          denied: false,
        });
      },
      (error) => {
        console.warn('Geolocation unavailable:', error.message);
        resolve({
          latitude: 0,
          longitude: 0,
          accuracy: 0,
          label: 'Location off',
          denied: true,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 4000,
        maximumAge: 60000,
      }
    );
  });
}

/**
 * Races geolocation against a strict timeout (default 4s) so a scan is never blocked.
 */
export async function getDeviceLocationWithTimeout(timeoutMs = 4000): Promise<GeoLocationState> {
  const timeoutPromise = new Promise<GeoLocationState>((resolve) => {
    setTimeout(() => {
      resolve({
        latitude: 0,
        longitude: 0,
        accuracy: 0,
        label: 'Location off',
        denied: false,
      });
    }, timeoutMs);
  });

  return Promise.race([getDeviceLocation(), timeoutPromise]);
}
