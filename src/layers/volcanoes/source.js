import { normalizeVolcanoSnapshot } from './records.js';
import { readResponseJsonCapped } from '../../sources/httpBody.js';

const STATUS_URL = 'https://volcanoes.usgs.gov/vsc/api/volcanoApi/geojson';
const ELEVATED_URL = 'https://volcanoes.usgs.gov/vsc/api/volcanoApi/elevated';

/** USGS volcano status + elevated activity notices (keyless, U.S. public domain). */
export function createVolcanoSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  async function readJson(url, signal) {
    const response = await fetchImpl(url, { signal });
    if (!response.ok) throw new Error(`USGS volcano HTTP ${response.status}`);
    return readResponseJsonCapped(response, 6 * 1024 * 1024, signal);
  }

  return {
    label: 'USGS',
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      const settled = await Promise.allSettled([
        readJson(STATUS_URL, signal),
        readJson(ELEVATED_URL, signal),
      ]);
      signal?.throwIfAborted();
      const status =
        settled[0].status === 'fulfilled' ? settled[0].value : null;
      const elevated =
        settled[1].status === 'fulfilled' ? settled[1].value : null;
      if (!status && !elevated) {
        const first = settled.find((result) => result.status === 'rejected');
        throw first?.reason instanceof Error
          ? first.reason
          : new Error('USGS volcano feeds unavailable');
      }
      const rows = normalizeVolcanoSnapshot({
        features: status?.features,
        elevated: Array.isArray(elevated) ? elevated : elevated?.elevated,
      });
      if (!rows) throw new Error('Malformed USGS volcano response');
      return rows;
    },
  };
}
