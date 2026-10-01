export const SHIPWRECK_OVERLAY_SOURCE_ID = 'shipwrecks';
export const SHIPWRECK_PICK_PREFIX = 'shipwreck:';

export function shipwreckAccent(severity) {
  if (severity === 'hazard') return '#ff453a';
  if (severity === 'visible') return '#ffd60a';
  return '#64d2ff';
}

export function buildShipwreckCard(row) {
  const facts = [];
  if (row.kind) facts.push(String(row.kind).split('-').join(' '));
  if (row.sourceDate) facts.push(`chart date ${row.sourceDate}`);
  const details = [];
  if (row.summary) details.push(row.summary);
  if (facts.length) details.push(facts.join(' · '));
  details.push('NOAA Office of Coast Survey ENC wrecks');
  if (row.sourceUrl) details.push('NOAA wrecks & obstructions ↗');

  return {
    id: `shipwreck-card:${row.stableId}`,
    selected: true,
    interactive: Boolean(row.sourceUrl),
    title: row.title || 'Shipwreck',
    details,
    accent: shipwreckAccent(row.severity),
    priority: Number.MAX_SAFE_INTEGER,
    gapPx: 15,
    verticalOnly: true,
    placement: 'above',
    sourceUrl: row.sourceUrl || null,
  };
}
