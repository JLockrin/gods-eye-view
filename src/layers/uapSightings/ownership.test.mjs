import assert from 'node:assert/strict';
import test from 'node:test';
import { createUapSightingsLayer } from './index.js';
import { buildUapCard } from './cards.js';

test('uap selection card never claims verification', () => {
  const card = buildUapCard({
    stableId: 'uap-1',
    title: 'UAP sighting report · san marcos, tx',
    summary: 'Lights',
    shape: 'cylinder',
    year: 1949,
    sourceUrl: 'https://doi.org/10.5281/zenodo.1205624',
  });
  assert.match(card.details.join(' '), /not a verified phenomenon/i);
  assert.doesNotMatch(card.title, /confirmed|verified phenomenon/i);
});

test('late uap refresh cannot publish after destroy', async () => {
  let resolve;
  let signal;
  const sources = [];
  const viewer = {
    camera: {
      computeViewRectangle: () => ({
        west: -2,
        south: 0.4,
        east: -1.5,
        north: 0.6,
      }),
      moveEnd: { addEventListener: () => () => {} },
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
  const layer = createUapSightingsLayer({
    source: {
      getSnapshot(options) {
        signal = options.signal;
        return new Promise((done) => {
          resolve = done;
        });
      },
    },
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
  const pending = layer.update(viewer);
  layer.destroy(viewer);
  assert.equal(signal.aborted, true);
  resolve([
    {
      stableId: 'uap-1',
      lat: 29.88,
      lon: -97.94,
      title: 'UAP sighting report',
      verified: false,
    },
  ]);
  assert.equal(await pending, false);
  assert.equal(layer.getStats().count, 0);
});
