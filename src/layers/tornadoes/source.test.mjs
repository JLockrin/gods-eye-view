import test from 'node:test';
import assert from 'node:assert/strict';
import { createTornadoSource } from './source.js';

test('a total feed failure rejects instead of publishing empty success', async () => {
  const source = createTornadoSource({
    fetchImpl: async () =>
      new Response('nope', {
        status: 503,
        headers: { 'content-type': 'text/plain' },
      }),
  });
  await assert.rejects(source.getSnapshot(), /Tornado feed HTTP 503/);
});

test('partial feed success still returns a usable merged snapshot', async () => {
  const source = createTornadoSource({
    fetchImpl: async (url) => {
      if (String(url).includes('lsr.geojson')) {
        return new Response(
          JSON.stringify({
            type: 'FeatureCollection',
            features: [
              {
                id: 'TO.1',
                geometry: { type: 'Point', coordinates: [-97.5, 35.2] },
                properties: {
                  phenomena: 'TO',
                  city: 'Norman',
                  state: 'OK',
                  valid: '2026-05-01T18:00:00Z',
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('nope', { status: 500 });
    },
  });
  const rows = await source.getSnapshot();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'tornado-report');
});

test('cancellation is honored', async () => {
  const abort = new AbortController();
  abort.abort();
  const source = createTornadoSource({
    fetchImpl: async () => new Response('{}', { status: 200 }),
  });
  await assert.rejects(source.getSnapshot({ signal: abort.signal }), {
    name: 'AbortError',
  });
});
