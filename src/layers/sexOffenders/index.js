import * as Cesium from 'cesium';
import { createPointEventLayer } from '../eventMarkers/pointEventLayer.js';
import { attachFocusControls } from '../localFocus/focusControls.js';
import { FOCUS_SOURCE_LABEL } from '../localFocus/ohioTnFourPlaces.js';
import {
  SEX_OFFENDERS_OVERLAY_SOURCE_ID,
  SEX_OFFENDERS_PICK_PREFIX,
  sexOffenderAccent,
  buildSexOffenderCard,
} from './cards.js';
export { normalizeSexOffenderSnapshot } from './records.js';
export { createSexOffenderSource } from './source.js';
export * from './cards.js';

const MAX_DISPLAY = 350;

function selectSexOffenderRows(rows) {
  return rows
    .slice()
    .sort((a, b) => {
      const time = (row) => (Number.isFinite(row.timeMs) ? row.timeMs : 0);
      return (
        time(b) - time(a) ||
        String(a.name || '').localeCompare(String(b.name || '')) ||
        String(a.stableId).localeCompare(String(b.stableId))
      );
    })
    .slice(0, MAX_DISPLAY);
}

/**
 * Public sex-offender registry for Lima / Beaverdam / Findlay OH and Knoxville TN.
 * Live points today: Knox County TN via TBI. Ohio places stay empty (no keyless API).
 */
export function createSexOffendersLayer(options = {}) {
  const layer = createPointEventLayer({
    id: 'sex-offenders',
    name: 'Registered Sex Offenders',
    icon: '◈',
    sourceLabel: `Public registry · ${FOCUS_SOURCE_LABEL}`,
    updateInterval: 180000,
    overlaySourceId: SEX_OFFENDERS_OVERLAY_SOURCE_ID,
    pickPrefix: SEX_OFFENDERS_PICK_PREFIX,
    viewportBounded: true,
    pointPixelSize: 9,
    emptyStatusMessage:
      'No registry points here (Knoxville TN via TBI; Ohio towns have no keyless open feed)',
    colorFor: (row) => Cesium.Color.fromCssColorString(sexOffenderAccent(row)),
    buildCard: (row) => buildSexOffenderCard(row),
    selectRows: selectSexOffenderRows,
    logName: 'SexOffenders',
    ...options,
  });
  return attachFocusControls(layer);
}
