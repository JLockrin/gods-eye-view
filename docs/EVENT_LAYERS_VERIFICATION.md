# Event layers verification notes

Manual / dev checks for the five new Events-panel layers.

## Run the app

```bash
npm install
npm run dev
```

Open the local URL Vite prints (typically `http://localhost:5173`). Open **Data Layers → Events**.

## Layer checks

| Layer | Toggle id | What to expect | Notes |
| --- | --- | --- | --- |
| Aviation Accidents | `aviation-accidents` | Point markers; click shows NTSB place/severity/year | Bundled NTSB public-domain snapshot; viewport-thinned. Zoom into the U.S. |
| Shipwrecks | `shipwrecks` | Charted wreck points near coasts | Live NOAA ENC query. **Zoom into a coastal area** (viewport must be ≤ ~28°); whole-globe returns empty fail-soft |
| Tornadoes & Severe Weather | `tornadoes` | Recent tornado LSR points + warning/outlook polygons when active | Live IEM + SPC. Quiet weather days may show only outlook polygons or nothing |
| Volcanoes & Eruptions | `volcanoes` | U.S. volcanoes; elevated alerts emphasized | Live USGS status + elevated notices |
| UAP Sighting Reports | `uap-sightings` | Historical report points; cards say **unverified sighting report** | Bundled CC BY 4.0 subset; never labeled as verified phenomena |

## Share links

Tokens: aviation `0`, shipwrecks `3`, tornadoes `4`, volcanoes `5`, uap `6`. Enabling a layer and copying the share URL should restore that toggle.

## Automated tests

```bash
node --test \
  src/layers/aviationAccidents/*.test.mjs \
  src/layers/shipwrecks/*.test.mjs \
  src/layers/tornadoes/*.test.mjs \
  src/layers/volcanoes/*.test.mjs \
  src/layers/uapSightings/*.test.mjs \
  src/app/constructCatalog.test.mjs \
  src/data/layerState.test.mjs \
  src/data/layerStateTokenLedger.test.mjs

npm run check:boundaries
```

## Known gaps (documented, still ship a polished layer)

- **Aviation:** NTSB's authenticated developer API is not used; the layer ships a curated public-domain snapshot rather than live CAROL queries.
- **Shipwrecks:** ENC wreck points are charted hazards, not a complete historical wreck gazetteer; not for navigation.
- **Tornadoes:** Historical multi-decade track polylines from SPC svrgis are not bundled (size); recent reports/warnings/outlooks are live.
- **Volcanoes:** Global Smithsonian GVP Holocene eruption WFS was not relied on (availability); USGS U.S. status + elevated notices are live.
- **UAP:** Live NUFORC pages are not scraped (terms). The layer uses a licensed Zenodo CC BY 4.0 geocoded compilation subset and labels every feature as an unverified sighting report.
