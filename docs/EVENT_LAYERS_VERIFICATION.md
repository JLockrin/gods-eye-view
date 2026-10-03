# Event layers verification notes

Manual / dev checks for the five new Events-panel layers.

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
| Bible Locations            | `bible-locations`    | Point markers for biblical places; card shows KJV citation, verses, OpenBible link | Bundled OpenBible.info CC BY 4.0 pack; zoom into the Levant / eastern Mediterranean                              |

## Re-verify the two excellence blockers

### 1) Volcanoes must load (not UNAVAILABLE)

1. `npm run dev`
2. Open DevTools → Network; filter `volcanoes`.
3. Data Layers → Events → enable **Volcanoes & Eruptions**.
4. Confirm the client requests **`/api/volcanoes`** (same-origin), not `volcanoes.usgs.gov`.
5. Layer status should become available with markers (Alaska / CONUS volcanoes). No browser CORS “Failed to fetch”.

### 2) Selection detail cards must appear

1. Close the layers panel (cards must not depend on it being open).
2. Click an aviation, shipwreck, volcano, UAP, tornado, or Bible **point** marker.
3. A world-overlay selected detail card should show what / when / where / source metadata between the left and right HUD columns (not under them).
4. UAP cards must still say **unverified sighting report** / not a verified phenomenon.
5. Bible cards must show the event citation, book/chapter/verse mentions, **OpenBible.info**, and an outbound place-page link.

## Share links

Tokens: aviation `0`, shipwrecks `3`, tornadoes `4`, volcanoes `5`, uap `6`, bible `7`. Enabling a layer and copying the share URL should restore that toggle.

## Automated tests

```bash
node --test \
  src/layers/aviationAccidents/*.test.mjs \
  src/layers/shipwrecks/*.test.mjs \
  src/layers/tornadoes/*.test.mjs \
  src/layers/volcanoes/*.test.mjs \
  src/layers/uapSightings/*.test.mjs \
  src/layers/bibleLocations/*.test.mjs \
  src/layers/eventMarkers/*.test.mjs \
  src/data/volcanoesProxy.test.mjs \
  src/app/constructCatalog.test.mjs \
  src/data/layerState.test.mjs \
  src/data/layerStateTokenLedger.test.mjs \
  src/voice/actionSchemas.test.mjs

npm run check:boundaries
```

## Known gaps (documented, still ship a polished layer)

- **Aviation:** NTSB's authenticated developer API is not used; the layer ships a curated public-domain snapshot rather than live CAROL queries.
- **Shipwrecks:** ENC wreck points are charted hazards, not a complete historical wreck gazetteer; not for navigation.
- **Tornadoes:** Historical multi-decade track polylines from SPC svrgis are not bundled (size); recent reports/warnings/outlooks are live.
- **Volcanoes:** Global Smithsonian GVP Holocene eruption WFS was not relied on (availability); USGS U.S. status + elevated notices are live through `/api/volcanoes`.
- **UAP:** Live NUFORC pages are not scraped (terms). The layer uses a licensed Zenodo CC BY 4.0 geocoded compilation subset and labels every feature as an unverified sighting report.
- **Bible locations:** Uses OpenBible.info's CC BY 4.0 geocoding dataset (not invented coordinates/events). Event lines are short public-domain KJV citations of the primary verse OpenBible lists for the place; copyrighted modern Bible text is not scraped.
