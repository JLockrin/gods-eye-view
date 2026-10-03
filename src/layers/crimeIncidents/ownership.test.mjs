import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCrimeIncidentSnapshot,
  crimeIncidentSortKey,
} from './records.js';
import { createCrimeIncidentSource } from './source.js';
import { buildCrimeIncidentCard } from './cards.js';
import { createCrimeIncidentsLayer } from './index.js';

test('crime snapshot prefers homicide sort and keeps incident framing', () => {
  const rows = normalizeCrimeIncidentSnapshot(
    [
      {
        id: '1',
        primary_type: 'THEFT',
        date: '2026-01-02T00:00:00.000',
        latitude: '40.74',
        longitude: '-84.10',
        community_area: '1',
      },
      {
        id: '2',
        primary_type: 'HOMICIDE',
        date: '2026-01-01T00:00:00.000',
        latitude: '40.74',
        longitude: '-84.11',
        community_area: '1',
      },
    ],
    { id: 'chicago', name: 'test' },
  );
  // Normalizer still accepts Socrata-shaped fixtures; production proxy is scoped empty.
  assert.equal(rows.length, 2);
  assert.ok(crimeIncidentSortKey(rows[1]) > crimeIncidentSortKey(rows[0]));
  const card = buildCrimeIncidentCard(rows.find((row) => row.severity === 'homicide'));
  assert.match(card.details.join(' '), /not a suspect profile/i);
  assert.match(card.details.join(' '), /Knoxville|Findlay|Lima/i);
});

test('crime source requires a focused viewport and surfaces empty coverage notes', async () => {
  const source = createCrimeIncidentSource({
    fetchImpl: async () => {
      throw new Error('should not fetch');
    },
  });
  const zoom = await source.getSnapshot({
    bounds: { west: -180, south: -90, east: 180, north: 90 },
  });
  assert.equal(zoom.status, 'zoom-in');

  const emptySource = createCrimeIncidentSource({
    fetchImpl: async () =>
      Response.json({
        rows: [],
        coverage: 'none',
        note: 'No keyless official crime-point feed',
      }),
  });
  const empty = await emptySource.getSnapshot({
    bounds: { west: -84.05, south: 35.9, east: -83.85, north: 36.05 },
  });
  assert.equal(empty.status, 'empty');
  assert.match(empty.statusMessage, /keyless|feed/i);
});

test('crime layer mounts focus chips for the four places', () => {
  const viewer = {
    camera: {
      computeViewRectangle: () => null,
      flyToBoundingSphere() {},
      moveEnd: { addEventListener() { return () => {}; } },
    },
    scene: { pick: () => null },
    dataSources: { add() {}, remove() {} },
  };
  const layer = createCrimeIncidentsLayer({
    source: { getSnapshot: async () => ({ rows: [] }) },
    overlayHost: {
      setEntries() {},
      setVisible() {},
      clearSource() {},
      hitTest: () => null,
    },
    screenSpaceEventHandlerFactory: () => ({
      setInputAction() {},
      destroy() {},
    }),
    picking: {
      resolvePickId: () => null,
      isOwnedByOtherLayer: () => false,
      registerPickOwner() {},
      unregisterPickOwner() {},
    },
    pointer: { isPointerFree: () => true },
  });
  layer.init(viewer);
  layer.enable();
  const ids = layer.getRowControls().chips.map((chip) => chip.id);
  assert.ok(ids.includes('lima-oh'));
  assert.ok(ids.includes('beaverdam-oh'));
  assert.ok(ids.includes('findlay-oh'));
  assert.ok(ids.includes('knoxville-tn'));
});
