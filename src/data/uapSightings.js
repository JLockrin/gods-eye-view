import { createUapSightingSource } from '../layers/uapSightings/index.js';
import { createApplicationUapSightings } from '../app/layers/uapSightings.js';
export * from '../layers/uapSightings/index.js';

/** Wire the standalone source and application overlay owner. */
export function createUapSightingsLayer({
  source = createUapSightingSource(),
  ...options
} = {}) {
  return createApplicationUapSightings({ source, ...options });
}
export default createUapSightingsLayer();
