import { createShipwreckSource } from '../layers/shipwrecks/index.js';
import { createApplicationShipwrecks } from '../app/layers/shipwrecks.js';
export * from '../layers/shipwrecks/index.js';

/** Wire the standalone source and application overlay owner. */
export function createShipwrecksLayer({
  source = createShipwreckSource(),
  ...options
} = {}) {
  return createApplicationShipwrecks({ source, ...options });
}
export default createShipwrecksLayer();
