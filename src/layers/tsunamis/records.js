/** Normalize NCEI Global Historical Tsunami Database event snapshots. */

const finiteOrNull = (value) => (Number.isFinite(value) ? value : null);
const textOrNull = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

function placeLabel(properties) {
  const location = textOrNull(properties.location);
  const country = textOrNull(properties.country);
  return [location, country].filter(Boolean).join(', ') || null;
}

/** Accept FeatureCollection or an array of Feature / already-normalized rows. */
export function normalizeTsunamiSnapshot(payload) {
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
    const eventId = finiteOrNull(
      typeof properties.id === 'number' ? properties.id : Number(properties.id),
    );
    const stableId =
      eventId != null
        ? String(eventId)
        : feature.id == null || feature.id === ''
          ? `tsunami-${index + 1}`
          : String(feature.id);
    if (ids.has(stableId)) continue;
    ids.add(stableId);
    const place = placeLabel(properties);
    const year = finiteOrNull(
      typeof properties.year === 'number'
        ? properties.year
        : Number(properties.year),
    );
    const intensity = finiteOrNull(
      typeof properties.tsIntensity === 'number'
        ? properties.tsIntensity
        : Number(properties.tsIntensity),
    );
    const magnitude = finiteOrNull(
      typeof properties.eqMagnitude === 'number'
        ? properties.eqMagnitude
        : Number(properties.eqMagnitude),
    );
    rows.push({
      stableId,
      lat,
      lon,
      year,
      month: finiteOrNull(
        typeof properties.month === 'number'
          ? properties.month
          : Number(properties.month),
      ),
      day: finiteOrNull(
        typeof properties.day === 'number'
          ? properties.day
          : Number(properties.day),
      ),
      title: place ? `Tsunami · ${place}` : 'Tsunami event',
      summary: place,
      location: textOrNull(properties.location),
      country: textOrNull(properties.country),
      region: textOrNull(properties.region),
      cause: textOrNull(properties.cause),
      validity: textOrNull(properties.validity),
      validityCode: finiteOrNull(
        typeof properties.validityCode === 'number'
          ? properties.validityCode
          : Number(properties.validityCode),
      ),
      eqMagnitude: magnitude,
      tsIntensity: intensity,
      tsMtIi: finiteOrNull(
        typeof properties.tsMtIi === 'number'
          ? properties.tsMtIi
          : Number(properties.tsMtIi),
      ),
      maxRunup: finiteOrNull(
        typeof properties.maxRunup === 'number'
          ? properties.maxRunup
          : Number(properties.maxRunup),
      ),
      deaths: finiteOrNull(
        typeof properties.deaths === 'number'
          ? properties.deaths
          : Number(properties.deaths),
      ),
      damageMillions: finiteOrNull(
        typeof properties.damageMillions === 'number'
          ? properties.damageMillions
          : Number(properties.damageMillions),
      ),
      damage: textOrNull(properties.damage),
      sourceUrl:
        textOrNull(properties.url) ||
        (eventId != null
          ? `https://www.ngdc.noaa.gov/hazel/view/hazards/tsunami/event-more-info/${eventId}`
          : null),
      eventId,
    });
  }
  return rows;
}
