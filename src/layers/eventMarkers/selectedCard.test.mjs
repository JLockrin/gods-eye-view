import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedEventCardPresentation } from './selectedCard.js';
import { buildSexOffenderCard } from '../sexOffenders/cards.js';
import { buildCrimeIncidentCard } from '../crimeIncidents/cards.js';

test('selected event card presentation matches FIRMS selected-card lane fields', () => {
  assert.deepEqual(selectedEventCardPresentation(), {
    variant: 'selected',
    selected: true,
    protected: true,
    collisionGroup: 'ambient-card',
    cardStyle: 'tactical',
  });
});

test('registry and crime cards use the selected-card presentation fields', () => {
  const offenders = buildSexOffenderCard({
    stableId: 'tn-tbi:1',
    title: 'JANE DOE',
    offenseCategory: 'VIOLENT',
    jurisdiction: 'Knoxville, Knox County, TN',
    asOf: '2026-01-01',
    sourceName: 'Tennessee TBI',
    sourceUrl: 'https://example.test/tbi',
  });
  const crimes = buildCrimeIncidentCard({
    stableId: 'crime:1',
    title: 'HOMICIDE',
    crimeType: 'HOMICIDE',
    jurisdiction: 'Lima, Allen County, OH',
    date: '2026-01-02',
    sourceName: 'Configured upstream',
    severity: 'homicide',
  });
  for (const card of [offenders, crimes]) {
    assert.equal(card.variant, 'selected');
    assert.equal(card.selected, true);
    assert.equal(card.protected, true);
    assert.equal(card.collisionGroup, 'ambient-card');
    assert.equal(card.cardStyle, 'tactical');
  }
});
