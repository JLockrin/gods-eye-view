/** Normalize NPS National Register of Historic Places point snapshots. */

const finiteOrNull = (value) => (Number.isFinite(value) ? value : null);
const textOrNull = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

function parseTimeMs(value) {
  if (Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  // NRHP CertDate often arrives as "1984-04-" (month precision).
  const cleaned = value.trim().replace(/-+$/, '');
  const ms = Date.parse(cleaned.length === 7 ? `${cleaned}-01` : cleaned);
  return Number.isFinite(ms) ? ms : null;
}

function npsLink(refnum) {
  const id = textOrNull(refnum);
  if (!id) return null;
  return `https://npgallery.nps.gov/AssetDetail/${id}`;
}

function addressLabel(properties) {
  const parts = [
    textOrNull(properties.Address) || textOrNull(properties.address),
    textOrNull(properties.City) || textOrNull(properties.city),
    textOrNull(properties.State) || textOrNull(properties.state),
  ].filter(Boolean);
  return parts.join(', ') || null;
}

/** Accept FeatureCollection, proxy `{ rows }`, or already-normalized rows. */
export function normalizeHistoricPlacesSnapshot(payload) {
  if (Array.isArray(payload?.rows)) {
    const rows = [];
    const ids = new Set();
    for (const row of payload.rows) {
      if (
        !row ||
        typeof row !== 'object' ||
        !row.stableId ||
        !Number.isFinite(row.lat) ||
        !Number.isFinite(row.lon)
      )
        continue;
      if (ids.has(row.stableId)) continue;
      ids.add(row.stableId);
      rows.push(row);
    }
    return rows;
  }
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
    const refnum =
      textOrNull(properties.NRIS_Refnum) ||
      textOrNull(properties.PROPERTY_ID) ||
      textOrNull(properties.nrisId);
    const name =
      textOrNull(properties.RESNAME) ||
      textOrNull(properties.name) ||
      'Historic place';
    const stableId =
      refnum ||
      textOrNull(properties.CR_ID) ||
      (feature.id == null || feature.id === ''
        ? `nrhp-${index + 1}`
        : String(feature.id));
    if (ids.has(stableId)) continue;
    ids.add(stableId);
    const listed =
      textOrNull(properties.CertDate) || textOrNull(properties.listedDate);
    const address = addressLabel(properties);
    const nhlRaw = properties.Is_NHL ?? properties.isNhl;
    const isNhl =
      nhlRaw === true ||
      nhlRaw === 1 ||
      String(nhlRaw || '')
        .trim()
        .toLowerCase() === 'true';
    rows.push({
      stableId,
      lat,
      lon,
      title: name,
      summary: address,
      name,
      address: textOrNull(properties.Address) || textOrNull(properties.address),
      city: textOrNull(properties.City) || textOrNull(properties.city),
      county: textOrNull(properties.County) || textOrNull(properties.county),
      state: textOrNull(properties.State) || textOrNull(properties.state),
      resType: textOrNull(properties.ResType) || textOrNull(properties.resType),
      listedDate: listed,
      timeMs: parseTimeMs(listed),
      nrisId: refnum,
      isNhl,
      status: textOrNull(properties.STATUS) || textOrNull(properties.status),
      sourceUrl:
        textOrNull(properties.NARA_URL) ||
        textOrNull(properties.sourceUrl) ||
        npsLink(refnum),
    });
  }
  return rows;
}
