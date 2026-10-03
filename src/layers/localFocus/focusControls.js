import * as Cesium from 'cesium';
import {
  FOCUS_PLACES,
  NW_OHIO_OVERVIEW,
  FOCUS_SOURCE_LABEL,
  placesInView,
} from './ohioTnFourPlaces.js';
import { viewBoundsDegrees } from '../eventMarkers/pointEventLayer.js';

function flyToTarget(viewer, target) {
  const camera = viewer?.camera;
  if (!camera?.flyToBoundingSphere || !target) return false;
  const center = Cesium.Cartesian3.fromDegrees(target.lon, target.lat);
  const range = Number.isFinite(target.rangeM) ? target.rangeM : 12000;
  camera.flyToBoundingSphere(new Cesium.BoundingSphere(center, range * 0.35), {
    duration: 2.2,
    offset: new Cesium.HeadingPitchRange(
      0,
      Cesium.Math.toRadians(-48),
      range,
    ),
  });
  return true;
}

export function viewportIntersectsFocus(viewer) {
  const bounds = viewBoundsDegrees(viewer, { padFraction: 0 });
  return placesInView(bounds).length > 0;
}

/** Default framing: NW Ohio trio (3 of the 4 scoped places). */
export function flyToDefaultFocus(viewer) {
  return flyToTarget(viewer, NW_OHIO_OVERVIEW);
}

export function flyToFocusPlace(viewer, placeId) {
  const place =
    FOCUS_PLACES.find((entry) => entry.id === placeId) ||
    (placeId === NW_OHIO_OVERVIEW.id ? NW_OHIO_OVERVIEW : null);
  return flyToTarget(viewer, place);
}

/** Row chips so an operator can jump to each scoped place. */
export function buildFocusRowControls(viewer, { enabled = true } = {}) {
  const chips = [
    {
      id: NW_OHIO_OVERVIEW.id,
      label: 'OHIO TOWNS',
      title: 'Frame Lima, Beaverdam, and Findlay, Ohio',
      disabled: !enabled || !viewer,
      onClick: () => flyToDefaultFocus(viewer),
    },
    ...FOCUS_PLACES.map((place) => ({
      id: place.id,
      label: place.label.toUpperCase(),
      title: `${place.label} (${place.jurisdictionLabel})`,
      disabled: !enabled || !viewer,
      onClick: () => flyToFocusPlace(viewer, place.id),
    })),
  ];
  return {
    chips,
    info: `${FOCUS_SOURCE_LABEL} · jurisdictions: Allen Co. OH, Hancock Co. OH, Knox Co. TN`,
  };
}

/**
 * Attach focus chips + default fly-on-enable to a point-event layer instance.
 * Mutates the layer object returned by createPointEventLayer.
 */
export function attachFocusControls(layer, { flyOnEnable = true } = {}) {
  let viewer = null;
  const init = layer.init.bind(layer);
  layer.init = (nextViewer) => {
    viewer = nextViewer;
    return init(nextViewer);
  };
  const enable = layer.enable.bind(layer);
  layer.enable = (...args) => {
    enable(...args);
    if (flyOnEnable && viewer && !viewportIntersectsFocus(viewer)) {
      flyToDefaultFocus(viewer);
    }
  };
  const destroy = layer.destroy.bind(layer);
  layer.destroy = (...args) => {
    const result = destroy(...args);
    viewer = null;
    return result;
  };
  layer.getRowControls = () =>
    buildFocusRowControls(viewer, { enabled: true });
  return layer;
}
