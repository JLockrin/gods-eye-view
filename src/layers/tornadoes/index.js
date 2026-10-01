import * as Cesium from 'cesium';
import {
  TORNADO_OVERLAY_SOURCE_ID,
  TORNADO_PICK_PREFIX,
  tornadoAccent,
  buildTornadoCard,
} from './cards.js';
export { createTornadoSource } from './source.js';
export {
  normalizeTornadoReportSnapshot,
  normalizeTornadoPolygonSnapshot,
  mergeTornadoSnapshots,
} from './records.js';
export * from './cards.js';

const ringPositions = (ring) =>
  ring.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat));

const CARD_HOST_OPTIONS = Object.freeze({
  cohortLimit: 1,
  collisionCapacity: 1,
  moving: false,
});

/** Own tornado reports, warning polygons, and outlook polygons. */
export function createTornadoesLayer({
  source,
  overlayHost = null,
  screenSpaceEventHandlerFactory = null,
  picking = null,
  pointer = null,
  openExternal = null,
} = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError('Tornadoes require a snapshot source');

  let _viewer = null;
  let _request = null;
  let _dataSource = null;
  let _count = 0;
  let _lastUpdate = null;
  let _lastError = null;
  let _enabled = false;
  let _clickHandler = null;
  let _selectedId = null;
  let _selectedCardId = null;
  /** @type {Map<string, object>} */
  const _rowById = new Map();

  const canSelect = () =>
    overlayHost && screenSpaceEventHandlerFactory && picking;

  function publishSelectedCard() {
    if (!canSelect()) return;
    const row = _selectedId ? _rowById.get(_selectedId) : null;
    if (!row) {
      _selectedId = null;
      _selectedCardId = null;
      overlayHost.setEntries(TORNADO_OVERLAY_SOURCE_ID, [], CARD_HOST_OPTIONS);
      return;
    }
    const card = {
      ...buildTornadoCard(row),
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
      TORNADO_OVERLAY_SOURCE_ID,
      [card],
      CARD_HOST_OPTIONS,
    );
  }

  function pickedRowId(picked) {
    const pickId = picking.resolvePickId(picked);
    if (typeof pickId !== 'string' || !pickId.startsWith(TORNADO_PICK_PREFIX))
      return null;
    const rowId = pickId.slice(TORNADO_PICK_PREFIX.length).split(':')[0];
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
        { sourceId: TORNADO_OVERLAY_SOURCE_ID },
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
      overlayHost.clearSource(TORNADO_OVERLAY_SOURCE_ID);
      overlayHost.setVisible?.(TORNADO_OVERLAY_SOURCE_ID, false);
    }
  }

  const layer = {
    id: 'tornadoes',
    name: 'Tornadoes & Severe Weather',
    icon: '🌪️',
    source: 'NWS / SPC',
    updateInterval: 120000,

    init(viewer) {
      if (_viewer) throw new Error('Tornado layer is already initialized');
      _viewer = viewer;
      _dataSource = new Cesium.CustomDataSource('tornadoes');
      _dataSource.show = false;
      viewer.dataSources.add(_dataSource);
      _count = 0;
      _lastUpdate = null;
      _lastError = null;
      _enabled = false;
      console.log('[Data:Tornadoes] Initialized');
    },

    enable() {
      _enabled = true;
      if (_dataSource) _dataSource.show = true;
      overlayHost?.setVisible?.(TORNADO_OVERLAY_SOURCE_ID, true);
      installClickHandler();
    },

    disable() {
      _request?.abort();
      _request = null;
      _enabled = false;
      if (_dataSource) _dataSource.show = false;
      removeClickHandler();
      clearSelection();
    },

    async update() {
      if (!_enabled || !_dataSource) return false;
      _request?.abort();
      const request = new AbortController();
      _request = request;
      try {
        const rows = await source.getSnapshot({ signal: request.signal });
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        if (!Array.isArray(rows)) throw new Error('Malformed tornado snapshot');

        const nextEntities = [];
        _rowById.clear();
        for (const row of rows) {
          const color = Cesium.Color.fromCssColorString(
            tornadoAccent(row.kind, row.severity),
          );
          _rowById.set(row.stableId, {
            ...row,
            polygons: undefined,
          });
          if (row.geometryType === 'polygon' && Array.isArray(row.polygons)) {
            for (const [index, rings] of row.polygons.entries()) {
              const [outer, ...holes] = rings;
              const outerPositions = ringPositions(outer);
              nextEntities.push(
                new Cesium.Entity({
                  id: `${TORNADO_PICK_PREFIX}${row.stableId}:${index}`,
                  polygon: {
                    hierarchy: new Cesium.PolygonHierarchy(
                      outerPositions,
                      holes.map(
                        (hole) =>
                          new Cesium.PolygonHierarchy(ringPositions(hole)),
                      ),
                    ),
                    material: new Cesium.ColorMaterialProperty(
                      color.withAlpha(
                        row.kind === 'tornado-outlook' ? 0.18 : 0.28,
                      ),
                    ),
                  },
                  polyline: {
                    positions: outerPositions,
                    clampToGround: true,
                    width: 2,
                    material: new Cesium.ColorMaterialProperty(
                      color.withAlpha(0.9),
                    ),
                  },
                }),
              );
            }
          } else if (Number.isFinite(row.lat) && Number.isFinite(row.lon)) {
            nextEntities.push(
              new Cesium.Entity({
                id: `${TORNADO_PICK_PREFIX}${row.stableId}`,
                position: Cesium.Cartesian3.fromDegrees(row.lon, row.lat),
                point: {
                  pixelSize: 11,
                  color: color.withAlpha(0.9),
                  outlineColor: Cesium.Color.WHITE.withAlpha(0.95),
                  outlineWidth: 1,
                  heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                },
              }),
            );
          }
        }

        _dataSource.entities.removeAll();
        for (const entity of nextEntities) _dataSource.entities.add(entity);
        if (_selectedId && !_rowById.has(_selectedId)) _selectedId = null;
        if (_selectedId) publishSelectedCard();
        else if (canSelect())
          overlayHost.setEntries(
            TORNADO_OVERLAY_SOURCE_ID,
            [],
            CARD_HOST_OPTIONS,
          );

        _count = _rowById.size;
        _lastUpdate = Date.now();
        _lastError = null;
        console.log(
          `[Data:Tornadoes] Updated: ${_count} features (${nextEntities.length} entities)`,
        );
        return true;
      } catch (e) {
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        console.warn('[Data:Tornadoes] Fetch error:', e);
        _lastError = e?.message || 'Tornado source unavailable';
        return false;
      } finally {
        if (_request === request) _request = null;
      }
    },

    destroy(viewer = _viewer) {
      _request?.abort();
      _request = null;
      removeClickHandler();
      clearSelection();
      _rowById.clear();
      _viewer = null;
      _enabled = false;
      if (_dataSource) {
        viewer?.dataSources?.remove(_dataSource, true);
        _dataSource = null;
      }
      _count = 0;
      _lastUpdate = null;
      _lastError = null;
    },

    getStats() {
      return {
        count: _count,
        lastUpdate: _lastUpdate,
        error: _lastError,
      };
    },
  };
  return layer;
}
