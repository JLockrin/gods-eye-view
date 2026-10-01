/** Normalize USGS volcano status / elevated-activity payloads. */

const textOrNull = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};
const finiteOrNull = (value) => (Number.isFinite(value) ? value : null);

function parseTimeMs(value) {
  if (Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function severityFromAlert(alertLevel, colorCode) {
  const alert = String(alertLevel || '').toUpperCase();
  const color = String(colorCode || '').toUpperCase();
  if (alert === 'WARNING' || color === 'RED') return 'warning';
  if (alert === 'WATCH' || color === 'ORANGE') return 'watch';
  if (alert === 'ADVISORY' || color === 'YELLOW') return 'advisory';
  if (alert === 'NORMAL' || color === 'GREEN') return 'normal';
  return 'unassigned';
}

function normalizeFeature(feature, index) {
  const coordinates = feature?.geometry?.coordinates;
  const properties = feature?.properties || {};
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    (feature.geometry?.type != null && feature.geometry.type !== 'Point')
  )
    return null;
  const [lon, lat] = coordinates;
  if (
    !Number.isFinite(lon) ||
    Math.abs(lon) > 180 ||
    !Number.isFinite(lat) ||
    Math.abs(lat) > 90
  )
    return null;
  const vnum = textOrNull(properties.vnum) || textOrNull(String(properties.vnum));
  const name =
    textOrNull(properties.volcanoName) || textOrNull(properties.vName);
  const stableId =
    vnum ||
    (feature.id == null || feature.id === ''
      ? `volcano-${index + 1}`
      : String(feature.id));
  const alertLevel = textOrNull(properties.alertLevel);
  const colorCode = textOrNull(properties.colorCode);
  const severity = severityFromAlert(alertLevel, colorCode);
  const synopsis =
    textOrNull(properties.noticeSynopsis) || textOrNull(properties.noticeId);
  return {
    stableId,
    lat,
    lon,
    title: name ? `Volcano · ${name}` : 'Volcano',
    summary: synopsis || `${alertLevel || 'UNASSIGNED'} / ${colorCode || 'UNASSIGNED'}`,
    kind: 'volcano',
    severity,
    name,
    vnum,
    alertLevel,
    colorCode,
    region: textOrNull(properties.region),
    time: textOrNull(properties.alertDate) || textOrNull(properties.colorDate),
    timeMs:
      parseTimeMs(properties.alertDate) || parseTimeMs(properties.colorDate),
    sourceUrl:
      textOrNull(properties.noticeUrl) ||
      textOrNull(properties.volcanoUrl) ||
      (vnum ? `https://volcano.si.edu/volcano.cfm?vn=${vnum}` : null),
    elevated: severity === 'warning' || severity === 'watch' || severity === 'advisory',
  };
}

function normalizeElevatedRow(row, index) {
  const lat = finiteOrNull(Number(row?.lat));
  const lon = finiteOrNull(Number(row?.long ?? row?.lon ?? row?.longitude));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const vnum = textOrNull(row.vnum);
  const name = textOrNull(row.vName) || textOrNull(row.volcanoName);
  const stableId = vnum || `elevated-${index + 1}`;
  const alertLevel = textOrNull(row.alertLevel);
  const colorCode = textOrNull(row.colorCode);
  const severity = severityFromAlert(alertLevel, colorCode);
  return {
    stableId,
    lat,
    lon,
    title: name ? `Volcano · ${name}` : 'Volcano',
    summary: textOrNull(row.noticeSynopsis) || `${alertLevel} / ${colorCode}`,
    kind: 'volcano',
    severity,
    name,
    vnum,
    alertLevel,
    colorCode,
    region: textOrNull(row.obs),
    time: textOrNull(row.alertDate) || textOrNull(row.sentUtc),
    timeMs: parseTimeMs(row.alertDate) || parseTimeMs(row.sentUtc),
    sourceUrl:
      textOrNull(row.noticeUrl) ||
      (vnum ? `https://volcano.si.edu/volcano.cfm?vn=${vnum}` : null),
    elevated: true,
  };
}

/**
 * Accept USGS GeoJSON status, elevated JSON array, or a premerged
 * `{ features }` / `{ elevated }` object.
 */
export function normalizeVolcanoSnapshot(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const byId = new Map();
  if (Array.isArray(payload)) {
    payload.forEach((row, index) => {
      const normalized = normalizeElevatedRow(row, index);
      if (normalized) byId.set(normalized.stableId, normalized);
    });
  }
  if (Array.isArray(payload.elevated)) {
    payload.elevated.forEach((row, index) => {
      const normalized = normalizeElevatedRow(row, index);
      if (normalized) byId.set(normalized.stableId, normalized);
    });
  }
  const features = Array.isArray(payload.features) ? payload.features : null;
  if (features) {
    features.forEach((feature, index) => {
      const normalized = normalizeFeature(feature, index);
      if (!normalized) return;
      const prior = byId.get(normalized.stableId);
      byId.set(
        normalized.stableId,
        prior ? { ...normalized, ...prior, elevated: true } : normalized,
      );
    });
  } else if (!byId.size && !Array.isArray(payload)) {
    return null;
  }
  return [...byId.values()];
}
