import { normalizeVolcanoSnapshot } from '../../src/layers/volcanoes/records.js';
import {
  readResponseJsonCapped,
  coalesceProxyRequest,
} from './common/http.js';
import { makeRateLimiter, clientKey } from './common/rate-limit.js';

const STATUS_URL = 'https://volcanoes.usgs.gov/vsc/api/volcanoApi/geojson';
const ELEVATED_URL = 'https://volcanoes.usgs.gov/vsc/api/volcanoApi/elevated';
const MIB = 1024 * 1024;
const CACHE_TTL_MS = 300_000;

/**
 * Same-origin USGS volcano proxy. The USGS volcano API answers browsers with
 * hostile CORS (`Access-Control-Allow-Credentials: 1` together with
 * `Access-Control-Allow-Origin: *`), so the client must not fetch it directly.
 *
 * GET /api/volcanoes → { fetchedAt, rows, stale? }
 */
export function volcanoesProxy({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
} = {}) {
  const cache = new Map();
  const inFlight = new Map();
  const allow = makeRateLimiter({ windowMs: 60_000, max: 60, globalMax: 1200 });

  async function upstream(url, cap, timeout) {
    const signal = AbortSignal.timeout(timeout);
    const response = await fetchImpl(url, {
      signal,
      redirect: 'error',
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('upstream_unavailable');
    }
    return readResponseJsonCapped(response, cap, signal);
  }

  async function fetchVolcanoes() {
    const settled = await Promise.allSettled([
      upstream(STATUS_URL, 6 * MIB, 30_000),
      upstream(ELEVATED_URL, 2 * MIB, 20_000),
    ]);
    const status =
      settled[0].status === 'fulfilled' ? settled[0].value : null;
    const elevated =
      settled[1].status === 'fulfilled' ? settled[1].value : null;
    if (!status && !elevated) {
      throw new Error('upstream_unavailable');
    }
    const rows = normalizeVolcanoSnapshot({
      features: status?.features,
      elevated: Array.isArray(elevated) ? elevated : elevated?.elevated,
    });
    if (!rows) throw new Error('invalid_snapshot');
    return { fetchedAt: now(), rows };
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
    const path = (req.url || '/').split('?')[0];
    if (path !== '/' && path !== '')
      return json(404, { error: 'unknown_route' });
    if (!allow(clientKey(req))) return json(429, { error: 'rate_limited' });
    try {
      const { value, stale } = await acquire(
        'volcanoes',
        CACHE_TTL_MS,
        fetchVolcanoes,
      );
      json(200, stale ? { ...value, stale: true } : value, stale);
    } catch {
      json(502, { error: 'volcanoes_unavailable' });
    }
  }

  return {
    name: 'volcanoes',
    configureServer({ middlewares }) {
      middlewares.use('/api/volcanoes', handler);
    },
    configurePreviewServer({ middlewares }) {
      middlewares.use('/api/volcanoes', handler);
    },
  };
}
