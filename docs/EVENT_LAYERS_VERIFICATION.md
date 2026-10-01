# Event layers verification notes

Manual / dev checks for the Events-panel layers (aviation, shipwrecks, tornadoes,
volcanoes, UAP, tsunamis, GDELT geographic news, and NRHP historic places).

## Run the app

```bash
npm install
npm run dev
```

Open the local URL Vite prints (typically `http://localhost:5173`). Open **Data Layers → Events**.

## Layer checks

| Layer                      | Toggle id            | What to expect                                                     | Notes                                                                                                            |
| -------------------------- | -------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Aviation Accidents         | `aviation-accidents` | Point markers; click shows NTSB place/severity/year                | Bundled NTSB public-domain snapshot; viewport-thinned. Zoom into the U.S.                                        |
| Shipwrecks                 | `shipwrecks`         | Charted wreck points near coasts                                   | Live NOAA ENC query. **Zoom into a coastal area** (viewport must be ≤ ~28°); whole-globe returns empty fail-soft |
| Tornadoes & Severe Weather | `tornadoes`          | Recent tornado LSR points + warning/outlook polygons when active   | Live IEM + SPC. Quiet weather days may show only outlook polygons or nothing                                     |
| Volcanoes & Eruptions      | `volcanoes`          | U.S. volcanoes; elevated alerts emphasized                         | Live USGS via same-origin `/api/volcanoes` proxy (browser CORS-safe)                                             |
| UAP Sighting Reports       | `uap-sightings`      | Historical report points; cards say **unverified sighting report** | Bundled CC BY 4.0 subset; never labeled as verified phenomena                                                    |
| Tsunamis                   | `tsunamis`           | Global historical tsunami source points                            | Bundled NCEI snapshot; viewport-thinned. Cards show year/intensity/deaths/NCEI link                              |
| Geographic News            | `gdelt-geo`          | Geo-tagged news points for the configured query                    | Live `/api/gdelt-geo` (Geo 2.0 → GKG → Event export). Default query via `GDELT_GEO_QUERY`                         |
| Historic Places & Forgotten Infrastructure | `historic-places` | NRHP property points                                     | Live `/api/historic-places`. **Zoom into a U.S. metro/region** (viewport ≤ ~12°); whole-globe returns empty      |

## Re-verify the two excellence blockers

### 1) Volcanoes must load (not UNAVAILABLE)

1. `npm run dev`
2. Open DevTools → Network; filter `volcanoes`.
3. Data Layers → Events → enable **Volcanoes & Eruptions**.
4. Confirm the client requests **`/api/volcanoes`** (same-origin), not `volcanoes.usgs.gov`.
5. Layer status should become available with markers (Alaska / CONUS volcanoes). No browser CORS “Failed to fetch”.

### 2) Selection detail cards must appear

1. Close the layers panel (cards must not depend on it being open).
2. Click an aviation, shipwreck, volcano, UAP, tsunami, GDELT, historic-place, or tornado **point** marker.
3. A world-overlay selected detail card should show what / when / where / source metadata.
4. UAP cards must still say **unverified sighting report** / not a verified phenomenon.

## Share links

Tokens: aviation `0`, shipwrecks `3`, tornadoes `4`, volcanoes `5`, uap `6`, tsunamis `7`, gdelt-geo `8`, historic-places `9`. Enabling a layer and copying the share URL should restore that toggle.

## Automated tests

```bash
node --test \
  src/layers/aviationAccidents/*.test.mjs \
  src/layers/shipwrecks/*.test.mjs \
  src/layers/tornadoes/*.test.mjs \
  src/layers/volcanoes/*.test.mjs \
  src/layers/uapSightings/*.test.mjs \
  src/layers/tsunamis/*.test.mjs \
  src/layers/gdeltGeo/*.test.mjs \
  src/layers/historicPlaces/*.test.mjs \
  src/layers/eventMarkers/*.test.mjs \
  src/data/volcanoesProxy.test.mjs \
  src/data/gdeltGeoProxy.test.mjs \
  src/data/historicPlacesProxy.test.mjs \
  src/app/constructCatalog.test.mjs \
  src/data/layerState.test.mjs \
  src/data/layerStateTokenLedger.test.mjs \
  src/voice/actionSchemas.test.mjs

npm run check:boundaries
```

## Point marker depth / occlusion

Event point markers (aviation, shipwrecks, volcanoes, UAP, tsunamis, GDELT, historic
places, and tornado report points) depth-test against the globe
(`disableDepthTestDistance: 0`). Far-side points must not paint through the Earth;
near-side points remain pickable with detail cards. Regression covered by
`src/layers/eventMarkers/pointDepth.test.mjs`.

## Known gaps (documented, still ship a polished layer)

- **Aviation:** NTSB's authenticated developer API is not used; the layer ships a curated public-domain snapshot rather than live CAROL queries.
- **Shipwrecks:** ENC wreck points are charted hazards, not a complete historical wreck gazetteer; not for navigation.
- **Tornadoes:** Historical multi-decade track polylines from SPC svrgis are not bundled (size); recent reports/warnings/outlooks are live.
- **Volcanoes:** Global Smithsonian GVP Holocene eruption WFS was not relied on (availability); USGS U.S. status + elevated notices are live through `/api/volcanoes`.
- **UAP:** Live NUFORC pages are not scraped (terms). The layer uses a licensed Zenodo CC BY 4.0 geocoded compilation subset and labels every feature as an unverified sighting report.
- **Tsunamis:** Bundled NCEI snapshot drops `EVENT_VALIDITY_CODE < 2`; refresh via `src/data/local_data/ncei_tsunami_events/README.md`.
- **Geographic News:** GDELT Geo 2.0 currently 404s upstream; the proxy falls back to GKG GeoJSON / Event export while keeping the same card fields. Query is server-configurable (`GDELT_GEO_QUERY`), not a full in-app text control yet.
- **Historic places:** Full NRHP (~75k unrestricted points) is viewport-bounded live rather than fully bundled; UI framing is broader than NRHP-only naming.
