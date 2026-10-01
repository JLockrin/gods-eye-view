import { readResponseJsonCapped } from '../../sources/httpBody.js';

/** Request a normalized volcano snapshot through the same-origin USGS proxy. */
export function createVolcanoSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    label: 'USGS',
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      const response = await fetchImpl('/api/volcanoes', { signal });
      if (!response.ok) throw new Error(`USGS volcano HTTP ${response.status}`);
      const payload = await readResponseJsonCapped(
        response,
        6 * 1024 * 1024,
        signal,
      );
      signal?.throwIfAborted();
      if (!Array.isArray(payload?.rows))
        throw new Error('Malformed USGS volcano response');
      return payload.rows;
    },
  };
}
