import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTornadoReportSnapshot,
  normalizeTornadoPolygonSnapshot,
  mergeTornadoSnapshots,
} from './records.js';

test('tornado LSR normalizer keeps tornado points and drops other phenomena', () => {
  const rows = normalizeTornadoReportSnapshot({
    features: [
      {
        id: 'TO.1',
        geometry: { type: 'Point', coordinates: [-97.5, 35.2] },
        properties: {
          phenomena: 'TO',
          city: 'Norman',
          state: 'OK',
          magnitude: 'EF1',
          valid: '2026-05-01T18:00:00Z',
        },
      },
      {
        id: 'SV.1',
        geometry: { type: 'Point', coordinates: [-97.4, 35.1] },
        properties: { phenomena: 'SV', city: 'Moore', state: 'OK' },
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'tornado-report');
  assert.equal(rows[0].severity, 'EF1');
});

test('tornado polygon normalizer accepts warning rings', () => {
  const ring = [
    [-97.6, 35.1],
    [-97.4, 35.1],
    [-97.4, 35.3],
    [-97.6, 35.1],
  ];
  const rows = normalizeTornadoPolygonSnapshot(
    {
      features: [
        {
          id: 'OUN.TO.W.1',
          geometry: { type: 'Polygon', coordinates: [ring] },
          properties: {
            phenomena: 'TO',
            significance: 'W',
            ps: 'Tornado Warning',
            wfo: 'OUN',
            issue: '2026-05-01T18:00:00Z',
          },
        },
      ],
    },
    { kind: 'tornado-warning' },
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].geometryType, 'polygon');
  assert.ok(rows[0].polygons?.[0]?.[0]?.length >= 4);
});

test('merge keeps report and polygon subsets', () => {
  const merged = mergeTornadoSnapshots({
    reports: [{ stableId: 'r1' }],
    warnings: [{ stableId: 'w1' }],
    outlooks: [],
  });
  assert.deepEqual(
    merged.map((row) => row.stableId),
    ['r1', 'w1'],
  );
});
