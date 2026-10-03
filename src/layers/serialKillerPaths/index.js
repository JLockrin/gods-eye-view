import * as Cesium from 'cesium';
import {
  SERIAL_KILLER_PATHS_OVERLAY_SOURCE_ID,
  SERIAL_KILLER_PATHS_PICK_PREFIX,
  siteAccent,
  buildSerialKillerPathCard,
  ROLE_ACCENTS,
} from './cards.js';
export { createSerialKillerPathSource } from './source.js';
export { normalizeSerialKillerPathSnapshot } from './records.js';
export * from './cards.js';

const CARD_HOST_OPTIONS = Object.freeze({
  cohortLimit: 1,
  collisionCapacity: 1,
  moving: false,
});

const EDUCATIONAL_BLURB =
  'Investigative / educational mapping of public historical cases only — not a live crime feed. City-level pins are approximate; uncertain streets are omitted.';

/**
 * Sparse case pins follow installations / FIRMS / cyclones surface markers:
 * always-on-top against photoreal tiles so they stay pickable. Far-side bleed
 * is mitigated with translucencyByDistance (this pack is ~13 U.S. points, not
 * a dense global event feed). Shared EVENT_POINT depth-0 policy is intentional
 * for dense globe layers and is the wrong tradeoff here.
 */
export const SERIAL_PATH_POINT_DISABLE_DEPTH_TEST_DISTANCE =
  Number.POSITIVE_INFINITY;

function pointPixelSize(role) {
  if (role === 'body') return 14;
  if (role === 'last_seen') return 11;
  return 13;
}

