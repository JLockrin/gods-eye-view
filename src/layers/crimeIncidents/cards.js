import { selectedEventCardPresentation } from '../eventMarkers/selectedCard.js';

export const CRIME_INCIDENTS_OVERLAY_SOURCE_ID = 'crime-incidents';
export const CRIME_INCIDENTS_PICK_PREFIX = 'crime-incident:';

export function crimeIncidentAccent(row) {
  if (row?.severity === 'homicide' || row?.kind === 'homicide') return '#9f1239';
  const type = String(row?.crimeType || '').toUpperCase();
  if (type.includes('ASSAULT') || type.includes('ROBBERY')) return '#c2410c';
  if (type.includes('BURGLARY') || type.includes('THEFT')) return '#a16207';
  return '#7c2d12';
}

/** Card model for one selected public crime incident. Pure — no Cesium. */
export function buildCrimeIncidentCard(row) {
  const details = [];
  if (row.crimeType) details.push(String(row.crimeType));
  if (row.description && row.description !== row.crimeType)
    details.push(String(row.description));
  if (row.jurisdiction) details.push(String(row.jurisdiction));
  if (row.date) details.push(String(row.date));
  details.push(
    `${row.sourceName || 'City open crime data'} · public incident in Lima/Beaverdam/Findlay OH or Knoxville TN (not a suspect profile)`,
  );
  if (row.sourceUrl) details.push('Source ↗ · click card to open');

  return {
    id: `crime-incident-card:${row.stableId}`,
    ...selectedEventCardPresentation(),
    interactive: Boolean(row.sourceUrl),
    title: row.title || row.crimeType || 'Crime incident',
    details,
    accent: crimeIncidentAccent(row),
    priority: Number.MAX_SAFE_INTEGER,
    gapPx: 15,
    verticalOnly: true,
    placement: 'above',
    sourceUrl: row.sourceUrl || null,
  };
}
