import test from 'node:test';
import assert from 'node:assert/strict';
import { crimeIncidentsProxy } from '../../server/providers/crimeIncidents.js';

function install(options = {}) {
  let handler;
  const plugin = crimeIncidentsProxy(options);
  plugin.configureServer({
    middlewares: {
      use(path, callback) {
        assert.equal(path, '/api/crime-incidents');
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

test('crime proxy requires bounds', async () => {
  const request = install({
    knoxvilleUnsolved: { query: async () => ({ type: 'FeatureCollection', features: [] }) },
  });
  const res = await request('/');
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'bounds_required');
});

test('Ohio focus stays empty with LexisNexis / token-wall block notes', async () => {
  const request = install({
    now: () => 7,
    upstreamUrl: '',
    knoxvilleUnsolved: {
      query: async () => {
        throw new Error('should not query Knoxville for Lima bbox');
      },
    },
  });
  const res = await request(
    '/?west=-84.2&south=40.70&east=-84.0&north=40.78&maxrecords=50',
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.coverage, 'none');
  assert.equal(res.body.rows.length, 0);
  assert.match(res.body.note, /Token Required|LexisNexis|499/i);
  assert.ok(res.body.places.includes('lima-oh'));
});

test('Knoxville focus returns geocoded unsolved-homicide points from the tip page', async () => {
  const request = install({
    now: () => 11,
    upstreamUrl: '',
    knoxvilleUnsolved: {
      id: 'knoxville-unsolved-homicides',
      name: 'Knoxville PD Unsolved Murder Cases (public tip list)',
      aboutUrl: 'https://www.knoxvilletn.gov/government/city_departments_offices/police_department/unsolved_murder_cases',
      async query() {
        return {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-83.92, 35.96] },
              properties: {
                crimeType: 'HOMICIDE',
                description: 'On 02/28/25, tip listing',
                jurisdiction: 'Knoxville, TN · Knox County',
                date: '2025-02-28T00:00:00.000Z',
                id: 'knoxville-unsolved:test',
                title: 'Unsolved homicide · Test Victim',
                sourceId: 'knoxville-unsolved',
                sourceName: 'Knoxville PD Unsolved Murder Cases (city tip page)',
              },
            },
          ],
        };
      },
    },
  });
  const res = await request(
    '/?west=-84.05&south=35.90&east=-83.85&north=36.05&maxrecords=50',
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.rows.length, 1);
  assert.equal(res.body.rows[0].crimeType, 'HOMICIDE');
  assert.equal(res.body.rows[0].severity, 'homicide');
  assert.deepEqual(res.body.sources, ['knoxville-unsolved-homicides']);
  assert.match(res.body.note, /Knoxville/i);
});
