import {
  QUERY_LIMIT,
  QUERY_SNAP_DEGREES,
  BRAND_FILTER_ALL,
  BRAND_FILTER_FLOCK,
  BRAND_FILTERS,
  ALPR_FLOCK_COLOR,
  ALPR_OTHER_COLOR,
  ALPR_SELECTED_COLOR,
  HEAT_GRID_DEGREES,
  HEAT_RADIUS_PER_CAMERA_M,
  HEAT_RADIUS_MIN_M,
  HEAT_RADIUS_MAX_M,
  MAX_HEAT_CELLS,
} from './policy.js';

export function textTag(value) {
  const t = String(value ?? '').trim();
  return t || null;
}

/**
 * Whether a camera record is tagged as Flock Safety / flock (manufacturer or
 * operator). Tile extracts map `brand` onto manufacturer.
 * @param {object|null|undefined} record
 * @returns {boolean}
 */
export function isFlockAlpr(record) {
  const haystack = `${record?.manufacturer || ''} ${record?.operator || ''}`
    .trim()
    .toLowerCase();
  if (!haystack) return false;
  // Match "Flock Safety", "flock", etc. Avoid matching unrelated tokens that
  // merely contain those letters as a substring of a longer word.
  return /(?:^|[^a-z])flock(?:[^a-z]|$)/i.test(` ${haystack} `);
}

/** Normalize a brand-filter param; invalid values keep `fallback`. */
export function normalizeBrandFilter(value, fallback = BRAND_FILTER_ALL) {
  return BRAND_FILTERS.includes(value) ? value : fallback;
}

/**
 * Apply the row brand filter. `all` keeps every record; `flock` keeps Flock
 * matches only. Highlighting is a separate presentation concern.
 * @param {Array<object>} records
 * @param {string} brandFilter
 * @returns {Array<object>}
 */
export function filterAlprByBrand(records, brandFilter) {
  if (!Array.isArray(records)) return [];
  if (normalizeBrandFilter(brandFilter) === BRAND_FILTER_FLOCK)
    return records.filter(isFlockAlpr);
  return records;
}

/**
 * Hazard marker / wedge color for one record.
 * @param {object} record
 * @param {{selected?: boolean, brandFilter?: string}} [options]
 * @returns {string} CSS hex color.
 */
export function alprHazardColor(record, { selected = false } = {}) {
  if (selected) return ALPR_SELECTED_COLOR;
  return isFlockAlpr(record) ? ALPR_FLOCK_COLOR : ALPR_OTHER_COLOR;
}

/**
 * Aggregate cameras into soft danger-zone cells (density heat). Pure helper
 * so tests pin the grid math without Cesium.
 * @param {Array<object>} records
 * @param {{gridDegrees?: number, maxCells?: number}} [options]
 * @returns {Array<{id:string, latitude:number, longitude:number, count:number,
 *   flockCount:number, radiusM:number, intensity:number}>}
 */
export function aggregateAlprHeatCells(
  records,
  { gridDegrees = HEAT_GRID_DEGREES, maxCells = MAX_HEAT_CELLS } = {},
) {
  if (!Array.isArray(records) || !records.length) return [];
  const step =
    Number.isFinite(gridDegrees) && gridDegrees > 0
      ? gridDegrees
      : HEAT_GRID_DEGREES;
  const cells = new Map();
  for (const record of records) {
    if (
      !Number.isFinite(record?.latitude) ||
      !Number.isFinite(record?.longitude)
    )
      continue;
    const latCell = Math.floor(record.latitude / step) * step;
    const lonCell = Math.floor(record.longitude / step) * step;
    const key = `${latCell.toFixed(5)}:${lonCell.toFixed(5)}`;
    const existing = cells.get(key) || {
      id: `alpr-heat:${key}`,
      latCell,
      lonCell,
      count: 0,
      flockCount: 0,
      latSum: 0,
      lonSum: 0,
    };
    existing.count += 1;
    if (isFlockAlpr(record)) existing.flockCount += 1;
    existing.latSum += record.latitude;
    existing.lonSum += record.longitude;
    cells.set(key, existing);
  }
  const ranked = [...cells.values()]
    .map((cell) => {
      const intensity = Math.min(1, Math.sqrt(cell.count / 8));
      const radiusM = Math.min(
        HEAT_RADIUS_MAX_M,
        Math.max(
          HEAT_RADIUS_MIN_M,
          HEAT_RADIUS_MIN_M + cell.count * HEAT_RADIUS_PER_CAMERA_M,
        ),
      );
      return {
        id: cell.id,
        latitude: cell.latSum / cell.count,
        longitude: cell.lonSum / cell.count,
        count: cell.count,
        flockCount: cell.flockCount,
        radiusM,
        intensity,
      };
    })
    .sort((a, b) => b.count - a.count || b.flockCount - a.flockCount);
  return ranked.slice(0, Math.max(1, maxCells | 0));
}

