import assert from 'node:assert/strict';
import test from 'node:test';
import { createSerialKillerPathsLayer } from './index.js';
import { buildSerialKillerPathCard } from './cards.js';
import { SERIAL_PATH_POINT_DISABLE_DEPTH_TEST_DISTANCE } from './index.js';

function harness(source) {
  const owners = new Map();
  const sources = [];
  const viewer = {
    camera: {
      computeViewRectangle: () => null,
    },
    scene: { pick: () => null },
    dataSources: {
      add(value) {
        sources.push(value);
      },
      remove(value) {
        const index = sources.indexOf(value);
        if (index >= 0) sources.splice(index, 1);
      },
    },
  };
  const layer = createSerialKillerPathsLayer({
    source,
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
  layer.enable(viewer);
  return { layer, owners, sources };
}

function propValue(property) {
  return typeof property?.getValue === 'function'
    ? property.getValue()
    : property;
}

test('serial-killer path layer registers pick ownership and depth-safe points', async () => {
  const { layer, owners, sources } = harness({
    getSnapshot: async () => ({
      educationalNote: 'edu',
      paths: [
        {
          stableId: 'alton-coleman:path',
          caseId: 'alton-coleman',
          caseColor: '#0f766e',
          positions: [
            { lat: 42.36, lon: -87.83 },
            { lat: 41.6, lon: -87.34 },
            { lat: 41.65, lon: -83.54 },
          ],
        },
      ],
      sites: [
        {
          stableId: 'alton-coleman:coleman-temple',
          caseId: 'alton-coleman',
          caseName: 'Alton Coleman',
          caseColor: '#0f766e',
          siteId: 'coleman-temple',
          role: 'kill_and_body',
          sequence: 4,
          lat: 41.652914,
          lon: -83.537817,
          title: '#4 kill / body · Virginia & Rachelle Temple',
          placeLabel: 'Toledo, OH',
          approximate: true,
          precision: 'city',
        },
      ],
    }),
  });
  await layer.update();
  assert.equal(owners.has('serial-killer-paths'), true);
  assert.equal(
    owners.get('serial-killer-paths')(
      'serial-killer-path:alton-coleman:coleman-temple',
    ),
    true,
  );
  const entities = [...sources[0].entities.values];
  const point = entities.find((entity) => entity.point);
  assert.ok(point);
  assert.equal(
    propValue(point.point.disableDepthTestDistance),
    SERIAL_PATH_POINT_DISABLE_DEPTH_TEST_DISTANCE,
  );
  assert.equal(
    SERIAL_PATH_POINT_DISABLE_DEPTH_TEST_DISTANCE,
    Number.POSITIVE_INFINITY,
  );
  const line = entities.find((entity) => entity.polyline);
  assert.ok(line);
  assert.equal(propValue(line.polyline.clampToGround), true);
  assert.match(
    buildSerialKillerPathCard({
      title: '#4 kill / body · Virginia & Rachelle Temple',
      caseName: 'Alton Coleman',
      role: 'kill_and_body',
      approximate: true,
      precision: 'city',
      placeLabel: 'Toledo, OH',
      attribution: 'Ohio Supreme Court',
    }).details.join(' '),
    /educational mapping/i,
  );
  const controls = layer.getRowControls();
  assert.equal(controls.info, 'edu');
  assert.ok(controls.legend.length >= 3);
  layer.disable();
  assert.equal(owners.has('serial-killer-paths'), false);
});
