import test from 'node:test';
import assert from 'node:assert/strict';
import { createTsunamiSource } from './source.js';

test('tsunami source caches the bundled geojsonl snapshot', async () => {
  const calls = [];
  const feature = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [142.3, 38.3] },
    properties: {
      id: 5413,
      year: 2011,
      location: 'HONSHU ISLAND',
      country: 'JAPAN',
      tsIntensity: 4,
    },
  };
  const source = createTsunamiSource({
    url: 'memory://tsunami',
    fetchImpl: async (url) => {
      calls.push(String(url));
      return new Response(`${JSON.stringify(feature)}\n`, { status: 200 });
    },
  });
  const first = await source.getSnapshot();
  const second = await source.getSnapshot();
  assert.equal(calls.length, 1);
  assert.equal(first.length, 1);
  assert.equal(second[0].stableId, '5413');
});

test('tsunami source rejects malformed geojsonl', async () => {
  const source = createTsunamiSource({
    url: 'memory://bad',
    fetchImpl: async () => new Response('{not-json\n', { status: 200 }),
  });
  await assert.rejects(() => source.getSnapshot(), /Malformed/);
});
