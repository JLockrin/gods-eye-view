import { normalizeSexOffenderSnapshot } from './records.js';
import { readResponseJsonCapped } from '../../sources/httpBody.js';
import {
  boundsSpanOk,
  FOCUS_SOURCE_LABEL,
  FOCUS_ZOOM_MESSAGE,
} from '../localFocus/ohioTnFourPlaces.js';

const MAX_SPAN_DEG = 8;
const MAX_RECORDS = 400;

/**
 * Viewport-bounded public registry points for the four scoped places only.
 * Live data today: Tennessee TBI (Knox County / Knoxville). Ohio places empty.
 */
export function createSexOffenderSource({
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
      const response = await fetchImpl(`/api/sex-offenders?${params}`, {
        signal,
      });
      if (!response.ok)
        throw new Error(`Sex offender registry HTTP ${response.status}`);
      const payload = await readResponseJsonCapped(
        response,
        6 * 1024 * 1024,
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
      const rows = normalizeSexOffenderSnapshot(payload);
      if (!rows) throw new Error('Malformed sex offender registry response');
      if (!rows.length) {
        return {
          rows: [],
          status: 'empty',
          statusMessage:
            typeof payload?.note === 'string' && payload.note.trim()
              ? payload.note.trim()
              : 'No registry points in this focused view (Knoxville TN via TBI; Ohio places have no keyless open feed)',
        };
      }
      return { rows: rows.slice(0, MAX_RECORDS) };
    },
  };
}
