import { selectedEventCardPresentation } from '../eventMarkers/selectedCard.js';

export const BIBLE_OVERLAY_SOURCE_ID = 'bible-locations';
export const BIBLE_PICK_PREFIX = 'bible-location:';

export function bibleAccent() {
  // Distinct from hazard/alert layers; parchment-gold, not purple or cream-theme.
  return '#c4a35a';
}

function formatCitations(row) {
  const verses = Array.isArray(row.verses) ? row.verses.filter(Boolean) : [];
  if (verses.length) {
    const shown = verses.slice(0, 4).join(' · ');
    if (Number.isFinite(row.moreVerses) && row.moreVerses > 0) {
      return `${shown} · +${row.moreVerses} more`;
    }
    return shown;
  }
  return row.citation || null;
}

/** Card model for one selected Bible place. Pure — no Cesium types. */
export function buildBibleLocationCard(row) {
  const details = [];
  if (row.event) details.push(row.event);
  const citations = formatCitations(row);
  if (citations) details.push(`Mentioned: ${citations}`);
  details.push('OpenBible.info Bible Geocoding (CC BY 4.0)');
  if (row.eventSource && /KJV/i.test(row.eventSource)) {
    details.push('Event citation: KJV (public domain)');
  }
  if (row.sourceUrl) details.push('OpenBible place page ↗ · click card to open');

  return {
    id: `bible-location-card:${row.stableId}`,
    ...selectedEventCardPresentation(),
    interactive: Boolean(row.sourceUrl),
    title: row.title || row.name || 'Bible place',
    details,
    accent: bibleAccent(),
    priority: Number.MAX_SAFE_INTEGER,
    gapPx: 15,
    verticalOnly: true,
    placement: 'above',
    sourceUrl: row.sourceUrl || null,
  };
}
