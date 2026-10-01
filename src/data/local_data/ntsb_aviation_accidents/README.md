# NTSB aviation accidents (bundled snapshot)

Geocoded U.S. civil aviation accident points extracted from the NTSB
downloadable aviation dataset (`avall.mdb` / monthly updates at
https://data.ntsb.gov/avdata/).

## Contents

- `accidents.geojsonl` — Feature-per-line GeoJSON points with NTSB case id,
  place, year, highest injury, and coordinates (`dec_latitude` /
  `dec_longitude`).

## Selection

The snapshot prefers fatal accidents and recent (2020+) non-fatal accidents
with valid coordinates, capped for runtime size. The layer viewport-thins
further when enabled.

## License

U.S. government work / public domain. The NTSB authenticated developer API is
**not** used; no API secrets are required or stored.

## Refresh

Re-export from a fresh NTSB `avall` / monthly MDB when refreshing this pack.
See `DATA_SOURCES.md`.
