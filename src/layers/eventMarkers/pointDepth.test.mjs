import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_POINT_DISABLE_DEPTH_TEST_DISTANCE } from './pointEventLayer.js';
import { createUapSightingsLayer } from '../uapSightings/index.js';
import { createAviationAccidentsLayer } from '../aviationAccidents/index.js';
import { createTsunamisLayer } from '../tsunamis/index.js';
import { createGdeltGeoLayer } from '../gdeltGeo/index.js';
import { createHistoricPlacesLayer } from '../historicPlaces/index.js';
import { createVolcanoesLayer } from '../volcanoes/index.js';
import { createShipwrecksLayer } from '../shipwrecks/index.js';
import { createTornadoesLayer } from '../tornadoes/index.js';
import {
  createSerialKillerPathsLayer,
  SERIAL_PATH_POINT_DISABLE_DEPTH_TEST_DISTANCE,
} from '../serialKillerPaths/index.js';

test('event point markers depth-test against the globe (no through-Earth paint)', () => {
  // Infinity was the through-the-planet bug: far-side points ignored globe depth.
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
      computeViewRectangle: () => ({
        west: -2.2,
        south: 0.8,
        east: -2.0,
        north: 0.9,
      }),
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
      remove(value) {
        const index = sources.indexOf(value);
        if (index >= 0) sources.splice(index, 1);
      },
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
      resolvePickId: (picked) => picked?.id ?? null,
      isOwnedByOtherLayer: () => false,
      registerPickOwner() {},
      unregisterPickOwner() {},
    },
    pointer: { isPointerFree: () => true },
  });
  layer.init(viewer);
  layer.enable(viewer);
  return { layer, sources };
}

function pointDepthDistance(entity) {
  const value = entity?.point?.disableDepthTestDistance;
  return typeof value?.getValue === 'function' ? value.getValue() : value;
}

async function assertDepthTestedPoints(createLayer, rows) {
  const { layer, sources } = harness(createLayer, rows);
  await layer.update();
  assert.equal(sources.length, 1);
  const entities = [...sources[0].entities.values].filter(
    (entity) => entity.point,
  );
  assert.ok(
    entities.length >= 1,
    `${layer.id} should render at least one point`,
  );
  for (const entity of entities) {
    assert.equal(
      pointDepthDistance(entity),
      EVENT_POINT_DISABLE_DEPTH_TEST_DISTANCE,
      `${layer.id} point must depth-test against the globe`,
    );
  }
  layer.disable();
}

const sharedPointRow = {
  stableId: 'probe',
  lat: 47.6,
  lon: -122.3,
  title: 'Probe',
  summary: 'Probe',
};

test('shared event point layers depth-test after update', async () => {
  for (const createLayer of [
    createUapSightingsLayer,
    createAviationAccidentsLayer,
    createTsunamisLayer,
    createGdeltGeoLayer,
    createHistoricPlacesLayer,
    createVolcanoesLayer,
    createShipwrecksLayer,
  ]) {
    await assertDepthTestedPoints(createLayer, [sharedPointRow]);
  }
});

test('tornado report points also depth-test against the globe', async () => {
  await assertDepthTestedPoints(createTornadoesLayer, [
    {
      stableId: 'tor-1',
      kind: 'report',
      lat: 35.2,
      lon: -97.4,
      title: 'Tornado report',
    },
  ]);
});

test('serial-killer path points follow sparse surface-marker depth policy', async () => {
  // Installations/FIRMS/cyclones use Infinity so photoreal tiles do not bury pins.
  assert.equal(
    SERIAL_PATH_POINT_DISABLE_DEPTH_TEST_DISTANCE,
    Number.POSITIVE_INFINITY,
  );
  const { layer, sources } = harness(createSerialKillerPathsLayer, {
    paths: [],
    sites: [
      {
        stableId: 'probe',
        lat: 41.47,
        lon: -81.6,
        title: 'Probe',
        role: 'kill_and_body',
        caseColor: '#b45309',
      },
    ],
  });
  await layer.update();
  const entities = [...sources[0].entities.values].filter(
    (entity) => entity.point,
  );
  assert.ok(entities.length >= 1);
  for (const entity of entities) {
    assert.equal(
      pointDepthDistance(entity),
      SERIAL_PATH_POINT_DISABLE_DEPTH_TEST_DISTANCE,
    );
  }
  layer.disable();
});
