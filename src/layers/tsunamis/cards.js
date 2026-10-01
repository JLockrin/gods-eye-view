import { selectedEventCardPresentation } from '../eventMarkers/selectedCard.js';

export const TSUNAMI_OVERLAY_SOURCE_ID = 'tsunamis';
export const TSUNAMI_PICK_PREFIX = 'tsunami:';

export function tsunamiAccent(row) {
  const intensity = Number(row?.tsIntensity);
  if (Number.isFinite(intensity)) {
    if (intensity >= 4) return '#0077b6';
    if (intensity >= 2) return '#00a6fb';
    if (intensity >= 1) return '#48cae4';
  }
  if (Number.isFinite(row?.deaths) && row.deaths > 0) return '#023e8a';
  return '#90e0ef';
}

function formatWhen(row) {
  const year = Number.isFinite(row.year) ? String(row.year) : null;
  if (!year) return null;
  const month = Number.isFinite(row.month)
    ? String(row.month).padStart(2, '0')
    : null;
  const day = Number.isFinite(row.day)
    ? String(row.day).padStart(2, '0')
    : null;
  if (month && day) return `${year}-${month}-${day}`;
  if (month) return `${year}-${month}`;
  return year;
}

/** Card model for one selected historical tsunami event. Pure — no Cesium. */
export function buildTsunamiCard(row) {
  const facts = [];
  const when = formatWhen(row);
  if (when) facts.push(when);
  if (Number.isFinite(row.tsIntensity))
    facts.push(`intensity ${row.tsIntensity}`);
  if (Number.isFinite(row.eqMagnitude)) facts.push(`M${row.eqMagnitude}`);
  if (Number.isFinite(row.maxRunup)) facts.push(`runup ${row.maxRunup} m`);
  if (row.cause) facts.push(String(row.cause));
  if (Number.isFinite(row.deaths)) facts.push(`${row.deaths} deaths`);
  if (Number.isFinite(row.damageMillions))
    facts.push(`$${row.damageMillions}M damage`);
  else if (row.damage) facts.push(String(row.damage));
  if (row.validity) facts.push(String(row.validity));
  if (row.eventId != null) facts.push(`NCEI ${row.eventId}`);

  const details = [];
  if (row.summary) details.push(row.summary);
  if (facts.length) details.push(facts.join(' · '));
  details.push('NOAA NCEI / WDS Global Historical Tsunami Database');
  if (row.sourceUrl) details.push('NCEI event page ↗ · click card to open');

  return {
    id: `tsunami-card:${row.stableId}`,
    ...selectedEventCardPresentation(),
    interactive: Boolean(row.sourceUrl),
    title: row.title || 'Tsunami event',
    details,
    accent: tsunamiAccent(row),
    priority: Number.MAX_SAFE_INTEGER,
    gapPx: 15,
    verticalOnly: true,
    placement: 'above',
    sourceUrl: row.sourceUrl || null,
  };
}
