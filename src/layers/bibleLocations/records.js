/** Normalize OpenBible Bible-location GeoJSON / GeoJSONL snapshots. */

const textOrNull = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};
const finiteOrNull = (value) => (Number.isFinite(value) ? value : null);

function verseList(properties) {
  if (Array.isArray(properties.verses)) {
    return properties.verses.map(textOrNull).filter(Boolean);
  }
  const single = textOrNull(properties.citation);
  return single ? [single] : [];
}

/** Accept FeatureCollection or an array of Feature / already-normalized rows. */
export function normalizeBibleLocationSnapshot(payload) {
  const features = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.features)
      ? payload.features
      : null;
  if (!features) return null;
  const rows = [];
  const ids = new Set();
  for (const [index, feature] of features.entries()) {
    if (feature && typeof feature === 'object' && !feature.geometry) {
      if (
        feature.stableId &&
        Number.isFinite(feature.lat) &&
        Number.isFinite(feature.lon)
      ) {
        if (ids.has(feature.stableId)) continue;
        ids.add(feature.stableId);
        rows.push(feature);
      }
      continue;
    }
    const coordinates = feature?.geometry?.coordinates;
    const properties = feature?.properties;
    if (
      !Array.isArray(coordinates) ||
      coordinates.length < 2 ||
      !properties ||
      typeof properties !== 'object' ||
      Array.isArray(properties) ||
      (feature.geometry.type != null && feature.geometry.type !== 'Point')
    )
      continue;
    const [lon, lat] = coordinates;
    if (
      !Number.isFinite(lon) ||
      Math.abs(lon) > 180 ||
      !Number.isFinite(lat) ||
      Math.abs(lat) > 90
    )
      continue;
    const stableId =
      feature.id == null || feature.id === ''
        ? `bible-${index + 1}`
        : String(feature.id);
    if (ids.has(stableId)) continue;
    ids.add(stableId);
    const name =
      textOrNull(properties.name) ||
      textOrNull(properties.title) ||
      'Bible place';
    const verses = verseList(properties);
    const citation = textOrNull(properties.citation) || verses[0] || null;
    // No invented coordinates: skip anything the pack could not site.
    if (!citation) continue;
    const event =
      textOrNull(properties.event) ||
      textOrNull(properties.summary) ||
      null;
    if (!event) continue;
    rows.push({
      stableId,
      lat,
      lon,
      title: name,
      name,
      event,
      summary: event,
      citation,
      verses,
      verseCount: finiteOrNull(Number(properties.verseCount)) ?? verses.length,
      moreVerses: finiteOrNull(Number(properties.moreVerses)) || 0,
      kind: textOrNull(properties.kind) || 'place',
      severity: 'bible',
      confidence: finiteOrNull(Number(properties.confidence)),
      source:
        textOrNull(properties.source) ||
        'OpenBible.info Bible Geocoding (CC BY 4.0)',
      sourceUrl:
        textOrNull(properties.sourceUrl) ||
        'https://www.openbible.info/geo/',
      eventSource: textOrNull(properties.eventSource) || null,
    });
  }
  return rows;
}
