import { selectedEventCardPresentation } from '../eventMarkers/selectedCard.js';

export const GDELT_GEO_OVERLAY_SOURCE_ID = 'gdelt-geo';
export const GDELT_GEO_PICK_PREFIX = 'gdelt-geo:';

export function gdeltGeoAccent(row) {
  if (Number.isFinite(row?.count) && row.count >= 20) return '#c9184a';
  if (Number.isFinite(row?.count) && row.count >= 5) return '#ff4d6d';
  return '#ff8fa3';
}

function formatWhen(row) {
  if (Number.isFinite(row.timeMs)) {
    try {
      return new Date(row.timeMs).toISOString().slice(0, 16).replace('T', ' ');
    } catch {
      /* fall through */
    }
  }
  if (typeof row.date === 'string' && row.date.trim()) return row.date.trim();
  return null;
}

/** Card model for one selected GDELT geo news point. Pure — no Cesium. */
export function buildGdeltGeoCard(row) {
  const facts = [];
  const when = formatWhen(row);
  if (when) facts.push(when);
  if (row.location) facts.push(String(row.location));
  if (Number.isFinite(row.count)) facts.push(`${row.count} mentions`);
  if (row.feed) facts.push(String(row.feed));

  const details = [];
  if (row.title && row.title !== row.summary) details.push(row.title);
  if (facts.length) details.push(facts.join(' · '));
  details.push('GDELT geo-tagged news (not verified incident reports)');
  if (row.sourceUrl) details.push('Open article ↗ · click card to open');

  return {
    id: `gdelt-geo-card:${row.stableId}`,
    ...selectedEventCardPresentation(),
    interactive: Boolean(row.sourceUrl),
    title: row.summary ? `News · ${row.summary}` : row.title || 'Geographic news',
    details,
    accent: gdeltGeoAccent(row),
    priority: Number.MAX_SAFE_INTEGER,
    gapPx: 15,
    verticalOnly: true,
    placement: 'above',
    sourceUrl: row.sourceUrl || null,
  };
}
