import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isFlockAlpr,
  filterAlprByBrand,
  normalizeBrandFilter,
  alprHazardColor,
  aggregateAlprHeatCells,
} from './records.js';
import {
  coverageScreenRadiusPx,
  paintCoverageMask,
  ALPR_COVERAGE_GRADE_SHADER,
} from './coverage.js';
import {
  BRAND_FILTER_ALL,
  BRAND_FILTER_FLOCK,
  ALPR_FLOCK_COLOR,
  ALPR_OTHER_COLOR,
  ALPR_SELECTED_COLOR,
} from './policy.js';

test('isFlockAlpr matches manufacturer or operator flock tags', () => {
  assert.equal(isFlockAlpr({ manufacturer: 'Flock Safety' }), true);
  assert.equal(isFlockAlpr({ operator: 'flock' }), true);
  assert.equal(isFlockAlpr({ manufacturer: 'Motorola' }), false);
  assert.equal(isFlockAlpr({ manufacturer: 'Superflockcam' }), false);
  assert.equal(isFlockAlpr(null), false);
});

test('filterAlprByBrand keeps Flock-only or all records', () => {
  const records = [
    { id: 'a', manufacturer: 'Flock Safety', latitude: 1, longitude: 1 },
    { id: 'b', manufacturer: 'Genetec', latitude: 2, longitude: 2 },
    { id: 'c', operator: 'City flock unit', latitude: 3, longitude: 3 },
  ];
  assert.deepEqual(
    filterAlprByBrand(records, BRAND_FILTER_FLOCK).map((r) => r.id),
    ['a', 'c'],
  );
  assert.equal(filterAlprByBrand(records, BRAND_FILTER_ALL).length, 3);
  assert.equal(
    normalizeBrandFilter('nope', BRAND_FILTER_ALL),
    BRAND_FILTER_ALL,
  );
  assert.equal(normalizeBrandFilter('flock'), BRAND_FILTER_FLOCK);
});

test('alprHazardColor highlights Flock sharper than other ALPRs', () => {
  assert.equal(
    alprHazardColor({ manufacturer: 'Flock Safety' }),
    ALPR_FLOCK_COLOR,
  );
  assert.equal(alprHazardColor({ manufacturer: 'Other' }), ALPR_OTHER_COLOR);
  assert.equal(
    alprHazardColor({ manufacturer: 'Flock Safety' }, { selected: true }),
    ALPR_SELECTED_COLOR,
  );
});

test('aggregateAlprHeatCells bins density and prefers busier cells', () => {
  const records = [];
  for (let i = 0; i < 5; i++)
    records.push({
      id: `f${i}`,
      latitude: 30.27,
      longitude: -97.74,
      manufacturer: 'Flock Safety',
    });
  records.push({
    id: 'lonely',
    latitude: 30.3,
    longitude: -97.8,
    manufacturer: 'Other',
  });
  const cells = aggregateAlprHeatCells(records, { maxCells: 10 });
  assert.ok(cells.length >= 2);
  assert.equal(cells[0].count, 5);
  assert.equal(cells[0].flockCount, 5);
  assert.ok(cells[0].radiusM > cells[1].radiusM);
  assert.ok(cells[0].intensity > cells[1].intensity);
});

test('coverageScreenRadiusPx stays readable and bounded', () => {
  assert.equal(coverageScreenRadiusPx(0, 1000, 800), 0);
  const city = coverageScreenRadiusPx(220, 2000, 900);
  const far = coverageScreenRadiusPx(220, 80_000, 900);
  // Same ground radius shrinks in screen space as the camera rises, but never
  // below the readability floor used for avoid-zone blobs.
  assert.ok(city >= 18);
  assert.equal(far, 18);
  assert.ok(city <= 900 * 0.35);
  assert.ok(
    coverageScreenRadiusPx(900, 4_000, 900) >
      coverageScreenRadiusPx(220, 4_000, 900),
  );
});

test('paintCoverageMask draws soft blobs without throwing', () => {
  const canvas = {
    width: 64,
    height: 64,
  };
  const calls = [];
  const ctx = {
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
    clearRect: (...args) => calls.push(['clear', ...args]),
    createRadialGradient: () => ({
      addColorStop: () => {},
    }),
    beginPath: () => calls.push(['begin']),
    arc: (...args) => calls.push(['arc', ...args]),
    ellipse: (...args) => calls.push(['ellipse', ...args]),
    fill: () => calls.push(['fill']),
    stroke: () => calls.push(['stroke']),
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    translate: () => {},
    set fillStyle(_v) {},
    set strokeStyle(_v) {},
    set lineWidth(_v) {},
  };
  paintCoverageMask(ctx, canvas.width, canvas.height, [
    { x: 20, y: 20, radiusPx: 30, weight: 0.8, flock: true },
    { x: 40, y: 40, radiusPx: 18, weight: 0.3, flock: false },
  ]);
  assert.ok(calls.some(([name]) => name === 'clear'));
  assert.ok(calls.some(([name]) => name === 'arc'));
  assert.ok(calls.some(([name]) => name === 'ellipse'));
  assert.match(ALPR_COVERAGE_GRADE_SHADER, /coverageTexture/);
  assert.match(ALPR_COVERAGE_GRADE_SHADER, /desaturat|luma/i);
});
