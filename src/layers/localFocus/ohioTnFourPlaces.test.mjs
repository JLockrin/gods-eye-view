import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOCUS_PLACES,
  placesInView,
  jurisdictionsInView,
  boundsSpanOk,
  focusCoverageSummary,
} from './ohioTnFourPlaces.js';

test('focus places cover the four Joel towns with county jurisdictions', () => {
  assert.deepEqual(
    FOCUS_PLACES.map((place) => place.id),
    ['lima-oh', 'beaverdam-oh', 'findlay-oh', 'knoxville-tn'],
  );
  assert.equal(
    FOCUS_PLACES.find((place) => place.id === 'lima-oh').jurisdictionLabel,
    'Allen County, OH',
  );
  assert.equal(
    FOCUS_PLACES.find((place) => place.id === 'beaverdam-oh').jurisdictionId,
    'allen-oh',
  );
  assert.equal(
    FOCUS_PLACES.find((place) => place.id === 'findlay-oh').jurisdictionLabel,
    'Hancock County, OH',
  );
  assert.equal(
    FOCUS_PLACES.find((place) => place.id === 'knoxville-tn').jurisdictionLabel,
    'Knox County, TN',
  );
});

test('placesInView distinguishes Knoxville from the Ohio trio', () => {
  const knox = placesInView({
    west: -84.05,
    south: 35.9,
    east: -83.85,
    north: 36.05,
  });
  assert.deepEqual(
    knox.map((place) => place.id),
    ['knoxville-tn'],
  );
  const lima = placesInView({
    west: -84.2,
    south: 40.7,
    east: -84.0,
    north: 40.78,
  });
  assert.ok(lima.some((place) => place.id === 'lima-oh'));
  assert.equal(jurisdictionsInView({
    west: -84.2,
    south: 40.7,
    east: -84.0,
    north: 40.78,
  })[0].id, 'allen-oh');
});

test('whole-globe span is rejected', () => {
  assert.equal(
    boundsSpanOk({ west: -180, south: -90, east: 180, north: 90 }),
    false,
  );
  assert.equal(focusCoverageSummary(null).coverage, 'none');
});