/** Own chronological serial-case paths (points + ground-clamped polylines). */
export function createSerialKillerPathsLayer({
  source,
  overlayHost = null,
  screenSpaceEventHandlerFactory = null,
  picking = null,
  pointer = null,
  openExternal = null,
} = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError('Serial killer paths require a snapshot source');

  let _viewer = null;
  let _request = null;
  let _dataSource = null;
  let _count = 0;
  let _pathCount = 0;
  let _lastUpdate = null;
  let _lastError = null;
  let _enabled = false;
  let _clickHandler = null;
  let _selectedId = null;
  let _selectedCardId = null;
  let _educationalNote = EDUCATIONAL_BLURB;
  /** @type {Map<string, object>} */
  const _rowById = new Map();

  const canSelect = () =>
    overlayHost && screenSpaceEventHandlerFactory && picking;

  function ownsPickId(pickedId) {
    if (
      typeof pickedId !== 'string' ||
      !pickedId.startsWith(SERIAL_KILLER_PATHS_PICK_PREFIX)
    )
      return false;
    return _rowById.has(pickedId.slice(SERIAL_KILLER_PATHS_PICK_PREFIX.length));
  }

  function registerOwnership() {
    picking?.registerPickOwner?.('serial-killer-paths', ownsPickId);
  }

  function unregisterOwnership() {
    picking?.unregisterPickOwner?.('serial-killer-paths');
  }

  function publishSelectedCard() {
    if (!canSelect()) return;
    const row = _selectedId ? _rowById.get(_selectedId) : null;
    if (!row) {
      _selectedId = null;
      _selectedCardId = null;
      overlayHost.setEntries(
        SERIAL_KILLER_PATHS_OVERLAY_SOURCE_ID,
        [],
        CARD_HOST_OPTIONS,
      );
      return;
    }
    const card = {
      ...buildSerialKillerPathCard(row),
      position: Cesium.Cartesian3.fromDegrees(row.lon, row.lat),
    };
    if (row.sourceUrl && openExternal) {
      const url = row.sourceUrl;
      card.interactive = true;
      card.activate = () => {
        openExternal(url);
        return true;
      };
    } else card.interactive = false;
    _selectedCardId = card.id;
    overlayHost.setEntries(
      SERIAL_KILLER_PATHS_OVERLAY_SOURCE_ID,
      [card],
      CARD_HOST_OPTIONS,
    );
  }

  function pickedRowId(picked) {
    const pickId = picking.resolvePickId(picked);
    if (
      typeof pickId !== 'string' ||
      !pickId.startsWith(SERIAL_KILLER_PATHS_PICK_PREFIX)
    )
      return null;
    const rowId = pickId.slice(SERIAL_KILLER_PATHS_PICK_PREFIX.length);
    return _rowById.has(rowId) ? rowId : null;
  }

  function installClickHandler() {
    if (!canSelect() || _clickHandler || !_viewer) return;
    _clickHandler = screenSpaceEventHandlerFactory(_viewer);
    _clickHandler.setInputAction((click) => {
      if (pointer && !pointer.isPointerFree()) return;
      const cardHit = overlayHost.hitTest?.(
        click.position?.x,
        click.position?.y,
        { sourceId: SERIAL_KILLER_PATHS_OVERLAY_SOURCE_ID },
      );
      if (cardHit && cardHit.entryId === _selectedCardId) {
        const row = _selectedId ? _rowById.get(_selectedId) : null;
        if (row?.sourceUrl && openExternal) openExternal(row.sourceUrl);
        return;
      }
      const picked = _viewer.scene.pick(click.position);
      const rowId = picked ? pickedRowId(picked) : null;
      if (rowId) {
        _selectedId = rowId;
        publishSelectedCard();
        return;
      }
      if (picked) {
        const pickId = picking.resolvePickId(picked);
        if (pickId && picking.isOwnedByOtherLayer(layer.id, pickId)) return;
      }
      if (_selectedId) {
        _selectedId = null;
        publishSelectedCard();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  function removeClickHandler() {
    if (_clickHandler) {
      _clickHandler.destroy();
      _clickHandler = null;
    }
  }

  function clearSelection() {
    _selectedId = null;
    _selectedCardId = null;
    if (overlayHost) {
      overlayHost.clearSource(SERIAL_KILLER_PATHS_OVERLAY_SOURCE_ID);
      overlayHost.setVisible?.(SERIAL_KILLER_PATHS_OVERLAY_SOURCE_ID, false);
    }
  }

  const layer = {
    id: 'serial-killer-paths',
    name: 'Historical Serial Cases',
    icon: '⌀',
    source: 'Public court / news archives',
    updateInterval: 0,

    init(viewer) {
      if (_viewer) throw new Error('Serial killer paths already initialized');
      _viewer = viewer;
      _dataSource = new Cesium.CustomDataSource('serial-killer-paths');
      _dataSource.show = false;
      viewer.dataSources.add(_dataSource);
      _count = 0;
      _pathCount = 0;
      _lastUpdate = null;
      _lastError = null;
      _enabled = false;
      console.log('[Data:SerialKillerPaths] Initialized');
    },

    enable() {
      _enabled = true;
      if (_dataSource) _dataSource.show = true;
      overlayHost?.setVisible?.(SERIAL_KILLER_PATHS_OVERLAY_SOURCE_ID, true);
      installClickHandler();
      registerOwnership();
    },

    disable() {
      _request?.abort();
      _request = null;
      _enabled = false;
      if (_dataSource) _dataSource.show = false;
      removeClickHandler();
      unregisterOwnership();
      clearSelection();
    },

    async update() {
      if (!_enabled || !_dataSource) return false;
      _request?.abort();
      const request = new AbortController();
      _request = request;
      try {
        const snapshot = await source.getSnapshot({ signal: request.signal });
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        if (!snapshot || !Array.isArray(snapshot.sites))
          throw new Error('Malformed serial-killer path snapshot');

        _educationalNote = snapshot.educationalNote || EDUCATIONAL_BLURB;
        const nextEntities = [];
        _rowById.clear();

        for (const path of Array.isArray(snapshot.paths)
          ? snapshot.paths
          : []) {
          const positions = (path.positions || []).map(({ lon, lat }) =>
            Cesium.Cartesian3.fromDegrees(lon, lat),
          );
          if (positions.length < 2) continue;
          const color = Cesium.Color.fromCssColorString(
            path.caseColor || '#78716c',
          );
          nextEntities.push(
            new Cesium.Entity({
              id: `${SERIAL_KILLER_PATHS_PICK_PREFIX}${path.stableId}`,
              polyline: {
                positions,
                clampToGround: true,
                width: 3,
                material: new Cesium.ColorMaterialProperty(
                  color.withAlpha(0.85),
                ),
              },
            }),
          );
        }

        for (const row of snapshot.sites) {
          if (!Number.isFinite(row.lat) || !Number.isFinite(row.lon)) continue;
          _rowById.set(row.stableId, row);
          const color = Cesium.Color.fromCssColorString(siteAccent(row));
          const isBody = row.role === 'body';
          nextEntities.push(
            new Cesium.Entity({
              id: `${SERIAL_KILLER_PATHS_PICK_PREFIX}${row.stableId}`,
              position: Cesium.Cartesian3.fromDegrees(row.lon, row.lat),
              point: {
                pixelSize: pointPixelSize(row.role),
                color: color.withAlpha(isBody ? 0.75 : 0.9),
                outlineColor: isBody
                  ? Cesium.Color.fromCssColorString('#e0f2fe').withAlpha(0.95)
                  : Cesium.Color.WHITE.withAlpha(0.95),
                outlineWidth: isBody ? 2 : 1,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance:
                  SERIAL_PATH_POINT_DISABLE_DEPTH_TEST_DISTANCE,
                scaleByDistance: new Cesium.NearFarScalar(
                  200,
                  1.35,
                  120000,
                  0.55,
                ),
                translucencyByDistance: new Cesium.NearFarScalar(
                  50_000,
                  1.0,
                  2_000_000,
                  0.0,
                ),
              },
              properties: {
                stableId: row.stableId,
                title: row.title,
                role: row.role,
                caseId: row.caseId,
              },
            }),
          );
        }

        _dataSource.entities.removeAll();
        for (const entity of nextEntities) _dataSource.entities.add(entity);
        if (_selectedId && !_rowById.has(_selectedId)) _selectedId = null;
        if (_selectedId) publishSelectedCard();
        else if (canSelect())
          overlayHost.setEntries(
            SERIAL_KILLER_PATHS_OVERLAY_SOURCE_ID,
            [],
            CARD_HOST_OPTIONS,
          );

        _count = _rowById.size;
        _pathCount = Array.isArray(snapshot.paths) ? snapshot.paths.length : 0;
        _lastUpdate = Date.now();
        _lastError = null;
        console.log(
          `[Data:SerialKillerPaths] Updated: ${_count} sites · ${_pathCount} paths`,
        );
        return true;
      } catch (e) {
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        console.warn('[Data:SerialKillerPaths] Fetch error:', e);
        _lastError = e?.message || 'Serial-case path source unavailable';
        return false;
      } finally {
        if (_request === request) _request = null;
      }
    },

    destroy(viewer = _viewer) {
      _request?.abort();
      _request = null;
      removeClickHandler();
      unregisterOwnership();
      clearSelection();
      _rowById.clear();
      _viewer = null;
      _enabled = false;
      if (_dataSource) {
        viewer?.dataSources?.remove(_dataSource, true);
        _dataSource = null;
      }
      _count = 0;
      _pathCount = 0;
      _lastUpdate = null;
      _lastError = null;
    },

    getRowControls() {
      return {
        legend: [
          {
            label: 'Kill / kill+body',
            color: ROLE_ACCENTS.kill,
            count: [..._rowById.values()].filter((row) =>
              ['kill', 'kill_and_body'].includes(row.role),
            ).length,
            blurb:
              'Chronological kill path nodes (numbered in the detail card).',
          },
          {
            label: 'Body found (distinct)',
            color: ROLE_ACCENTS.body,
            count: [..._rowById.values()].filter((row) => row.role === 'body')
              .length,
            blurb:
              'Body-recovery site when it differs from the kill / last-seen pin.',
          },
          {
            label: 'Last seen',
            color: ROLE_ACCENTS.last_seen,
            count: [..._rowById.values()].filter(
              (row) => row.role === 'last_seen',
            ).length,
            blurb:
              'Public last-known locality when the kill street is unknown.',
          },
        ],
        info: _educationalNote,
      };
    },

    getStats() {
      return {
        count: _count,
        pathCount: _pathCount,
        lastUpdate: _lastUpdate,
        error: _lastError,
      };
    },
  };
  return layer;
}
