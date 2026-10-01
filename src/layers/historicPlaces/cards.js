import { selectedEventCardPresentation } from '../eventMarkers/selectedCard.js';

export const HISTORIC_PLACES_OVERLAY_SOURCE_ID = 'historic-places';
export const HISTORIC_PLACES_PICK_PREFIX = 'historic-place:';

export function historicPlacesAccent(row) {
  if (row?.isNhl) return '#b08968';
  if (row?.resType === 'district') return '#7f5539';
  if (row?.resType === 'structure') return '#9c6644';
  return '#ddb892';
}

/** Card model for one selected NRHP property. Pure — no Cesium. */
export function buildHistoricPlacesCard(row) {
  const facts = [];
  if (row.resType) facts.push(String(row.resType));
  if (row.isNhl) facts.push('National Historic Landmark');
  if (row.listedDate) facts.push(`listed ${row.listedDate.replace(/-+$/, '')}`);
  if (row.nrisId) facts.push(`NRIS ${row.nrisId}`);
  if (row.status) facts.push(String(row.status));

  const details = [];
  if (row.summary) details.push(row.summary);
  if (facts.length) details.push(facts.join(' · '));
  details.push(
    'NPS National Register of Historic Places (public unrestricted points)',
  );
  if (row.sourceUrl) details.push('Record ↗ · click card to open');

  return {
    id: `historic-place-card:${row.stableId}`,
    ...selectedEventCardPresentation(),
    interactive: Boolean(row.sourceUrl),
    title: row.title || row.name || 'Historic place',
    details,
    accent: historicPlacesAccent(row),
    priority: Number.MAX_SAFE_INTEGER,
    gapPx: 15,
    verticalOnly: true,
    placement: 'above',
    sourceUrl: row.sourceUrl || null,
  };
}
