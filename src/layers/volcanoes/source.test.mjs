import test from 'node:test';
import assert from 'node:assert/strict';
import { createVolcanoSource } from './source.js';

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

test('elevated-only success still yields rows', async () => {
  const source = createVolcanoSource({
    fetchImpl: async (url) => {
      if (String(url).includes('elevated')) {
        return new Response(
          JSON.stringify([
            {
              vName: 'Great Sitkin',
              vnum: '311120',
              lat: 52.07,
              long: -176.11,
              alertLevel: 'WATCH',
              colorCode: 'ORANGE',
              noticeSynopsis: 'Slow eruption',
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('nope', { status: 500 });
    },
  });
  const rows = await source.getSnapshot();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].severity, 'watch');
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
