import { createTornadoSource } from '../layers/tornadoes/index.js';
import { createApplicationTornadoes } from '../app/layers/tornadoes.js';
export * from '../layers/tornadoes/index.js';

/** Wire the standalone source and application overlay owner. */
export function createTornadoesLayer({
  source = createTornadoSource(),
  ...options
} = {}) {
  return createApplicationTornadoes({ source, ...options });
}
export default createTornadoesLayer();
