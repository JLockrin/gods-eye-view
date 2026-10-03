import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_POINT_DISABLE_DEPTH_TEST_DISTANCE } from './pointEventLayer.js';
import { createSexOffendersLayer } from '../sexOffenders/index.js';
import { createCrimeIncidentsLayer } from '../crimeIncidents/index.js';

test('event point markers depth-test against the globe (no through-Earth paint)', () => {
  assert.equal(EVENT_POINT_DISABLE_DEPTH_TEST_DISTANCE, 0);
  assert.notEqual(
    EVENT_POINT_DISABLE_DEPTH_TEST_DISTANCE,
    Number.POSITIVE_INFINITY,
  );
});

function harness(createLayer, sourceRows) {
  const sources = [];
  const viewer = {
    camera: {
      // Radians covering Lima, OH (~40.74N, 84.1W).
      computeViewRectangle: () => ({
        west: -1.48,
        south: 0.7,
        east: -1.45,
        north: 0.72,
      }),
      flyToBoundingSphere() {},
      moveEnd: {
        addEventListener() {
          return () => {};
        },
      },
    },
    scene: { pick: () => null },
    dataSources: {
      add(value) {
        sources.push(value);
      },
      remove() {},
    },
  };
  const layer = createLayer({
    source: { getSnapshot: async () => sourceRows },
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
  return { layer, sources };
}

test('sex offender and crime point entities use globe depth testing', async () => {
  const row = {
    stableId: 'point-1',
    lat: 40.74,
    lon: -84.1,
    title: 'Test',
    offenseCategory: 'Class A',
    crimeType: 'HOMICIDE',
    jurisdiction: 'Lima, OH',
    sourceName: 'test',
  };
  for (const createLayer of [createSexOffendersLayer, createCrimeIncidentsLayer]) {
    const { layer, sources } = harness(createLayer, { rows: [row] });
    await layer.update();
    const entity = sources[0]?.entities?.values?.[0];
    assert.ok(entity?.point, 'entity point exists');
    const depth =
      typeof entity.point.disableDepthTestDistance?.getValue === 'function'
        ? entity.point.disableDepthTestDistance.getValue()
        : entity.point.disableDepthTestDistance;
    assert.equal(depth, 0);
    layer.destroy();
  }
});
