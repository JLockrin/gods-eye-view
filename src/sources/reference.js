import { createUsgsEarthquakeSource } from '../layers/earthquakes/source.js';
import { createWfigsPerimeterSource } from '../layers/perimeters/source.js';
import { createBundledCableSource } from '../layers/submarineCables/bundledSource.js';
import { createAviationAccidentSource } from '../layers/aviationAccidents/source.js';
import { createShipwreckSource } from '../layers/shipwrecks/source.js';
import { createTornadoSource } from '../layers/tornadoes/source.js';
import { createVolcanoSource } from '../layers/volcanoes/source.js';
import { createUapSightingSource } from '../layers/uapSightings/source.js';
import { createTsunamiSource } from '../layers/tsunamis/source.js';
import { createGdeltGeoSource } from '../layers/gdeltGeo/source.js';
import { createHistoricPlacesSource } from '../layers/historicPlaces/source.js';
import { createSerialKillerPathSource } from '../layers/serialKillerPaths/source.js';

/** Construct the existing reference feeds independently of application setup. */
export function createReferenceSources() {
  return {
    earthquakes: createUsgsEarthquakeSource(),
    'fire-perimeters': createWfigsPerimeterSource(),
    'aviation-accidents': createAviationAccidentSource(),
    shipwrecks: createShipwreckSource(),
    tornadoes: createTornadoSource(),
    volcanoes: createVolcanoSource(),
    'uap-sightings': createUapSightingSource(),
    tsunamis: createTsunamiSource(),
    'gdelt-geo': createGdeltGeoSource(),
    'historic-places': createHistoricPlacesSource(),
    'serial-killer-paths': createSerialKillerPathSource(),
    cables: createBundledCableSource(),
  };
}
