import { createSexOffenderSource } from '../layers/sexOffenders/index.js';
import { createApplicationSexOffenders } from '../app/layers/sexOffenders.js';
export * from '../layers/sexOffenders/index.js';

/** Wire the standalone source and application overlay owner. */
export function createSexOffendersLayer({
  source = createSexOffenderSource(),
  ...options
} = {}) {
  return createApplicationSexOffenders({ source, ...options });
}
export default createSexOffendersLayer();
