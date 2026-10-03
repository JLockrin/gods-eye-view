import { normalizeCrimeIncidentSnapshot } from '../../src/layers/crimeIncidents/records.js';
import {
  FOCUS_PLACES,
  boundsSpanOk,
  jurisdictionsInView,
  placesInView,
} from '../../src/layers/localFocus/ohioTnFourPlaces.js';
import {
  CRIME_PLACE_COVERAGE,
  coverageNoteForPlaces,
  liveFeedSummary,
} from '../../src/layers/localFocus/placeCoverage.js';
import {
  readResponseJsonCapped,
  coalesceProxyRequest,
} from './common/http.js';
import { makeRateLimiter, clientKey } from './common/rate-limit.js';
import { createKnoxvilleUnsolvedSource } from './crimeIncidents/knoxvilleUnsolved.js';

/**
 * Scoped crime proxy for Lima / Beaverdam / Findlay (OH) and Knoxville (TN).
 *
 * Live built-in feed today: Knoxville unsolved-murder tip listings (homicides)
 * from the City of Knoxville public HTML page, geocoded via Nominatim.
 * LexisNexis Community Crime Map / Findlay Citizen Connect forbid automation;
 * Lima COLGIS Police is token-gated; KGIS is auth-gated; FBI CDE needs a key.
 *
 * Optional: set CRIME_INCIDENTS_UPSTREAM_URL to a GeoJSON/ArcGIS query URL that
 * already returns only these places — still never a national scrape.
 */
export const CRIME_INCIDENT_SOURCES = Object.freeze([]);

const MIB = 1024 * 1024;
const CACHE_TTL_MS = 120_000;
const DEFAULT_MAX_RECORDS = 500;
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

function pointInBounds(lon, lat, bounds) {
  if (!bounds) return true;
  if (lat < bounds.south || lat > bounds.north) return false;
  if (bounds.west <= bounds.east)
    return lon >= bounds.west && lon <= bounds.east;
  return lon >= bounds.west || lon <= bounds.east;
}

/**
 * GET /api/crime-incidents?west=&south=&east=&north=&maxrecords=500
 */
export function crimeIncidentsProxy({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
  sources = CRIME_INCIDENT_SOURCES,
  upstreamUrl = process.env.CRIME_INCIDENTS_UPSTREAM_URL || '',
  knoxvilleUnsolved = createKnoxvilleUnsolvedSource({ fetchImpl, now }),
} = {}) {
  const cache = new Map();
  const inFlight = new Map();
  const allow = makeRateLimiter({ windowMs: 60_000, max: 45, globalMax: 450 });

  async function queryOptionalUpstream(bounds, maxRecords) {
    const url = String(upstreamUrl || '').trim();
    if (!url) return null;
    if (!/^https:\/\//i.test(url)) throw new Error('upstream_must_be_https');
    const separator = url.includes('?') ? '&' : '?';
    const requestUrl = `${url}${separator}west=${bounds.west}&south=${bounds.south}&east=${bounds.east}&north=${bounds.north}&maxrecords=${maxRecords}&geometry=${encodeURIComponent(bboxParam(bounds))}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outSR=4326&f=geojson`;
    const signal = AbortSignal.timeout(30_000);
    const response = await fetchImpl(requestUrl, {
      signal,
      redirect: 'error',
      headers: { 'User-Agent': 'GodsEyeView/0.1', Accept: 'application/json' },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`upstream_optional_${response.status}`);
    }
    const payload = await readResponseJsonCapped(response, 8 * MIB, signal);
    const rows = normalizeCrimeIncidentSnapshot(payload, {
      id: 'configured-upstream',
      name: 'Configured crime upstream',
    });
    if (!rows) throw new Error('invalid_optional_upstream');
    return rows;
  }

  async function queryKnoxville(bounds, maxRecords, signal) {
    if (!knoxvilleUnsolved?.query) return [];
    const collection = await knoxvilleUnsolved.query({
      signal,
      maxRecords,
    });
    const rows = normalizeCrimeIncidentSnapshot(collection, {
      id: 'knoxville-unsolved',
      name: knoxvilleUnsolved.name,
      aboutUrl: knoxvilleUnsolved.aboutUrl,
    });
    if (!rows) return [];
    return rows.filter((row) => pointInBounds(row.lon, row.lat, bounds));
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
    const placeIds = places.map((place) => place.id);
    const jurisdictions = jurisdictionsInView(bounds, FOCUS_PLACES);
    const emptyNote = coverageNoteForPlaces(placeIds, CRIME_PLACE_COVERAGE);
    const liveNote = liveFeedSummary(CRIME_PLACE_COVERAGE);

    if (upstreamUrl) {
      const rows = await queryOptionalUpstream(bounds, maxRecords);
      return {
        fetchedAt: now(),
        rows: (rows || []).slice(0, maxRecords),
        coverage: rows?.length ? 'partial' : 'empty',
        sources: ['configured-upstream'],
        places: placeIds,
        jurisdictions: jurisdictions.map((entry) => entry.label),
        note: emptyNote,
        placeCoverage: placeIds.map((id) => CRIME_PLACE_COVERAGE[id]),
      };
    }

    void sources;
    const knoxInView = jurisdictions.some((entry) => entry.id === 'knox-tn');
    const rows = [];
    const used = [];
    if (knoxInView) {
      const signal = AbortSignal.timeout(45_000);
      const knoxRows = await queryKnoxville(bounds, maxRecords, signal);
      used.push('knoxville-unsolved-homicides');
      rows.push(...knoxRows);
    }

    const coverage = rows.length
      ? 'partial'
      : emptyNote
        ? 'none'
        : 'empty';

    return {
      fetchedAt: now(),
      rows: rows.slice(0, maxRecords),
      coverage,
      sources: used,
      places: placeIds,
      jurisdictions: jurisdictions.map((entry) => entry.label),
      note: [liveNote, emptyNote].filter(Boolean).join(' · ') || null,
      placeCoverage: placeIds.map((id) => CRIME_PLACE_COVERAGE[id]),
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
      json(502, { error: 'crime_incidents_unavailable' });
    }
  }

  return {
    name: 'crime-incidents',
    configureServer({ middlewares }) {
      middlewares.use('/api/crime-incidents', handler);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/crime-incidents', handler);
    },
  };
}
