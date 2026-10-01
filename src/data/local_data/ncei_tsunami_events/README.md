# NCEI Global Historical Tsunami Events

Bundled snapshot of tsunami **source events** from the NOAA NCEI / WDS Global
Historical Tsunami Database (doi:10.7289/V5PN93H7), served by the public NCEI
Natural Hazards ArcGIS layer “Tsunami Events by Cause/Fatalities”.

## Source

- Product page: https://www.ncei.noaa.gov/products/natural-hazards/tsunamis-earthquakes-volcanoes/tsunamis/global-historical-data
- Live service: `https://gis.ngdc.noaa.gov/arcgis/rest/services/web_mercator/hazards/MapServer/1`
- License: U.S. public domain (NCEI / WDS)

## Curation

- Point features only (event source locations with coordinates).
- Rows with `EVENT_VALIDITY_CODE < 2` (very doubtful / erroneous / seiche) are dropped.
- Coordinates rounded to 4 decimal degrees in the geojsonl snapshot.

## Refresh

```bash
python3 - <<'PY'
import json, urllib.request
from pathlib import Path
base = "https://gis.ngdc.noaa.gov/arcgis/rest/services/web_mercator/hazards/MapServer/1/query"
fields = ",".join([
  "ID","YEAR","MONTH","DAY","LATITUDE","LONGITUDE","LOCATION_NAME","COUNTRY",
  "REGION","EQ_MAGNITUDE","TS_INTENSITY","TS_MT_II","DEATHS","DEATHS_TOTAL",
  "DAMAGE_MILLIONS_DOLLARS","DAMAGE_MILLIONS_DOLLARS_TOTAL","DAMAGE_DESCRIPTION",
  "DAMAGE_TOTAL_DESCRIPTION","CAUSE","EVENT_VALIDITY","EVENT_VALIDITY_CODE","URL",
  "MAX_EVENT_RUNUP",
])
features = []
offset = 0
while True:
  url = (
    f"{base}?where=1%3D1&outFields={fields}&returnGeometry=true&outSR=4326"
    f"&f=geojson&resultRecordCount=1000&resultOffset={offset}&orderByFields=ID"
  )
  batch = json.load(urllib.request.urlopen(url, timeout=60)).get("features") or []
  features.extend(batch)
  if len(batch) < 1000:
    break
  offset += 1000
out = Path("src/data/local_data/ncei_tsunami_events/events.geojsonl")
lines = []
for f in features:
  p = f.get("properties") or {}
  coords = (f.get("geometry") or {}).get("coordinates") or []
  if len(coords) < 2:
    continue
  lon, lat = coords[0], coords[1]
  if not (-180 <= lon <= 180 and -90 <= lat <= 90):
    continue
  validity = p.get("EVENT_VALIDITY_CODE")
  if validity is not None and validity < 2:
    continue
  props = {
    "id": p.get("ID"),
    "year": p.get("YEAR"),
    "month": p.get("MONTH"),
    "day": p.get("DAY"),
    "location": p.get("LOCATION_NAME"),
    "country": p.get("COUNTRY"),
    "region": p.get("REGION"),
    "cause": p.get("CAUSE"),
    "validity": p.get("EVENT_VALIDITY"),
    "validityCode": validity,
    "eqMagnitude": p.get("EQ_MAGNITUDE"),
    "tsIntensity": p.get("TS_INTENSITY"),
    "tsMtIi": p.get("TS_MT_II"),
    "maxRunup": p.get("MAX_EVENT_RUNUP"),
    "deaths": p.get("DEATHS_TOTAL") if p.get("DEATHS_TOTAL") is not None else p.get("DEATHS"),
    "damageMillions": p.get("DAMAGE_MILLIONS_DOLLARS_TOTAL")
      if p.get("DAMAGE_MILLIONS_DOLLARS_TOTAL") is not None
      else p.get("DAMAGE_MILLIONS_DOLLARS"),
    "damage": p.get("DAMAGE_TOTAL_DESCRIPTION") or p.get("DAMAGE_DESCRIPTION"),
    "url": p.get("URL"),
  }
  props = {k: v for k, v in props.items() if v is not None and v != ""}
  lines.append(json.dumps({
    "type": "Feature",
    "geometry": {"type": "Point", "coordinates": [round(lon, 4), round(lat, 4)]},
    "properties": props,
  }, separators=(",", ":")))
out.write_text("\n".join(lines) + "\n")
print(f"wrote {len(lines)} features to {out}")
PY
```

Do not commit intermediate full GeoJSON dumps.