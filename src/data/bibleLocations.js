import { createBibleLocationSource } from '../layers/bibleLocations/index.js';
import { createApplicationBibleLocations } from '../app/layers/bibleLocations.js';
export * from '../layers/bibleLocations/index.js';

/** Wire the standalone source and application overlay owner. */
export function createBibleLocationsLayer({
  source = createBibleLocationSource(),
  ...options
} = {}) {
  return createApplicationBibleLocations({ source, ...options });
}
export default createBibleLocationsLayer();
