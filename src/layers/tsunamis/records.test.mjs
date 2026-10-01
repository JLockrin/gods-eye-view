import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTsunamiSnapshot } from './records.js';

test('tsunami snapshot keeps NCEI ids, intensity, and source URLs', () => {
  const rows = normalizeTsunamiSnapshot({
    features: [
      {
        geometry: { type: 'Point', coordinates: [999, 10] },
        properties: { id: 1, year: 1900 },
      },
      {
        geometry: { type: 'Point', coordinates: [142.3, 38.3] },
        properties: {
          id: 5413,
          year: 2011,
          location: 'HONSHU ISLAND',
          country: 'JAPAN',
          tsIntensity: 4,
          eqMagnitude: 9.1,
          deaths: 18434,
          url: 'https://www.ngdc.noaa.gov/hazel/view/hazards/tsunami/event-more-info/5413',
        },
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stableId, '5413');
  assert.equal(rows[0].tsIntensity, 4);
  assert.match(rows[0].title, /HONSHU/);
  assert.match(rows[0].sourceUrl, /5413/);
});

test('tsunami snapshot rejects a non-collection payload', () => {
  assert.equal(normalizeTsunamiSnapshot({}), null);
  assert.equal(normalizeTsunamiSnapshot(null), null);
});
