import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedEventCardPresentation } from './selectedCard.js';
import { buildAviationCard } from '../aviationAccidents/cards.js';
import { buildShipwreckCard } from '../shipwrecks/cards.js';
import { buildVolcanoCard } from '../volcanoes/cards.js';
import { buildUapCard } from '../uapSightings/cards.js';
import { buildTornadoCard } from '../tornadoes/cards.js';

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
];

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
