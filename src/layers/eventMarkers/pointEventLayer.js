import * as Cesium from 'cesium';

/**
 * Shared selectable point-event layer lifecycle used by the aviation, shipwreck,
 * volcano, UAP, tsunami, GDELT, and historic-places layers. Ownership stays with
 * each layer's factory; this helper only owns the common Cesium/overlay/click
 * plumbing so the event layers do not invent a parallel architecture.
 */

/**
 * Ground-clamped event markers must depth-test against the globe. Setting this
 * to Infinity (always-on-top) made far-side points paint through the Earth.
 * Traffic landing dots and TeleGeography cable points use the same `0` policy.
 */
export const EVENT_POINT_DISABLE_DEPTH_TEST_DISTANCE = 0;

export function viewBoundsDegrees(viewer, { padFraction = 0.08 } = {}) {
  const rect = viewer?.camera?.computeViewRectangle?.(Cesium.Ellipsoid.WGS84);
  if (!rect) return null;
  const toDeg = Cesium.Math.toDegrees;
  let west = toDeg(rect.west);
  let south = toDeg(rect.south);
  let east = toDeg(rect.east);
  let north = toDeg(rect.north);
  if (
    ![west, south, east, north].every((value) => Number.isFinite(value)) ||
    south >= north
  )
    return null;
  const latPad = (north - south) * padFraction;
  south = Math.max(-90, south - latPad);
  north = Math.min(90, north + latPad);
  // Dateline-crossing rectangles keep their raw west/east; callers decide policy.
  return { west, south, east, north };
}

export function rowInBounds(row, bounds) {
  if (!bounds) return true;
  const { lat, lon } = row;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < bounds.south || lat > bounds.north) return false;
  if (bounds.west <= bounds.east)
    return lon >= bounds.west && lon <= bounds.east;
  return lon >= bounds.west || lon <= bounds.east;
}

/**
 * @param {object} config
 * @param {string} config.id
 * @param {string} config.name
 * @param {string} config.icon
 * @param {string} config.sourceLabel
 * @param {number} [config.updateInterval]
 * @param {{getSnapshot: Function}} config.source
 * @param {object} config.overlayHost
 * @param {string} config.overlaySourceId
 * @param {string} config.pickPrefix
 * @param {(row: object) => Cesium.Color} config.colorFor
 * @param {(row: object, nowMs: number) => object} config.buildCard
 * @param {(rows: object[], ctx: object) => object[]} [config.selectRows]
 * @param {boolean} [config.viewportBounded]
 * @param {number} [config.pointPixelSize]
 */
