import { selectedEventCardPresentation } from '../eventMarkers/selectedCard.js';

export const SERIAL_KILLER_PATHS_OVERLAY_SOURCE_ID = 'serial-killer-paths';
export const SERIAL_KILLER_PATHS_PICK_PREFIX = 'serial-killer-path:';

export const ROLE_ACCENTS = Object.freeze({
  kill: '#b91c1c',
  kill_and_body: '#b91c1c',
  body: '#0369a1',
  last_seen: '#a16207',
});

export function siteAccent(row) {
  if (row?.caseColor && (row.role === 'kill' || row.role === 'kill_and_body'))
    return row.caseColor;
  return ROLE_ACCENTS[row?.role] || '#78716c';
}

function roleLabel(role) {
  if (role === 'kill_and_body') return 'kill + body found';
  if (role === 'body') return 'body found';
  if (role === 'last_seen') return 'last seen';
  if (role === 'kill') return 'kill / associated site';
  return role || 'site';
}

/** Card model for one selected serial-case site. Pure — no Cesium. */
export function buildSerialKillerPathCard(row) {
  const details = [];
  if (row.caseName) {
    details.push(
      [row.caseName, row.aka, row.years].filter(Boolean).join(' · '),
    );
  }
  if (row.whenLabel) details.push(row.whenLabel);
  if (row.placeLabel) {
    details.push(
      row.approximate || row.precision !== 'address'
        ? `${row.placeLabel} · ${row.precision || 'unspecified'}${
            row.approximate ? ' · approximate' : ''
          }`
        : row.placeLabel,
    );
  }
  details.push(roleLabel(row.role));
  if (row.summary) details.push(row.summary);
  if (Array.isArray(row.victims) && row.victims.length) {
    details.push(
      `Chronology: ${row.victims
        .map(
          (victim) =>
            `#${victim.order} ${victim.name}${
              victim.disappeared ? ` (${victim.disappeared})` : ''
            }`,
        )
        .join('; ')}`,
    );
  }
  details.push(
    'Investigative / educational mapping of public historical cases — not a live crime feed.',
  );
  if (row.attribution) details.push(row.attribution);
  if (row.sourceUrl) details.push('Source ↗ · click card to open');

  return {
    id: `serial-killer-path-card:${row.stableId}`,
    ...selectedEventCardPresentation(),
    interactive: Boolean(row.sourceUrl),
    title: row.title || row.placeLabel || 'Historical case site',
    details,
    accent: siteAccent(row),
    priority: Number.MAX_SAFE_INTEGER,
    gapPx: 15,
    verticalOnly: true,
    placement: 'above',
    sourceUrl: row.sourceUrl || null,
  };
}
