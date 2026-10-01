/** Normalize GDELT geo-tagged news snapshots (Geo 2.0 / GKG / Event export). */

const finiteOrNull = (value) => (Number.isFinite(value) ? value : null);
const textOrNull = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

function parseTimeMs(value) {
  if (Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function featureArticles(properties) {
  const articles = [];
  const seen = new Set();
  const push = (title, url, date) => {
    const href = textOrNull(url);
    if (!href || seen.has(href)) return;
    seen.add(href);
    articles.push({
      title: textOrNull(title) || href,
      url: href,
      date: textOrNull(date),
    });
  };
  if (Array.isArray(properties?.articles)) {
    for (const article of properties.articles) {
      if (!article || typeof article !== 'object') continue;
      push(article.title || article.name, article.url, article.date || article.seendate);
    }
  }
  push(
    properties?.title || properties?.name,
    properties?.url || properties?.sourceUrl,
    properties?.urlpubtimedate || properties?.date || properties?.seendate,
  );
  return articles;
}

/** Accept FeatureCollection, proxy `{ rows }`, or already-normalized rows. */
export function normalizeGdeltGeoSnapshot(payload) {
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
    const articles = featureArticles(properties);
    const primary = articles[0] || null;
    const place = textOrNull(properties.name) || textOrNull(properties.location);
    const count = finiteOrNull(
      typeof properties.count === 'number'
        ? properties.count
        : Number(properties.count),
    );
    const stableId =
      textOrNull(properties.id) ||
      (primary?.url
        ? `${lon.toFixed(3)},${lat.toFixed(3)}:${primary.url}`
        : null) ||
      (feature.id == null || feature.id === ''
        ? `gdelt-${index + 1}`
        : String(feature.id));
    if (ids.has(stableId)) continue;
    ids.add(stableId);
    const title =
      textOrNull(properties.title) ||
      primary?.title ||
      (place ? `News · ${place}` : 'Geographic news');
    const when =
      textOrNull(properties.urlpubtimedate) ||
      textOrNull(properties.date) ||
      primary?.date ||
      null;
    rows.push({
      stableId,
      lat,
      lon,
      title,
      summary: place,
      location: place,
      date: when,
      timeMs: parseTimeMs(when),
      count,
      themes: textOrNull(properties.mentionedthemes),
      sourceUrl: primary?.url || null,
      articles,
      feed: textOrNull(properties.feed) || textOrNull(payload?.feed) || null,
    });
  }
  return rows;
}

export const DEFAULT_GDELT_GEO_QUERY =
  '(protest OR election OR conflict OR climate OR disaster)';
