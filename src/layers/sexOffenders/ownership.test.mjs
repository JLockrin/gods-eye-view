import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSexOffenderSnapshot } from './records.js';
import { createSexOffenderSource } from './source.js';
import { buildSexOffenderCard } from './cards.js';
import { createSexOffendersLayer } from './index.js';

test('sex offender snapshot keeps category and jurisdiction without street prose', () => {
  const rows = normalizeSexOffenderSnapshot(
    {
      features: [
        {
          geometry: { type: 'Point', coordinates: [-83.92, 35.96] },
          properties: {
            Tid: '0001',
            LastName: 'DOE',
            FirstName: 'JANE',
            ResCity: 'KNOXVILLE',
            ResCounty: 'KNOX',
            ResState: 'TN',
            Classification: 'VIOLENT',
            Tca1: 'RAPE',
            CREATE_DATE: 1_700_000_000_000,
            ResAddr1: '123 SECRET STREET',
          },
        },
      ],
    },
    {
      id: 'tn-tbi',
      name: 'Tennessee TBI Sex Offender Registry (Knox County)',
      aboutUrl: 'https://example.test/tbi',
    },
  );
  assert.equal(rows.length, 1);
  assert.match(rows[0].offenseCategory, /VIOLENT/);
  assert.match(rows[0].jurisdiction, /Knox|KNOXVILLE|TN/i);
  assert.equal(rows[0].sourceName.includes('TBI'), true);
  const card = buildSexOffenderCard(rows[0]);
  assert.doesNotMatch(card.details.join(' '), /SECRET STREET/);
  assert.match(card.details.join(' '), /public registry/);
});

test('sex offender source asks for a focused regional viewport', async () => {
  const source = createSexOffenderSource({
    fetchImpl: async () => {
      throw new Error('should not fetch');
    },
  });
  const zoom = await source.getSnapshot({
    bounds: { west: -180, south: -90, east: 180, north: 90 },
  });
  assert.equal(zoom.status, 'zoom-in');
  assert.match(zoom.statusMessage, /Lima|Knoxville/);
});

test('sex offender source surfaces proxy empty notes for Ohio coverage gaps', async () => {
  const source = createSexOffenderSource({
    fetchImpl: async () =>
      Response.json({
        rows: [],
        coverage: 'none',
        note: 'Allen County OH empty note',
      }),
  });
  const empty = await source.getSnapshot({
    bounds: { west: -84.2, south: 40.7, east: -84.0, north: 40.78 },
  });
  assert.equal(empty.status, 'empty');
  assert.match(empty.statusMessage, /Allen County/);
});

test('sex offenders layer registers pick ownership and focus chips', async () => {
  const owners = new Map();
  const flights = [];
  const viewer = {
    camera: {
      computeViewRectangle: () => null,
      flyToBoundingSphere(_sphere, options) {
        flights.push(options);
      },
      moveEnd: {
        addEventListener() {
          return () => {};
        },
      },
    },
    scene: { pick: () => null },
    dataSources: { add() {}, remove() {} },
  };
  const layer = createSexOffendersLayer({
    source: {
      getSnapshot: async () => ({
        rows: [
          {
            stableId: 'tn-tbi:1',
            lat: 35.96,
            lon: -83.92,
            title: 'JANE DOE',
            offenseCategory: 'VIOLENT',
            jurisdiction: 'Knoxville, Knox County, TN',
            asOf: '2026-01-01',
            sourceName: 'TBI',
          },
        ],
      }),
    },
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
      resolvePickId: (picked) => picked?.id ?? null,
      isOwnedByOtherLayer: () => false,
      registerPickOwner: (layerId, predicate) => owners.set(layerId, predicate),
      unregisterPickOwner: (layerId) => owners.delete(layerId),
    },
    pointer: { isPointerFree: () => true },
  });
  layer.init(viewer);
  layer.enable();
  assert.ok(flights.length >= 1, 'enable flies to the Ohio focus overview');
  const controls = layer.getRowControls();
  assert.ok(controls.chips.some((chip) => chip.id === 'knoxville-tn'));
  assert.match(controls.info, /Allen Co\. OH/);
  await layer.update();
  assert.equal(owners.has('sex-offenders'), true);
  layer.disable();
  assert.equal(owners.has('sex-offenders'), false);
});
