import { normalizeCrimeIncidentSnapshot } from './records.js';
import { readResponseJsonCapped } from '../../sources/httpBody.js';
import {
  boundsSpanOk,
  FOCUS_SOURCE_LABEL,
  FOCUS_ZOOM_MESSAGE,
} from '../localFocus/ohioTnFourPlaces.js';

const MAX_SPAN_DEG = 8;
const MAX_RECORDS = 500;

/**
 * Viewport-bounded crime incidents for the four scoped places only.
 * Built-in upstreams are empty until an official keyless point feed exists.
 */
export function createCrimeIncidentSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    label: FOCUS_SOURCE_LABEL,
    async getSnapshot({ signal, bounds } = {}) {
      signal?.throwIfAborted();
      if (!boundsSpanOk(bounds, MAX_SPAN_DEG)) {
        return {
          rows: [],
          status: 'zoom-in',
          statusMessage: FOCUS_ZOOM_MESSAGE,
        };
      }
      const params = new URLSearchParams({
        west: String(bounds.west),
        south: String(bounds.south),
        east: String(bounds.east),
        north: String(bounds.north),
        maxrecords: String(MAX_RECORDS),
      });
      const response = await fetchImpl(`/api/crime-incidents?${params}`, {
        signal,
      });
      if (!response.ok)
        throw new Error(`Crime incidents HTTP ${response.status}`);
      const payload = await readResponseJsonCapped(
        response,
        8 * 1024 * 1024,
        signal,
      );
      signal?.throwIfAborted();
      if (payload?.coverage === 'outside-focus') {
        return {
          rows: [],
          status: 'zoom-in',
          statusMessage: FOCUS_ZOOM_MESSAGE,
        };
      }
      const rows = normalizeCrimeIncidentSnapshot(payload);
      if (!rows) throw new Error('Malformed crime incidents response');
      if (!rows.length) {
        return {
          rows: [],
          status: 'empty',
          statusMessage:
            typeof payload?.note === 'string' && payload.note.trim()
              ? payload.note.trim()
              : 'No open crime-point feed for these four places yet',
        };
      }
      return { rows: rows.slice(0, MAX_RECORDS) };
    },
  };
}