export function numTag(value) {
  // `Number('')` and `Number('   ')` are 0, not NaN — a blank or whitespace-only
  // tag value must read as missing, never as a due-north bearing.
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Snap a viewport box OUTWARD to the query grid, clamped to valid ranges.
 * Pure so the reuse contract is pinnable.
 * @param {{south:number,west:number,north:number,east:number}} box
 * @param {number} [step=QUERY_SNAP_DEGREES]
 */
export function snapAlprBox(box, step = QUERY_SNAP_DEGREES) {
  const down = (v) => Math.floor(v / step) * step;
  const up = (v) => Math.ceil(v / step) * step;
  return {
    south: Math.max(-90, down(box.south)),
    west: Math.max(-180, down(box.west)),
    north: Math.min(90, up(box.north)),
    east: Math.min(180, up(box.east)),
  };
}

/** Whether `inner` lies entirely within `outer` (no dateline handling; the viewport gate already rejects east <= west). */
export function boxContains(outer, inner) {
  if (!outer || !inner) return false;
  return (
    inner.south >= outer.south &&
    inner.north <= outer.north &&
    inner.west >= outer.west &&
    inner.east <= outer.east
  );
}

/**
 * Backoff progression for the unavailable-state retry: 30 s, doubling to a
 * 240 s ceiling. Pure so the progression is pinnable without booting the layer.
 */
export function alprRetryDelayMs(prevDelayMs) {
  const RETRY_MIN_MS = 30000;
  const RETRY_CEIL_MS = 240000;
  if (!Number.isFinite(prevDelayMs) || prevDelayMs <= 0) return RETRY_MIN_MS;
  return Math.min(prevDelayMs * 2, RETRY_CEIL_MS);
}

/**
 * Whether a `surveillance:type` value denotes an ALPR camera. OSM allows
 * semicolon multi-values (`camera;ALPR`) and mixed case, so an exact match
 * would silently miss tagged cameras.
 * @param {*} value - raw `surveillance:type` tag value
 * @returns {boolean}
 */
export function isAlprSurveillanceType(value) {
  return String(value ?? '')
    .split(';')
    .some((part) => part.trim().toUpperCase() === 'ALPR');
}

/** Map one raw Overpass node element to a plain camera record. Null for anything unusable. */
export function normalizeAlprNode(el) {
  if (
    !el ||
    el.type !== 'node' ||
    !Number.isSafeInteger(el.id) ||
    el.id <= 0 ||
    !Number.isFinite(el.lat) ||
    Math.abs(el.lat) > 90 ||
    !Number.isFinite(el.lon) ||
    Math.abs(el.lon) > 180
  )
    return null;
  const tags = el.tags || {};
  if (!isAlprSurveillanceType(tags['surveillance:type'])) return null;
  return {
    id: `alpr:${el.id}`,
    osmId: el.id,
    latitude: el.lat,
    longitude: el.lon,
    operator: textTag(tags.operator),
    manufacturer: textTag(tags.manufacturer),
    cameraType: textTag(tags['camera:type']),
    zone: textTag(tags['surveillance:zone']),
    // Only numeric bearings are parsed; compass-word directions ("N"/"NE")
    // are rare on this tag and simply render with no facing line.
    directionDeg: normalizeDirection(
      tags['camera:direction'] ?? tags.direction,
    ),
    ref: textTag(tags.ref),
    lastVerified: textTag(tags.check_date) || textTag(tags['survey:date']),
    source: textTag(tags.source),
  };
}

export function normalizeDirection(value) {
  const degrees = numTag(value);
  return degrees != null && degrees >= 0 && degrees <= 360
    ? degrees % 360
    : null;
}

/**
 * Overpass QL for the viewport. The tag match is a case-insensitive regex, not
 * an exact `="ALPR"`, because OSM semicolon multi-values such as
 * `surveillance:type=camera;ALPR` are common and an exact match drops them.
 * Exported so the query shape is pinnable.
 */
export function buildOverpassQuery(south, west, north, east) {
  return (
    `[out:json][timeout:20];node["man_made"="surveillance"]["surveillance:type"~"(^|;)\\s*ALPR\\s*(;|$)",i]` +
    `(${south},${west},${north},${east});out body ${QUERY_LIMIT};`
  );
}

/** Validate a source-independent snapshot before replacing the accepted display. */
export function validateAlprSnapshot(snapshot) {
  if (
    !Array.isArray(snapshot?.records) ||
    typeof snapshot.stale !== 'boolean' ||
    typeof snapshot.saturated !== 'boolean'
  ) {
    throw new TypeError('Camera source returned an invalid snapshot');
  }
  const ids = new Set();
  for (const record of snapshot.records) {
    if (
      !record ||
      typeof record.id !== 'string' ||
      !record.id.trim() ||
      ids.has(record.id) ||
      !Number.isFinite(record.latitude) ||
      Math.abs(record.latitude) > 90 ||
      !Number.isFinite(record.longitude) ||
      Math.abs(record.longitude) > 180 ||
      (record.directionDeg != null &&
        (!Number.isFinite(record.directionDeg) ||
          record.directionDeg < 0 ||
          record.directionDeg >= 360))
    ) {
      throw new TypeError('Camera source returned an invalid record');
    }
    ids.add(record.id);
  }
  return snapshot;
}
