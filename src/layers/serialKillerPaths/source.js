import { normalizeSerialKillerPathSnapshot } from './records.js';

const bundledUrl = new URL(
  '../../data/local_data/serial_killer_paths/cases.json',
  import.meta.url,
).href;

/** Bundled public historical serial-case path pack (keyless, static). */
export function createSerialKillerPathSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  url = bundledUrl,
} = {}) {
  let cached = null;
  return {
    label: 'Public court / news archives',
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      if (cached) return cached;
      const response = await fetchImpl(url, { signal, cache: 'force-cache' });
      if (!response.ok)
        throw new Error(`Serial-killer path snapshot HTTP ${response.status}`);
      const payload = await response.json();
      signal?.throwIfAborted();
      const normalized = normalizeSerialKillerPathSnapshot(payload);
      if (!normalized) throw new Error('Malformed serial-killer path snapshot');
      cached = normalized;
      return cached;
    },
  };
}
