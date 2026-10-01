/** Normalize IEM LSR tornado reports and SBW / SPC outlook polygons. */

const textOrNull = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};
const finiteOrNull = (value) => (Number.isFinite(value) ? value : null);

function parseTimeMs(value) {
  if (Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function validRing(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return false;
  for (const position of ring) {
    if (!Array.isArray(position) || position.length < 2) return false;
    const [lon, lat] = position;
    if (!Number.isFinite(lon) || Math.abs(lon) > 180) return false;
    if (!Number.isFinite(lat) || Math.abs(lat) > 90) return false;
  }
  return true;
}

function normalizePolygons(geometry) {
  if (!geometry || typeof geometry !== 'object') return null;
  let polygons;
  if (geometry.type === 'Polygon') polygons = [geometry.coordinates];
  else if (geometry.type === 'MultiPolygon') polygons = geometry.coordinates;
  else return null;
  if (!Array.isArray(polygons)) return null;
  const result = [];
  for (const rings of polygons) {
    if (!Array.isArray(rings) || !rings.length) continue;
    if (!rings.every(validRing)) continue;
    result.push(rings);
  }
  return result.length ? result : null;
}

function polygonAnchor(polygons) {
  const outer = polygons[0][0];
  let lon = 0;
  let lat = 0;
  const count = outer.length - 1;
  for (let i = 0; i < count; i++) {
    lon += outer[i][0];
    lat += outer[i][1];
  }
  return { lon: lon / count, lat: lat / count };
}

/** Local storm reports (tornado points). */
export function normalizeTornadoReportSnapshot(geojson) {
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
    const phenomena = textOrNull(properties.phenomena) || textOrNull(properties.type);
    if (phenomena && !/^T(?:O|ORN)/i.test(phenomena) && phenomena !== 'TORNADO')
      continue;
    const stableId =
      feature.id == null || feature.id === ''
        ? `tornado-report-${index + 1}`
        : String(feature.id);
    if (ids.has(stableId)) continue;
    ids.add(stableId);
    const magnitude = textOrNull(properties.magnitude) || textOrNull(properties.mag);
    const city = textOrNull(properties.city) || textOrNull(properties.typloc);
    const state = textOrNull(properties.state);
    const remark = textOrNull(properties.remark) || textOrNull(properties.comments);
    const valid = properties.valid || properties.utc_valid || properties.wfo_valid;
    rows.push({
      stableId,
      geometryType: 'point',
      lat,
      lon,
      title: city ? `Tornado report · ${city}` : 'Tornado report',
      summary: remark || [city, state].filter(Boolean).join(', ') || 'NWS local storm report',
      kind: 'tornado-report',
      severity: magnitude || 'report',
      magnitude,
      city,
      state,
      time: typeof valid === 'string' ? valid : null,
      timeMs: parseTimeMs(valid),
      sourceUrl: textOrNull(properties.href) || 'https://mesonet.agron.iastate.edu/lsr/',
      polygons: null,
    });
  }
  return rows;
}

/** Storm-based warning / outlook polygons. */
export function normalizeTornadoPolygonSnapshot(geojson, { kind = 'tornado-warning' } = {}) {
  if (!Array.isArray(geojson?.features)) return null;
  const rows = [];
  const ids = new Set();
  for (const [index, feature] of geojson.features.entries()) {
    const properties = feature?.properties || {};
    const phenomena = textOrNull(properties.phenomena);
    if (kind === 'tornado-warning' && phenomena && phenomena !== 'TO') continue;
    const polygons = normalizePolygons(feature.geometry);
    if (!polygons) continue;
    const stableId =
      feature.id == null || feature.id === ''
        ? `${kind}-${index + 1}`
        : String(feature.id);
    if (ids.has(stableId)) continue;
    ids.add(stableId);
    const anchor = polygonAnchor(polygons);
    const label =
      textOrNull(properties.ps) ||
      textOrNull(properties.LABEL) ||
      textOrNull(properties.label2) ||
      (kind === 'tornado-outlook' ? 'SPC tornado outlook' : 'Tornado warning');
    const issue = properties.issue || properties.polygon_begin || properties.VALID;
    rows.push({
      stableId,
      geometryType: 'polygon',
      lat: anchor.lat,
      lon: anchor.lon,
      title: label,
      summary:
        textOrNull(properties.link)?.replace(/<[^>]+>/g, '') ||
        textOrNull(properties.LABEL) ||
        label,
      kind,
      severity:
        textOrNull(properties.significance) ||
        textOrNull(properties.DN) ||
        (kind === 'tornado-outlook' ? 'outlook' : 'warning'),
      time: typeof issue === 'string' ? issue : null,
      timeMs: parseTimeMs(issue),
      sourceUrl: textOrNull(properties.href) ||
        (kind === 'tornado-outlook'
          ? 'https://www.spc.noaa.gov/products/outlook/'
          : 'https://mesonet.agron.iastate.edu/current/severe.phtml'),
      polygons,
      wfo: textOrNull(properties.wfo),
      probability: finiteOrNull(Number(properties.DN)),
    });
  }
  return rows;
}

export function mergeTornadoSnapshots({ reports, warnings, outlooks } = {}) {
  const rows = [];
  if (Array.isArray(reports)) rows.push(...reports);
  if (Array.isArray(warnings)) rows.push(...warnings);
  if (Array.isArray(outlooks)) rows.push(...outlooks);
  return rows;
}
