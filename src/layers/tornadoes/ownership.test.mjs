import assert from 'node:assert/strict';
import test from 'node:test';
import { createTornadoesLayer } from './index.js';

function harness(source) {
  const sources = [];
  const viewer = {
    scene: { pick: () => null },
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
    },
    pointer: { isPointerFree: () => true },
  });
  layer.init(viewer);
  layer.enable(viewer);
  return { layer, viewer, sources };
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
        stableId: 'WARN.1',
        geometryType: 'polygon',
        lat: 35.2,
        lon: -97.5,
        title: 'Tornado Warning',
        kind: 'tornado-warning',
        severity: 'W',
        polygons: [[ring]],
      },
    ],
  });
  assert.equal(await h.layer.update(h.viewer), true);
  assert.equal(h.layer.getStats().count, 2);
  assert.ok(h.sources[0].entities.values.length >= 2);
  h.layer.destroy(h.viewer);
});
