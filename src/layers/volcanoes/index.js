import * as Cesium from 'cesium';
import { createPointEventLayer } from '../eventMarkers/pointEventLayer.js';
import {
  VOLCANO_OVERLAY_SOURCE_ID,
  VOLCANO_PICK_PREFIX,
  volcanoAccent,
  buildVolcanoCard,
} from './cards.js';
export { normalizeVolcanoSnapshot } from './records.js';
export { createVolcanoSource } from './source.js';
export * from './cards.js';

const SEV_RANK = {
  warning: 4,
  watch: 3,
  advisory: 2,
  normal: 1,
  unassigned: 0,
};

function selectVolcanoRows(rows) {
  // Prefer elevated activity; keep a bounded set of quiet volcanoes for context.
  const elevated = rows.filter((row) => row.elevated);
  const quiet = rows
    .filter((row) => !row.elevated)
    .sort((a, b) => String(a.stableId).localeCompare(String(b.stableId)))
    .slice(0, 120);
  return [...elevated, ...quiet].sort(
    (a, b) =>
      (SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0) ||
      String(a.stableId).localeCompare(String(b.stableId)),
  );
}

/** Own one volcano status display and its refresh lifecycle. */
export function createVolcanoesLayer(options = {}) {
  return createPointEventLayer({
    id: 'volcanoes',
    name: 'Volcanoes & Eruptions',
    icon: '🌋',
    sourceLabel: 'USGS',
    updateInterval: 300000,
    overlaySourceId: VOLCANO_OVERLAY_SOURCE_ID,
    pickPrefix: VOLCANO_PICK_PREFIX,
    viewportBounded: false,
    pointPixelSize: 10,
    colorFor: (row) =>
      Cesium.Color.fromCssColorString(volcanoAccent(row.severity)),
    buildCard: (row) => buildVolcanoCard(row),
    selectRows: selectVolcanoRows,
    logName: 'Volcanoes',
    ...options,
  });
}
