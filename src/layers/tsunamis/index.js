import * as Cesium from 'cesium';
import {
  createPointEventLayer,
  rowInBounds,
} from '../eventMarkers/pointEventLayer.js';
import {
  TSUNAMI_OVERLAY_SOURCE_ID,
  TSUNAMI_PICK_PREFIX,
  tsunamiAccent,
  buildTsunamiCard,
} from './cards.js';
export { normalizeTsunamiSnapshot } from './records.js';
export { createTsunamiSource } from './source.js';
export * from './cards.js';

const MAX_DISPLAY = 900;

function selectTsunamiRows(rows, { bounds } = {}) {
  const ranked = rows
    .slice()
    .sort((a, b) => {
      const score = (row) =>
        (Number.isFinite(row.tsIntensity) ? row.tsIntensity : 0) * 10 +
        (Number.isFinite(row.deaths) ? Math.min(row.deaths, 100000) / 1000 : 0) +
        (Number.isFinite(row.validityCode) ? row.validityCode : 0);
      return (
        score(b) - score(a) ||
        (b.year || 0) - (a.year || 0) ||
        String(a.stableId).localeCompare(String(b.stableId))
      );
    })
    .filter((row) => rowInBounds(row, bounds));
  return ranked.slice(0, MAX_DISPLAY);
}

/** Own one historical-tsunami display and its refresh lifecycle. */
export function createTsunamisLayer(options = {}) {
  return createPointEventLayer({
    id: 'tsunamis',
    name: 'Tsunamis',
    icon: '🌊',
    sourceLabel: 'NCEI',
    updateInterval: 300000,
    overlaySourceId: TSUNAMI_OVERLAY_SOURCE_ID,
    pickPrefix: TSUNAMI_PICK_PREFIX,
    viewportBounded: true,
    pointPixelSize: 9,
    colorFor: (row) => Cesium.Color.fromCssColorString(tsunamiAccent(row)),
    buildCard: (row) => buildTsunamiCard(row),
    selectRows: selectTsunamiRows,
    logName: 'Tsunamis',
    ...options,
  });
}
