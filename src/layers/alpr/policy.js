/**
 * Community-mapped OpenStreetMap ALPR locations, via hourly US/Canada detail
 * tiles. OSM data remains ODbL, separate from the application code. These are
 * mapped locations, not footage, plate records or evidence of current activity.
 *
 * Visual treatment: hazard / avoid framing — dense ALPR coverage reads as
 * surveillance hotspots (danger-zone heat + subtle watched pulse), with the
 * globe desaturated outside coverage while the layer is on.
 */

export const LAYER_ID = 'alpr-cameras';

export const OVERPASS_URL = '/api/overpass';

export const REQUEST_DEBOUNCE_MS = 300;

/** Keep camera acquisition city-scale, never globe-wide. */
export const MAX_VIEWPORT_DEGREES = 3;

/** Camera record cap; reaching it reports limited coverage. */
export const QUERY_LIMIT = 1500;

/**
 * The extract carries full camera attributes from z9 (z0-8 are geometry-only
 * heat tiles). Each view uses the finest zoom from z12 down to z9 that fits
 * DETAIL_MAX_TILES, so a whole city loads from a few z9/z10 tiles and a
 * neighbourhood from z12 (about 2 m position precision).
 */
export const DETAIL_MIN_ZOOM = 9;
export const DETAIL_MAX_ZOOM = 12;
export const DETAIL_MAX_TILES = 16;

/** Decoded records kept per accepted tile coverage (memory bound, not a render cap). */
export const SOURCE_RECORD_LIMIT = 6000;

/** Best-precision coordinates remembered per camera across zoom changes. */
export const PRECISION_CACHE_LIMIT = 20000;

/** Render cap. Kept at or above QUERY_LIMIT on purpose: if it ever sat below
 * it, cameras between the two would be silently dropped while `saturated`
 * stayed false and `count` still reported them — a lie about coverage. */
export const MAX_RENDERED = 1500;

/** Meters — illustrative facing wedge depth, when a camera reports a bearing. */
export const DIRECTION_CONE_M = 90;
export const DIRECTION_CONE_HALF_ANGLE_DEG = 20;

export const EARTH_MEAN_RADIUS_M = 6371008.8;

/** Query boxes are snapped outward to this grid so nearby camera moves reuse
 * one accepted viewport snapshot rather than rebuilding records on every pan. */
export const QUERY_SNAP_DEGREES = 0.05;

/** A view still fully inside the last snapped query box reuses those records
 * for this long before selecting tiles again. */
export const QUERY_REUSE_MS = 10 * 60 * 1000;

/**
 * Hazard palette: avoid-zone reds. Flock-tagged cameras use the sharpest red;
 * other ALPRs use a cooler warning rose when both are shown.
 */
export const ALPR_COLOR = '#e85a4f';
export const ALPR_FLOCK_COLOR = '#ff2a2a';
export const ALPR_OTHER_COLOR = '#d9785c';
export const ALPR_SELECTED_COLOR = '#ff6474';
export const ALPR_HEAT_COLOR = '#c62828';

/** Brand filter: show every mapped ALPR, or only Flock Safety / flock matches. */
export const BRAND_FILTER_ALL = 'all';
export const BRAND_FILTER_FLOCK = 'flock';
export const BRAND_FILTERS = Object.freeze([
  BRAND_FILTER_ALL,
  BRAND_FILTER_FLOCK,
]);

/** Soft coverage influence radius around each camera (metres). */
export const COVERAGE_RADIUS_M = 220;
/** Extra metres added per camera in a heat cell when aggregating danger zones. */
export const HEAT_RADIUS_PER_CAMERA_M = 80;
export const HEAT_RADIUS_MIN_M = 180;
export const HEAT_RADIUS_MAX_M = 900;
/** Grid step (degrees) for density / danger-zone aggregation. */
export const HEAT_GRID_DEGREES = 0.01;
/** Cap heat cells drawn as ground ellipses. */
export const MAX_HEAT_CELLS = 200;
/** Coverage-grade desaturation intensity outside watched zones (0..1). */
export const COVERAGE_DESATURATE = 0.82;
/** Minimum coverage samples before the grade engages (avoids muddy gray planet). */
export const COVERAGE_GRADE_MIN_POINTS = 3;

export const MARKER_ICON_SIZE = 38;
/** Badge scale by camera distance (near m, scale, far m, scale), shared by
 * native badges and overlay glyphs so both shrink alike in city-wide views. */
export const MARKER_SCALE_BY_DISTANCE = Object.freeze([
  500, 1.15, 40_000, 0.45,
]);
export const SELECTED_MARKER_ICON_SIZE = 60;
export const MAX_CANVAS_FRUSTUMS = 64;

/** Metres a floor-placed marker sits above its resolved ground cell. */
export const MARKER_FLOOR_LIFT_M = 1.5;

/** Rendered-surface samples one overlay paint may take (each is a depth render). */
export const ANCHOR_SAMPLES_PER_PAINT = 4;

/** Accepted rendered-surface window around a floor cell (a cut or an embankment
 * sits within it; a rooftop or an unstreamed tile usually does not). */
export const SURFACE_BELOW_FLOOR_M = 30;
/** Rendered-surface refinements per paint while the camera is still. */
export const SURFACE_SAMPLES_PER_PAINT = 2;
export const SURFACE_ABOVE_FLOOR_M = 40;

/** OSM attribution may collapse after five seconds; full credit stays in Data attribution. */
export const CREDIT_DISPLAY_MS = 5000;
