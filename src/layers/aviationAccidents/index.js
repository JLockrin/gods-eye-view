import * as Cesium from 'cesium';
import { createPointEventLayer, rowInBounds } from '../eventMarkers/pointEventLayer.js';
import {
  AVIATION_OVERLAY_SOURCE_ID,
  AVIATION_PICK_PREFIX,
  aviationAccent,
  buildAviationCard,
} from './cards.js';
export { normalizeAviationAccidentSnapshot } from './records.js';
export { createAviationAccidentSource } from './source.js';
export * from './cards.js';

const MAX_DISPLAY = 900;

function selectAviationRows(rows, { bounds } = {}) {
  const ranked = rows
    .slice()
    .sort((a, b) => {
      const sev = (row) =>
        row.severity === 'fatal' ? 3 : row.severity === 'serious' ? 2 : 1;
      return (
        sev(b) - sev(a) ||
        (b.year || 0) - (a.year || 0) ||
        String(a.stableId).localeCompare(String(b.stableId))
      );
    })
    .filter((row) => rowInBounds(row, bounds));
  return ranked.slice(0, MAX_DISPLAY);
}

/** Own one aviation-accident display and its refresh lifecycle. */
export function createAviationAccidentsLayer(options = {}) {
  return createPointEventLayer({
    id: 'aviation-accidents',
    name: 'Aviation Accidents',
    icon: '✈',
    sourceLabel: 'NTSB',
    updateInterval: 120000,
    overlaySourceId: AVIATION_OVERLAY_SOURCE_ID,
    pickPrefix: AVIATION_PICK_PREFIX,
    viewportBounded: true,
    pointPixelSize: 9,
    colorFor: (row) =>
      Cesium.Color.fromCssColorString(aviationAccent(row.severity)),
    buildCard: (row) => buildAviationCard(row),
    selectRows: selectAviationRows,
    logName: 'AviationAccidents',
    ...options,
  });
}
