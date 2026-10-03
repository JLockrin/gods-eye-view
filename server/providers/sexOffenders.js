import { normalizeSexOffenderSnapshot } from '../../src/layers/sexOffenders/records.js';
import {
  FOCUS_PLACES,
  boundsSpanOk,
  jurisdictionsInView,
  placesInView,
} from '../../src/layers/localFocus/ohioTnFourPlaces.js';
import {
  readResponseJsonCapped,
  coalesceProxyRequest,
} from './common/http.js';
import { makeRateLimiter, clientKey } from './common/rate-limit.js';

/**
 * Only Knox County, TN has a verified keyless official ArcGIS registry feed
 * (Tennessee TBI). Allen County OH (Lima, Beaverdam) and Hancock County OH
 * (Findlay) publish through the Ohio AG SORN search UI / sheriff pages — not a
 * documented programmatic open API — so those places stay empty rather than
 * scraping NSOPW or OffenderWatch.
 */
export const SEX_OFFENDER_SOURCES = Object.freeze([
  Object.freeze({
    id: 'tn-tbi-knox',
    name: 'Tennessee TBI Sex Offender Registry (Knox County)',
    aboutUrl:
      'https://tnmap.tn.gov/arcgis/rest/services/PUBLIC_SAFETY/TBI_SEX_OFFENDER_REGISTRY/MapServer',
    queryUrl:
      'https://tnmap.tn.gov/arcgis/rest/services/PUBLIC_SAFETY/TBI_SEX_OFFENDER_REGISTRY/MapServer/0/query',
    outFields:
      'OBJECTID,Tid,LastName,FirstName,ResCity,ResCounty,ResState,Classification,Tca1,CREATE_DATE,Current_Receive_Date,OffenseDate',
    jurisdictionId: 'knox-tn',
    // County filter keeps the pull inside Knox County even if the bbox is loose.
    where: "ResCounty='KNOX'",
    placeIds: Object.freeze(['knoxville-tn']),
  }),
]);

const OHIO_EMPTY_NOTE =
  'Allen County OH (Lima, Beaverdam) and Hancock County OH (Findlay): no keyless official registry ArcGIS/SODA feed found — Ohio AG SORN is a search UI, not used.';

const MIB = 1024 * 1024;
const CACHE_TTL_MS = 180_000;
const DEFAULT_MAX_RECORDS = 400;
const MAX_SPAN_DEG = 8;

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
  const bounds = { west, south, east, north };
  if (!boundsSpanOk(bounds, MAX_SPAN_DEG)) return null;
  return bounds;
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
 * Same-origin sex-offender proxy scoped to the four Joel places.
 *
 * GET /api/sex-offenders?west=&south=&east=&north=&maxrecords=400
 */
export function sexOffendersProxy({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
  sources = SEX_OFFENDER_SOURCES,
} = {}) {
  const cache = new Map();
  const inFlight = new Map();
  const allow = makeRateLimiter({ windowMs: 60_000, max: 45, globalMax: 450 });

  async function querySource(source, bounds, maxRecords) {
    const params = new URLSearchParams({
      where: source.where || '1=1',
      geometry: bboxParam(bounds),
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: source.outFields,
      returnGeometry: 'true',
      outSR: '4326',
      resultRecordCount: String(maxRecords),
      f: 'geojson',
    });
    const signal = AbortSignal.timeout(30_000);
    const response = await fetchImpl(`${source.queryUrl}?${params}`, {
      signal,
      redirect: 'error',
      headers: { 'User-Agent': 'GodsEyeView/0.1' },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`upstream_${source.id}_${response.status}`);
    }
    const payload = await readResponseJsonCapped(response, 6 * MIB, signal);
    const rows = normalizeSexOffenderSnapshot(payload, {
      id: 'tn-tbi',
      name: source.name,
      aboutUrl: source.aboutUrl,
    });
    if (!rows) throw new Error(`invalid_snapshot_${source.id}`);
    return rows;
  }

  async function fetchBounds(bounds, maxRecords) {
    const places = placesInView(bounds, FOCUS_PLACES);
    if (!places.length) {
      return {
        fetchedAt: now(),
        rows: [],
        coverage: 'outside-focus',
        sources: [],
        note: 'Viewport is outside Lima, Beaverdam, Findlay (OH) and Knoxville (TN).',
      };
    }
    const jurisdictions = jurisdictionsInView(bounds, FOCUS_PLACES);
    const active = sources.filter((source) =>
      jurisdictions.some((entry) => entry.id === source.jurisdictionId),
    );
    const ohioInView = jurisdictions.some((entry) =>
      entry.id.endsWith('-oh'),
    );
    if (!active.length) {
      return {
        fetchedAt: now(),
        rows: [],
        coverage: 'none',
        sources: [],
        places: places.map((place) => place.id),
        jurisdictions: jurisdictions.map((entry) => entry.label),
        note: ohioInView
          ? OHIO_EMPTY_NOTE
          : 'No wired registry source for the focused places in view.',
      };
    }

    const settled = await Promise.allSettled(
      active.map((source) => querySource(source, bounds, maxRecords)),
    );
    const rows = [];
    const used = [];
    const ids = new Set();
    let failures = 0;
    for (const [index, result] of settled.entries()) {
      if (result.status !== 'fulfilled') {
        failures += 1;
        continue;
      }
      used.push(active[index].id);
      for (const row of result.value) {
        if (!row?.stableId || ids.has(row.stableId)) continue;
        ids.add(row.stableId);
        rows.push(row);
        if (rows.length >= maxRecords) break;
      }
      if (rows.length >= maxRecords) break;
    }
    if (!rows.length && failures === active.length) {
      throw new Error('all_sources_unavailable');
    }
    return {
      fetchedAt: now(),
      rows: rows.slice(0, maxRecords),
      coverage: rows.length ? 'partial' : 'empty',
      sources: used,
      places: places.map((place) => place.id),
      jurisdictions: jurisdictions.map((entry) => entry.label),
      note: ohioInView ? OHIO_EMPTY_NOTE : null,
    };
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
        800,
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
      json(502, { error: 'sex_offenders_unavailable' });
    }
  }

  return {
    name: 'sex-offenders',
    configureServer({ middlewares }) {
      middlewares.use('/api/sex-offenders', handler);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/sex-offenders', handler);
    },
  };
}
