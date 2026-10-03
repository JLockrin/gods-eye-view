/** Normalize the bundled historical serial-case path pack. */

const textOrNull = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const finiteOrNull = (value) => (Number.isFinite(value) ? value : null);

const VALID_ROLES = new Set(['kill', 'kill_and_body', 'body', 'last_seen']);

/**
 * Flatten cases → selectable site rows + per-case path polylines.
 * Returns null when the payload shape is unusable.
 */
export function normalizeSerialKillerPathSnapshot(payload) {
  const cases = Array.isArray(payload?.cases) ? payload.cases : null;
  if (!cases) return null;

  const sites = [];
  const paths = [];
  const ids = new Set();

  for (const caseRow of cases) {
    if (!caseRow || typeof caseRow !== 'object') continue;
    const caseId = textOrNull(caseRow.id);
    if (!caseId) continue;
    const caseName = textOrNull(caseRow.name) || caseId;
    const caseColor = textOrNull(caseRow.color) || '#78716c';
    const attribution = textOrNull(caseRow.attribution);
    const sourceUrl = Array.isArray(caseRow.sourceUrls)
      ? textOrNull(caseRow.sourceUrls[0])
      : null;
    const siteById = new Map();

    for (const site of Array.isArray(caseRow.sites) ? caseRow.sites : []) {
      if (!site || typeof site !== 'object') continue;
      const siteId = textOrNull(site.id);
      const lat = finiteOrNull(site.lat);
      const lon = finiteOrNull(site.lon);
      const role = textOrNull(site.role);
      if (
        !siteId ||
        !Number.isFinite(lat) ||
        Math.abs(lat) > 90 ||
        !Number.isFinite(lon) ||
        Math.abs(lon) > 180 ||
        !VALID_ROLES.has(role)
      )
        continue;
      const stableId = `${caseId}:${siteId}`;
      if (ids.has(stableId)) continue;
      ids.add(stableId);
      const row = {
        stableId,
        caseId,
        caseName,
        aka: textOrNull(caseRow.aka),
        years: textOrNull(caseRow.years),
        regionLabel: textOrNull(caseRow.regionLabel),
        caseColor,
        caseSummary: textOrNull(caseRow.summary),
        attribution,
        sourceUrl,
        siteId,
        role,
        sequence: finiteOrNull(site.sequence),
        lat,
        lon,
        precision: textOrNull(site.precision) || 'unspecified',
        approximate: Boolean(site.approximate),
        placeLabel: textOrNull(site.placeLabel),
        title:
          textOrNull(site.title) || textOrNull(site.placeLabel) || caseName,
        whenLabel: textOrNull(site.whenLabel),
        summary: textOrNull(site.summary),
        relatedPathId: textOrNull(site.relatedPathId),
        victims: Array.isArray(site.victims)
          ? site.victims
              .map((victim) => ({
                order: finiteOrNull(victim?.order),
                name: textOrNull(victim?.name),
                disappeared: textOrNull(victim?.disappeared),
                notes: textOrNull(victim?.notes),
              }))
              .filter((victim) => victim.name)
          : [],
      };
      siteById.set(siteId, row);
      sites.push(row);
    }

    const pathIds = Array.isArray(caseRow.pathSiteIds)
      ? caseRow.pathSiteIds
      : [];
    const positions = [];
    for (const pathId of pathIds) {
      const site = siteById.get(textOrNull(pathId));
      if (!site) continue;
      const prev = positions[positions.length - 1];
      if (prev && prev.lat === site.lat && prev.lon === site.lon) continue;
      positions.push({ lat: site.lat, lon: site.lon, siteId: site.siteId });
    }
    if (positions.length >= 2) {
      paths.push({
        stableId: `${caseId}:path`,
        caseId,
        caseName,
        caseColor,
        positions,
      });
    }
  }

  return {
    educationalNote: textOrNull(payload?.educationalNote),
    sites,
    paths,
  };
}
