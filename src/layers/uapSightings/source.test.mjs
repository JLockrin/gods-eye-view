import test from 'node:test';
import assert from 'node:assert/strict';
import { createUapSightingSource } from './source.js';

const LINE = JSON.stringify({
  type: 'Feature',
  id: 'uap-1',
  geometry: { type: 'Point', coordinates: [-97.94, 29.88] },
  properties: {
    time: '10/10/1949 20:30',
    year: 1949,
    city: 'san marcos',
    state: 'tx',
    country: 'us',
    shape: 'cylinder',
    summary: 'Lights in the sky',
    verified: false,
    label: 'Sighting report — not a verified phenomenon',
    sourceUrl: 'https://doi.org/10.5281/zenodo.1205624',
  },
});

test('malformed uap geojsonl is rejected', async () => {
  const source = createUapSightingSource({
    fetchImpl: async () => ({ ok: true, text: async () => 'not-json' }),
  });
  await assert.rejects(source.getSnapshot(), /Malformed UAP snapshot/);
});

test('cancellation during body read cannot return a late snapshot', async () => {
  const abort = new AbortController();
  const source = createUapSightingSource({
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
