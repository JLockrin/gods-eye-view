import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeSerialKillerPathSnapshot } from './records.js';

const bundled = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        '../../data/local_data/serial_killer_paths/cases.json',
        import.meta.url,
      ),
    ),
    'utf8',
  ),
);

test('bundled pack normalizes two cases with path and body-found roles', () => {
  const snapshot = normalizeSerialKillerPathSnapshot(bundled);
  assert.ok(snapshot);
  assert.equal(snapshot.sites.length >= 10, true);
  const caseIds = new Set(snapshot.sites.map((row) => row.caseId));
  assert.deepEqual([...caseIds].sort(), ['alton-coleman', 'anthony-sowell']);
  assert.equal(snapshot.paths.length, 1);
  assert.equal(snapshot.paths[0].caseId, 'alton-coleman');
  assert.ok(snapshot.paths[0].positions.length >= 5);

  const imperial = snapshot.sites.find(
    (row) => row.siteId === 'sowell-imperial',
  );
  assert.ok(imperial);
  assert.equal(imperial.role, 'kill_and_body');
  assert.equal(imperial.precision, 'address');
  assert.equal(imperial.approximate, false);
  assert.equal(imperial.victims.length, 11);

  const bodyOnly = snapshot.sites.filter((row) => row.role === 'body');
  assert.ok(bodyOnly.some((row) => row.siteId === 'coleman-williams-body'));
  assert.ok(bodyOnly.some((row) => row.siteId === 'coleman-storey-body'));
});

test('normalize rejects malformed payloads and skips bad coordinates', () => {
  assert.equal(normalizeSerialKillerPathSnapshot(null), null);
  assert.equal(normalizeSerialKillerPathSnapshot({}), null);
  const snapshot = normalizeSerialKillerPathSnapshot({
    cases: [
      {
        id: 'x',
        name: 'X',
        pathSiteIds: ['good', 'bad'],
        sites: [
          {
            id: 'good',
            role: 'kill',
            sequence: 1,
            lat: 41.5,
            lon: -81.6,
            placeLabel: 'OK',
          },
          {
            id: 'bad',
            role: 'kill',
            sequence: 2,
            lat: 999,
            lon: -81.6,
          },
        ],
      },
    ],
  });
  assert.equal(snapshot.sites.length, 1);
  assert.equal(snapshot.paths.length, 0);
});
