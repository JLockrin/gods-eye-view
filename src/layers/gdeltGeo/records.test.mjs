import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGdeltGeoSnapshot } from './records.js';

test('gdelt geo snapshot keeps article title, date, and link', () => {
  const rows = normalizeGdeltGeoSnapshot({
    features: [
      {
        geometry: { type: 'Point', coordinates: [2.35, 48.85] },
        properties: {
          name: 'Paris, France',
          url: 'https://example.com/paris',
          urlpubtimedate: '2026-10-01T12:00:00Z',
          title: 'Protests in Paris',
          count: 12,
        },
      },
      {
        geometry: { type: 'Point', coordinates: [200, 10] },
        properties: { name: 'bad' },
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].location, 'Paris, France');
  assert.equal(rows[0].sourceUrl, 'https://example.com/paris');
  assert.equal(rows[0].count, 12);
});

test('gdelt geo snapshot accepts proxy rows payloads', () => {
  const rows = normalizeGdeltGeoSnapshot({
    rows: [
      {
        stableId: 'a',
        lat: 1,
        lon: 2,
        title: 'News',
        sourceUrl: 'https://example.com/a',
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stableId, 'a');
});

test('gdelt geo snapshot rejects a non-collection payload', () => {
  assert.equal(normalizeGdeltGeoSnapshot({}), null);
});
