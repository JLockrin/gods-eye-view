import { createUsgsEarthquakeSource } from '../layers/earthquakes/source.js';
import { createWfigsPerimeterSource } from '../layers/perimeters/source.js';
import { createBundledCableSource } from '../layers/submarineCables/bundledSource.js';
import { createSexOffenderSource } from '../layers/sexOffenders/source.js';
import { createCrimeIncidentSource } from '../layers/crimeIncidents/source.js';

/** Construct the existing reference feeds independently of application setup. */
export function createReferenceSources() {
  return {
    earthquakes: createUsgsEarthquakeSource(),
    'fire-perimeters': createWfigsPerimeterSource(),
    cables: createBundledCableSource(),
    'sex-offenders': createSexOffenderSource(),
    'crime-incidents': createCrimeIncidentSource(),
  };
}
