import * as Cesium from 'cesium';
import { createPointEventLayer } from '../eventMarkers/pointEventLayer.js';
import {
  SHIPWRECK_OVERLAY_SOURCE_ID,
  SHIPWRECK_PICK_PREFIX,
  shipwreckAccent,
  buildShipwreckCard,
} from './cards.js';
export { normalizeShipwreckSnapshot } from './records.js';
export { createShipwreckSource } from './source.js';
export * from './cards.js';

/** Own one shipwreck display and its refresh lifecycle. */
export function createShipwrecksLayer(options = {}) {
  return createPointEventLayer({
    id: 'shipwrecks',
    name: 'Shipwrecks',
    icon: '⚓',
    sourceLabel: 'NOAA ENC',
    updateInterval: 120000,
    overlaySourceId: SHIPWRECK_OVERLAY_SOURCE_ID,
    pickPrefix: SHIPWRECK_PICK_PREFIX,
    viewportBounded: true,
    pointPixelSize: 8,
    colorFor: (row) =>
      Cesium.Color.fromCssColorString(shipwreckAccent(row.severity)),
    buildCard: (row) => buildShipwreckCard(row),
    logName: 'Shipwrecks',
    ...options,
  });
}
