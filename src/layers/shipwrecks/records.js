/** Normalize NOAA ENC wreck GeoJSON into stable shipwreck rows. */

const textOrNull = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

function wreckKind(catwrk) {
  const raw = String(catwrk || '').toLowerCase();
  if (!raw) return 'wreck';
  if (raw.includes('dangerous')) return 'dangerous-wreck';
  if (raw.includes('non-dangerous') || raw.includes('non dangerous'))
    return 'non-dangerous-wreck';
  if (raw.includes('distributed')) return 'wreck-remains';
  if (raw.includes('mast')) return 'mast-showing';
  return 'wreck';
}

function severityFor(kind) {
  if (kind === 'dangerous-wreck') return 'hazard';
  if (kind === 'mast-showing') return 'visible';
  return 'charted';
}

export function normalizeShipwreckSnapshot(geojson) {
  if (!Array.isArray(geojson?.features)) return null;
  const rows = [];
  const ids = new Set();
  for (const [index, feature] of geojson.features.entries()) {
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
    const objectId = properties.OBJECTID ?? feature.id;
    const stableId =
      objectId == null || objectId === ''
        ? `wreck-${index + 1}`
        : `wreck-${objectId}`;
    if (ids.has(stableId)) continue;
    ids.add(stableId);
    const name = textOrNull(properties.OBJNAM);
    const catwrk = textOrNull(properties.CATWRK);
    const kind = wreckKind(catwrk);
    const inform = textOrNull(properties.INFORM);
    const sourceDate = textOrNull(properties.SORDAT);
    rows.push({
      stableId,
      lat,
      lon,
      title: name ? `Shipwreck · ${name}` : 'Charted shipwreck',
      summary: inform || catwrk || 'NOAA ENC wreck',
      kind,
      severity: severityFor(kind),
      name,
      catwrk,
      inform,
      sourceDate,
      time: sourceDate,
      timeMs: null,
      sourceUrl:
        'https://nauticalcharts.noaa.gov/data/wrecks-and-obstructions.html',
    });
  }
  return rows;
}
