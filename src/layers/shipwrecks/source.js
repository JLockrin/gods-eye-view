import { normalizeShipwreckSnapshot } from './records.js';
import { readResponseJsonCapped } from '../../sources/httpBody.js';

const HARBOUR_WRECKS =
  'https://gis.charttools.noaa.gov/arcgis/rest/services/encdirect/enc_harbour/MapServer/36/query';
const APPROACH_WRECKS =
  'https://gis.charttools.noaa.gov/arcgis/rest/services/encdirect/enc_approach/MapServer/39/query';

const MAX_SPAN_DEG = 28;
const MAX_RECORDS = 800;

function spanOk(bounds) {
  if (!bounds) return false;
  const latSpan = bounds.north - bounds.south;
  const lonSpan =
    bounds.west <= bounds.east
      ? bounds.east - bounds.west
      : 360 - (bounds.west - bounds.east);
  return latSpan > 0 && lonSpan > 0 && latSpan <= MAX_SPAN_DEG && lonSpan <= MAX_SPAN_DEG;
}

function bboxParam(bounds) {
  // ArcGIS envelope: xmin,ymin,xmax,ymax in WGS84
  if (bounds.west <= bounds.east)
    return `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`;
  // Dateline: query the larger side only to avoid worldwide pulls.
  const westWidth = 180 - bounds.west;
  const eastWidth = bounds.east + 180;
  if (westWidth >= eastWidth)
    return `${bounds.west},${bounds.south},180,${bounds.north}`;
  return `-180,${bounds.south},${bounds.east},${bounds.north}`;
}

/** Viewport-bounded NOAA ENC wreck points (keyless ArcGIS REST GeoJSON). */
export function createShipwreckSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  async function queryLayer(url, bounds, signal) {
    const params = new URLSearchParams({
      where: '1=1',
      geometry: bboxParam(bounds),
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'OBJECTID,OBJNAM,CATWRK,INFORM,SORDAT',
      returnGeometry: 'true',
      outSR: '4326',
      resultRecordCount: String(MAX_RECORDS),
      f: 'geojson',
    });
    const response = await fetchImpl(`${url}?${params}`, { signal });
    if (!response.ok) throw new Error(`NOAA wrecks HTTP ${response.status}`);
    return readResponseJsonCapped(response, 8 * 1024 * 1024, signal);
  }

  return {
    label: 'NOAA ENC',
    async getSnapshot({ signal, bounds } = {}) {
      signal?.throwIfAborted();
      if (!spanOk(bounds)) {
        // Fail soft: whole-globe queries would freeze the scene.
        return [];
      }
      const payloads = await Promise.all([
        queryLayer(HARBOUR_WRECKS, bounds, signal),
        queryLayer(APPROACH_WRECKS, bounds, signal),
      ]);
      signal?.throwIfAborted();
      const merged = {
        type: 'FeatureCollection',
        features: payloads.flatMap((payload) =>
          Array.isArray(payload?.features) ? payload.features : [],
        ),
      };
      const rows = normalizeShipwreckSnapshot(merged);
      if (!rows) throw new Error('Malformed NOAA wreck response');
      return rows.slice(0, MAX_RECORDS);
    },
  };
}
