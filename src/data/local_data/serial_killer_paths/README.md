# Historical serial-case path pack (v1)

Bundled static JSON for the **Historical Serial Cases** layer (`serial-killer-paths`).

## Contents

| File | Purpose |
| --- | --- |
| `cases.json` | Two public historical cases with ordered path sites, kill vs body-found roles, precision flags, and attribution URLs |

## Cases shipped

1. **Anthony Sowell (Cleveland, OH, 2007–2009)** — kill/body locus at **12205 Imperial Avenue** from *State v. Sowell*, 2016-Ohio-8025. Victim disappearance order from contemporaneous public identification reporting. Separate last-seen street pins are omitted when not court-documented.
2. **Alton Coleman (1984 Midwest spree)** — chronological path emphasizing court-documented Ohio sites (Toledo, Cincinnati May & Morgan / May Street, Norwood) plus city-approximate out-of-state localities from public encyclopedic/news summaries. Uncertain building numbers are not invented.

## Coordinate policy

- Prefer court opinions and reputable news archives.
- `precision: "address"` only for publicly cited street addresses (Imperial Avenue).
- City / street / intersection pins set `approximate: true` and document the source note in the site summary.
- If a kill street is unknown, omit it or map last-seen / body-found only.

## License / terms

Case facts are public-record summaries. This folder does not rehost sealed records, FOIA dumps, or non-public personal data. OSM Nominatim was used only to geocode publicly named places for this research pack.

## Refresh

Edit `cases.json` by hand. Keep attribution URLs current. Do not scrape paywalled sites.
