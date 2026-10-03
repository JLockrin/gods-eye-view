import * as Cesium from 'cesium';
import {
  createPointEventLayer,
  rowInBounds,
} from '../eventMarkers/pointEventLayer.js';
import {
  BIBLE_OVERLAY_SOURCE_ID,
  BIBLE_PICK_PREFIX,
  bibleAccent,
  buildBibleLocationCard,
} from './cards.js';
export { normalizeBibleLocationSnapshot } from './records.js';
export { createBibleLocationSource } from './source.js';
export * from './cards.js';

const MAX_DISPLAY = 700;

function selectBibleRows(rows, { bounds } = {}) {
  const inView = rows.filter((row) => rowInBounds(row, bounds));
  if (inView.length <= MAX_DISPLAY) return inView;
  // Prefer higher OpenBible confidence, then stable id.
  return inView
    .slice()
    .sort((a, b) => {
      const conf = (b.confidence || 0) - (a.confidence || 0);
      if (conf) return conf;
      return String(a.stableId).localeCompare(String(b.stableId));
    })
    .slice(0, MAX_DISPLAY);
}

/** Own one Bible-locations display and its refresh lifecycle. */
export function createBibleLocationsLayer(options = {}) {
  return createPointEventLayer({
    id: 'bible-locations',
    name: 'Bible Locations',
    icon: '†',
    sourceLabel: 'OpenBible.info',
    updateInterval: 120000,
    overlaySourceId: BIBLE_OVERLAY_SOURCE_ID,
    pickPrefix: BIBLE_PICK_PREFIX,
    viewportBounded: true,
    pointPixelSize: 8,
    colorFor: () => Cesium.Color.fromCssColorString(bibleAccent()),
    buildCard: (row) => buildBibleLocationCard(row),
    selectRows: selectBibleRows,
    logName: 'BibleLocations',
    ...options,
  });
}
