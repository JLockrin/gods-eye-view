import { normalizeHistoricPlacesSnapshot } from './records.js';
import { readResponseJsonCapped } from '../../sources/httpBody.js';

const MAX_SPAN_DEG = 12;
const MAX_RECORDS = 500;

function spanOk(bounds) {
  if (!bounds) return false;
  const latSpan = bounds.north - bounds.south;
  const lonSpan =
    bounds.west <= bounds.east
      ? bounds.east - bounds.west
      : 360 - (bounds.west - bounds.east);
  return (
    latSpan > 0 &&
    lonSpan > 0 &&
    latSpan <= MAX_SPAN_DEG &&
    lonSpan <= MAX_SPAN_DEG
  );
}

/** Viewport-bounded NRHP points via same-origin NPS proxy. */
export function createHistoricPlacesSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    label: 'NPS NRHP',
    async getSnapshot({ signal, bounds } = {}) {
      signal?.throwIfAborted();
      if (!spanOk(bounds)) {
        // Fail soft: the full NRHP corpus is huge; require a regional viewport.
        return [];
      }
      const params = new URLSearchParams({
        west: String(bounds.west),
        south: String(bounds.south),
        east: String(bounds.east),
        north: String(bounds.north),
        maxrecords: String(MAX_RECORDS),
      });
      const response = await fetchImpl(`/api/historic-places?${params}`, {
        signal,
      });
      if (!response.ok)
        throw new Error(`NRHP historic places HTTP ${response.status}`);
      const payload = await readResponseJsonCapped(
        response,
        8 * 1024 * 1024,
        signal,
      );
      signal?.throwIfAborted();
      const rows = normalizeHistoricPlacesSnapshot(payload);
      if (!rows) throw new Error('Malformed NRHP historic places response');
      return rows.slice(0, MAX_RECORDS);
    },
  };
}
