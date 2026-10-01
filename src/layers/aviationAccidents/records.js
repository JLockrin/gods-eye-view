/** Normalize NTSB aviation-accident GeoJSON / GeoJSONL snapshots. */

const finiteOrNull = (value) => (Number.isFinite(value) ? value : null);
const textOrNull = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

function parseTimeMs(value) {
  if (Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function severityFromInjury(injury) {
  const code = String(injury || '')
    .trim()
    .toUpperCase();
  if (code === 'FATL' || code === 'FATAL') return 'fatal';
  if (code === 'SERS' || code === 'SERIOUS') return 'serious';
  if (code === 'MINR' || code === 'MINOR') return 'minor';
  if (code === 'NONE') return 'none';
  return code ? code.toLowerCase() : 'unknown';
}

function placeLabel(properties) {
  const city = textOrNull(properties.city);
  const state = textOrNull(properties.state);
  const country = textOrNull(properties.country);
  return [city, state, country].filter(Boolean).join(', ') || null;
}

function ntsbCaseUrl(ntsbNo) {
  const id = textOrNull(ntsbNo);
  if (!id) return null;
  return `https://www.ntsb.gov/Pages/AviationQueryV2.aspx`;
}

/** Accept FeatureCollection or an array of Feature / already-normalized rows. */
export function normalizeAviationAccidentSnapshot(payload) {
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
      // Already-normalized row passthrough (tests / cached rows).
      if (
        feature.stableId &&
        Number.isFinite(feature.lat) &&
        Number.isFinite(feature.lon)
      ) {
        if (ids.has(feature.stableId)) continue;
        ids.add(feature.stableId);
        rows.push(feature);
      }
      continue;
    }
    const coordinates = feature?.geometry?.coordinates;
    const properties = feature?.properties;
    if (
      !Array.isArray(coordinates) ||
      coordinates.length < 2 ||
      !properties ||
      typeof properties !== 'object' ||
      Array.isArray(properties) ||
      (feature.geometry.type != null && feature.geometry.type !== 'Point')
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
    const ntsbNo = textOrNull(properties.ntsbNo) || textOrNull(properties.id);
    const stableId =
      ntsbNo ||
      textOrNull(properties.evId) ||
      (feature.id == null || feature.id === ''
        ? `aviation-${index + 1}`
        : String(feature.id));
    if (ids.has(stableId)) continue;
    ids.add(stableId);
    const injury = textOrNull(properties.injury);
    const severity = severityFromInjury(injury);
    const place = placeLabel(properties);
    const year = finiteOrNull(
      typeof properties.year === 'number'
        ? properties.year
        : Number(properties.year),
    );
    rows.push({
      stableId,
      lat,
      lon,
      time: textOrNull(properties.time),
      timeMs: parseTimeMs(properties.time),
      year,
      title: place ? `Aviation accident · ${place}` : 'Aviation accident',
      summary: place,
      kind: textOrNull(properties.type) || 'ACC',
      severity,
      injury,
      city: textOrNull(properties.city),
      state: textOrNull(properties.state),
      country: textOrNull(properties.country),
      midAir: textOrNull(properties.midAir),
      sourceUrl: ntsbCaseUrl(ntsbNo),
      ntsbNo,
    });
  }
  return rows;
}
