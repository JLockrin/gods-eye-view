import { selectedEventCardPresentation } from '../eventMarkers/selectedCard.js';

export const AVIATION_OVERLAY_SOURCE_ID = 'aviation-accidents';
export const AVIATION_PICK_PREFIX = 'aviation-accident:';

export function aviationAccent(severity) {
  if (severity === 'fatal') return '#ff3b30';
  if (severity === 'serious') return '#ff9500';
  if (severity === 'minor') return '#ffcc00';
  return '#8e8e93';
}

function formatWhen(row) {
  if (Number.isFinite(row.timeMs)) {
    try {
      return new Date(row.timeMs).toISOString().slice(0, 10);
    } catch {
      /* fall through */
    }
  }
  if (typeof row.time === 'string' && row.time.trim()) {
    return row.time.trim().slice(0, 10);
  }
  if (Number.isFinite(row.year)) return String(row.year);
  return null;
}

/** Card model for one selected aviation accident. Pure — no Cesium types. */
export function buildAviationCard(row) {
  const facts = [];
  if (row.severity) facts.push(String(row.severity));
  if (row.kind) facts.push(String(row.kind));
  if (row.midAir) facts.push('mid-air');
  const when = formatWhen(row);
  if (when) facts.push(when);
  if (row.ntsbNo) facts.push(row.ntsbNo);

  const details = [];
  if (row.summary) details.push(row.summary);
  if (facts.length) details.push(facts.join(' · '));
  details.push('NTSB aviation accident record (U.S. public domain)');
  if (row.sourceUrl) details.push('NTSB query ↗ · click card to open');

  return {
    id: `aviation-accident-card:${row.stableId}`,
    ...selectedEventCardPresentation(),
    interactive: Boolean(row.sourceUrl),
    title: row.title || 'Aviation accident',
    details,
    accent: aviationAccent(row.severity),
    priority: Number.MAX_SAFE_INTEGER,
    gapPx: 15,
    verticalOnly: true,
    placement: 'above',
    sourceUrl: row.sourceUrl || null,
  };
}
