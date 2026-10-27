/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAccessionNumber,
  cleanAndParseJson,
  normalizeHotspotBox,
  filterValidHotspots,
  calculatePinCenter,
  trimStorageList,
  validateObserveResponse,
  validateInterpretResponse,
  shouldGateConfidence,
  sanitizeTimeline,
  parseYearNumber,
  mapCuratorialErrorMessage,
} from './pure-logic.ts';

test('formatAccessionNumber formats correctly with sequence numbers', () => {
  const d = new Date(2026, 9, 20); // October 2026
  assert.equal(formatAccessionNumber([], d), '2026.10.1');
  assert.equal(formatAccessionNumber(['2026.10.1', '2026.10.2'], d), '2026.10.3');
  assert.equal(formatAccessionNumber(['2026.09.4', '2026.10.1'], d), '2026.10.2');
});

test('cleanAndParseJson handles raw JSON and markdown fences', () => {
  const sample = { title: 'Test Object', confidence: 'High' };
  assert.deepEqual(cleanAndParseJson(JSON.stringify(sample), {}), sample);

  const fenced = '```json\n{"big_idea": "Serrell style reading"}\n```';
  assert.deepEqual(cleanAndParseJson(fenced, {}), { big_idea: 'Serrell style reading' });

  const withProse = 'Here is the reading you requested:\n```json\n{"val": 42}\n```\nHope this helps!';
  assert.deepEqual(cleanAndParseJson(withProse, {}), { val: 42 });

  assert.deepEqual(cleanAndParseJson('invalid json', { fallback: true }), { fallback: true });
});

test('normalizeHotspotBox bounds, swaps inverted coordinates, and enforces area bounds', () => {
  const inverted = [800, 700, 200, 100];
  const normalized = normalizeHotspotBox(inverted);
  assert.notEqual(normalized, null);
  if (normalized) {
    assert.ok(normalized[0] <= normalized[2], 'ymin <= ymax');
    assert.ok(normalized[1] <= normalized[3], 'xmin <= xmax');
    assert.equal(normalized[0], 200);
    assert.equal(normalized[2], 800);
  }

  // Too small: 10x10 = 100 area (0.01% < 0.2% = 2,000 threshold)
  const tiny = [100, 100, 110, 110];
  assert.equal(normalizeHotspotBox(tiny), null);

  // Small component: e.g. thin cap/nib 50x50 = 2,500 area (0.25%, >= 0.2% threshold)
  const smallComponent = [100, 100, 150, 150];
  assert.deepEqual(normalizeHotspotBox(smallComponent), [100, 100, 150, 150]);

  // Too large: 960x960 = 921,600 area (92.16% > 90%)
  const huge = [20, 20, 980, 980];
  assert.equal(normalizeHotspotBox(huge), null);

  // Valid standard: 200x200 = 40,000 area (4%, within 0.2%..90%)
  const valid = [100, 100, 300, 300];
  assert.deepEqual(normalizeHotspotBox(valid), [100, 100, 300, 300]);
});

test('filterValidHotspots caps at 5 and drops invalid boxes', () => {
  const rawList = [
    { label: 'Tiny', box_2d: [10, 10, 20, 20] },
    { label: 'Box 1', box_2d: [100, 100, 300, 300] },
    { label: 'Box 2', box_2d: [200, 200, 400, 400] },
    { label: 'Box 3', box_2d: [300, 300, 500, 500] },
    { label: 'Box 4', box_2d: [400, 400, 600, 600] },
    { label: 'Box 5', box_2d: [500, 500, 700, 700] },
    { label: 'Box 6', box_2d: [600, 600, 800, 800] },
  ];
  const filtered = filterValidHotspots(rawList);
  assert.equal(filtered.length, 5);
  assert.equal(filtered[0].label, 'Box 1');
  assert.equal(filtered[4].label, 'Box 5');
});

test('filterValidHotspots keeps top 2 by area when fewer than 2 valid survive', () => {
  // Only 1 hotspot has area >= 2000, but there are smaller candidate features (clip, hole)
  const penFeatures = [
    { label: 'Pen Barrel', box_2d: [200, 100, 800, 200] }, // area 600 * 100 = 60,000 (valid)
    { label: 'Vent Hole', box_2d: [120, 140, 130, 150] }, // area 10 * 10 = 100
    { label: 'Clip', box_2d: [100, 130, 180, 150] }, // area 80 * 20 = 1600 (sub-2000)
  ];
  const result = filterValidHotspots(penFeatures);
  assert.equal(result.length, 2);
  assert.equal(result[0].label, 'Pen Barrel');
  assert.equal(result[1].label, 'Clip'); // Top 2 by area kept!

  // Zero valid hotspots (both sub-2000)
  const tinyPair = [
    { label: 'Nib', box_2d: [500, 500, 530, 520] }, // area 30 * 20 = 600
    { label: 'Cap Hole', box_2d: [100, 100, 110, 120] }, // area 10 * 20 = 200
  ];
  const tinyResult = filterValidHotspots(tinyPair);
  assert.equal(tinyResult.length, 2);
  assert.equal(tinyResult[0].label, 'Nib');
  assert.equal(tinyResult[1].label, 'Cap Hole');
});

