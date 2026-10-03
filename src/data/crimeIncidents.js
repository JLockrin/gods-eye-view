import { createCrimeIncidentSource } from '../layers/crimeIncidents/index.js';
import { createApplicationCrimeIncidents } from '../app/layers/crimeIncidents.js';
export * from '../layers/crimeIncidents/index.js';

/** Wire the standalone source and application overlay owner. */
export function createCrimeIncidentsLayer({
  source = createCrimeIncidentSource(),
  ...options
} = {}) {
  return createApplicationCrimeIncidents({ source, ...options });
}
export default createCrimeIncidentsLayer();
