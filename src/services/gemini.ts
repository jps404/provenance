/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ObserveResponse, InterpretResponse, GeoLocationState } from '../types.ts';

export interface ObserveParams {
  imageBase64: string;
  location?: GeoLocationState;
}

export interface InterpretParams {
  imageBase64: string;
  observe: ObserveResponse;
  location?: GeoLocationState;
}

/**
 * Call 1 - OBSERVE: Fast, structured physical observation and VTS docent question.
 */
export async function observeSpecimen(params: ObserveParams): Promise<ObserveResponse> {
  const localDate = new Date().toISOString().split('T')[0];

  const response = await fetch('/api/observe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: params.imageBase64,
      location: params.location && !params.location.denied ? params.location : undefined,
      localDate,
    }),
  });

  if (!response.ok) {
    let errorMsg = `Server error (${response.status})`;
    try {
      const errorJson = await response.json();
      if (errorJson.error) {
        errorMsg = errorJson.error;
      }
    } catch {
      // Use fallback errorMsg
    }
    throw new Error(errorMsg);
  }

  const data: ObserveResponse = await response.json();
  return data;
}

/**
 * Call 2 - INTERPRET: Grounded historical interpretation streaming progress via SSE.
 */
export async function interpretSpecimen(
  params: InterpretParams,
  onPhase?: (phase: string) => void
): Promise<InterpretResponse> {
  const localDate = new Date().toISOString().split('T')[0];

  const response = await fetch('/api/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: params.imageBase64,
      observe: params.observe,
      location: params.location && !params.location.denied ? params.location : undefined,
      localDate,
    }),
  });

  if (!response.ok) {
    let errorMsg = `Server error (${response.status})`;
    try {
      const errorJson = await response.json();
      if (errorJson.error) {
        errorMsg = errorJson.error;
      }
    } catch {
      // Use fallback
    }
    throw new Error(errorMsg);
  }

  // Read Server-Sent Events stream
  if (!response.body) {
    throw new Error('Response body is missing');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: InterpretResponse | null = null;
  let finalError: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.replace(/^data:\s*/, '');
      if (!jsonStr) continue;

      try {
        const payload = JSON.parse(jsonStr);
        if (payload.type === 'phase') {
          if (onPhase && payload.phase) {
            onPhase(payload.phase);
          }
        } else if (payload.type === 'complete') {
          finalResult = payload.data as InterpretResponse;
        } else if (payload.type === 'error') {
          finalError = payload.error || 'Interpretation failed';
        }
      } catch {
        // Skip malformed chunk
      }
    }
  }

  if (finalError) {
    throw new Error(finalError);
  }

  if (!finalResult) {
    throw new Error('Interpretation stream finished without complete payload.');
  }

  return finalResult;
}
