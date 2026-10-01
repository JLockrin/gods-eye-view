import assert from 'node:assert/strict';
import test from 'node:test';
import { createTsunamisLayer } from './index.js';
import { buildTsunamiCard } from './cards.js';

function harness(source) {
  const owners = new Map();
  const viewer = {
    camera: {
      computeViewRectangle: () => ({
        west: 2.4,
        south: 0.6,
        east: 2.6,
        north: 0.7,
      }),
    },
    scene: { pick: () => null },
    dataSources: { add() {}, remove() {} },
  };
  const layer = createTsunamisLayer({
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
  return { layer, owners };
}

test('tsunami layer registers pick ownership while enabled', async () => {
  const row = {
    stableId: '5413',
    lat: 38.3,
    lon: 142.3,
    title: 'Tsunami · HONSHU ISLAND, JAPAN',
    tsIntensity: 4,
  };
  const { layer, owners } = harness({
    getSnapshot: async () => [row],
  });
  await layer.update();
  assert.equal(owners.has('tsunamis'), true);
  assert.equal(owners.get('tsunamis')('tsunami:5413'), true);
  assert.match(buildTsunamiCard(row).title, /HONSHU/);
  layer.disable();
  assert.equal(owners.has('tsunamis'), false);
});
