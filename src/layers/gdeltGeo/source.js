import {
  DEFAULT_GDELT_GEO_QUERY,
  normalizeGdeltGeoSnapshot,
} from './records.js';
import { readResponseJsonCapped } from '../../sources/httpBody.js';

/** Same-origin GDELT Geo proxy (rate-limited + cached server-side). */
export function createGdeltGeoSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  query = DEFAULT_GDELT_GEO_QUERY,
  maxPoints = 120,
} = {}) {
  let lastQuery = null;
  let cached = null;
  return {
    label: 'GDELT',
    async getSnapshot({ signal, query: nextQuery } = {}) {
      signal?.throwIfAborted();
      const resolved =
        typeof nextQuery === 'string' && nextQuery.trim()
          ? nextQuery.trim()
          : query;
      if (cached && lastQuery === resolved) return cached;
      const params = new URLSearchParams({
        query: resolved,
        maxpoints: String(maxPoints),
      });
      const response = await fetchImpl(`/api/gdelt-geo?${params}`, { signal });
      if (!response.ok) throw new Error(`GDELT geo HTTP ${response.status}`);
      const payload = await readResponseJsonCapped(
        response,
        4 * 1024 * 1024,
        signal,
      );
      signal?.throwIfAborted();
      const rows = normalizeGdeltGeoSnapshot(payload);
      if (!rows) throw new Error('Malformed GDELT geo response');
      cached = rows;
      lastQuery = resolved;
      return rows;
    },
  };
}
