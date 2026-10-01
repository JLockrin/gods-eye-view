import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistoricPlacesSource } from './source.js';

test('historic places source requires a regional viewport', async () => {
  const source = createHistoricPlacesSource({
    fetchImpl: async () => {
      throw new Error('should not fetch');
    },
  });
  const empty = await source.getSnapshot({
    bounds: { west: -180, south: -90, east: 180, north: 90 },
  });
  assert.deepEqual(empty, []);
});

test('historic places source queries the same-origin proxy with bounds', async () => {
  const calls = [];
  const source = createHistoricPlacesSource({
    fetchImpl: async (url) => {
      calls.push(String(url));
      return Response.json({
        rows: [
          {
            stableId: '84003502',
            lat: 47.62,
            lon: -122.35,
            title: 'Seattle Statue',
            nrisId: '84003502',
          },
        ],
      });
    },
  });
  const rows = await source.getSnapshot({
    bounds: { west: -122.5, south: 47.5, east: -122.2, north: 47.7 },
  });
  assert.equal(rows.length, 1);
  assert.match(calls[0], /\/api\/historic-places\?/);
  assert.match(calls[0], /west=-122\.5/);
});
