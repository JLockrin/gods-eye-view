import test from 'node:test';
import assert from 'node:assert/strict';
import { gdeltGeoProxy } from '../../server/providers/gdeltGeo.js';

function install(options = {}) {
  let handler;
  const plugin = gdeltGeoProxy(options);
  plugin.configureServer({
    middlewares: {
      use(path, callback) {
        assert.equal(path, '/api/gdelt-geo');
        handler = callback;
      },
    },
  });
  return async (url = '/?query=protest&maxpoints=20', method = 'GET') => {
    const res = {
      writeHead(status, headers) {
        this.status = status;
        this.headers = headers;
      },
      end(body) {
        this.body = JSON.parse(body);
      },
    };
    await handler(
      { url, method, socket: { remoteAddress: 'local' } },
      res,
    );
    return res;
  };
}

test('gdelt geo proxy falls back to GKG when Geo 2.0 is unavailable', async () => {
  const urls = [];
  const request = install({
    now: () => 42,
    fetchImpl: async (url) => {
      const href = String(url);
      urls.push(href);
      if (href.includes('/api/v2/geo/geo')) {
        return new Response('missing', { status: 404 });
      }
      if (href.includes('/api/v1/gkg_geojson')) {
        return Response.json({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [2.35, 48.85] },
              properties: {
                name: 'Paris, France',
                url: 'https://example.com/paris',
                urlpubtimedate: '2026-10-01T12:00:00Z',
                count: 3,
              },
            },
          ],
        });
      }
      throw new Error(`unexpected ${href}`);
    },
  });
  const res = await request();
  assert.equal(res.status, 200);
  assert.equal(res.body.fetchedAt, 42);
  assert.equal(res.body.feed, 'gkg-geojson');
  assert.equal(res.body.rows.length, 1);
  assert.equal(res.body.rows[0].location, 'Paris, France');
  assert.ok(urls.some((url) => url.includes('/api/v2/geo/geo')));
});

test('gdelt geo proxy rate-limits clients', async () => {
  let calls = 0;
  const request = install({
    fetchImpl: async () => {
      calls += 1;
      return Response.json({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
            properties: { name: 'Null Island', url: 'https://example.com' },
          },
        ],
      });
    },
  });
  for (let i = 0; i < 30; i += 1) await request('/?query=test');
  const limited = await request('/?query=test');
  assert.equal(limited.status, 429);
  assert.ok(calls <= 30);
});
