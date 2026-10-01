import test from 'node:test';
import assert from 'node:assert/strict';
import { createAviationAccidentSource } from './source.js';

const LINE = JSON.stringify({
  type: 'Feature',
  id: 'SEA26FA001',
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
});

test('malformed geojsonl is never accepted as an empty aviation snapshot', async () => {
  const source = createAviationAccidentSource({
    fetchImpl: async () => ({ ok: true, text: async () => '{not-json' }),
  });
  await assert.rejects(source.getSnapshot(), /Malformed NTSB snapshot/);
});

test('body completion honors cancellation without replacing records', async () => {
  const abort = new AbortController();
  const source = createAviationAccidentSource({
    fetchImpl: async () => ({
      ok: true,
      text: async () => {
        abort.abort();
        return `${LINE}\n`;
      },
    }),
  });
  await assert.rejects(source.getSnapshot({ signal: abort.signal }), {
    name: 'AbortError',
  });
});

test('successful snapshot normalizes and caches rows', async () => {
  let calls = 0;
  const source = createAviationAccidentSource({
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, text: async () => `${LINE}\n` };
    },
  });
  const first = await source.getSnapshot();
  const second = await source.getSnapshot();
  assert.equal(calls, 1);
  assert.equal(first.length, 1);
  assert.equal(second[0].stableId, 'SEA26FA001');
});
