import { normalizeTsunamiSnapshot } from './records.js';

const bundledUrl = new URL(
  '../../data/local_data/ncei_tsunami_events/events.geojsonl',
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

/** Bundled NCEI Global Historical Tsunami Database snapshot (keyless). */
export function createTsunamiSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  url = bundledUrl,
} = {}) {
  let cached = null;
  return {
    label: 'NCEI',
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      if (cached) return cached;
      const response = await fetchImpl(url, { signal, cache: 'force-cache' });
      if (!response.ok)
        throw new Error(`NCEI tsunami snapshot HTTP ${response.status}`);
      const text = await response.text();
      signal?.throwIfAborted();
      const payload = await readGeoJsonLines(text);
      if (!payload) throw new Error('Malformed NCEI tsunami snapshot');
      const rows = normalizeTsunamiSnapshot(payload);
      if (!rows) throw new Error('Malformed NCEI tsunami snapshot');
      cached = rows;
      return rows;
    },
  };
}
