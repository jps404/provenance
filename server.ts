/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import {
  cleanAndParseJson,
  validateObserveResponse,
  validateInterpretResponse,
  mapCuratorialErrorMessage,
} from './src/utils/pure-logic.ts';

dotenv.config();

const app = express();
app.use(express.json({ limit: '30mb' }));

const SYSTEM_INSTRUCTION =
  "You are Provenance, a museum docent and historian of material culture. Be precise and concrete. " +
  "Never invent names, dates, patents or places; when the record is uncertain, say 'date uncertain' or 'attribution disputed' " +
  "and lower confidence. Prefer the specific over the generic: identify the exact model, building or maker when the evidence supports it.";

// Model fallback chains:
// Observe: fast lite model first for speed (target <10s)
const OBSERVE_MODEL_CHAIN = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
];

// Interpret: 3.6 first (reliable with grounding), followed by 3.8, 3.5, 3.1
const INTERPRET_MODEL_CHAIN = [
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

const OBSERVE_TIMEOUT_MS = 12000;
const INTERPRET_TIMEOUT_MS = 30000;

function getAiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`TIMEOUT_${timeoutMs}MS: ${operationName}`)), timeoutMs)
    ),
  ]);
}

/**
 * Call 1 - OBSERVE: Fast, structured JSON schema, no tools, lowest thinking level.
 * 15s per-attempt timeout; on 503/429/404/timeout, moves immediately to next model.
 */
