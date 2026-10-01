import { createTsunamiSource } from '../layers/tsunamis/index.js';
import { createApplicationTsunamis } from '../app/layers/tsunamis.js';
export * from '../layers/tsunamis/index.js';

/** Wire the standalone source and application overlay owner. */
export function createTsunamisLayer({
  source = createTsunamiSource(),
  ...options
} = {}) {
  return createApplicationTsunamis({ source, ...options });
}
export default createTsunamisLayer();
