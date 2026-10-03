/**
 * Host-side presentation fields for a click-selected event card.
 * WorldOverlay normalizes a missing `variant` to `'label'`, which keeps the
 * entry out of the selected-card paint lane even when `selected: true`. Match
 * FIRMS `buildSelectedFireCard` / `applyFirmsOverlayPolicy`.
 */
export function selectedEventCardPresentation() {
  return Object.freeze({
    variant: 'selected',
    selected: true,
    protected: true,
    collisionGroup: 'ambient-card',
    cardStyle: 'tactical',
  });
}
