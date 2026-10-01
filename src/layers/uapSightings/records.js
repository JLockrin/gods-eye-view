/** Normalize UAP / UFO *sighting report* snapshots. Never treat as verified. */

const textOrNull = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};
const finiteOrNull = (value) => (Number.isFinite(value) ? value : null);

function parseTimeMs(value) {
  if (Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  // Prefer ISO; fall back to MM/DD/YYYY[ HH:MM]
  const direct = Date.parse(value);
  if (Number.isFinite(direct)) return direct;
  const match = value
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  let year = Number(match[3]);
  if (year < 100) year += year >= 40 ? 1900 : 2000;
  const month = Number(match[1]) - 1;
  const day = Number(match[2]);
  const hour = Number(match[4] || 0);
  const minute = Number(match[5] || 0);
  const ms = Date.UTC(year, month, day, hour, minute);
  return Number.isFinite(ms) ? ms : null;
}

export function normalizeUapSightingSnapshot(payload) {
  const features = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.features)
      ? payload.features
      : null;
  if (!features) return null;
  const rows = [];
  const ids = new Set();
  for (const [index, feature] of features.entries()) {
    if (feature && typeof feature === 'object' && !feature.geometry) {
      if (
        feature.stableId &&
        Number.isFinite(feature.lat) &&
        Number.isFinite(feature.lon)
      ) {
        if (ids.has(feature.stableId)) continue;
        ids.add(feature.stableId);
        rows.push({
          ...feature,
          verified: false,
          label: feature.label || 'Sighting report — not a verified phenomenon',
        });
      }
      continue;
    }
    const coordinates = feature?.geometry?.coordinates;
    const properties = feature?.properties || {};
    if (
      !Array.isArray(coordinates) ||
      coordinates.length < 2 ||
      (feature.geometry?.type != null && feature.geometry.type !== 'Point')
    )
      continue;
    const [lon, lat] = coordinates;
    if (
      !Number.isFinite(lon) ||
      Math.abs(lon) > 180 ||
      !Number.isFinite(lat) ||
      Math.abs(lat) > 90
    )
      continue;
    const stableId =
      feature.id == null || feature.id === ''
        ? `uap-${index + 1}`
        : String(feature.id);
    if (ids.has(stableId)) continue;
    ids.add(stableId);
    const city = textOrNull(properties.city);
    const state = textOrNull(properties.state);
    const country = textOrNull(properties.country);
    const place = [city, state, country].filter(Boolean).join(', ');
    const shape = textOrNull(properties.shape);
    const year = finiteOrNull(
      typeof properties.year === 'number'
        ? properties.year
        : Number(properties.year),
    );
    rows.push({
      stableId,
      lat,
      lon,
      title: place ? `UAP sighting report · ${place}` : 'UAP sighting report',
      summary:
        textOrNull(properties.summary) ||
        textOrNull(properties.label) ||
        'Unverified sighting report',
      kind: 'sighting-report',
      severity: shape || 'report',
      shape,
      city,
      state,
      country,
      year,
      time: textOrNull(properties.time),
      timeMs: parseTimeMs(properties.time),
      durationSec: finiteOrNull(Number(properties.durationSec)),
      verified: false,
      label:
        textOrNull(properties.label) ||
        'Sighting report — not a verified phenomenon',
      sourceUrl:
        textOrNull(properties.sourceUrl) ||
        'https://doi.org/10.5281/zenodo.1205624',
    });
  }
  return rows;
}
