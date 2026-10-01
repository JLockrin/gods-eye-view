import { normalizeAviationAccidentSnapshot } from './records.js';

const bundledUrl = new URL(
  '../../data/local_data/ntsb_aviation_accidents/accidents.geojsonl',
  import.meta.url,
).href;

async function readGeoJsonLines(text) {
  const features = [];
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      features.push(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  return { type: 'FeatureCollection', features };
}

/** Bundled NTSB public-domain aviation accident snapshot (keyless). */
export function createAviationAccidentSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  url = bundledUrl,
} = {}) {
  let cached = null;
  return {
    label: 'NTSB',
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      if (cached) return cached;
      const response = await fetchImpl(url, { signal, cache: 'force-cache' });
      if (!response.ok)
        throw new Error(`NTSB snapshot HTTP ${response.status}`);
      const text = await response.text();
      signal?.throwIfAborted();
      const payload = await readGeoJsonLines(text);
      if (!payload) throw new Error('Malformed NTSB snapshot');
      const rows = normalizeAviationAccidentSnapshot(payload);
      if (!rows) throw new Error('Malformed NTSB snapshot');
      cached = rows;
      return rows;
    },
  };
}
