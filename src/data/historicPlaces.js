import { createHistoricPlacesSource } from '../layers/historicPlaces/index.js';
import { createApplicationHistoricPlaces } from '../app/layers/historicPlaces.js';
export * from '../layers/historicPlaces/index.js';

/** Wire the standalone source and application overlay owner. */
export function createHistoricPlacesLayer({
  source = createHistoricPlacesSource(),
  ...options
} = {}) {
  return createApplicationHistoricPlaces({ source, ...options });
}
export default createHistoricPlacesLayer();
