import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUapSightingSnapshot } from './records.js';

test('uap normalizer labels every row as an unverified sighting report', () => {
  const rows = normalizeUapSightingSnapshot({
    features: [
      {
        id: 'uap-1',
        geometry: { type: 'Point', coordinates: [-97.94, 29.88] },
        properties: {
          time: '10/10/1949 20:30',
          year: 1949,
          city: 'san marcos',
          state: 'tx',
          country: 'us',
          shape: 'cylinder',
          summary: 'Lights in the sky',
          verified: true, // must be forced false
        },
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].verified, false);
  assert.match(rows[0].label, /not a verified phenomenon/i);
  assert.match(rows[0].title, /sighting report/i);
});

test('uap normalizer rejects non-collections', () => {
  assert.equal(normalizeUapSightingSnapshot({}), null);
});
