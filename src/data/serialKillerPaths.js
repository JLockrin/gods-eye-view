import { createSerialKillerPathSource } from '../layers/serialKillerPaths/index.js';
import { createApplicationSerialKillerPaths } from '../app/layers/serialKillerPaths.js';
export * from '../layers/serialKillerPaths/index.js';

/** Wire the standalone source and application overlay owner. */
export function createSerialKillerPathsLayer({
  source = createSerialKillerPathSource(),
  ...options
} = {}) {
  return createApplicationSerialKillerPaths({ source, ...options });
}
export default createSerialKillerPathsLayer();
