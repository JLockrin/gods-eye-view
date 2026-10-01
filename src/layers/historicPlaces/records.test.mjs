import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHistoricPlacesSnapshot } from './records.js';

test('historic places snapshot keeps NRIS id, address, and listing date', () => {
  const rows = normalizeHistoricPlacesSnapshot({
    features: [
      {
        geometry: { type: 'Point', coordinates: [-122.35, 47.62] },
        properties: {
          NRIS_Refnum: '84003502',
          RESNAME: 'Seattle, Chief of the Suquamish, Statue',
          Address: '5th Ave., Denny Way, and Cedar St.',
          City: 'Seattle',
          State: 'WASHINGTON',
          CertDate: '1984-04-',
          ResType: 'object',
          Is_NHL: null,
          NARA_URL: 'https://catalog.archives.gov/id/75612684',
        },
      },
      {
        geometry: { type: 'Point', coordinates: [999, 10] },
        properties: { NRIS_Refnum: 'bad' },
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].nrisId, '84003502');
  assert.match(rows[0].summary, /Seattle/);
  assert.equal(rows[0].sourceUrl, 'https://catalog.archives.gov/id/75612684');
});

test('historic places snapshot rejects a non-collection payload', () => {
  assert.equal(normalizeHistoricPlacesSnapshot({}), null);
});
