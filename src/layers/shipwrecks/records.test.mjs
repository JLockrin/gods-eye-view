import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeShipwreckSnapshot } from './records.js';

test('shipwreck snapshot keeps charted wreck metadata', () => {
  const rows = normalizeShipwreckSnapshot({
    features: [
      {
        id: 1,
        geometry: { type: 'Point', coordinates: [-74.0, 40.5] },
        properties: {
          OBJECTID: 1,
          OBJNAM: 'USS Example',
          CATWRK: 'dangerous wreck',
          INFORM: 'depth unknown',
          SORDAT: '20150717',
        },
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].severity, 'hazard');
  assert.match(rows[0].title, /USS Example/);
});

test('shipwreck snapshot rejects non-collections', () => {
  assert.equal(normalizeShipwreckSnapshot({}), null);
});
