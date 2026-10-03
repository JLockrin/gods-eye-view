/**
 * City of Knoxville public Unsolved Murder Cases tip page → homicide points.
 *
 * Source page: https://www.knoxvilletn.gov/government/city_departments_offices/police_department/unsolved_murder_cases
 * robots.txt allows this path (only admin/search/map paths are Disallow'd).
 * Locations are street strings published for tip purposes; we geocode them with
 * Nominatim (rate-limited) and keep only points inside Knoxville focus bounds.
 */

const DEFAULT_PAGE_URL =
  'https://www.knoxvilletn.gov/government/city_departments_offices/police_department/unsolved_murder_cases';

const KNOXVILLE_BOUNDS = Object.freeze({
  west: -84.15,
  south: 35.82,
  east: -83.7,
  north: 36.12,
});

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_HEADERS = Object.freeze({
  Accept: 'application/json',
  'User-Agent': 'GodsEyeView/0.1 (crime layer; knoxville unsolved murders)',
});

function stripTags(html) {
  return String(html || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDateFromDetails(details) {
  if (!details) return null;
  const match = details.match(
    /\bOn\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/i,
  );
  if (!match) return null;
  let [, mm, dd, yy] = match;
  let year = Number(yy);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const month = Number(mm);
  const day = Number(dd);
  if (!(year >= 1970 && month >= 1 && month <= 12 && day >= 1 && day <= 31))
    return null;
  const ms = Date.UTC(year, month - 1, day);
  return Number.isFinite(ms) ? ms : null;
}

/** Pure HTML → case rows (no network). */
export function parseKnoxvilleUnsolvedHtml(html) {
  const source = String(html || '');
  const cellRe =
    /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
  const cases = [];
  let year = null;
  let match;
  while ((match = cellRe.exec(source))) {
    const cell = match[1];
    const yearOnly = stripTags(cell);
    if (/^\d{4}$/.test(yearOnly)) {
      year = Number(yearOnly);
      continue;
    }
    if (!/Name:/i.test(cell) || !/Location:/i.test(cell)) continue;
    const name = stripTags(
      (cell.match(
        /Name:(?:&nbsp;|\s)*<\/strong>(?:&nbsp;|\s)*([\s\S]*?)(?:<br|$)/i,
      ) || [])[1] || '',
    );
    const location = stripTags(
      (cell.match(
        /Location:(?:&nbsp;|\s)*<\/strong>(?:&nbsp;|\s)*([\s\S]*?)(?:<br|$)/i,
      ) || [])[1] || '',
    );
    const details = stripTags(
      (cell.match(
        /Details:(?:&nbsp;|\s)*<\/strong>(?:&nbsp;|\s)*([\s\S]*?)(?:<\/td>|$)/i,
      ) || [])[1] || '',
    );
    if (!name || !location) continue;
    const timeMs = parseDateFromDetails(details);
    const stableId = `knoxville-unsolved:${name}:${location}:${
      Number.isFinite(timeMs) ? timeMs : year || 'na'
    }`
      .toLowerCase()
      .replace(/[^a-z0-9:._-]+/g, '-');
    cases.push({
      stableId,
      name,
      location,
      details: details || null,
      year: Number.isFinite(year) ? year : null,
      timeMs,
      crimeType: 'HOMICIDE',
      jurisdiction: 'Knoxville, TN · Knox County',
    });
  }
  return cases;
}

function inKnoxvilleBounds(lon, lat) {
  return (
    lon >= KNOXVILLE_BOUNDS.west &&
    lon <= KNOXVILLE_BOUNDS.east &&
    lat >= KNOXVILLE_BOUNDS.south &&
    lat <= KNOXVILLE_BOUNDS.north
  );
}

/**
 * Fetch + geocode Knoxville unsolved murders into crime rows.
 * Geocoding is rate-limited and time-budgeted so the layer can paint points
 * before every address has been resolved; later refreshes fill the cache.
 */
export function createKnoxvilleUnsolvedSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  pageUrl = DEFAULT_PAGE_URL,
  geocodeBudgetMs = 18_000,
  now = () => Date.now(),
} = {}) {
  const geocodeCache = new Map();
  let pageCache = null;
  let pageCachedAt = 0;
  let nominatimChain = Promise.resolve();
  let lastNominatimAt = 0;

  async function loadCases(signal) {
    if (pageCache && now() - pageCachedAt < 3600_000) return pageCache;
    const response = await fetchImpl(pageUrl, {
      signal,
      redirect: 'follow',
      headers: {
        Accept: 'text/html',
        'User-Agent': 'GodsEyeView/0.1',
      },
    });
    if (!response.ok) {
      await response.body?.cancel?.();
      throw new Error(`knoxville_unsolved_http_${response.status}`);
    }
    const html = await response.text();
    pageCache = parseKnoxvilleUnsolvedHtml(html);
    pageCachedAt = now();
    return pageCache;
  }

  function enqueueNominatim(task) {
    const run = nominatimChain.then(async () => {
      const wait = Math.max(0, 1100 - (now() - lastNominatimAt));
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      lastNominatimAt = now();
      return task();
    });
    nominatimChain = run.catch(() => null);
    return run;
  }

  async function geocodeLocation(location, signal) {
    const key = location.toLowerCase();
    if (geocodeCache.has(key)) return geocodeCache.get(key);
    const query = `${location}, Knoxville, Tennessee, USA`;
    const params = new URLSearchParams({
      format: 'jsonv2',
      q: query,
      limit: '1',
      countrycodes: 'us',
      viewbox: `${KNOXVILLE_BOUNDS.west},${KNOXVILLE_BOUNDS.north},${KNOXVILLE_BOUNDS.east},${KNOXVILLE_BOUNDS.south}`,
      bounded: '1',
    });
    const result = await enqueueNominatim(async () => {
      signal?.throwIfAborted?.();
      const response = await fetchImpl(`${NOMINATIM_ENDPOINT}?${params}`, {
        signal,
        redirect: 'error',
        headers: NOMINATIM_HEADERS,
      });
      if (!response.ok) {
        await response.body?.cancel?.();
        return null;
      }
      const rows = await response.json();
      const hit = Array.isArray(rows) ? rows[0] : null;
      const lat = Number(hit?.lat);
      const lon = Number(hit?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      if (!inKnoxvilleBounds(lon, lat)) return null;
      return { lat, lon };
    });
    geocodeCache.set(key, result);
    return result;
  }

  return {
    id: 'knoxville-unsolved-homicides',
    name: 'Knoxville PD Unsolved Murder Cases (public tip list)',
    aboutUrl: DEFAULT_PAGE_URL,
    jurisdictionId: 'knox-tn',
    placeIds: Object.freeze(['knoxville-tn']),
    async query({ signal, maxRecords = 400 } = {}) {
      const cases = await loadCases(signal);
      // Prefer recent cases so a short geocode budget still paints the map.
      const ordered = cases.slice().sort((a, b) => {
        const ay = Number.isFinite(a.year) ? a.year : 0;
        const by = Number.isFinite(b.year) ? b.year : 0;
        const at = Number.isFinite(a.timeMs) ? a.timeMs : 0;
        const bt = Number.isFinite(b.timeMs) ? b.timeMs : 0;
        return by - ay || bt - at;
      });
      const deadline = now() + geocodeBudgetMs;
      const rows = [];
      for (const entry of ordered) {
        if (rows.length >= maxRecords) break;
        if (now() > deadline) break;
        signal?.throwIfAborted?.();
        const point = await geocodeLocation(entry.location, signal);
        if (!point) continue;
        rows.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [point.lon, point.lat],
          },
          properties: {
            crimeType: 'HOMICIDE',
            description: entry.details,
            jurisdiction: entry.jurisdiction,
            date: Number.isFinite(entry.timeMs)
              ? new Date(entry.timeMs).toISOString()
              : entry.year
                ? `${entry.year}-01-01T00:00:00.000Z`
                : null,
            timeMs: entry.timeMs,
            id: entry.stableId,
            title: `Unsolved homicide · ${entry.name}`,
            locationText: entry.location,
            sourceId: 'knoxville-unsolved',
            sourceName:
              'Knoxville PD Unsolved Murder Cases (city tip page)',
            sourceUrl: DEFAULT_PAGE_URL,
          },
        });
      }
      return {
        type: 'FeatureCollection',
        features: rows,
        meta: {
          parsed: cases.length,
          geocoded: rows.length,
          geocodeBudgetMs,
        },
      };
    },
  };
}
