import * as Cesium from 'cesium';
import { createPointEventLayer } from '../eventMarkers/pointEventLayer.js';
import {
  GDELT_GEO_OVERLAY_SOURCE_ID,
  GDELT_GEO_PICK_PREFIX,
  gdeltGeoAccent,
  buildGdeltGeoCard,
} from './cards.js';
export {
  normalizeGdeltGeoSnapshot,
  DEFAULT_GDELT_GEO_QUERY,
} from './records.js';
export { createGdeltGeoSource } from './source.js';
export * from './cards.js';

const MAX_DISPLAY = 160;

function selectGdeltRows(rows) {
  return rows
    .slice()
    .sort((a, b) => {
      const count = (row) => (Number.isFinite(row.count) ? row.count : 0);
      return (
        count(b) - count(a) ||
        (b.timeMs || 0) - (a.timeMs || 0) ||
        String(a.stableId).localeCompare(String(b.stableId))
      );
    })
    .slice(0, MAX_DISPLAY);
}

/** Own one GDELT geographic-news display and its refresh lifecycle. */
export function createGdeltGeoLayer(options = {}) {
  return createPointEventLayer({
    id: 'gdelt-geo',
    name: 'Geographic News',
    icon: '📰',
    sourceLabel: 'GDELT',
    updateInterval: 900000,
    overlaySourceId: GDELT_GEO_OVERLAY_SOURCE_ID,
    pickPrefix: GDELT_GEO_PICK_PREFIX,
    viewportBounded: false,
    pointPixelSize: 8,
    colorFor: (row) => Cesium.Color.fromCssColorString(gdeltGeoAccent(row)),
    buildCard: (row) => buildGdeltGeoCard(row),
    selectRows: selectGdeltRows,
    logName: 'GdeltGeo',
    ...options,
  });
}
