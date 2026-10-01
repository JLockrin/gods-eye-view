import assert from 'node:assert/strict';
import test from 'node:test';
import { createVolcanoesLayer } from './index.js';

function harness(source, { pick = () => null } = {}) {
  const sources = [];
  const owners = new Map();
  const overlay = { entries: new Map() };
  const clicks = { handler: null };
  const viewer = {
    scene: { pick },
    dataSources: {
      add(value) {
        sources.push(value);
      },
      remove(value) {
        sources.splice(sources.indexOf(value), 1);
      },
    },
  };
  const layer = createVolcanoesLayer({
    source,
    overlayHost: {
      setEntries(sourceId, entries) {
        overlay.entries.set(sourceId, entries);
      },
      setVisible() {},
      clearSource(sourceId) {
        overlay.entries.delete(sourceId);
      },
      hitTest: () => null,
    },
    screenSpaceEventHandlerFactory: () => ({
      setInputAction(callback) {
        clicks.handler = callback;
      },
      destroy() {
        clicks.handler = null;
      },
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
  return { layer, viewer, sources, owners, overlay, clicks };
}

const row = {
  stableId: '311120',
  lat: 52.07,
  lon: -176.11,
  title: 'Volcano · Great Sitkin',
  summary: 'Slow eruption',
  alertLevel: 'WATCH',
  colorCode: 'ORANGE',
  severity: 'watch',
  elevated: true,
  sourceUrl: 'https://volcano.si.edu/volcano.cfm?vn=311120',
};

test('volcano enable registers pick ownership and click publishes selected card', async () => {
  let pickResult = null;
  const h = harness(
    { getSnapshot: async () => [row] },
    { pick: () => pickResult },
  );
  assert.ok(h.owners.has('volcanoes'));
  assert.equal(await h.layer.update(h.viewer), true);
  assert.equal(h.owners.get('volcanoes')('volcano:311120'), true);

  pickResult = { id: 'volcano:311120' };
  h.clicks.handler({ position: { x: 1, y: 2 } });
  const entries = h.overlay.entries.get('volcanoes');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].variant, 'selected');
  assert.equal(entries[0].selected, true);
  assert.equal(entries[0].protected, true);
  assert.equal(entries[0].collisionGroup, 'ambient-card');
  assert.equal(entries[0].title, row.title);
  assert.match(entries[0].details.join(' '), /USGS Volcano Hazards Program/i);

  h.layer.disable(h.viewer);
  assert.equal(h.owners.has('volcanoes'), false);
  h.layer.destroy(h.viewer);
});
