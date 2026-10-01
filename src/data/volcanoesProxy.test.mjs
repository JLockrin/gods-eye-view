import test from 'node:test';
import assert from 'node:assert/strict';
import { volcanoesProxy } from '../../server/providers/volcanoes.js';

const statusFeature = {
  type: 'Feature',
  id: '311120',
  geometry: { type: 'Point', coordinates: [-176.11, 52.07] },
  properties: {
    vnum: '311120',
    volcanoName: 'Great Sitkin',
    alertLevel: 'WATCH',
    colorCode: 'ORANGE',
    noticeSynopsis: 'Slow eruption',
    region: 'Alaska',
  },
};

const elevatedRow = {
  vName: 'Great Sitkin',
  vnum: '311120',
  lat: 52.07,
  long: -176.11,
  alertLevel: 'WATCH',
  colorCode: 'ORANGE',
  noticeSynopsis: 'Slow eruption',
};

function install(options = {}, hook = 'configureServer') {
  let handler;
  const plugin = volcanoesProxy(options);
  assert.equal(typeof plugin.configureServer, 'function');
  assert.equal(typeof plugin.configurePreviewServer, 'function');
  plugin[hook]({
    middlewares: {
      use(path, callback) {
        assert.equal(path, '/api/volcanoes');
        handler = callback;
      },
    },
  });
  return async (url = '/', method = 'GET', peer = 'local') => {
    const res = {
      writeHead(status, headers) {
        this.status = status;
        this.headers = headers;
      },
      end(body) {
        this.body = JSON.parse(body);
      },
    };
    await handler({ url, method, socket: { remoteAddress: peer } }, res);
    return res;
  };
}

for (const hook of ['configureServer', 'configurePreviewServer']) {
  test(`${hook}: merges status + elevated into normalized rows`, async () => {
    const urls = [];
    const request = install(
      {
        now: () => 1234,
        fetchImpl: async (url) => {
          urls.push(String(url));
          if (String(url).includes('/elevated')) {
            return Response.json([elevatedRow]);
          }
          return Response.json({
            type: 'FeatureCollection',
            features: [statusFeature],
          });
        },
      },
      hook,
    );
    const res = await request();
    assert.equal(res.status, 200);
    assert.equal(res.body.fetchedAt, 1234);
    assert.equal(res.body.rows.length, 1);
    assert.equal(res.body.rows[0].stableId, '311120');
    assert.equal(res.body.rows[0].severity, 'watch');
    assert.ok(urls.every((url) => url.startsWith('https://volcanoes.usgs.gov/')));
    assert.ok(urls.some((url) => url.endsWith('/geojson')));
    assert.ok(urls.some((url) => url.endsWith('/elevated')));
  });
}

test('elevated-only success still yields rows when status fails', async () => {
  const request = install({
    now: () => 99,
    fetchImpl: async (url) => {
      if (String(url).includes('/elevated')) {
        return Response.json([elevatedRow]);
      }
      return new Response('nope', { status: 500 });
    },
  });
  const res = await request();
  assert.equal(res.status, 200);
  assert.equal(res.body.rows.length, 1);
  assert.equal(res.body.rows[0].severity, 'watch');
});

test('status-only success still yields rows when elevated fails', async () => {
  const request = install({
    fetchImpl: async (url) => {
      if (String(url).includes('/elevated')) {
        return new Response('nope', { status: 503 });
      }
      return Response.json({ features: [statusFeature] });
    },
  });
  const res = await request();
  assert.equal(res.status, 200);
  assert.equal(res.body.rows.length, 1);
  assert.equal(res.body.rows[0].stableId, '311120');
});

test('both upstream legs failing produce a sanitized 502', async () => {
  const request = install({
    fetchImpl: async () => new Response('nope', { status: 500 }),
  });
  const res = await request();
  assert.equal(res.status, 502);
  assert.deepEqual(res.body, { error: 'volcanoes_unavailable' });
});

test('a failed refresh serves the last good volcano snapshot as stale', async () => {
  let clock = 0;
  let calls = 0;
  const request = install({
    now: () => clock,
    fetchImpl: async (url) => {
      if (++calls > 2) throw new Error('private upstream details');
      if (String(url).includes('/elevated')) return Response.json([]);
      return Response.json({ features: [statusFeature] });
    },
  });
  await request();
  clock = 300_000;
  const res = await request();
  assert.equal(res.status, 200);
  assert.equal(res.body.stale, true);
  assert.equal(res.body.fetchedAt, 0);
  assert.equal(res.body.rows[0].stableId, '311120');
});

test('fresh cache does not re-fetch upstream', async () => {
  let calls = 0;
  const request = install({
    fetchImpl: async (url) => {
      calls++;
      if (String(url).includes('/elevated')) return Response.json([]);
      return Response.json({ features: [statusFeature] });
    },
  });
  const first = await request();
  assert.deepEqual((await request()).body, first.body);
  assert.equal(calls, 2);
});

test('non-GET methods are rejected', async () => {
  const request = install({
    fetchImpl: async () => Response.json({ features: [] }),
  });
  const res = await request('/', 'POST');
  assert.equal(res.status, 405);
  assert.deepEqual(res.body, { error: 'method_not_allowed' });
});
