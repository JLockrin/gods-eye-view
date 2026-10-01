import { selectedEventCardPresentation } from '../eventMarkers/selectedCard.js';

export const VOLCANO_OVERLAY_SOURCE_ID = 'volcanoes';
export const VOLCANO_PICK_PREFIX = 'volcano:';

export function volcanoAccent(severity) {
  if (severity === 'warning') return '#ff3b30';
  if (severity === 'watch') return '#ff9500';
  if (severity === 'advisory') return '#ffd60a';
  if (severity === 'normal') return '#30d158';
  return '#8e8e93';
}

export function buildVolcanoCard(row) {
  const facts = [];
  if (row.alertLevel) facts.push(row.alertLevel);
  if (row.colorCode) facts.push(row.colorCode);
  if (row.region) facts.push(row.region);
  if (row.time) facts.push(String(row.time).replace('T', ' ').slice(0, 16));
  if (row.vnum) facts.push(`GVP ${row.vnum}`);

  const details = [];
  if (row.summary) details.push(row.summary);
  if (facts.length) details.push(facts.join(' · '));
  details.push('USGS Volcano Hazards Program (U.S. public domain)');
  if (row.sourceUrl) details.push('Source ↗ · click card to open');

  return {
    id: `volcano-card:${row.stableId}`,
    ...selectedEventCardPresentation(),
    interactive: Boolean(row.sourceUrl),
    title: row.title || 'Volcano',
    details,
    accent: volcanoAccent(row.severity),
    priority: Number.MAX_SAFE_INTEGER,
    gapPx: 15,
    verticalOnly: true,
    placement: 'above',
    sourceUrl: row.sourceUrl || null,
  };
}
