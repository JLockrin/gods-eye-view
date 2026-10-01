import {
  normalizeTornadoReportSnapshot,
  normalizeTornadoPolygonSnapshot,
  mergeTornadoSnapshots,
} from './records.js';
import { readResponseJsonCapped } from '../../sources/httpBody.js';

const LSR_URL =
  'https://mesonet.agron.iastate.edu/geojson/lsr.geojson?hours=72&phenomena=TO';
const SBW_URL =
  'https://mesonet.agron.iastate.edu/geojson/sbw.geojson?hours=24&phenomena=TO';
const OUTLOOK_URL =
  'https://www.spc.noaa.gov/products/outlook/day1otlk_torn.lyr.geojson';

/** Recent tornado reports, warnings, and Day-1 SPC tornado outlook (keyless). */
export function createTornadoSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  async function readGeoJson(url, signal) {
    const response = await fetchImpl(url, { signal });
    if (!response.ok) throw new Error(`Tornado feed HTTP ${response.status}`);
    return readResponseJsonCapped(response, 12 * 1024 * 1024, signal);
  }

  return {
    label: 'NWS / SPC',
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      const settled = await Promise.allSettled([
        readGeoJson(LSR_URL, signal),
        readGeoJson(SBW_URL, signal),
        readGeoJson(OUTLOOK_URL, signal),
      ]);
      signal?.throwIfAborted();
      const [lsrPayload, sbwPayload, outlookPayload] = settled.map((result) =>
        result.status === 'fulfilled' ? result.value : null,
      );
      const reports = lsrPayload
        ? normalizeTornadoReportSnapshot(lsrPayload)
        : [];
      const warnings = sbwPayload
        ? normalizeTornadoPolygonSnapshot(sbwPayload, {
            kind: 'tornado-warning',
          })
        : [];
      const outlooks = outlookPayload
        ? normalizeTornadoPolygonSnapshot(outlookPayload, {
            kind: 'tornado-outlook',
          })
        : [];
      if (reports === null || warnings === null || outlooks === null)
        throw new Error('Malformed tornado feed');
      // Fail soft: keep any successful subset (including an empty quiet day).
      // Only hard-fail when every upstream request failed.
      if (settled.every((result) => result.status === 'rejected')) {
        const first = settled.find((result) => result.status === 'rejected');
        throw first.reason instanceof Error
          ? first.reason
          : new Error('Tornado feeds unavailable');
      }
      return mergeTornadoSnapshots({ reports, warnings, outlooks });
    },
  };
}
