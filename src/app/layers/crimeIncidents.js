import * as Cesium from 'cesium';
import { createCrimeIncidentsLayer } from '../../layers/crimeIncidents/index.js';
import * as picking from '../../data/pickRegistry.js';
import * as overlays from '../../overlays/worldOverlay.js';
import { isPointerFree } from '../../data/inputOwnership.js';

/** Wire public crime incidents into the application catalog. */
export function createApplicationCrimeIncidents(options) {
  return createCrimeIncidentsLayer({
    overlayHost: {
      setEntries: overlays.setOverlayEntries,
      setVisible: overlays.setOverlaySourceVisible,
      clearSource: overlays.clearOverlaySource,
      hitTest: overlays.hitTestWorldOverlay,
    },
    openExternal: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
    screenSpaceEventHandlerFactory: (viewer) =>
      new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas),
    picking,
    pointer: { isPointerFree },
    ...options,
  });
}
