import { createAviationAccidentSource } from '../layers/aviationAccidents/index.js';
import { createApplicationAviationAccidents } from '../app/layers/aviationAccidents.js';
export * from '../layers/aviationAccidents/index.js';

/** Wire the standalone source and application overlay owner. */
export function createAviationAccidentsLayer({
  source = createAviationAccidentSource(),
  ...options
} = {}) {
  return createApplicationAviationAccidents({ source, ...options });
}
export default createAviationAccidentsLayer();
