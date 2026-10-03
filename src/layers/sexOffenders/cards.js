import { selectedEventCardPresentation } from '../eventMarkers/selectedCard.js';

export const SEX_OFFENDERS_OVERLAY_SOURCE_ID = 'sex-offenders';
export const SEX_OFFENDERS_PICK_PREFIX = 'sex-offender:';

export function sexOffenderAccent(row) {
  const category = String(row?.offenseCategory || '').toUpperCase();
  if (category.includes('VIOLENT') || category.includes('CLASS A'))
    return '#c45c26';
  if (category.includes('CLASS B')) return '#d97706';
  return '#b45309';
}

/** Card model for one selected public-registry point. Pure — no Cesium. */
export function buildSexOffenderCard(row) {
  const details = [];
  if (row.offenseCategory) details.push(String(row.offenseCategory));
  if (row.jurisdiction) details.push(String(row.jurisdiction));
  if (row.asOf) details.push(`as of ${row.asOf}`);
  details.push(
    `${row.sourceName || 'Public sex offender registry'} · public registry point for Lima/Beaverdam/Findlay OH or Knoxville TN (not a private dossier)`,
  );
  if (row.sourceUrl) details.push('Source ↗ · click card to open');

  return {
    id: `sex-offender-card:${row.stableId}`,
    ...selectedEventCardPresentation(),
    interactive: Boolean(row.sourceUrl),
    title: row.title || row.name || 'Registered person',
    details,
    accent: sexOffenderAccent(row),
    priority: Number.MAX_SAFE_INTEGER,
    gapPx: 15,
    verticalOnly: true,
    placement: 'above',
    sourceUrl: row.sourceUrl || null,
  };
}