app.post('/api/observe', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', location, localDate } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please check Settings > Secrets.',
      });
    }

    const ai = getAiClient();
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    const locationContext = location
      ? `Location coordinates: lat ${location.latitude?.toFixed(5)}, lng ${location.longitude?.toFixed(5)} (accuracy ~${Math.round(location.accuracy || 20)}m). If this is a building or landmark, use this location to identify it.`
      : 'Location: Not provided / unavailable (read physical specimen directly).';

    const promptText =
      `Examine this photograph closely as a museum curator and material-culture historian.\n` +
      `Current date: ${localDate || new Date().toISOString().split('T')[0]}.\n` +
      `${locationContext}\n\n` +
      `Rules:\n` +
      `1. Determine the kind: 'object', 'building', 'artwork', 'natural', or 'unknown'.\n` +
      `2. Tombstone details: title, maker (or architect/attribution), date, materials, origin, classification.\n` +
      `3. Visual Thinking Strategies (VTS): Formulate exactly ONE open-ended docent question about THIS photograph (e.g., 'What do you notice about where a hand would hold this?' or 'What do the surface textures along the edges suggest to you?'). Do NOT reveal the answers yet.\n` +
      `4. Description: Prown stage 1, 2-3 sentences of purely physical, observable description (geometry, surfaces, joinery, mass).\n` +
      `5. Hotspots: Return 3 to 5 hotspots. For small handheld objects, include distinct small components (cap, cap hole, clip, tip/nib, button, hinge, label) even if they are thin; draw the box tightly around the visible component. Never place a hotspot on something not visible. For buildings, focus on architectural elements (cornice, arch, lintel, columns, bond, windows). For each feature, explain what earlier failure or human need this design feature answered (Petroski's 'form follows failure') in 2 sentences, plus approximate introduced year or 'uncertain'.\n` +
      `Coordinates box_2d are [ymin, xmin, ymax, xmax] normalized to 0-1000 integers.`;

    const requestPayload = {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            kind: {
              type: Type.STRING,
              description: "One of 'object', 'building', 'artwork', 'natural', 'unknown'",
            },
            identification_confidence: {
              type: Type.STRING,
              description: "'High', 'Medium', or 'Low'",
            },
            tombstone: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                maker: { type: Type.STRING },
                date: { type: Type.STRING },
                materials: { type: Type.STRING },
                origin: { type: Type.STRING },
                classification: { type: Type.STRING },
              },
              required: ['title', 'maker', 'date', 'materials', 'origin', 'classification'],
            },
            vts_question: {
              type: Type.STRING,
              description: 'One open-ended docent question about this specific photograph before facts are revealed',
            },
            description: {
              type: Type.STRING,
              description: 'Prown stage 1: 2-3 sentences of purely physical, observable description',
            },
            hotspots: {
              type: Type.ARRAY,
              description:
                'Return 3 to 5 hotspots. For small handheld objects, include distinct small components (cap, cap hole, clip, tip/nib, button, hinge, label) even if they are thin; draw the box tightly around the visible component.',
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  box_2d: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER },
                    description: '[ymin, xmin, ymax, xmax] 0-1000',
                  },
                  feature_story: {
                    type: Type.STRING,
                    description: '2 sentences on what earlier failure or human need this solved',
                  },
                  introduced: {
                    type: Type.STRING,
                    description: "Approximate year or 'uncertain'",
                  },
                },
                required: ['label', 'box_2d', 'feature_story', 'introduced'],
              },
            },
          },
          required: [
            'kind',
            'identification_confidence',
            'tombstone',
            'vts_question',
            'description',
            'hotspots',
          ],
        },
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    };

    let response = null;
    let modelUsed = '';
    let lastError: unknown = null;

    for (const candidateModel of OBSERVE_MODEL_CHAIN) {
      const attemptStart = Date.now();
      try {
        response = await withTimeout(
          ai.models.generateContent({
            model: candidateModel,
            ...requestPayload,
          }),
          OBSERVE_TIMEOUT_MS,
          `Observe (${candidateModel})`
        );
        const elapsed = Date.now() - attemptStart;
        modelUsed = candidateModel;
        console.log(`[Observe] model=${candidateModel} outcome=ok status=200 ms=${elapsed}`);
        break;
      } catch (err: any) {
        lastError = err;
        const elapsed = Date.now() - attemptStart;
        const status = err.status || (String(err).includes('TIMEOUT') ? 408 : 500);
        const errMsg = err.message || String(err);
        console.log(`[Observe] model=${candidateModel} outcome=failed status=${status} ms=${elapsed} error="${errMsg.slice(0, 80)}"`);

        // If thinkingConfig caused error, retry once without thinkingConfig on the same model
        if (errMsg.includes('thinkingConfig') || errMsg.includes('thinkingLevel')) {
          const retryStart = Date.now();
          try {
            const noThinkingPayload = {
              ...requestPayload,
              config: {
                ...requestPayload.config,
                thinkingConfig: undefined,
              },
            };
            response = await withTimeout(
              ai.models.generateContent({
                model: candidateModel,
                ...noThinkingPayload,
              }),
              OBSERVE_TIMEOUT_MS,
              `Observe-NoThinking (${candidateModel})`
            );
            const retryElapsed = Date.now() - retryStart;
            modelUsed = candidateModel;
            console.log(`[Observe] model=${candidateModel} outcome=ok_no_thinking status=200 ms=${retryElapsed}`);
            break;
          } catch (retryErr: any) {
            lastError = retryErr;
            const retryElapsed = Date.now() - retryStart;
            console.log(`[Observe] model=${candidateModel} outcome=failed_no_thinking status=${retryErr.status || 500} ms=${retryElapsed}`);
          }
        }
        // Move to next model immediately without waiting
      }
    }

    if (!response || !modelUsed) {
      throw lastError || new Error('All models in fallback chain exhausted for observation.');
    }

    const rawText = response.text || '';
    const parsed = cleanAndParseJson<Record<string, unknown>>(rawText, {});
    const validated = validateObserveResponse(parsed, modelUsed);

    return res.json(validated);
  } catch (error: unknown) {
    console.error('Error in /api/observe:', error);
    const message = error instanceof Error ? error.message : String(error);
    const isQuota = message.includes('429') || message.includes('quota') || message.includes('RESOURCE_EXHAUSTED');
    const isBusy = message.includes('503') || message.toLowerCase().includes('high demand') || message.includes('UNAVAILABLE');
    return res.status(isQuota ? 429 : isBusy ? 503 : 500).json({
      error: mapCuratorialErrorMessage(error),
    });
  }
});

