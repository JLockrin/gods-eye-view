import assert from 'node:assert/strict';
import test from 'node:test';
import { createGdeltGeoLayer } from './index.js';
import { buildGdeltGeoCard } from './cards.js';

test('gdelt geo layer registers pick ownership while enabled', async () => {
  const owners = new Map();
  const viewer = {
    camera: { computeViewRectangle: () => null },
    scene: { pick: () => null },
    dataSources: { add() {}, remove() {} },
  };
  const row = {
    stableId: 'p1',
    lat: 48.85,
    lon: 2.35,
    title: 'Protests in Paris',
    summary: 'Paris, France',
    sourceUrl: 'https://example.com/paris',
    count: 4,
  };
  const layer = createGdeltGeoLayer({
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
  assert.equal(owners.has('gdelt-geo'), true);
  assert.equal(owners.get('gdelt-geo')('gdelt-geo:p1'), true);
  assert.match(buildGdeltGeoCard(row).details.join(' '), /GDELT/);
  layer.disable();
  assert.equal(owners.has('gdelt-geo'), false);
});
