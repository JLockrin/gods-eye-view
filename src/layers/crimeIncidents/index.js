import * as Cesium from 'cesium';
import { createPointEventLayer } from '../eventMarkers/pointEventLayer.js';
import { attachFocusControls } from '../localFocus/focusControls.js';
import { FOCUS_SOURCE_LABEL } from '../localFocus/ohioTnFourPlaces.js';
import {
  CRIME_INCIDENTS_OVERLAY_SOURCE_ID,
  CRIME_INCIDENTS_PICK_PREFIX,
  crimeIncidentAccent,
  buildCrimeIncidentCard,
} from './cards.js';
import { crimeIncidentSortKey } from './records.js';
export { normalizeCrimeIncidentSnapshot, crimeIncidentSortKey } from './records.js';
export { createCrimeIncidentSource } from './source.js';
export * from './cards.js';

const MAX_DISPLAY = 400;

function selectCrimeRows(rows) {
  return rows
    .slice()
    .sort((a, b) => {
      return (
        crimeIncidentSortKey(b) - crimeIncidentSortKey(a) ||
        String(a.stableId).localeCompare(String(b.stableId))
      );
    })
    .slice(0, MAX_DISPLAY);
}

/**
 * Homicides & other crimes for Lima / Beaverdam / Findlay OH and Knoxville TN.
 * Built-in keyless point feeds are not available for these places yet.
 */
export function createCrimeIncidentsLayer(options = {}) {
  const layer = createPointEventLayer({
    id: 'crime-incidents',
    name: 'Homicides & Other Crimes',
    icon: '▣',
    sourceLabel: `Open crime data · ${FOCUS_SOURCE_LABEL}`,
    updateInterval: 180000,
    overlaySourceId: CRIME_INCIDENTS_OVERLAY_SOURCE_ID,
    pickPrefix: CRIME_INCIDENTS_PICK_PREFIX,
    viewportBounded: true,
    pointPixelSize: 8,
    emptyStatusMessage:
      'No open crime-point feed for these four places yet (see layer note)',
    colorFor: (row) =>
      Cesium.Color.fromCssColorString(crimeIncidentAccent(row)),
    buildCard: (row) => buildCrimeIncidentCard(row),
    selectRows: selectCrimeRows,
    logName: 'CrimeIncidents',
    ...options,
  });
  return attachFocusControls(layer);
}
