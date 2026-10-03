# Bible locations (bundled snapshot)

Places mentioned in the Protestant Bible with coordinates and verse
references from [OpenBible.info Bible Geocoding Data](https://github.com/openbibleinfo/Bible-Geocoding-Data)
(CC BY 4.0). Short event lines are public-domain King James Version
citations of the place's primary verse (or, when a verse text is unavailable,
the OpenBible place type only — never invented narrative).

## Contents

- `places.geojsonl` — one Feature per place with reliable OpenBible
  coordinates (best identification score ≥ 200). Places without
  source coordinates are omitted.

## Fields

- `event` — short KJV citation of the primary verse (what scripture records)
- `citation` / `verses` — book, chapter, and verse from OpenBible
- `sourceUrl` — OpenBible place page for more data
- `confidence` — OpenBible time/path score for the chosen identification

## License / attribution

- Place data & coordinates: © OpenBible.info, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Event citation text: King James Version (public domain)
- Rebuild: `node scripts/build-bible-locations-pack.mjs`

Do not treat coordinates as archaeological certainty; OpenBible publishes
scholarly confidence scores, and this pack keeps only higher-scoring
identifications.
