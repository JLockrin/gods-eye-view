/**
 * Normalize public crime-incident snapshots from city open-data portals.
 * Points are incidents (not suspect profiles).
 */

const finiteOrNull = (value) => {
  const number = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(number) ? number : null;
};
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

function formatDate(ms) {
  if (!Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function isHomicide(crimeType) {
  const text = String(crimeType || '').toUpperCase();
  return (
    text.includes('HOMICIDE') ||
    text.includes('MURDER') ||
    text.includes('MANSLAUGHTER')
  );
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

function fromSocrataRow(row, index, sourceMeta = {}) {
  const sourceId = textOrNull(sourceMeta.id);
  let lat = null;
  let lon = null;
  let crimeType = null;
  let description = null;
  let jurisdiction = null;
  let timeMs = null;
  let incidentId = null;

  if (sourceId === 'chicago') {
    lat = finiteOrNull(row.latitude);
    lon = finiteOrNull(row.longitude);
    crimeType = textOrNull(row.primary_type);
    description = textOrNull(row.description);
    jurisdiction = textOrNull(row.community_area)
      ? `Chicago · community area ${row.community_area}`
      : 'Chicago, IL';
    timeMs = parseTimeMs(row.date);
    incidentId = textOrNull(row.id) || textOrNull(row.case_number);
  } else if (sourceId === 'nyc') {
    lat = finiteOrNull(row.latitude);
    lon = finiteOrNull(row.longitude);
    crimeType = textOrNull(row.ofns_desc) || textOrNull(row.law_cat_cd);
    description = textOrNull(row.law_cat_cd);
    jurisdiction = textOrNull(row.boro_nm)
      ? `${row.boro_nm}, NYC`
      : 'New York City, NY';
    timeMs = parseTimeMs(row.cmplnt_fr_dt);
    incidentId = textOrNull(String(row.cmplnt_num ?? ''));
  } else if (sourceId === 'la') {
    lat = finiteOrNull(row.lat);
    lon = finiteOrNull(row.lon);
    crimeType = textOrNull(row.crm_cd_desc);
    description = textOrNull(row.area_name);
    jurisdiction = textOrNull(row.area_name)
      ? `Los Angeles · ${row.area_name}`
      : 'Los Angeles, CA';
    timeMs = parseTimeMs(row.date_rptd) || parseTimeMs(row.date_occ);
    incidentId = textOrNull(String(row.dr_no ?? ''));
  } else {
    lat = finiteOrNull(row.lat ?? row.latitude);
    lon = finiteOrNull(row.lon ?? row.longitude);
    crimeType = textOrNull(row.crimeType) || textOrNull(row.primary_type);
    description = textOrNull(row.description);
    jurisdiction = textOrNull(row.jurisdiction);
    timeMs = parseTimeMs(row.date) || finiteOrNull(row.timeMs);
    incidentId = textOrNull(row.id) || textOrNull(row.stableId);
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !crimeType) return null;
  const sourceName =
    textOrNull(sourceMeta.name) ||
    textOrNull(row.sourceName) ||
    'City open crime data';
  const stableId =
    textOrNull(row.stableId) ||
    (incidentId && sourceId ? `${sourceId}:${incidentId}` : null) ||
    (sourceId ? `${sourceId}:${index + 1}` : `crime-${index + 1}`);
  const date = formatDate(timeMs);
  const homicide = isHomicide(crimeType);

  return {
    stableId,
    lat,
    lon,
    title: crimeType,
    crimeType,
    description,
    jurisdiction,
    date,
    timeMs: Number.isFinite(timeMs) ? timeMs : null,
    kind: homicide ? 'homicide' : 'crime',
    severity: homicide ? 'homicide' : 'other',
    sourceId: sourceId || null,
    sourceName,
    sourceUrl: textOrNull(sourceMeta.aboutUrl) || textOrNull(row.sourceUrl),
    summary: [crimeType, jurisdiction, date].filter(Boolean).join(' · '),
  };
}

function fromGeoJsonFeature(feature, index, sourceMeta = {}) {
  if (feature && typeof feature === 'object' && !feature.geometry) {
    if (
      feature.stableId &&
      Number.isFinite(feature.lat) &&
      Number.isFinite(feature.lon)
    ) {
      return feature;
    }
    return fromSocrataRow(feature, index, sourceMeta);
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
  let crimeType = null;
  let description = null;
  let jurisdiction = null;
  let timeMs = null;
  let incidentId = null;

  if (sourceId === 'dc-mpd') {
    crimeType = textOrNull(properties.OFFENSE);
    description = textOrNull(properties.METHOD);
    jurisdiction = textOrNull(properties.WARD)
      ? `Washington, DC · Ward ${properties.WARD}`
      : 'Washington, DC';
    timeMs =
      finiteOrNull(properties.REPORT_DAT) || parseTimeMs(properties.REPORT_DAT);
    incidentId =
      textOrNull(properties.CCN) ||
      (feature.id == null ? null : String(feature.id));
  } else {
    crimeType =
      textOrNull(properties.crimeType) ||
      textOrNull(properties.OFFENSE) ||
      textOrNull(properties.primary_type);
    description = textOrNull(properties.description);
    jurisdiction = textOrNull(properties.jurisdiction);
    timeMs =
      finiteOrNull(properties.timeMs) ||
      parseTimeMs(properties.date) ||
      finiteOrNull(properties.REPORT_DAT);
    incidentId =
      textOrNull(properties.id) ||
      (feature.id == null ? null : String(feature.id));
  }

  if (!crimeType) return null;
  const sourceName =
    textOrNull(sourceMeta.name) ||
    textOrNull(properties.sourceName) ||
    'City open crime data';
  const date = formatDate(timeMs);
  const homicide = isHomicide(crimeType);
  const stableId =
    textOrNull(properties.stableId) ||
    (incidentId && sourceId ? `${sourceId}:${incidentId}` : null) ||
    (sourceId ? `${sourceId}:${index + 1}` : `crime-${index + 1}`);

  return {
    stableId,
    lat: coords.lat,
    lon: coords.lon,
    title: crimeType,
    crimeType,
    description,
    jurisdiction,
    date,
    timeMs: Number.isFinite(timeMs) ? timeMs : null,
    kind: homicide ? 'homicide' : 'crime',
    severity: homicide ? 'homicide' : 'other',
    sourceId: sourceId || null,
    sourceName,
    sourceUrl:
      textOrNull(sourceMeta.aboutUrl) || textOrNull(properties.sourceUrl),
    summary: [crimeType, jurisdiction, date].filter(Boolean).join(' · '),
  };
}

/** Accept FeatureCollection, Socrata arrays, proxy `{ rows }`, or normalized rows. */
export function normalizeCrimeIncidentSnapshot(payload, sourceMeta = {}) {
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

  if (Array.isArray(payload) && payload.length && !payload[0]?.geometry) {
    const rows = [];
    const ids = new Set();
    for (const [index, entry] of payload.entries()) {
      const row = fromSocrataRow(entry, index, sourceMeta);
      if (!row || ids.has(row.stableId)) continue;
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
    const row = fromGeoJsonFeature(feature, index, sourceMeta);
    if (!row || ids.has(row.stableId)) continue;
    ids.add(row.stableId);
    rows.push(row);
  }
  return rows;
}

export function crimeIncidentSortKey(row) {
  const homicideBoost = row?.severity === 'homicide' ? 1_000_000_000_000 : 0;
  return homicideBoost + (Number.isFinite(row?.timeMs) ? row.timeMs : 0);
}
