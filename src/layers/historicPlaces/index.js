import * as Cesium from 'cesium';
import { createPointEventLayer } from '../eventMarkers/pointEventLayer.js';
import {
  HISTORIC_PLACES_OVERLAY_SOURCE_ID,
  HISTORIC_PLACES_PICK_PREFIX,
  historicPlacesAccent,
  buildHistoricPlacesCard,
} from './cards.js';
export { normalizeHistoricPlacesSnapshot } from './records.js';
export { createHistoricPlacesSource } from './source.js';
export * from './cards.js';

const MAX_DISPLAY = 450;

function selectHistoricRows(rows) {
  return rows
    .slice()
    .sort((a, b) => {
      const rank = (row) => (row.isNhl ? 2 : 0) + (row.resType === 'district' ? 1 : 0);
      return (
        rank(b) - rank(a) ||
        String(a.name || '').localeCompare(String(b.name || '')) ||
        String(a.stableId).localeCompare(String(b.stableId))
      );
    })
    .slice(0, MAX_DISPLAY);
}

/**
 * Own one Historic places & forgotten infrastructure (NRHP) display.
 * Data is the National Register of Historic Places; UI framing is broader.
 */
export function createHistoricPlacesLayer(options = {}) {
  return createPointEventLayer({
    id: 'historic-places',
    name: 'Historic Places & Forgotten Infrastructure',
    icon: '🏛',
    sourceLabel: 'NPS NRHP',
    updateInterval: 180000,
    overlaySourceId: HISTORIC_PLACES_OVERLAY_SOURCE_ID,
    pickPrefix: HISTORIC_PLACES_PICK_PREFIX,
    viewportBounded: true,
    pointPixelSize: 8,
    colorFor: (row) =>
      Cesium.Color.fromCssColorString(historicPlacesAccent(row)),
    buildCard: (row) => buildHistoricPlacesCard(row),
    selectRows: selectHistoricRows,
    logName: 'HistoricPlaces',
    ...options,
  });
}
