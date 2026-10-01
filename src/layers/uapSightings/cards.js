import { selectedEventCardPresentation } from '../eventMarkers/selectedCard.js';

export const UAP_OVERLAY_SOURCE_ID = 'uap-sightings';
export const UAP_PICK_PREFIX = 'uap-sighting:';

export function uapAccent() {
  // Distinct from verified-science layers; cool teal, not "alert red".
  return '#5ac8fa';
}

export function buildUapCard(row) {
  const facts = [];
  facts.push('unverified sighting report');
  if (row.shape) facts.push(String(row.shape));
  if (Number.isFinite(row.year)) facts.push(String(row.year));
  else if (row.time) facts.push(String(row.time).slice(0, 16));
  if (Number.isFinite(row.durationSec))
    facts.push(`${Math.round(row.durationSec)}s reported`);

  const details = [];
  details.push('Sighting report — not a verified phenomenon');
  if (row.summary) details.push(row.summary);
  if (facts.length) details.push(facts.join(' · '));
  details.push(
    'Geocoded NUFORC-derived compilation · Zenodo CC BY 4.0 (Sigmond Axel)',
  );
  if (row.sourceUrl) details.push('Dataset DOI ↗ · click card to open');

  return {
    id: `uap-sighting-card:${row.stableId}`,
    ...selectedEventCardPresentation(),
    interactive: Boolean(row.sourceUrl),
    title: row.title || 'UAP sighting report',
    details,
    accent: uapAccent(),
    priority: Number.MAX_SAFE_INTEGER,
    gapPx: 15,
    verticalOnly: true,
    placement: 'above',
    sourceUrl: row.sourceUrl || null,
  };
}
