import test from 'node:test';
import assert from 'node:assert/strict';
import { createBibleLocationSource } from './source.js';

test('bible source loads a geojsonl snapshot once and caches it', async () => {
  let calls = 0;
  const feature = {
    type: 'Feature',
    id: 'a15257a',
    geometry: { type: 'Point', coordinates: [35.234167, 31.776667] },
    properties: {
      name: 'Jerusalem',
      event: 'Now it came to pass…',
      citation: 'Josh 10:1',
      verses: ['Josh 10:1'],
      sourceUrl: 'https://www.openbible.info/geo/ancient/a15257a/jerusalem',
    },
  };
  const source = createBibleLocationSource({
    url: 'https://example.test/bible.geojsonl',
    fetchImpl: async () => {
      calls += 1;
      return {
        ok: true,
        async text() {
          return `${JSON.stringify(feature)}\n`;
        },
      };
    },
  });
  const first = await source.getSnapshot();
  const second = await source.getSnapshot();
  assert.equal(calls, 1);
  assert.equal(first.length, 1);
  assert.equal(second[0].stableId, 'a15257a');
  assert.equal(source.label, 'OpenBible.info');
});
