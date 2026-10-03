#!/usr/bin/env node
/**
 * Build a small Bible-locations GeoJSONL pack from OpenBible.info
 * Bible-Geocoding-Data (CC BY 4.0) plus short public-domain KJV citations.
 *
 * Usage: node scripts/build-bible-locations-pack.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../src/data/local_data/bible_locations');
const ANCIENT_URL =
  'https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data/ancient.jsonl';
const KJV_BASE =
  'https://raw.githubusercontent.com/aruljohn/Bible-kjv/master';

/** Minimum OpenBible time/path score to treat a coordinate as reliable. */
const MIN_SCORE = 200;
const MAX_EVENT_CHARS = 180;
const MAX_VERSE_LIST = 4;

const OSIS_TO_FILE = Object.freeze({
  Gen: 'Genesis',
  Exod: 'Exodus',
  Lev: 'Leviticus',
  Num: 'Numbers',
  Deut: 'Deuteronomy',
  Josh: 'Joshua',
  Judg: 'Judges',
  Ruth: 'Ruth',
  '1Sam': '1Samuel',
  '2Sam': '2Samuel',
  '1Kgs': '1Kings',
  '2Kgs': '2Kings',
  '1Chr': '1Chronicles',
  '2Chr': '2Chronicles',
  Ezra: 'Ezra',
  Neh: 'Nehemiah',
  Esth: 'Esther',
  Job: 'Job',
  Ps: 'Psalms',
  Prov: 'Proverbs',
  Eccl: 'Ecclesiastes',
  Song: 'SongofSolomon',
  Isa: 'Isaiah',
  Jer: 'Jeremiah',
  Lam: 'Lamentations',
  Ezek: 'Ezekiel',
  Dan: 'Daniel',
  Hos: 'Hosea',
  Joel: 'Joel',
  Amos: 'Amos',
  Obad: 'Obadiah',
  Jonah: 'Jonah',
  Mic: 'Micah',
  Nah: 'Nahum',
  Hab: 'Habakkuk',
  Zeph: 'Zephaniah',
  Hag: 'Haggai',
  Zech: 'Zechariah',
  Mal: 'Malachi',
  Matt: 'Matthew',
  Mark: 'Mark',
  Luke: 'Luke',
  John: 'John',
  Acts: 'Acts',
  Rom: 'Romans',
  '1Cor': '1Corinthians',
  '2Cor': '2Corinthians',
  Gal: 'Galatians',
  Eph: 'Ephesians',
  Phil: 'Philippians',
  Col: 'Colossians',
  '1Thess': '1Thessalonians',
  '2Thess': '2Thessalonians',
  '1Tim': '1Timothy',
  '2Tim': '2Timothy',
  Titus: 'Titus',
  Phlm: 'Philemon',
  Heb: 'Hebrews',
  Jas: 'James',
  '1Pet': '1Peter',
  '2Pet': '2Peter',
  '1John': '1John',
  '2John': '2John',
  '3John': '3John',
  Jude: 'Jude',
  Rev: 'Revelation',
});

function parseLonLat(value) {
  if (typeof value !== 'string') return null;
  const parts = value.split(',');
  if (parts.length !== 2) return null;
  const lon = Number(parts[0]);
  const lat = Number(parts[1]);
  if (
    !Number.isFinite(lon) ||
    !Number.isFinite(lat) ||
    Math.abs(lon) > 180 ||
    Math.abs(lat) > 90
  )
    return null;
  return { lon, lat };
}

