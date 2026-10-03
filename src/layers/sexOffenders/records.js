/**
 * Normalize public sex-offender registry snapshots from official open GIS feeds.
 *
 * Privacy: keep only what a public map point already exposes for identification —
 * registry category, jurisdiction, and as-of/registration date. Do not carry
 * photos, biometrics, or street-address prose into the client model.
 */

const finiteOrNull = (value) => (Number.isFinite(value) ? value : null);
const textOrNull = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

function parseTimeMs(value) {
  if (Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value.trim());
  return Number.isFinite(ms) ? ms : null;
}

function formatAsOf(ms) {
  if (!Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function jurisdictionLabel(parts) {
  return parts.map(textOrNull).filter(Boolean).join(', ') || null;
}

function offenseCategory(properties, sourceId) {
  if (sourceId === 'dc-opendata') {
    const classification = textOrNull(properties.MAXCLASSIFICATION);
    const type = textOrNull(properties.TYPE);
    if (classification && type) return `Class ${classification} · ${type}`;
    if (classification) return `Class ${classification}`;
    return type || 'Registered sex offender';
  }
  if (sourceId === 'tn-tbi') {
    const classification = textOrNull(properties.Classification);
    const offense = textOrNull(properties.Tca1);
    if (classification && offense) return `${classification} · ${offense}`;
    return classification || offense || 'Registered sex offender';
  }
  if (sourceId === 'forsyth-nc') {
    return 'Registered sex offender';
  }
  return (
    textOrNull(properties.offenseCategory) ||
    textOrNull(properties.Classification) ||
    textOrNull(properties.TYPE) ||
    'Registered sex offender'
  );
}

function asOfMs(properties, sourceId) {
  if (sourceId === 'dc-opendata') {
    return (
      finiteOrNull(properties.DCS_LAST_MOD_DTM) ||
      finiteOrNull(properties.REGISTRATIONDATE) ||
      finiteOrNull(properties.ADDDATE)
    );
  }
  if (sourceId === 'tn-tbi') {
    return (
      finiteOrNull(properties.CREATE_DATE) ||
      parseTimeMs(properties.Current_Receive_Date) ||
      parseTimeMs(properties.OffenseDate)
    );
  }
  return (
    finiteOrNull(properties.asOfMs) ||
    parseTimeMs(properties.asOf) ||
    parseTimeMs(properties.listedDate)
  );
}

function registryName(properties, sourceId) {
  if (sourceId === 'forsyth-nc') {
    return textOrNull(properties.Offender) || 'Registered person';
  }
  const first =
    textOrNull(properties.FIRSTNAME) || textOrNull(properties.FirstName);
  const last =
    textOrNull(properties.LASTNAME) || textOrNull(properties.LastName);
  const combined = [first, last].filter(Boolean).join(' ');
  return combined || textOrNull(properties.name) || 'Registered person';
}

function featureCoordinates(feature) {
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const [lon, lat] = coordinates;
  if (
    !Number.isFinite(lon) ||
    Math.abs(lon) > 180 ||
    !Number.isFinite(lat) ||
    Math.abs(lat) > 90
  )
    return null;
  return { lon, lat };
}

function normalizeFeature(feature, index, sourceMeta = {}) {
  if (feature && typeof feature === 'object' && !feature.geometry) {
    if (
      feature.stableId &&
      Number.isFinite(feature.lat) &&
      Number.isFinite(feature.lon)
    ) {
      return feature;
    }
    return null;
  }
  const coords = featureCoordinates(feature);
  const properties = feature?.properties;
  if (
    !coords ||
    !properties ||
    typeof properties !== 'object' ||
    Array.isArray(properties) ||
    (feature.geometry.type != null && feature.geometry.type !== 'Point')
  )
    return null;

  const sourceId = textOrNull(sourceMeta.id) || textOrNull(properties.sourceId);
  const sourceName =
    textOrNull(sourceMeta.name) ||
    textOrNull(properties.sourceName) ||
    'Public sex offender registry';
  const name = registryName(properties, sourceId);
  const category = offenseCategory(properties, sourceId);
  const timeMs = asOfMs(properties, sourceId);
  const asOf = formatAsOf(timeMs);

  let jurisdiction = null;
  if (sourceId === 'dc-opendata') {
    jurisdiction = jurisdictionLabel([
      textOrNull(properties.QUADRANT)
        ? `Washington, DC (${properties.QUADRANT})`
        : 'Washington, DC',
      textOrNull(properties.ZIPCODE) ? `ZIP ${properties.ZIPCODE}` : null,
    ]);
  } else if (sourceId === 'tn-tbi') {
    jurisdiction = jurisdictionLabel([
      textOrNull(properties.ResCity),
      textOrNull(properties.ResCounty)
        ? `${properties.ResCounty} County`
        : null,
      textOrNull(properties.ResState) || 'TN',
    ]);
  } else if (sourceId === 'forsyth-nc') {
    jurisdiction = jurisdictionLabel([
      textOrNull(properties.City),
      'Forsyth County',
      textOrNull(properties.State) || 'NC',
    ]);
  } else {
    jurisdiction = jurisdictionLabel([
      textOrNull(properties.city),
      textOrNull(properties.county),
      textOrNull(properties.state),
      textOrNull(properties.jurisdiction),
    ]);
  }

  const registryId =
    textOrNull(properties.SEXOFFENDERCODE) ||
    textOrNull(properties.Tid) ||
    (properties.FCSO_ID != null ? String(properties.FCSO_ID) : null) ||
    textOrNull(properties.GLOBALID) ||
    (feature.id == null || feature.id === ''
      ? null
      : String(feature.id));

  const stableId =
    textOrNull(properties.stableId) ||
    (registryId && sourceId ? `${sourceId}:${registryId}` : null) ||
    (sourceId ? `${sourceId}:${index + 1}` : `registry-${index + 1}`);

  return {
    stableId,
    lat: coords.lat,
    lon: coords.lon,
    title: name,
    name,
    offenseCategory: category,
    jurisdiction,
    asOf,
    timeMs: Number.isFinite(timeMs) ? timeMs : null,
    kind: 'registered-sex-offender',
    sourceId: sourceId || null,
    sourceName,
    sourceUrl: textOrNull(sourceMeta.aboutUrl) || textOrNull(properties.sourceUrl),
    summary: [category, jurisdiction].filter(Boolean).join(' · ') || null,
  };
}

/**
 * Accept FeatureCollection, proxy `{ rows }`, or already-normalized rows.
 * Optional `source` metadata is applied when normalizing GeoJSON features.
 */
export function normalizeSexOffenderSnapshot(payload, sourceMeta = {}) {
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
    const row = normalizeFeature(feature, index, sourceMeta);
    if (!row || ids.has(row.stableId)) continue;
    ids.add(row.stableId);
    rows.push(row);
  }
  return rows;
}
