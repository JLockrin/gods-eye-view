import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAviationAccidentSnapshot } from './records.js';

test('aviation snapshot skips invalid coordinates and keeps fatal severity', () => {
  const rows = normalizeAviationAccidentSnapshot({
    features: [
      {
        id: 'bad',
        geometry: { type: 'Point', coordinates: [999, 10] },
        properties: { ntsbNo: 'BAD', injury: 'FATL' },
      },
      {
        id: 'ok',
        geometry: { type: 'Point', coordinates: [-122.3, 47.6] },
        properties: {
          ntsbNo: 'SEA26FA001',
          injury: 'FATL',
          city: 'Seattle',
          state: 'WA',
          country: 'USA',
          year: 2026,
          time: '01/02/26 00:00:00',
          type: 'ACC',
        },
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stableId, 'SEA26FA001');
  assert.equal(rows[0].severity, 'fatal');
  assert.match(rows[0].title, /Seattle/);
});

test('aviation snapshot rejects a non-collection payload', () => {
  assert.equal(normalizeAviationAccidentSnapshot({}), null);
  assert.equal(normalizeAviationAccidentSnapshot(null), null);
});
