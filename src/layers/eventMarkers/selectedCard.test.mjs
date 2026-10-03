import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedEventCardPresentation } from './selectedCard.js';
import { buildAviationCard } from '../aviationAccidents/cards.js';
import { buildShipwreckCard } from '../shipwrecks/cards.js';
import { buildVolcanoCard } from '../volcanoes/cards.js';
import { buildUapCard } from '../uapSightings/cards.js';
import { buildTornadoCard } from '../tornadoes/cards.js';
import { buildBibleLocationCard } from '../bibleLocations/cards.js';

test('selected event card presentation matches FIRMS selected-card lane fields', () => {
  assert.deepEqual(selectedEventCardPresentation(), {
    variant: 'selected',
    selected: true,
    protected: true,
    collisionGroup: 'ambient-card',
    cardStyle: 'tactical',
  });
});

const builders = [
  [
    'aviation',
    () =>
      buildAviationCard({
        stableId: 'SEA26FA001',
        title: 'Aviation accident · Seattle',
        summary: 'Seattle, WA',
        severity: 'fatal',
        kind: 'ACC',
        year: 2026,
        sourceUrl: 'https://example.test/ntsb',
      }),
  ],
  [
    'shipwreck',
    () =>
      buildShipwreckCard({
        stableId: 'wreck-1',
        title: 'Shipwreck · wreck',
        summary: 'dangerous wreck',
        kind: 'dangerous-wreck',
        severity: 'hazard',
        sourceUrl: 'https://example.test/noaa',
      }),
  ],
  [
    'volcano',
    () =>
      buildVolcanoCard({
        stableId: '311120',
        title: 'Volcano · Great Sitkin',
        summary: 'Slow eruption',
        alertLevel: 'WATCH',
        colorCode: 'ORANGE',
        severity: 'watch',
        sourceUrl: 'https://example.test/usgs',
      }),
  ],
  [
    'uap',
    () =>
      buildUapCard({
        stableId: 'uap-1',
        title: 'UAP sighting report · san marcos, tx',
        summary: 'Lights',
        shape: 'cylinder',
        year: 1949,
        sourceUrl: 'https://doi.org/10.5281/zenodo.1205624',
      }),
  ],
  [
    'tornado',
    () =>
      buildTornadoCard({
        stableId: 'lsr-1',
        title: 'Tornado report',
        summary: 'brief touchdown',
        kind: 'tornado-report',
        magnitude: 'EF1',
        sourceUrl: 'https://example.test/iem',
      }),
  ],
  [
    'bible',
    () =>
      buildBibleLocationCard({
        stableId: 'a15257a',
        title: 'Jerusalem',
        event: 'Now it came to pass…',
        citation: 'Josh 10:1',
        verses: ['Josh 10:1', 'Josh 10:2'],
        sourceUrl: 'https://www.openbible.info/geo/ancient/a15257a/jerusalem',
        eventSource: 'KJV (public domain)',
      }),
  ],
];

test('bible selected card shows event, citation, source name, and outbound link', () => {
  const card = buildBibleLocationCard({
    stableId: 'a631d35',
    title: 'Golgotha',
    event:
      'And when they were come unto a place called Golgotha, that is to say, a place of a skull,',
    citation: 'Matt 27:33',
    verses: ['Matt 27:33', 'Mark 15:22', 'Luke 23:33', 'John 19:17'],
    sourceUrl: 'https://www.openbible.info/geo/ancient/a631d35/golgotha',
    eventSource: 'KJV (public domain)',
  });
  const text = card.details.join(' ');
  assert.match(text, /Golgotha/);
  assert.match(text, /Matt 27:33/);
  assert.match(text, /OpenBible\.info/);
  assert.match(text, /click card to open/i);
  assert.equal(
    card.sourceUrl,
    'https://www.openbible.info/geo/ancient/a631d35/golgotha',
  );
});

for (const [name, build] of builders) {
  test(`${name} selected card emits variant selected for the world-overlay card lane`, () => {
    const card = build();
    assert.equal(card.variant, 'selected');
    assert.equal(card.selected, true);
    assert.equal(card.protected, true);
    assert.equal(card.collisionGroup, 'ambient-card');
    assert.equal(card.cardStyle, 'tactical');
    assert.ok(Array.isArray(card.details) && card.details.length > 0);
    assert.ok(typeof card.title === 'string' && card.title.length > 0);
  });
}

test('uap selected card still labels the report as unverified', () => {
  const card = buildUapCard({
    stableId: 'uap-1',
    title: 'UAP sighting report',
    summary: 'Lights',
    year: 1949,
  });
  assert.match(card.details.join(' '), /not a verified phenomenon/i);
  assert.match(card.details.join(' '), /unverified sighting report/i);
});
