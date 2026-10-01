import {
  DEFAULT_GDELT_GEO_QUERY,
  normalizeGdeltGeoSnapshot,
} from '../../src/layers/gdeltGeo/records.js';
import {
  readResponseJsonCapped,
  readResponseTextCapped,
  coalesceProxyRequest,
} from './common/http.js';
import { makeRateLimiter, clientKey } from './common/rate-limit.js';

const GEO_V2_URL = 'https://api.gdeltproject.org/api/v2/geo/geo';
const GKG_GEOJSON_URL = 'https://api.gdeltproject.org/api/v1/gkg_geojson';
const LAST_UPDATE_URL = 'https://data.gdeltproject.org/gdeltv2/lastupdate.txt';
const MIB = 1024 * 1024;
const CACHE_TTL_MS = 900_000;
const DEFAULT_MAX_POINTS = 120;
const MAX_QUERY_CHARS = 160;

function sanitizeQuery(raw, fallback = DEFAULT_GDELT_GEO_QUERY) {
  const text = String(raw || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUERY_CHARS);
  return text || fallback;
}

function parseExportRows(text, query, maxPoints) {
  const needles = String(query)
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .split(/\s+or\s+|\s+/i)
    .map((part) => part.trim())
    .filter((part) => part && part !== 'or');
  const features = [];
  const seen = new Set();
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line) continue;
    const cols = line.split('\t');
    if (cols.length < 58) continue;
    const lat = Number(cols[56]);
    const lon = Number(cols[57]);
    if (
      !Number.isFinite(lat) ||
      Math.abs(lat) > 90 ||
      !Number.isFinite(lon) ||
      Math.abs(lon) > 180
    )
      continue;
    const url = cols[60] || cols[cols.length - 1] || '';
    const place = cols[52] || '';
    const dateAdded = cols[58] || '';
    const haystack = `${place} ${url}`.toLowerCase();
    if (needles.length && !needles.some((needle) => haystack.includes(needle)))
      continue;
    const key = `${lon.toFixed(2)},${lat.toFixed(2)}:${url || place}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const when =
      dateAdded.length >= 8
        ? `${dateAdded.slice(0, 4)}-${dateAdded.slice(4, 6)}-${dateAdded.slice(6, 8)}`
        : null;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        name: place || null,
        title: place ? `News near ${place}` : 'Geographic news',
        url: url || null,
        date: when,
        count: 1,
        feed: 'event-export',
      },
    });
    if (features.length >= maxPoints) break;
  }
  return { type: 'FeatureCollection', features, feed: 'event-export' };
}

/**
 * Same-origin GDELT geographic-news proxy.
 *
 * Prefers Geo 2.0 PointData GeoJSON, then the still-live GKG GeoJSON API, then a
 * sampled GDELT 2.0 Event export (always has lat/lon). Responses are cached for
 * 15 minutes to respect upstream rate limits.
 *
 * GET /api/gdelt-geo?query=...&maxpoints=120 → { fetchedAt, rows, feed, query, stale? }
 */
export function gdeltGeoProxy({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
  defaultQuery = process.env.GDELT_GEO_QUERY || DEFAULT_GDELT_GEO_QUERY,
} = {}) {
  const cache = new Map();
  const inFlight = new Map();
  const allow = makeRateLimiter({ windowMs: 60_000, max: 30, globalMax: 300 });

  async function upstreamJson(url, cap, timeout) {
    const signal = AbortSignal.timeout(timeout);
    const response = await fetchImpl(url, {
      signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'GodsEyeView/0.1' },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`upstream_${response.status}`);
    }
    return readResponseJsonCapped(response, cap, signal);
  }

  async function upstreamText(url, cap, timeout) {
    const signal = AbortSignal.timeout(timeout);
    const response = await fetchImpl(url, {
      signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'GodsEyeView/0.1' },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`upstream_${response.status}`);
    }
    return readResponseTextCapped(response, cap, signal);
  }

  async function fetchGeoV2(query, maxPoints) {
    const params = new URLSearchParams({
      query,
      mode: 'PointData',
      format: 'GeoJSON',
      maxpoints: String(maxPoints),
    });
    const payload = await upstreamJson(
      `${GEO_V2_URL}?${params}`,
      4 * MIB,
      20_000,
    );
    if (!Array.isArray(payload?.features)) throw new Error('invalid_geo_v2');
    return { ...payload, feed: 'geo-2.0' };
  }

  async function fetchGkg(query, maxPoints) {
    const params = new URLSearchParams({
      QUERY: query,
      MAXROWS: String(maxPoints),
    });
    const payload = await upstreamJson(
      `${GKG_GEOJSON_URL}?${params}`,
      4 * MIB,
      20_000,
    );
    if (!Array.isArray(payload?.features)) throw new Error('invalid_gkg');
    return { ...payload, feed: 'gkg-geojson' };
  }

  async function fetchEventExport(query, maxPoints) {
    const listing = await upstreamText(LAST_UPDATE_URL, 64 * 1024, 12_000);
    const exportLine = String(listing)
      .split(/\r?\n/)
      .find((line) => /\.export\.CSV\.zip\b/i.test(line));
    if (!exportLine) throw new Error('no_export');
    const exportUrl = exportLine.trim().split(/\s+/).pop();
    if (!/^https?:\/\//i.test(exportUrl || '')) throw new Error('bad_export_url');
    const signal = AbortSignal.timeout(45_000);
    const response = await fetchImpl(exportUrl, {
      signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'GodsEyeView/0.1' },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`export_${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    // GDELT export zips are typically a single STORED/DEFLATE entry.
    const text = await inflateZipFirstFile(buffer);
    return parseExportRows(text, query, maxPoints);
  }

  async function loadSnapshot(query, maxPoints) {
    const attempts = [
      () => fetchGeoV2(query, maxPoints),
      () => fetchGkg(query, maxPoints),
      () => fetchEventExport(query, maxPoints),
    ];
    let lastError = null;
    for (const attempt of attempts) {
      try {
        const payload = await attempt();
        const rows = normalizeGdeltGeoSnapshot(payload);
        if (!rows?.length) {
          lastError = new Error('empty_snapshot');
          continue;
        }
        return {
          fetchedAt: now(),
          rows: rows.slice(0, maxPoints),
          feed: payload.feed || null,
          query,
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('gdelt_unavailable');
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
    const query = sanitizeQuery(
      requestUrl.searchParams.get('query'),
      sanitizeQuery(defaultQuery),
    );
    const maxPoints = Math.max(
      10,
      Math.min(
        250,
        Number(requestUrl.searchParams.get('maxpoints')) || DEFAULT_MAX_POINTS,
      ),
    );
    try {
      const cacheKey = `${query}::${maxPoints}`;
      const { value, stale } = await acquire(cacheKey, CACHE_TTL_MS, () =>
        loadSnapshot(query, maxPoints),
      );
      json(200, stale ? { ...value, stale: true } : value, stale);
    } catch {
      json(502, { error: 'gdelt_geo_unavailable' });
    }
  }

  return {
    name: 'gdelt-geo',
    configureServer({ middlewares }) {
      middlewares.use('/api/gdelt-geo', handler);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/gdelt-geo', handler);
    },
  };
}

async function inflateZipFirstFile(buffer) {
  // Parse a simple single-entry ZIP (GDELT export) without extra deps.
  const { inflateRawSync } = await import('node:zlib');
  if (buffer.readUInt32LE(0) !== 0x04034b50)
    throw new Error('invalid_zip');
  const compression = buffer.readUInt16LE(8);
  const compSize = buffer.readUInt32LE(18);
  const nameLen = buffer.readUInt16LE(26);
  const extraLen = buffer.readUInt16LE(28);
  const dataStart = 30 + nameLen + extraLen;
  const compressed = buffer.subarray(dataStart, dataStart + compSize);
  if (compression === 0) return compressed.toString('utf8');
  if (compression === 8) return inflateRawSync(compressed).toString('utf8');
  throw new Error(`unsupported_zip_compression_${compression}`);
}
