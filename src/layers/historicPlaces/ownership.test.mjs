import assert from 'node:assert/strict';
import test from 'node:test';
import { createHistoricPlacesLayer } from './index.js';
import { buildHistoricPlacesCard } from './cards.js';

test('historic places layer registers pick ownership while enabled', async () => {
  const owners = new Map();
  const moveEnd = { cb: null };
  const viewer = {
    camera: {
      computeViewRectangle: () => ({
        west: -2.15,
        south: 0.82,
        east: -2.12,
        north: 0.84,
      }),
      moveEnd: {
        addEventListener(cb) {
          moveEnd.cb = cb;
          return () => {
            moveEnd.cb = null;
          };
        },
      },
    },
    scene: { pick: () => null },
    dataSources: { add() {}, remove() {} },
  };
  const row = {
    stableId: '84003502',
    lat: 47.62,
    lon: -122.35,
    title: 'Seattle Statue',
    summary: 'Seattle, WASHINGTON',
    nrisId: '84003502',
    isNhl: false,
  };
  const layer = createHistoricPlacesLayer({
    source: { getSnapshot: async () => [row] },
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
  await layer.update();
  assert.equal(owners.has('historic-places'), true);
  assert.equal(owners.get('historic-places')('historic-place:84003502'), true);
  assert.match(buildHistoricPlacesCard(row).details.join(' '), /NRIS/);
  layer.disable();
  assert.equal(owners.has('historic-places'), false);
});
