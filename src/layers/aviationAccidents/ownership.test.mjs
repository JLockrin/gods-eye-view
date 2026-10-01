import assert from 'node:assert/strict';
import test from 'node:test';
import { createAviationAccidentsLayer } from './index.js';
import { buildAviationCard } from './cards.js';

function harness(source, { pick = () => null } = {}) {
  const sources = [];
  const events = [];
  const owners = new Map();
  const clicks = { handler: null, destroyed: 0 };
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
  return { layer, viewer, sources, events, moveEnd, owners, clicks };
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

test('enable registers pick ownership; disable/destroy clear it', async () => {
  const h = harness({ getSnapshot: async () => [row] });
  assert.equal(await h.layer.update(h.viewer), true);
  assert.ok(h.owners.has('aviation-accidents'));
  assert.equal(
    h.owners.get('aviation-accidents')('aviation-accident:SEA26FA001'),
    true,
  );
  assert.equal(h.owners.get('aviation-accidents')('volcano:311120'), false);

  h.layer.disable(h.viewer);
  assert.equal(h.owners.has('aviation-accidents'), false);

  h.layer.enable(h.viewer);
  assert.ok(h.owners.has('aviation-accidents'));
  h.layer.destroy(h.viewer);
  assert.equal(h.owners.has('aviation-accidents'), false);
});

test('clicking a marker publishes a selected-variant detail card', async () => {
  let pickResult = null;
  const h = harness(
    { getSnapshot: async () => [row] },
    { pick: () => pickResult },
  );
  await h.layer.update(h.viewer);
  pickResult = { id: 'aviation-accident:SEA26FA001' };
  h.clicks.handler({ position: { x: 12, y: 18 } });
  const published = h.events.filter((event) => event[0] === 'entries').at(-1);
  assert.ok(published, 'expected overlay entries publish');
  const [, sourceId, entries] = published;
  assert.equal(sourceId, 'aviation-accidents');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].variant, 'selected');
  assert.equal(entries[0].selected, true);
  assert.equal(entries[0].protected, true);
  assert.equal(entries[0].collisionGroup, 'ambient-card');
  assert.equal(entries[0].title, row.title);
  assert.ok(entries[0].position, 'card must carry a world anchor');
  assert.deepEqual(
    entries[0].details.slice(0, 2),
    buildAviationCard(row).details.slice(0, 2),
  );
  h.layer.destroy(h.viewer);
});
