import test from 'node:test';
import assert from 'node:assert/strict';
import { createShipwreckSource } from './source.js';

test('whole-globe bounds fail soft with an empty shipwreck snapshot', async () => {
  let calls = 0;
  const source = createShipwreckSource({
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, json: async () => ({ features: [] }) };
    },
  });
  const rows = await source.getSnapshot({
    bounds: { west: -180, south: -90, east: 180, north: 90 },
  });
  assert.deepEqual(rows, []);
  assert.equal(calls, 0);
});

test('malformed NOAA payloads are rejected', async () => {
  const source = createShipwreckSource({
    fetchImpl: async () =>
      new Response(JSON.stringify({ not: 'geojson' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  });
  // Missing `features` normalizes to null and must not paint as success.
  // Both harbor + approach queries return the same malformed body.
  await assert.rejects(
    source.getSnapshot({
      bounds: { west: -75, south: 39, east: -73, north: 41 },
    }),
    /Malformed NOAA wreck response/,
  );
});

test('cancellation during JSON parsing cannot return a late snapshot', async () => {
  const abort = new AbortController();
  const source = createShipwreckSource({
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          type: 'FeatureCollection',
          features: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
  });
  // Abort after scheduling
  const pending = source.getSnapshot({
    signal: abort.signal,
    bounds: { west: -75, south: 39, east: -73, north: 41 },
  });
  abort.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
