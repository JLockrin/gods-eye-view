import { normalizeBibleLocationSnapshot } from './records.js';

const bundledUrl = new URL(
  '../../data/local_data/bible_locations/places.geojsonl',
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
 * Bundled OpenBible.info Bible places (CC BY 4.0) with short public-domain
 * KJV citations. Keyless; places without reliable source coordinates are
 * omitted from the pack.
 */
export function createBibleLocationSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  url = bundledUrl,
} = {}) {
  let cached = null;
  return {
    label: 'OpenBible.info',
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      if (cached) return cached;
      const response = await fetchImpl(url, { signal, cache: 'force-cache' });
      if (!response.ok)
        throw new Error(`Bible locations snapshot HTTP ${response.status}`);
      const text = await response.text();
      signal?.throwIfAborted();
      const payload = await readGeoJsonLines(text);
      if (!payload) throw new Error('Malformed Bible locations snapshot');
      const rows = normalizeBibleLocationSnapshot(payload);
      if (!rows) throw new Error('Malformed Bible locations snapshot');
      cached = rows;
      return rows;
    },
  };
}