export function createPointEventLayer({
  id,
  name,
  icon,
  sourceLabel,
  updateInterval = 300000,
  source,
  overlayHost = null,
  overlaySourceId,
  pickPrefix,
  colorFor,
  buildCard,
  selectRows = (rows) => rows,
  viewportBounded = false,
  pointPixelSize = 10,
  emptyStatusMessage = 'No features in this view',
  screenSpaceEventHandlerFactory = null,
  picking = null,
  pointer = null,
  openExternal = null,
  logName = name,
} = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError(`${name} requires a snapshot source`);
  if (!overlaySourceId || !pickPrefix)
    throw new TypeError(`${name} requires overlay and pick identities`);

  let _viewer = null;
  let _request = null;
  let _dataSource = null;
  let _count = 0;
  let _lastUpdate = null;
  let _lastError = null;
  let _loading = false;
  let _status = 'idle';
  let _statusMessage = null;
  let _enabled = false;
  let _clickHandler = null;
  let _moveEndRemover = null;
  let _selectedId = null;
  let _selectedCardId = null;
  /** @type {Map<string, object>} */
  const _rowById = new Map();

  function parseSnapshot(snapshot) {
    if (Array.isArray(snapshot)) {
      return {
        rows: snapshot,
        status: null,
        statusMessage: null,
      };
    }
    if (snapshot && typeof snapshot === 'object' && Array.isArray(snapshot.rows)) {
      const status =
        typeof snapshot.status === 'string' && snapshot.status.trim()
          ? snapshot.status.trim().toLowerCase()
          : null;
      const statusMessage =
        typeof snapshot.statusMessage === 'string' &&
        snapshot.statusMessage.trim()
          ? snapshot.statusMessage.trim()
          : null;
      return { rows: snapshot.rows, status, statusMessage };
    }
    return null;
  }

  const canSelect = () =>
    overlayHost && screenSpaceEventHandlerFactory && picking;

  function ownsPickId(pickedId) {
    if (typeof pickedId !== 'string' || !pickedId.startsWith(pickPrefix))
      return false;
    return _rowById.has(pickedId.slice(pickPrefix.length));
  }

  function registerOwnership() {
    picking?.registerPickOwner?.(id, ownsPickId);
  }

  function unregisterOwnership() {
    picking?.unregisterPickOwner?.(id);
  }

  function installMoveEndWatcher() {
    if (!viewportBounded || _moveEndRemover || !_viewer?.camera?.moveEnd)
      return;
    _moveEndRemover = _viewer.camera.moveEnd.addEventListener(() => {
      if (!_enabled) return;
      void layer.update();
    });
  }

  function removeMoveEndWatcher() {
    if (_moveEndRemover) {
      _moveEndRemover();
      _moveEndRemover = null;
    }
  }

  const CARD_HOST_OPTIONS = Object.freeze({
    cohortLimit: 1,
    collisionCapacity: 1,
    moving: false,
  });

  function publishSelectedCard() {
    if (!canSelect()) return;
    const row = _selectedId ? _rowById.get(_selectedId) : null;
    if (!row) {
      _selectedId = null;
      _selectedCardId = null;
      overlayHost.setEntries(overlaySourceId, [], CARD_HOST_OPTIONS);
      return;
    }
    const card = {
      ...buildCard(row, Date.now()),
      position: Cesium.Cartesian3.fromDegrees(row.lon, row.lat),
    };
    if (card.sourceUrl && openExternal) {
      const url = card.sourceUrl;
      card.interactive = true;
      card.activate = () => {
        openExternal(url);
        return true;
      };
    } else {
      card.interactive = false;
    }
    _selectedCardId = card.id;
    overlayHost.setEntries(overlaySourceId, [card], CARD_HOST_OPTIONS);
  }

  function pickedRowId(picked) {
    const pickId = picking.resolvePickId(picked);
    if (typeof pickId !== 'string' || !pickId.startsWith(pickPrefix))
      return null;
    const rowId = pickId.slice(pickPrefix.length);
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
        { sourceId: overlaySourceId },
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
        if (pickId && picking.isOwnedByOtherLayer(id, pickId)) return;
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
      overlayHost.clearSource(overlaySourceId);
      overlayHost.setVisible?.(overlaySourceId, false);
    }
  }

  const layer = {
    id,
    name,
    icon,
    source: sourceLabel,
    updateInterval,

    init(viewer) {
      if (_viewer) throw new Error(`${name} layer is already initialized`);
      _viewer = viewer;
      _dataSource = new Cesium.CustomDataSource(id);
      _dataSource.show = false;
      viewer.dataSources.add(_dataSource);
      _count = 0;
      _lastUpdate = null;
      _lastError = null;
      _loading = false;
      _status = 'idle';
      _statusMessage = null;
      _enabled = false;
      console.log(`[Data:${logName}] Initialized`);
    },

    enable() {
      _enabled = true;
      if (_dataSource) _dataSource.show = true;
      overlayHost?.setVisible?.(overlaySourceId, true);
      installClickHandler();
      registerOwnership();
      installMoveEndWatcher();
    },

    disable() {
      _request?.abort();
      _request = null;
      _enabled = false;
      _loading = false;
      if (_dataSource) _dataSource.show = false;
      removeMoveEndWatcher();
      removeClickHandler();
      unregisterOwnership();
      clearSelection();
    },

    async update() {
      if (!_enabled || !_dataSource) return false;
      _request?.abort();
      const request = new AbortController();
      _request = request;
      _loading = true;
      _lastError = null;
      try {
        const bounds = viewportBounded ? viewBoundsDegrees(_viewer) : null;
        const snapshot = await source.getSnapshot({
          signal: request.signal,
          bounds,
        });
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        const parsed = parseSnapshot(snapshot);
        if (!parsed) throw new Error('Malformed snapshot');
        const { rows } = parsed;

        const bounded = viewportBounded
          ? rows.filter((row) => rowInBounds(row, bounds))
          : rows;
        const selected = selectRows(bounded, { bounds });
        const nextEntities = [];
        _rowById.clear();
        for (const row of selected) {
          if (
            !row?.stableId ||
            !Number.isFinite(row.lat) ||
            !Number.isFinite(row.lon)
          )
            continue;
          _rowById.set(row.stableId, row);
          const color = colorFor(row);
          nextEntities.push(
            new Cesium.Entity({
              id: `${pickPrefix}${row.stableId}`,
              position: Cesium.Cartesian3.fromDegrees(row.lon, row.lat),
              point: {
                pixelSize: pointPixelSize,
                color: color.withAlpha(0.85),
                outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
                outlineWidth: 1,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: EVENT_POINT_DISABLE_DEPTH_TEST_DISTANCE,
              },
              properties: {
                stableId: row.stableId,
                title: row.title ?? null,
                time: row.time ?? null,
                kind: row.kind ?? null,
                severity: row.severity ?? null,
              },
            }),
          );
        }

        _dataSource.entities.removeAll();
        for (const entity of nextEntities) _dataSource.entities.add(entity);
        if (_selectedId && !_rowById.has(_selectedId)) _selectedId = null;
        if (_selectedId) publishSelectedCard();
        else if (canSelect())
          overlayHost.setEntries(overlaySourceId, [], CARD_HOST_OPTIONS);

        _count = nextEntities.length;
        _lastUpdate = Date.now();
        _lastError = null;
        if (parsed.status === 'zoom-in') {
          _status = 'zoom-in';
          _statusMessage =
            parsed.statusMessage || 'Zoom in to a regional viewport';
        } else if (_count === 0) {
          _status = 'empty';
          _statusMessage = parsed.statusMessage || emptyStatusMessage;
        } else {
          _status = null;
          _statusMessage = null;
        }
        console.log(`[Data:${logName}] Updated: ${_count} features`);
        return true;
      } catch (e) {
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        console.warn(`[Data:${logName}] Fetch error:`, e);
        _lastError = e?.message || `${name} source unavailable`;
        _status = null;
        _statusMessage = null;
        return false;
      } finally {
        if (_request === request) {
          _request = null;
          _loading = false;
        }
      }
    },

    destroy(viewer = _viewer) {
      _request?.abort();
      _request = null;
      removeMoveEndWatcher();
      removeClickHandler();
      unregisterOwnership();
      clearSelection();
      _rowById.clear();
      _viewer = null;
      _enabled = false;
      _loading = false;
      if (_dataSource) {
        viewer?.dataSources?.remove(_dataSource, true);
        _dataSource = null;
      }
      _count = 0;
      _lastUpdate = null;
      _lastError = null;
      _status = 'idle';
      _statusMessage = null;
    },

    getStats() {
      return {
        count: _count,
        lastUpdate: _lastUpdate,
        error: _lastError,
        loading: _loading,
        status: _status,
        statusMessage: _statusMessage,
        source: sourceLabel,
      };
    },
  };
  return layer;
}
