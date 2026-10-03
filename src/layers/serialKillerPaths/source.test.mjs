import assert from 'node:assert/strict';
import test from 'node:test';
import { createSerialKillerPathSource } from './source.js';

test('serial-killer path source caches the bundled snapshot', async () => {
  let calls = 0;
  const source = createSerialKillerPathSource({
    fetchImpl: async () => {
      calls += 1;
      return {
        ok: true,
        async json() {
          return {
            educationalNote: 'note',
            cases: [
              {
                id: 'anthony-sowell',
                name: 'Anthony Sowell',
                color: '#b45309',
                pathSiteIds: ['sowell-imperial'],
                sites: [
                  {
                    id: 'sowell-imperial',
                    role: 'kill_and_body',
                    sequence: 1,
                    lat: 41.472896,
                    lon: -81.597598,
                    placeLabel: '12205 Imperial Avenue',
                  },
                ],
              },
            ],
          };
        },
      };
    },
  });
  const first = await source.getSnapshot();
  const second = await source.getSnapshot();
  assert.equal(calls, 1);
  assert.equal(first.sites.length, 1);
  assert.equal(second, first);
});
