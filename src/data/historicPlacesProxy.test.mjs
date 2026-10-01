import test from 'node:test';
import assert from 'node:assert/strict';
import { historicPlacesProxy } from '../../server/providers/historicPlaces.js';

function install(options = {}) {
  let handler;
  const plugin = historicPlacesProxy(options);
  plugin.configureServer({
    middlewares: {
      use(path, callback) {
        assert.equal(path, '/api/historic-places');
        handler = callback;
      },
    },
  });
  return async (url = '/', method = 'GET') => {
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

test('historic places proxy requires a bounded viewport', async () => {
  const request = install({
    fetchImpl: async () => {
      throw new Error('should not fetch');
    },
  });
  const res = await request('/');
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'bounds_required');
});

test('historic places proxy normalizes NPS GeoJSON for a regional bbox', async () => {
  const urls = [];
  const request = install({
    now: () => 99,
    fetchImpl: async (url) => {
      urls.push(String(url));
      return Response.json({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-122.35, 47.62] },
            properties: {
              NRIS_Refnum: '84003502',
              RESNAME: 'Seattle Statue',
              City: 'Seattle',
              State: 'WASHINGTON',
              CertDate: '1984-04-',
            },
          },
        ],
      });
    },
  });
  const res = await request(
    '/?west=-122.5&south=47.5&east=-122.2&north=47.7&maxrecords=50',
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.fetchedAt, 99);
  assert.equal(res.body.rows.length, 1);
  assert.equal(res.body.rows[0].nrisId, '84003502');
  assert.match(urls[0], /nrhp_locations\/MapServer\/0\/query/);
});
