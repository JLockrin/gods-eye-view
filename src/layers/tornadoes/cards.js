import { selectedEventCardPresentation } from '../eventMarkers/selectedCard.js';

export const TORNADO_OVERLAY_SOURCE_ID = 'tornadoes';
export const TORNADO_PICK_PREFIX = 'tornado:';

export function tornadoAccent(kind, severity) {
  if (kind === 'tornado-warning') return '#ff2d55';
  if (kind === 'tornado-outlook') {
    const p = Number(severity);
    if (Number.isFinite(p) && p >= 15) return '#ff9500';
    if (Number.isFinite(p) && p >= 5) return '#ffcc00';
    return '#ffd60a';
  }
  return '#bf5af2';
}

export function buildTornadoCard(row) {
  const facts = [];
  if (row.kind === 'tornado-report') facts.push('local storm report');
  if (row.kind === 'tornado-warning') facts.push('storm-based warning');
  if (row.kind === 'tornado-outlook') facts.push('SPC day-1 outlook');
  if (row.magnitude) facts.push(String(row.magnitude));
  if (row.wfo) facts.push(`WFO ${row.wfo}`);
  if (row.time) facts.push(String(row.time).replace('T', ' ').slice(0, 16));

  const details = [];
  if (row.summary) details.push(row.summary);
  if (facts.length) details.push(facts.join(' · '));
  details.push('NWS / SPC severe weather (U.S. public domain via IEM)');
  if (row.sourceUrl) details.push('Source ↗ · click card to open');

  return {
    id: `tornado-card:${row.stableId}`,
    ...selectedEventCardPresentation(),
    interactive: Boolean(row.sourceUrl),
    title: row.title || 'Tornado / severe weather',
    details,
    accent: tornadoAccent(row.kind, row.severity),
    priority: Number.MAX_SAFE_INTEGER,
    gapPx: 15,
    verticalOnly: true,
    placement: 'above',
    sourceUrl: row.sourceUrl || null,
  };
}