test('shouldGateConfidence gates Low confidence and unknown kind', () => {
  assert.equal(shouldGateConfidence({ kind: 'unknown', identification_confidence: 'High' }), true);
  assert.equal(shouldGateConfidence({ kind: 'object', identification_confidence: 'Low' }), true);
  assert.equal(shouldGateConfidence({ kind: 'object', identification_confidence: 'Medium' }), false);
  assert.equal(shouldGateConfidence({ kind: 'building', identification_confidence: 'High' }), false);
});

test('parseYearNumber extracts numeric years correctly', () => {
  assert.equal(parseYearNumber('1950'), 1950);
  assert.equal(parseYearNumber('circa 1895'), 1895);
  assert.equal(parseYearNumber('c. 1642 AD'), 1642);
  assert.equal(parseYearNumber('2026'), 2026);
  assert.equal(parseYearNumber('Uncertain date'), null);
});

test('sanitizeTimeline sorts chronologically, marks is_specimen, and drops post-dated nodes', () => {
  const rawNodes = [
    { year: '1970', title: 'Later derivative', note: 'Created decades later' },
    { year: '1895', title: 'Leitz Stand Ib', note: 'This specimen in hand', is_specimen: true },
    { year: '1590', title: 'Janssen tube', note: 'Prime ancestor' },
    { year: '1872', title: 'Abbe-Zeiss', note: 'Diffraction theory' },
    { year: '2005', title: 'Modern digital sensor', note: 'Far in future' },
  ];

  const sanitized = sanitizeTimeline(rawNodes, '1895');

  // Must drop the 1970 and 2005 nodes because they are after 1895!
  // Preceding nodes must be sorted: 1590, 1872
  // Final node must be 1895 and is_specimen: true
  assert.equal(sanitized.length, 3);
  assert.equal(sanitized[0].year, '1590');
  assert.equal(sanitized[1].year, '1872');
  assert.equal(sanitized[2].year, '1895');
  assert.equal(sanitized[2].is_specimen, true);
  assert.ok(sanitized[2].title.toLowerCase().includes('specimen'));
});

test('validateInterpretResponse includes searchQueries and modelUsed', () => {
  const validated = validateInterpretResponse(
    {
      big_idea: 'Serrell label test',
      overall_confidence: 'High',
    },
    false,
    'gemini-3.6-flash',
    ['Bic Cristal patent history', 'Marcel Bich ballpoint production 1950']
  );
  assert.equal(validated.modelUsed, 'gemini-3.6-flash');
  assert.equal(validated.isUnsourced, false);
  assert.deepEqual(validated.searchQueries, [
    'Bic Cristal patent history',
    'Marcel Bich ballpoint production 1950',
  ]);
});

test('mapCuratorialErrorMessage maps 503, 429, and other errors to calm curatorial notices', () => {
  // 503 / High demand variations
  assert.equal(
    mapCuratorialErrorMessage('503 Service Unavailable'),
    'The archive is busy right now. Trying again usually works.'
  );
  assert.equal(
    mapCuratorialErrorMessage('This model is currently experiencing high demand'),
    'The archive is busy right now. Trying again usually works.'
  );
  assert.equal(
    mapCuratorialErrorMessage({
      error: { code: 503, message: 'This model is currently experiencing high demand' },
    }),
    'The archive is busy right now. Trying again usually works.'
  );

  // 429 / Quota / Resource exhausted variations
  assert.equal(
    mapCuratorialErrorMessage('429 Too Many Requests'),
    'The daily research quota is used up. Try again shortly.'
  );
  assert.equal(
    mapCuratorialErrorMessage('RESOURCE_EXHAUSTED: Quota exceeded for quota metric'),
    'The daily research quota is used up. Try again shortly.'
  );
  assert.equal(
    mapCuratorialErrorMessage(new Error('Rate limit exceeded: 429')),
    'The daily research quota is used up. Try again shortly.'
  );

  // Other / generic errors
  assert.equal(
    mapCuratorialErrorMessage('500 Internal Server Error'),
    'The reading could not be completed.'
  );
  assert.equal(
    mapCuratorialErrorMessage(new Error('SyntaxError: Unexpected token')),
    'The reading could not be completed.'
  );
  assert.equal(
    mapCuratorialErrorMessage(null),
    'The reading could not be completed.'
  );
  assert.equal(
    mapCuratorialErrorMessage(undefined),
    'The reading could not be completed.'
  );
});
