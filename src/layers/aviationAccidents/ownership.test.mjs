import assert from 'node:assert/strict';
import test from 'node:test';
import { createAviationAccidentsLayer } from './index.js';

function harness(source) {
  const sources = [];
  const events = [];
  const moveEnd = { cb: null };
  const viewer = {
    camera: {
      computeViewRectangle: () => ({
        west: -2.2,
        south: 0.8,
        east: -2.0,
        north: 0.9,
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
    dataSources: {
      add(value) {
        sources.push(value);
      },
      remove(value) {
        sources.splice(sources.indexOf(value), 1);
      },
    },
  };
  const layer = createAviationAccidentsLayer({
    source,
    overlayHost: {
      setEntries(...args) {
        events.push(['entries', ...args]);
      },
      setVisible(...args) {
        events.push(['visible', ...args]);
      },
      clearSource(...args) {
        events.push(['clear', ...args]);
      },
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
  return { layer, viewer, sources, events, moveEnd };
}

const row = {
  stableId: 'SEA26FA001',
  lat: 47.6,
  lon: -122.3,
  title: 'Aviation accident · Seattle, WA, USA',
  summary: 'Seattle, WA, USA',
  kind: 'ACC',
  severity: 'fatal',
  year: 2026,
  time: '01/02/26',
  sourceUrl: 'https://www.ntsb.gov/Pages/AviationQueryV2.aspx',
};

test('late refresh cannot publish after disable or destroy', async () => {
  for (const action of ['disable', 'destroy']) {
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
    h.layer[action](h.viewer);
    assert.equal(signal.aborted, true);
    if (action === 'disable') h.layer.enable(h.viewer);
    resolve([row]);
    assert.equal(await pending, false);
    assert.equal(h.layer.getStats().count, 0);
    h.layer.destroy(h.viewer);
  }
});

test('successful update paints entities and selection card metadata', async () => {
  const h = harness({ getSnapshot: async () => [row] });
  assert.equal(await h.layer.update(h.viewer), true);
  assert.equal(h.layer.getStats().count, 1);
  assert.equal(h.sources[0].entities.values.length, 1);
  h.layer.destroy(h.viewer);
});
