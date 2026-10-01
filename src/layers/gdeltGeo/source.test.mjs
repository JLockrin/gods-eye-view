import test from 'node:test';
import assert from 'node:assert/strict';
import { createGdeltGeoSource } from './source.js';

test('gdelt geo source reads normalized rows from the same-origin proxy', async () => {
  const calls = [];
  const source = createGdeltGeoSource({
    query: 'protest',
    fetchImpl: async (url) => {
      calls.push(String(url));
      return Response.json({
        rows: [
          {
            stableId: 'p1',
            lat: 48.85,
            lon: 2.35,
            title: 'Protests in Paris',
            location: 'Paris, France',
            sourceUrl: 'https://example.com/paris',
            count: 4,
          },
        ],
        feed: 'gkg-geojson',
        query: 'protest',
      });
    },
  });
  const rows = await source.getSnapshot();
  assert.equal(rows.length, 1);
  assert.match(calls[0], /\/api\/gdelt-geo\?/);
  assert.match(calls[0], /query=protest/);
  const again = await source.getSnapshot();
  assert.equal(calls.length, 1);
  assert.equal(again[0].stableId, 'p1');
});

test('gdelt geo source rejects malformed proxy payloads', async () => {
  const source = createGdeltGeoSource({
    fetchImpl: async () => Response.json({ nope: true }),
  });
  await assert.rejects(() => source.getSnapshot(), /Malformed/);
});
