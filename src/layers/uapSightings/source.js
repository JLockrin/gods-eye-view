import { normalizeUapSightingSnapshot } from './records.js';

const bundledUrl = new URL(
  '../../data/local_data/uap_sightings/sightings.geojsonl',
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

/**
 * Bundled NUFORC-derived geocoded sighting reports (Zenodo CC BY 4.0).
 * These are *reports*, never verified phenomena.
 */
export function createUapSightingSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  url = bundledUrl,
} = {}) {
  let cached = null;
  return {
    label: 'Sighting reports',
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      if (cached) return cached;
      const response = await fetchImpl(url, { signal, cache: 'force-cache' });
      if (!response.ok) throw new Error(`UAP snapshot HTTP ${response.status}`);
      const text = await response.text();
      signal?.throwIfAborted();
      const payload = await readGeoJsonLines(text);
      if (!payload) throw new Error('Malformed UAP snapshot');
      const rows = normalizeUapSightingSnapshot(payload);
      if (!rows) throw new Error('Malformed UAP snapshot');
      cached = rows;
      return rows;
    },
  };
}
