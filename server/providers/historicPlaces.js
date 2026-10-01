import { normalizeHistoricPlacesSnapshot } from '../../src/layers/historicPlaces/records.js';
import {
  readResponseJsonCapped,
  coalesceProxyRequest,
} from './common/http.js';
import { makeRateLimiter, clientKey } from './common/rate-limit.js';

const NRHP_QUERY_URL =
  'https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0/query';
const MIB = 1024 * 1024;
const CACHE_TTL_MS = 180_000;
const DEFAULT_MAX_RECORDS = 500;
const MAX_SPAN_DEG = 12;

const OUT_FIELDS = [
  'NRIS_Refnum',
  'RESNAME',
  'ResType',
  'Address',
  'City',
  'County',
  'State',
  'CertDate',
  'Is_NHL',
  'STATUS',
  'NARA_URL',
  'CR_ID',
  'PROPERTY_ID',
].join(',');

function parseBounds(searchParams) {
  const west = Number(searchParams.get('west'));
  const south = Number(searchParams.get('south'));
  const east = Number(searchParams.get('east'));
  const north = Number(searchParams.get('north'));
  if (![west, south, east, north].every((value) => Number.isFinite(value)))
    return null;
  if (south >= north || Math.abs(west) > 180 || Math.abs(east) > 180)
    return null;
  if (Math.abs(south) > 90 || Math.abs(north) > 90) return null;
  const latSpan = north - south;
  const lonSpan = west <= east ? east - west : 360 - (west - east);
  if (latSpan <= 0 || lonSpan <= 0) return null;
  if (latSpan > MAX_SPAN_DEG || lonSpan > MAX_SPAN_DEG) return null;
  return { west, south, east, north };
}

function bboxParam(bounds) {
  if (bounds.west <= bounds.east)
    return `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`;
  const westWidth = 180 - bounds.west;
  const eastWidth = bounds.east + 180;
  if (westWidth >= eastWidth)
    return `${bounds.west},${bounds.south},180,${bounds.north}`;
  return `-180,${bounds.south},${bounds.east},${bounds.north}`;
}

/**
 * Same-origin NPS NRHP points proxy.
 *
 * The NRHP MapServer is huge (~75k unrestricted points) and answers browsers
 * with credentialed CORS, so the client queries only through this viewport
 * bounded proxy.
 *
 * GET /api/historic-places?west=&south=&east=&north=&maxrecords=500
 *   → { fetchedAt, rows, stale? }
 */
export function historicPlacesProxy({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
} = {}) {
  const cache = new Map();
  const inFlight = new Map();
  const allow = makeRateLimiter({ windowMs: 60_000, max: 60, globalMax: 600 });

  async function fetchBounds(bounds, maxRecords) {
    const params = new URLSearchParams({
      where: '1=1',
      geometry: bboxParam(bounds),
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: OUT_FIELDS,
      returnGeometry: 'true',
      outSR: '4326',
      resultRecordCount: String(maxRecords),
      f: 'geojson',
    });
    const signal = AbortSignal.timeout(30_000);
    const response = await fetchImpl(`${NRHP_QUERY_URL}?${params}`, {
      signal,
      redirect: 'error',
      headers: { 'User-Agent': 'GodsEyeView/0.1' },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('upstream_unavailable');
    }
    const payload = await readResponseJsonCapped(response, 8 * MIB, signal);
    const rows = normalizeHistoricPlacesSnapshot(payload);
    if (!rows) throw new Error('invalid_snapshot');
    return { fetchedAt: now(), rows: rows.slice(0, maxRecords) };
  }

  async function acquire(key, ttl, load) {
    const previous = cache.get(key);
    if (previous && now() - previous.savedAt < ttl)
      return { value: previous.value, stale: false };
    try {
      const { promise } = coalesceProxyRequest(inFlight, key, async () => {
        const value = await load();
        cache.set(key, { value, savedAt: now() });
        return value;
      });
      return { value: await promise, stale: false };
    } catch (error) {
      if (previous) return { value: previous.value, stale: true };
      throw error;
    }
  }

  async function handler(req, res) {
    const json = (status, value, stale = false) => {
      if (res.destroyed) return;
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...(status === 405 ? { Allow: 'GET' } : {}),
        ...(status === 429 ? { 'Retry-After': '60' } : {}),
        ...(stale ? { 'X-Data-Stale': 'true' } : {}),
      });
      res.end(JSON.stringify(value));
    };
    if (req.method !== 'GET') return json(405, { error: 'method_not_allowed' });
    const requestUrl = new URL(req.url || '/', 'http://localhost');
    if (requestUrl.pathname !== '/' && requestUrl.pathname !== '')
      return json(404, { error: 'unknown_route' });
    if (!allow(clientKey(req))) return json(429, { error: 'rate_limited' });
    const bounds = parseBounds(requestUrl.searchParams);
    if (!bounds) return json(400, { error: 'bounds_required' });
    const maxRecords = Math.max(
      10,
      Math.min(
        1000,
        Number(requestUrl.searchParams.get('maxrecords')) ||
          DEFAULT_MAX_RECORDS,
      ),
    );
    const cacheKey = [
      bounds.west.toFixed(3),
      bounds.south.toFixed(3),
      bounds.east.toFixed(3),
      bounds.north.toFixed(3),
      maxRecords,
    ].join(':');
    try {
      const { value, stale } = await acquire(cacheKey, CACHE_TTL_MS, () =>
        fetchBounds(bounds, maxRecords),
      );
      json(200, stale ? { ...value, stale: true } : value, stale);
    } catch {
      json(502, { error: 'historic_places_unavailable' });
    }
  }

  return {
    name: 'historic-places',
    configureServer({ middlewares }) {
      middlewares.use('/api/historic-places', handler);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/historic-places', handler);
    },
  };
}
