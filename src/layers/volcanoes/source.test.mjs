import test from 'node:test';
import assert from 'node:assert/strict';
import { createVolcanoSource } from './source.js';

test('client source fetches only the same-origin volcanoes proxy', async () => {
  let requested;
  const source = createVolcanoSource({
    fetchImpl: async (url) => {
      requested = String(url);
      return new Response(
        JSON.stringify({
          fetchedAt: 1,
          rows: [
            {
              stableId: '311120',
              lat: 52.07,
              lon: -176.11,
              severity: 'watch',
              title: 'Volcano · Great Sitkin',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });
  const rows = await source.getSnapshot();
  assert.equal(requested, '/api/volcanoes');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stableId, '311120');
});

test('malformed successful response is never accepted as an empty volcano snapshot', async () => {
  const source = createVolcanoSource({
    fetchImpl: async () =>
      new Response(JSON.stringify({ hello: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  });
  await assert.rejects(source.getSnapshot(), /Malformed USGS volcano response/);
});

test('proxy HTTP failures surface their status', async () => {
  const source = createVolcanoSource({
    fetchImpl: async () => new Response('nope', { status: 502 }),
  });
  await assert.rejects(source.getSnapshot(), /USGS volcano HTTP 502/);
});

test('response-body completion honors cancellation', async () => {
  const abort = new AbortController();
  abort.abort();
  const source = createVolcanoSource({
    fetchImpl: async () => new Response('{}', { status: 200 }),
  });
  await assert.rejects(source.getSnapshot({ signal: abort.signal }), {
    name: 'AbortError',
  });
});
