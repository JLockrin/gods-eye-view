import assert from 'node:assert/strict';
import test from 'node:test';
import { createBibleLocationsLayer } from './index.js';
import { buildBibleLocationCard } from './cards.js';

function harness(source, { pick = () => null } = {}) {
  const sources = [];
  const events = [];
  const owners = new Map();
  const clicks = { handler: null, destroyed: 0 };
  const moveEnd = { cb: null };
  const viewer = {
    camera: {
      computeViewRectangle: () => ({
        west: 0.6,
        south: 0.5,
        east: 0.7,
        north: 0.6,
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
  const layer = createBibleLocationsLayer({
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
  stableId: 'a15257a',
  lat: 31.776667,
  lon: 35.234167,
  title: 'Jerusalem',
  name: 'Jerusalem',
  event: 'Now it came to pass, when Adonizedec king of Jerusalem had heard…',
  citation: 'Josh 10:1',
  verses: ['Josh 10:1', 'Josh 10:2'],
  source: 'OpenBible.info Bible Geocoding (CC BY 4.0)',
  sourceUrl: 'https://www.openbible.info/geo/ancient/a15257a/jerusalem',
  eventSource: 'KJV (public domain)',
  confidence: 1000,
  kind: 'settlement',
};

test('enable registers pick ownership; disable/destroy clear it', async () => {
  const h = harness({ getSnapshot: async () => [row] });
  assert.equal(await h.layer.update(h.viewer), true);
  assert.ok(h.owners.has('bible-locations'));
  assert.equal(
    h.owners.get('bible-locations')('bible-location:a15257a'),
    true,
  );
  assert.equal(h.owners.get('bible-locations')('volcano:311120'), false);

  h.layer.disable(h.viewer);
  assert.equal(h.owners.has('bible-locations'), false);

  h.layer.enable(h.viewer);
  assert.ok(h.owners.has('bible-locations'));
  h.layer.destroy(h.viewer);
  assert.equal(h.owners.has('bible-locations'), false);
});

test('clicking a marker publishes a selected-variant detail card with event, citation, and link', async () => {
  let pickResult = null;
  const h = harness(
    { getSnapshot: async () => [row] },
    { pick: () => pickResult },
  );
  await h.layer.update(h.viewer);
  pickResult = { id: 'bible-location:a15257a' };
  h.clicks.handler({ position: { x: 12, y: 18 } });
  const published = h.events.filter((event) => event[0] === 'entries').at(-1);
  assert.ok(published, 'expected overlay entries publish');
  const [, sourceId, entries] = published;
  assert.equal(sourceId, 'bible-locations');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].variant, 'selected');
  assert.equal(entries[0].selected, true);
  assert.equal(entries[0].protected, true);
  assert.equal(entries[0].collisionGroup, 'ambient-card');
  assert.equal(entries[0].title, 'Jerusalem');
  const detailText = entries[0].details.join(' ');
  assert.match(detailText, /Adonizedec|Jerusalem/);
  assert.match(detailText, /Josh 10:1/);
  assert.match(detailText, /OpenBible/);
  assert.match(detailText, /click card to open/i);
  assert.equal(entries[0].sourceUrl, row.sourceUrl);
  assert.ok(entries[0].position, 'card must carry a world anchor');
  assert.deepEqual(
    entries[0].details.slice(0, 2),
    buildBibleLocationCard(row).details.slice(0, 2),
  );
  h.layer.destroy(h.viewer);
});

test('layer source label names OpenBible.info', () => {
  const layer = createBibleLocationsLayer({
    source: { getSnapshot: async () => [] },
  });
  assert.equal(layer.source, 'OpenBible.info');
  assert.equal(layer.id, 'bible-locations');
});