function stripXml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text, max = MAX_EVENT_CHARS) {
  const cleaned = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

function bestResolution(place) {
  let best = null;
  let bestScore = -1;
  for (const ident of place.identifications || []) {
    const identScore = ident?.score?.time_total;
    for (const res of ident.resolutions || []) {
      if (res.special || res.id_source === 'special') continue;
      const coords = parseLonLat(res.lonlat);
      if (!coords) continue;
      const score =
        res.best_time_score ??
        (Number.isFinite(identScore) ? identScore : 0);
      if (score > bestScore) {
        bestScore = score;
        best = { res, score, coords, types: ident.types || place.types || [] };
      }
    }
  }
  return best;
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function loadKjvBook(fileStem, cache) {
  if (cache.has(fileStem)) return cache.get(fileStem);
  const text = await fetchText(`${KJV_BASE}/${fileStem}.json`);
  const book = JSON.parse(text);
  const byChapter = new Map();
  for (const chapter of book.chapters || []) {
    const chapterNo = Number(chapter.chapter);
    const verses = new Map();
    for (const verse of chapter.verses || []) {
      verses.set(Number(verse.verse), String(verse.text || '').trim());
    }
    byChapter.set(chapterNo, verses);
  }
  cache.set(fileStem, byChapter);
  return byChapter;
}

async function kjvForOsis(osis, cache) {
  if (typeof osis !== 'string') return null;
  const match = osis.match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  const [, book, chapter, verse] = match;
  const fileStem = OSIS_TO_FILE[book];
  if (!fileStem) return null;
  const chapters = await loadKjvBook(fileStem, cache);
  return chapters.get(Number(chapter))?.get(Number(verse)) || null;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log('Fetching OpenBible ancient.jsonl…');
  const ancientText = await fetchText(ANCIENT_URL);
  const places = ancientText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const kjvCache = new Map();
  const features = [];
  let skippedNoCoords = 0;
  let skippedLowScore = 0;
  let skippedNoVerses = 0;
  let missingKjv = 0;

  for (const place of places) {
    const picked = bestResolution(place);
    if (!picked) {
      skippedNoCoords += 1;
      continue;
    }
    if (picked.score < MIN_SCORE) {
      skippedLowScore += 1;
      continue;
    }
    const verses = Array.isArray(place.verses) ? place.verses : [];
    if (!verses.length) {
      skippedNoVerses += 1;
      continue;
    }
    const primary = verses[0];
    const citation =
      primary.readable ||
      (primary.osis ? primary.osis.replace(/\./g, ' ') : null);
    if (!citation) {
      skippedNoVerses += 1;
      continue;
    }
    const verseList = verses
      .slice(0, MAX_VERSE_LIST)
      .map((v) => v.readable || v.osis)
      .filter(Boolean);
    const moreCount = Math.max(0, verses.length - verseList.length);

    let eventText = await kjvForOsis(primary.osis, kjvCache);
    if (eventText) {
      eventText = truncate(eventText);
    } else {
      missingKjv += 1;
      const type = Array.isArray(picked.types) && picked.types.length
        ? picked.types[0]
        : Array.isArray(place.types) && place.types.length
          ? place.types[0]
          : 'place';
      // Non-invented fallback: only fields present in OpenBible.
      eventText = `Biblical ${type} mentioned in scripture`;
    }

    const name =
      place.friendly_id ||
      Object.keys(place.translation_name_counts || {})[0] ||
      place.url_slug ||
      place.id;
    const sourceUrl = `https://www.openbible.info/geo/ancient/${place.id}/${place.url_slug}`;

    features.push({
      type: 'Feature',
      id: place.id,
      geometry: {
        type: 'Point',
        coordinates: [picked.coords.lon, picked.coords.lat],
      },
      properties: {
        title: name,
        name,
        event: eventText,
        citation,
        verses: verseList,
        verseCount: verses.length,
        moreVerses: moreCount,
        kind: Array.isArray(picked.types) ? picked.types[0] || null : null,
        confidence: picked.score,
        source: 'OpenBible.info Bible Geocoding (CC BY 4.0)',
        sourceUrl,
        eventSource: eventText.startsWith('Biblical ')
          ? 'OpenBible.info place type'
          : 'KJV (public domain)',
      },
    });
  }

  // Stable order: higher confidence first, then name.
  features.sort((a, b) => {
    const conf = (b.properties.confidence || 0) - (a.properties.confidence || 0);
    if (conf) return conf;
    return String(a.properties.name).localeCompare(String(b.properties.name));
  });

  const outPath = path.join(OUT_DIR, 'places.geojsonl');
  writeFileSync(
    outPath,
    features.map((f) => JSON.stringify(f)).join('\n') + '\n',
  );

  const readme = `# Bible locations (bundled snapshot)

Places mentioned in the Protestant Bible with coordinates and verse
references from [OpenBible.info Bible Geocoding Data](https://github.com/openbibleinfo/Bible-Geocoding-Data)
(CC BY 4.0). Short event lines are public-domain King James Version
citations of the place's primary verse (or, when a verse text is unavailable,
the OpenBible place type only — never invented narrative).

## Contents

- \`places.geojsonl\` — one Feature per place with reliable OpenBible
  coordinates (best identification score ≥ ${MIN_SCORE}). Places without
  source coordinates are omitted.

## Fields

- \`event\` — short KJV citation of the primary verse (what scripture records)
- \`citation\` / \`verses\` — book, chapter, and verse from OpenBible
- \`sourceUrl\` — OpenBible place page for more data
- \`confidence\` — OpenBible time/path score for the chosen identification

## License / attribution

- Place data & coordinates: © OpenBible.info, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Event citation text: King James Version (public domain)
- Rebuild: \`node scripts/build-bible-locations-pack.mjs\`

Do not treat coordinates as archaeological certainty; OpenBible publishes
scholarly confidence scores, and this pack keeps only higher-scoring
identifications.
`;
  writeFileSync(path.join(OUT_DIR, 'README.md'), readme);

  console.log(
    JSON.stringify(
      {
        written: outPath,
        features: features.length,
        skippedNoCoords,
        skippedLowScore,
        skippedNoVerses,
        missingKjv,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
