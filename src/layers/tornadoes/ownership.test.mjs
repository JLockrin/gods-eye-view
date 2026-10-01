import assert from 'node:assert/strict';
import test from 'node:test';
import { createTornadoesLayer } from './index.js';

function harness(source, { pick = () => null } = {}) {
  const sources = [];
  const owners = new Map();
  const overlay = { entries: new Map() };
  const clicks = { handler: null, destroyed: 0 };
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
  const layer = createTornadoesLayer({
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
        clicks.destroyed += 1;
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

test('late tornado refresh cannot publish after disable', async () => {
  let resolve;
  let signal;
  const h = harness({
    getSnapshot(options) {
      signal = options.signal;
      return new Promise((done) => {
        resolve = done;
      });
    },
  });
  const pending = h.layer.update(h.viewer);
  h.layer.disable(h.viewer);
  assert.equal(signal.aborted, true);
  resolve([
    {
      stableId: 'TO.1',
      geometryType: 'point',
      lat: 35.2,
      lon: -97.5,
      title: 'Tornado report',
      kind: 'tornado-report',
      severity: 'EF1',
    },
  ]);
  assert.equal(await pending, false);
  assert.equal(h.layer.getStats().count, 0);
  h.layer.destroy(h.viewer);
});

test('polygon and point rows both become entities', async () => {
  const ring = [
    [-97.6, 35.1],
    [-97.4, 35.1],
    [-97.4, 35.3],
    [-97.6, 35.1],
  ];
  const h = harness({
    getSnapshot: async () => [
      {
        stableId: 'TO.1',
        geometryType: 'point',
        lat: 35.2,
        lon: -97.5,
        title: 'Tornado report',
        kind: 'tornado-report',
        severity: 'EF1',
      },
      {
        stableId: 'TO.2',
        geometryType: 'polygon',
        lat: 35.2,
        lon: -97.5,
        title: 'Tornado warning',
        kind: 'tornado-warning',
        polygons: [[ring]],
      },
    ],
  });
  assert.equal(await h.layer.update(h.viewer), true);
  assert.equal(h.layer.getStats().count, 2);
  assert.ok(h.sources[0].entities.values.length >= 2);
  h.layer.destroy(h.viewer);
});

test('enable registers tornado pick ownership for points and polygons', async () => {
  const h = harness({
    getSnapshot: async () => [
      {
        stableId: 'TO.1',
        geometryType: 'point',
        lat: 35.2,
        lon: -97.5,
        title: 'Tornado report',
        kind: 'tornado-report',
      },
    ],
  });
  await h.layer.update(h.viewer);
  assert.ok(h.owners.has('tornadoes'));
  assert.equal(h.owners.get('tornadoes')('tornado:TO.1'), true);
  assert.equal(h.owners.get('tornadoes')('tornado:TO.1:0'), true);
  assert.equal(h.owners.get('tornadoes')('volcano:1'), false);
  h.layer.disable(h.viewer);
  assert.equal(h.owners.has('tornadoes'), false);
  h.layer.destroy(h.viewer);
});

test('clicking a tornado point publishes a selected-variant detail card', async () => {
  let pickResult = null;
  const h = harness(
    {
      getSnapshot: async () => [
        {
          stableId: 'TO.1',
          geometryType: 'point',
          lat: 35.2,
          lon: -97.5,
          title: 'Tornado report',
          summary: 'brief touchdown',
          kind: 'tornado-report',
          magnitude: 'EF1',
          sourceUrl: 'https://example.test/iem',
        },
      ],
    },
    { pick: () => pickResult },
  );
  await h.layer.update(h.viewer);
  pickResult = { id: 'tornado:TO.1' };
  h.clicks.handler({ position: { x: 4, y: 5 } });
  const entries = h.overlay.entries.get('tornadoes');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].variant, 'selected');
  assert.equal(entries[0].selected, true);
  assert.equal(entries[0].protected, true);
  assert.equal(entries[0].collisionGroup, 'ambient-card');
  assert.equal(entries[0].title, 'Tornado report');
  assert.ok(entries[0].position);
  h.layer.destroy(h.viewer);
});
