import { createVolcanoSource } from '../layers/volcanoes/index.js';
import { createApplicationVolcanoes } from '../app/layers/volcanoes.js';
export * from '../layers/volcanoes/index.js';

/** Wire the standalone source and application overlay owner. */
export function createVolcanoesLayer({
  source = createVolcanoSource(),
  ...options
} = {}) {
  return createApplicationVolcanoes({ source, ...options });
}
export default createVolcanoesLayer();
