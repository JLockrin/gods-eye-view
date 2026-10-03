/**
 * Per-place coverage ledger for the Joel-scoped registry and crime layers.
 * Empty places must name the sources checked and the exact block.
 */

export const SEX_OFFENDER_PLACE_COVERAGE = Object.freeze({
  'lima-oh': Object.freeze({
    placeId: 'lima-oh',
    label: 'Lima, OH',
    jurisdictionId: 'allen-oh',
    status: 'empty',
    sourceChecked:
      'Ohio AG eSORN / OffenderWatch (ohio.esorn.net · icrimewatch AgencyID 55149); Allen County GIS MapServer; Lima COLGIS Police folder',
    block:
      'CrimeWatch/OffenderWatch terms forbid bots/crawlers/scraping without written consent; public site is captcha-gated (no documented ArcGIS/SODA API). Allen County GIS has parcels/roads only (no offender points). Lima COLGIS /server/rest/services/Police returns HTTP 499 Token Required.',
  }),
  'beaverdam-oh': Object.freeze({
    placeId: 'beaverdam-oh',
    label: 'Beaverdam, OH',
    jurisdictionId: 'allen-oh',
    status: 'empty',
    sourceChecked:
      'Ohio AG eSORN / OffenderWatch (same statewide search UI as Lima); Allen County GIS MapServer',
    block:
      'Same OffenderWatch/CrimeWatch automation ban + captcha wall; no Allen County ArcGIS offender point layer (Trumbull County has one — wrong county, not used).',
  }),
  'findlay-oh': Object.freeze({
    placeId: 'findlay-oh',
    label: 'Findlay, OH',
    jurisdictionId: 'hancock-oh',
    status: 'empty',
    sourceChecked:
      'Ohio AG eSORN / OffenderWatch; Hancock County GIS portal host (gis.hancockcounty.us)',
    block:
      'OffenderWatch/CrimeWatch terms forbid automated extraction; captcha-gated search UI, no keyless GeoJSON/ArcGIS registry feed. Hancock GIS hostname does not resolve from this environment and published county GIS materials are parcels/environment, not offender points.',
  }),
  'knoxville-tn': Object.freeze({
    placeId: 'knoxville-tn',
    label: 'Knoxville, TN',
    jurisdictionId: 'knox-tn',
    status: 'live',
    sourceChecked:
      'Tennessee TBI Sex Offender Registry MapServer (tnmap.tn.gov PUBLIC_SAFETY/TBI_SEX_OFFENDER_REGISTRY)',
    block: null,
    feed: 'TBI ArcGIS query filtered ResCounty=\'KNOX\' via /api/sex-offenders',
  }),
});

export const CRIME_PLACE_COVERAGE = Object.freeze({
  'lima-oh': Object.freeze({
    placeId: 'lima-oh',
    label: 'Lima, OH',
    jurisdictionId: 'allen-oh',
    status: 'empty',
    sourceChecked:
      'Lima COLGIS Police ArcGIS folder; Allen County GIS downloads; Lima Police annual reports; ArcGIS Open Data search for Lima/Allen crime FeatureServers',
    block:
      'Lima COLGIS /server/rest/services/Police returns HTTP 499 Token Required (login wall). Allen County GIS publishes parcels/roads/addresses only — no incident points. Annual reports are aggregate counts (no coordinates). No keyless FeatureServer found.',
  }),
  'beaverdam-oh': Object.freeze({
    placeId: 'beaverdam-oh',
    label: 'Beaverdam, OH',
    jurisdictionId: 'allen-oh',
    status: 'empty',
    sourceChecked:
      'Same Allen County / Lima COLGIS sources as Lima (Beaverdam is in Allen County)',
    block:
      'No separate Beaverdam open incident-point feed; Allen County has no keyless crime FeatureServer; Lima Police GIS is token-gated.',
  }),
  'findlay-oh': Object.freeze({
    placeId: 'findlay-oh',
    label: 'Findlay, OH',
    jurisdictionId: 'hancock-oh',
    status: 'empty',
    sourceChecked:
      'Findlay Citizen Connect / LexisNexis Community Crime Map; Findlay Police records portal; ArcGIS Open Data search (a crime_data_2025 table under org 79kfd2K6fskCAkyg is Louisville LOJIC, not Findlay)',
    block:
      'LexisNexis Online Services terms prohibit mechanical/programmatic/robotic access without prior written permission — not scraped. Citizen Connect is that public UI (no documented open API). No Findlay-keyed incident-point GeoJSON/ArcGIS feed found.',
  }),
  'knoxville-tn': Object.freeze({
    placeId: 'knoxville-tn',
    label: 'Knoxville, TN',
    jurisdictionId: 'knox-tn',
    status: 'live',
    sourceChecked:
      'City of Knoxville Unsolved Murder Cases tip page (public HTML); LexisNexis Community Crime Map (checked, not used); KGIS REST (HTTP 401); TBI CrimeInsight (aggregates / account-gated); FBI CDE API (API key required)',
    block: null,
    feed: 'Knoxville unsolved-murder tip listings geocoded to points via Nominatim; LexisNexis not used (automation forbidden); KGIS crime auth-gated',
  }),
});

/** Build a human-readable empty-state note for places currently in view. */
export function coverageNoteForPlaces(placeIds, ledger) {
  const ids = Array.isArray(placeIds) ? placeIds : [];
  const rows = ids
    .map((id) => ledger[id])
    .filter((row) => row && row.status === 'empty');
  if (!rows.length) return null;
  return rows
    .map(
      (row) =>
        `${row.label}: empty — checked ${row.sourceChecked}. Block: ${row.block}`,
    )
    .join(' · ');
}

export function liveFeedSummary(ledger) {
  return Object.values(ledger)
    .filter((row) => row.status === 'live')
    .map((row) => `${row.label}: ${row.feed}`)
    .join(' · ');
}
