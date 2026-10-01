import { createGdeltGeoSource } from '../layers/gdeltGeo/index.js';
import { createApplicationGdeltGeo } from '../app/layers/gdeltGeo.js';
export * from '../layers/gdeltGeo/index.js';

/** Wire the standalone source and application overlay owner. */
export function createGdeltGeoLayer({
  source = createGdeltGeoSource(),
  ...options
} = {}) {
  return createApplicationGdeltGeo({ source, ...options });
}
export default createGdeltGeoLayer();
