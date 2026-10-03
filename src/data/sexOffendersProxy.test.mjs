import test from 'node:test';
import assert from 'node:assert/strict';
import { sexOffendersProxy } from '../../server/providers/sexOffenders.js';

function install(options = {}) {
  let handler;
  const plugin = sexOffendersProxy(options);
  plugin.configureServer({
    middlewares: {
      use(path, callback) {
        assert.equal(path, '/api/sex-offenders');
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
    await handler({ url, method, socket: { remoteAddress: 'local' } }, res);
    return res;
  };
}

test('sex offenders proxy requires a bounded focused viewport', async () => {
  const request = install({
    fetchImpl: async () => {
      throw new Error('should not fetch');
    },
  });
  const res = await request('/');
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'bounds_required');
});

test('Ohio focus returns empty coverage without calling TBI', async () => {
  const urls = [];
  const request = install({
    now: () => 42,
    fetchImpl: async (url) => {
      urls.push(String(url));
      throw new Error('should not fetch for Ohio');
    },
  });
  const res = await request(
    '/?west=-84.2&south=40.70&east=-84.0&north=40.78&maxrecords=50',
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.coverage, 'none');
  assert.equal(res.body.rows.length, 0);
  assert.equal(urls.length, 0);
  assert.match(res.body.note, /Allen County/);
});

test('Knoxville focus queries TBI with Knox County filter', async () => {
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
            geometry: { type: 'Point', coordinates: [-83.92, 35.96] },
            properties: {
              Tid: '42',
              LastName: 'DOE',
              FirstName: 'JANE',
              ResCity: 'KNOXVILLE',
              ResCounty: 'KNOX',
              ResState: 'TN',
              Classification: 'VIOLENT',
              Tca1: 'RAPE',
              CREATE_DATE: 1_700_000_000_000,
            },
          },
        ],
      });
    },
  });
  const res = await request(
    '/?west=-84.05&south=35.90&east=-83.85&north=36.05&maxrecords=50',
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.rows.length, 1);
  assert.match(urls[0], /TBI_SEX_OFFENDER_REGISTRY/);
  assert.match(urls[0], /ResCounty%3D%27KNOX%27|ResCounty='KNOX'/);
  assert.equal(res.body.sources[0], 'tn-tbi-knox');
});
