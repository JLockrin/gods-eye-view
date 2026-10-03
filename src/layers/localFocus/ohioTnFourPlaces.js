/**
 * Joel-scoped focus places for the registry and crime layers.
 * Lima + Beaverdam → Allen County, OH
 * Findlay → Hancock County, OH
 * Knoxville → Knox County, TN
 */

export const FOCUS_PLACES = Object.freeze([
  Object.freeze({
    id: 'lima-oh',
    label: 'Lima, OH',
    city: 'Lima',
    state: 'OH',
    county: 'Allen',
    jurisdictionId: 'allen-oh',
    jurisdictionLabel: 'Allen County, OH',
    lat: 40.7426,
    lon: -84.1052,
    // City-scale envelope used for coverage tests and default framing.
    west: -84.22,
    south: 40.68,
    east: -83.98,
    north: 40.8,
    rangeM: 9000,
  }),
  Object.freeze({
    id: 'beaverdam-oh',
    label: 'Beaverdam, OH',
    city: 'Beaverdam',
    state: 'OH',
    county: 'Allen',
    jurisdictionId: 'allen-oh',
    jurisdictionLabel: 'Allen County, OH',
    lat: 40.8253,
    lon: -83.9766,
    west: -84.02,
    south: 40.8,
    east: -83.93,
    north: 40.85,
    rangeM: 4500,
  }),
  Object.freeze({
    id: 'findlay-oh',
    label: 'Findlay, OH',
    city: 'Findlay',
    state: 'OH',
    county: 'Hancock',
    jurisdictionId: 'hancock-oh',
    jurisdictionLabel: 'Hancock County, OH',
    lat: 41.0442,
    lon: -83.6499,
    west: -83.78,
    south: 40.97,
    east: -83.52,
    north: 41.12,
    rangeM: 10000,
  }),
  Object.freeze({
    id: 'knoxville-tn',
    label: 'Knoxville, TN',
    city: 'Knoxville',
    state: 'TN',
    county: 'Knox',
    jurisdictionId: 'knox-tn',
    jurisdictionLabel: 'Knox County, TN',
    lat: 35.9606,
    lon: -83.9207,
    west: -84.15,
    south: 35.82,
    east: -83.7,
    north: 36.12,
    rangeM: 18000,
  }),
]);

/** Northwest Ohio trio (Lima, Beaverdam, Findlay) — default framing on enable. */
export const NW_OHIO_OVERVIEW = Object.freeze({
  id: 'nw-ohio-overview',
  label: 'Lima · Beaverdam · Findlay',
  lat: 40.9,
  lon: -83.9,
  west: -84.35,
  south: 40.65,
  east: -83.4,
  north: 41.18,
  rangeM: 45000,
});

export const FOCUS_SOURCE_LABEL =
  'Lima / Beaverdam / Findlay, OH · Knoxville, TN';

export const FOCUS_ZOOM_MESSAGE =
  'Zoom into Lima, Beaverdam, Findlay (OH), or Knoxville (TN)';

const MAX_SPAN_DEG = 8;

export function boundsSpanOk(bounds, maxSpanDeg = MAX_SPAN_DEG) {
  if (!bounds) return false;
  const latSpan = bounds.north - bounds.south;
  const lonSpan =
    bounds.west <= bounds.east
      ? bounds.east - bounds.west
      : 360 - (bounds.west - bounds.east);
  return (
    latSpan > 0 &&
    lonSpan > 0 &&
    latSpan <= maxSpanDeg &&
    lonSpan <= maxSpanDeg
  );
}

export function boundsOverlap(a, b) {
  if (!a || !b) return false;
  const lonOverlap =
    a.west <= a.east && b.west <= b.east
      ? a.west <= b.east && b.west <= a.east
      : true;
  return a.south <= b.north && b.south <= a.north && lonOverlap;
}

/** Places whose envelopes intersect the viewport. */
export function placesInView(bounds, places = FOCUS_PLACES) {
  if (!bounds) return [];
  return places.filter((place) => boundsOverlap(bounds, place));
}

export function jurisdictionsInView(bounds, places = FOCUS_PLACES) {
  const seen = new Set();
  const rows = [];
  for (const place of placesInView(bounds, places)) {
    if (seen.has(place.jurisdictionId)) continue;
    seen.add(place.jurisdictionId);
    rows.push({
      id: place.jurisdictionId,
      label: place.jurisdictionLabel,
      county: place.county,
      state: place.state,
      placeIds: places
        .filter((entry) => entry.jurisdictionId === place.jurisdictionId)
        .map((entry) => entry.id),
    });
  }
  return rows;
}

export function focusCoverageSummary(bounds) {
  const places = placesInView(bounds);
  if (!places.length) return { places: [], jurisdictions: [], coverage: 'none' };
  return {
    places,
    jurisdictions: jurisdictionsInView(bounds),
    coverage: 'focus',
  };
}