/**
 * Call 2 - INTERPRET: Grounded with googleSearch via streaming Server-Sent Events (SSE).
 * Emits progress phases while streaming and returns final validated reading.
 */
app.post('/api/interpret', async (req: Request, res: Response) => {
  // Set headers for Server-Sent Events (SSE)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { imageBase64, mimeType = 'image/jpeg', observe, location, localDate } = req.body;

    if (!imageBase64 || !observe) {
      sendEvent({ type: 'error', error: 'imageBase64 and observe are required.' });
      return res.end();
    }

    if (!process.env.GEMINI_API_KEY) {
      sendEvent({
        type: 'error',
        error: 'GEMINI_API_KEY is not configured on the server. Please check Settings > Secrets.',
      });
      return res.end();
    }

    const ai = getAiClient();
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    const observeSummary = JSON.stringify(observe, null, 2);
    const locationContext = location
      ? `Location: lat ${location.latitude?.toFixed(5)}, lng ${location.longitude?.toFixed(5)} (accuracy ~${Math.round(location.accuracy || 20)}m).`
      : 'Location: None.';

    const promptText =
      `You are conducting the in-depth interpretation phase for the following specimen.\n` +
      `Initial Observation data:\n${observeSummary}\n` +
      `${locationContext}\n` +
      `Local Date: ${localDate || new Date().toISOString().split('T')[0]}.\n\n` +
      `Use Google Search to corroborate historical facts, patents, maker origins, material extraction sources, and lineages.\n\n` +
      `Deliver the cultural biography and material-culture interpretation strictly formatted as a JSON object inside a single \`\`\`json block. Do not write text before or after the code fence.\n\n` +
      `Fields required:\n` +
      `{\n` +
      `  "big_idea": "Serrell-style big idea label, 75 words or fewer, distilling why this object matters to human culture.",\n` +
      `  "deduction": "Prown stage 2: what the object reveals about the people who made, bought, and used it (2-3 sentences).",\n` +
      `  "speculation": ["Hypothesis or research lead a material-culture historian would investigate", "Second hypothesis or lead"],\n` +
      `  "lineage": [\n` +
      `    {"year": "circa YYYY", "title": "Prime Object / Earliest Ancestor", "note": "Kopytoff/Kubler prime object context", "is_specimen": false},\n` +
      `    {"year": "YYYY", "title": "Key evolution", "note": "Crucial shift in technology or form", "is_specimen": false},\n` +
      `    {"year": "YYYY", "title": "Mass production / modern shift", "note": "Industrial or standard shift", "is_specimen": false},\n` +
      `    {"year": "${observe.tombstone?.date || 'Present'}", "title": "${observe.tombstone?.title || 'This Specimen'}", "note": "How this exact specimen fits into the evolutionary arc", "is_specimen": true}\n` +
      `  ],\n` +
      `  "hidden_world": [\n` +
      `    {"material": "e.g., Brass / Lead / Silicon / Oak", "from_where": "Geographic / mineral origin", "story": "Leonard Read 'I, Pencil' style supply chain reality"}\n` +
      `  ],\n` +
      `  "myth_vs_record": [\n` +
      `    {"myth": "Documented popular myth or misconception", "record": "What archival and patent records actually confirm", "confidence": "High / Medium"}\n` +
      `  ],\n` +
      `  "place_layers": ${observe.kind === 'building' ? '[{"period": "Historical Era", "what_was_here": "Previous structure, geology, or land use"}]' : 'null'},\n` +
      `  "provocation": "One single provocative question to sit with (Freeman Tilden principle). Not a summary. End with a question mark.",\n` +
      `  "narration": "A 60-90 second spoken script in a warm, precise, eloquent docent voice. Suitable for speech synthesis.",\n` +
      `  "overall_confidence": "High" | "Medium" | "Low"\n` +
      `}\n\n` +
      `CRITICAL RULE FOR LINEAGE:\n` +
      `The specimen node MUST be strictly the final node in the lineage array, must have "is_specimen": true, and must represent this specimen in hand. NEVER include a node dated after the specimen.`;

    const makePayload = (withSearch: boolean) => ({
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        ...(withSearch ? { tools: [{ googleSearch: {} }] } : {}),
      },
    });

    sendEvent({ type: 'phase', phase: 'Researching sources and history...' });

    let fullText = '';
    let modelUsed = '';
    let isUnsourced = false;
    let finalGroundingChunks: any[] = [];
    let finalSearchQueries: string[] = [];
    let lastError: unknown = null;

    // Helper to run a stream attempt for a given model and search configuration.
    // Stream creation AND reading of the first chunk are awaited inside the attempt.
    // If it throws 503/429/404/timeout before any text has been received, it throws and does not commit.
    // Only after the first text chunk is forwarded is the attempt committed.
    const executeStreamAttempt = async (
      candidateModel: string,
      withSearch: boolean
    ): Promise<{
      text: string;
      groundingChunks: any[];
      searchQueries: string[];
    }> => {
      const streamPromise = ai.models.generateContentStream({
        model: candidateModel,
        ...makePayload(withSearch),
      });

      const stream = await withTimeout(
        streamPromise,
        INTERPRET_TIMEOUT_MS,
        `InterpretStream (${candidateModel})`
      );

      const iterator = stream[Symbol.asyncIterator]();
      const firstChunkResult = await withTimeout(
        iterator.next(),
        INTERPRET_TIMEOUT_MS,
        `InterpretFirstChunk (${candidateModel})`
      );

      if (firstChunkResult.done) {
        throw new Error(`Stream closed immediately with no chunks (${candidateModel})`);
      }

      // First chunk arrived successfully! Attempt is now committed.
      sendEvent({ type: 'phase', phase: 'Drafting museum interpretation...' });

      let textAccumulator = '';
      const groundingChunks: any[] = [];
      const searchQueries: string[] = [];

      const recordChunkData = (chunk: any) => {
        if (chunk?.text) {
          textAccumulator += chunk.text;
        }
        const candidate = chunk?.candidates?.[0];
        if (candidate?.groundingMetadata?.groundingChunks) {
          groundingChunks.push(...candidate.groundingMetadata.groundingChunks);
        }
        if (candidate?.groundingMetadata?.webSearchQueries) {
          searchQueries.push(...candidate.groundingMetadata.webSearchQueries);
        }
      };

      recordChunkData(firstChunkResult.value);

      // Consume remainder of stream
      while (true) {
        const nextResult = await withTimeout(
          iterator.next(),
          INTERPRET_TIMEOUT_MS,
          `InterpretRemainingChunk (${candidateModel})`
        );
        if (nextResult.done) break;
        recordChunkData(nextResult.value);
      }

      if (!textAccumulator.trim()) {
        throw new Error(`Stream returned empty text (${candidateModel})`);
      }

      return {
        text: textAccumulator,
        groundingChunks,
        searchQueries,
      };
    };

    // Try models in order. Only the final model (gemini-3.1-flash-lite) starts without googleSearch.
    for (let i = 0; i < INTERPRET_MODEL_CHAIN.length; i++) {
      const candidateModel = INTERPRET_MODEL_CHAIN[i];
      const isFinalModel = i === INTERPRET_MODEL_CHAIN.length - 1;
      const useSearch = !isFinalModel; // Keep search on all except the final model

      const attemptStart = Date.now();
      try {
        sendEvent({
          type: 'phase',
          phase: useSearch
            ? `Corroborating records with ${candidateModel}...`
            : `Synthesizing curatorial reading with ${candidateModel}...`,
        });

        const attemptResult = await executeStreamAttempt(candidateModel, useSearch);
        const elapsed = Date.now() - attemptStart;
        fullText = attemptResult.text;
        finalGroundingChunks = attemptResult.groundingChunks;
        finalSearchQueries = attemptResult.searchQueries;
        modelUsed = candidateModel;
        isUnsourced = !useSearch || finalGroundingChunks.length === 0;

        console.log(`[Interpret] model=${candidateModel} outcome=ok status=200 search=${useSearch} ms=${elapsed}`);
        break;
      } catch (err: any) {
        lastError = err;
        const elapsed = Date.now() - attemptStart;
        const status = err.status || (String(err).includes('TIMEOUT') ? 408 : 500);
        const errMsg = err.message || String(err);
        console.log(`[Interpret] model=${candidateModel} outcome=failed status=${status} search=${useSearch} ms=${elapsed} error="${errMsg.slice(0, 80)}"`);

        // If a model fails with 429 while googleSearch is enabled,
        // retry that SAME model once without the search tool before moving on (search has its own quota),
        // and mark the reading Unsourced.
        const is429 =
          status === 429 ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.toLowerCase().includes('quota');

        if (is429 && useSearch) {
          const retryStart = Date.now();
          try {
            sendEvent({
              type: 'phase',
              phase: `Drafting unsourced reading with ${candidateModel}...`,
            });
            const retryResult = await executeStreamAttempt(candidateModel, false);
            const retryElapsed = Date.now() - retryStart;
            fullText = retryResult.text;
            finalGroundingChunks = retryResult.groundingChunks;
            finalSearchQueries = retryResult.searchQueries;
            modelUsed = candidateModel;
            isUnsourced = true;
            console.log(`[Interpret] model=${candidateModel} outcome=ok_unsourced_retry status=200 search=false ms=${retryElapsed}`);
            break;
          } catch (retryErr: any) {
            lastError = retryErr;
            const retryElapsed = Date.now() - retryStart;
            const retryStatus = retryErr.status || (String(retryErr).includes('TIMEOUT') ? 408 : 500);
            const retryErrMsg = retryErr.message || String(retryErr);
            console.log(`[Interpret] model=${candidateModel} outcome=failed_unsourced_retry status=${retryStatus} search=false ms=${retryElapsed} error="${retryErrMsg.slice(0, 80)}"`);
          }
        }
        // Move to next model immediately without backoff
      }
    }

    if (!fullText || !modelUsed) {
      throw lastError || new Error('All models in fallback chain exhausted for interpretation.');
    }

    sendEvent({ type: 'phase', phase: 'Finalizing exhibit placard...' });

    const parsed = cleanAndParseJson<Record<string, unknown>>(fullText, {});

    // Deduplicate grounding sources
    const sourceMap = new Map<string, string>();
    for (const chunk of finalGroundingChunks) {
      const web = chunk.web;
      if (web?.uri) {
        const title = web.title || new URL(web.uri).hostname.replace('www.', '');
        if (!sourceMap.has(web.uri)) {
          sourceMap.set(web.uri, title);
        }
      }
    }

    const extractedSources = Array.from(sourceMap.entries())
      .slice(0, 5)
      .map(([uri, title]) => ({ uri, title }));

    const deduplicatedSearchQueries = Array.from(new Set(finalSearchQueries)).slice(0, 4);

    const validated = validateInterpretResponse(
      {
        ...parsed,
        sources: extractedSources.length > 0 ? extractedSources : parsed.sources,
      },
      isUnsourced,
      modelUsed,
      deduplicatedSearchQueries,
      observe.tombstone?.date
    );

    sendEvent({ type: 'complete', data: validated });
    return res.end();
  } catch (error: unknown) {
    console.error('Error in /api/interpret:', error);
    sendEvent({
      type: 'error',
      error: mapCuratorialErrorMessage(error),
    });
    return res.end();
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const port = parseInt(process.env.PORT || '3000', 10);

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(import.meta.dirname || '.', 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Provenance server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
