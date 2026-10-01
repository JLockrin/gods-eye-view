import * as Cesium from 'cesium';
import {
  createPointEventLayer,
  rowInBounds,
} from '../eventMarkers/pointEventLayer.js';
import {
  UAP_OVERLAY_SOURCE_ID,
  UAP_PICK_PREFIX,
  uapAccent,
  buildUapCard,
} from './cards.js';
export { normalizeUapSightingSnapshot } from './records.js';
export { createUapSightingSource } from './source.js';
export * from './cards.js';

const MAX_DISPLAY = 600;

function selectUapRows(rows, { bounds } = {}) {
  const inView = rows.filter((row) => rowInBounds(row, bounds));
  // Stable geographic thinning when the viewport is dense.
  if (inView.length <= MAX_DISPLAY) return inView;
  const step = Math.ceil(inView.length / MAX_DISPLAY);
  return inView
    .sort((a, b) => String(a.stableId).localeCompare(String(b.stableId)))
    .filter((_, index) => index % step === 0)
    .slice(0, MAX_DISPLAY);
}

/** Own one UAP *sighting report* display. Never presents reports as verified. */
export function createUapSightingsLayer(options = {}) {
  return createPointEventLayer({
    id: 'uap-sightings',
    name: 'UAP Sighting Reports',
    icon: '◉',
    sourceLabel: 'Sighting reports (unverified)',
    updateInterval: 120000,
    overlaySourceId: UAP_OVERLAY_SOURCE_ID,
    pickPrefix: UAP_PICK_PREFIX,
    viewportBounded: true,
    pointPixelSize: 7,
    colorFor: () => Cesium.Color.fromCssColorString(uapAccent()),
    buildCard: (row) => buildUapCard(row),
    selectRows: selectUapRows,
    logName: 'UapSightings',
    ...options,
  });
}
