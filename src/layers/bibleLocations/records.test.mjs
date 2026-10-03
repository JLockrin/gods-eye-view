import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBibleLocationSnapshot } from './records.js';

test('bible normalizer keeps event, citation, and outbound link from the pack', () => {
  const rows = normalizeBibleLocationSnapshot({
    features: [
      {
        id: 'a15257a',
        geometry: { type: 'Point', coordinates: [35.234167, 31.776667] },
        properties: {
          name: 'Jerusalem',
          event:
            'Now it came to pass, when Adonizedec king of Jerusalem had heard…',
          citation: 'Josh 10:1',
          verses: ['Josh 10:1', 'Josh 10:2'],
          sourceUrl: 'https://www.openbible.info/geo/ancient/a15257a/jerusalem',
          source: 'OpenBible.info Bible Geocoding (CC BY 4.0)',
          eventSource: 'KJV (public domain)',
          confidence: 1000,
          kind: 'settlement',
        },
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stableId, 'a15257a');
  assert.equal(rows[0].title, 'Jerusalem');
  assert.match(rows[0].event, /Jerusalem/);
  assert.equal(rows[0].citation, 'Josh 10:1');
  assert.equal(
    rows[0].sourceUrl,
    'https://www.openbible.info/geo/ancient/a15257a/jerusalem',
  );
  assert.match(rows[0].source, /OpenBible/);
});

test('bible normalizer drops features without reliable coordinates or event/citation', () => {
  const rows = normalizeBibleLocationSnapshot({
    features: [
      {
        id: 'no-coords',
        geometry: { type: 'Point', coordinates: [null, null] },
        properties: {
          name: 'Unknown',
          event: 'x',
          citation: 'Gen 1:1',
        },
      },
      {
        id: 'no-event',
        geometry: { type: 'Point', coordinates: [35, 31] },
        properties: { name: 'Bare', citation: 'Gen 1:1' },
      },
      {
        id: 'ok',
        geometry: { type: 'Point', coordinates: [35, 31] },
        properties: {
          name: 'Ok',
          event: 'And God said…',
          citation: 'Gen 1:3',
          sourceUrl: 'https://www.openbible.info/geo/',
        },
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stableId, 'ok');
});

test('bible normalizer rejects non-collections', () => {
  assert.equal(normalizeBibleLocationSnapshot({}), null);
});
