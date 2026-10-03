import test from 'node:test';
import assert from 'node:assert/strict';
import { parseKnoxvilleUnsolvedHtml } from '../../../server/providers/crimeIncidents/knoxvilleUnsolved.js';
import {
  CRIME_PLACE_COVERAGE,
  SEX_OFFENDER_PLACE_COVERAGE,
  coverageNoteForPlaces,
} from '../localFocus/placeCoverage.js';

const SAMPLE_HTML = `
<table><tbody>
<tr><td bgcolor="#99CCFF"><strong>2025</strong></td></tr>
<tr><td><strong>Name:&nbsp;</strong>Antonio Middlebrooks<br>
<strong>Age:&nbsp;</strong>41<br>
<strong>Location:&nbsp;</strong>Dandridge Ave. at Riverside Drive<br>
<strong>Details:&nbsp;</strong>On 02/28/25, detectives responded to Dandridge Avenue at Riverside Drive where victim was located in a vehicle suffering from a gunshot wound. Investigation is ongoing.</td></tr>
<tr><td><strong>Name:&nbsp;</strong>Inmer Arita<br>
<strong>Age:&nbsp;</strong>32<br>
<strong>Location:&nbsp;</strong>1933 McCalla Avenue<br>
<strong>Details:&nbsp;</strong>On 12/06/25, detectives responded to 1933 McCalla Avenue.</td></tr>
</tbody></table>
`;

test('Knoxville unsolved HTML parser extracts homicide tip rows', () => {
  const rows = parseKnoxvilleUnsolvedHtml(SAMPLE_HTML);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, 'Antonio Middlebrooks');
  assert.equal(rows[0].location, 'Dandridge Ave. at Riverside Drive');
  assert.equal(rows[0].year, 2025);
  assert.equal(rows[0].crimeType, 'HOMICIDE');
  assert.ok(Number.isFinite(rows[0].timeMs));
});

test('every scoped place has an explicit sex-offender coverage ledger entry', () => {
  for (const id of ['lima-oh', 'beaverdam-oh', 'findlay-oh', 'knoxville-tn']) {
    const row = SEX_OFFENDER_PLACE_COVERAGE[id];
    assert.ok(row, id);
    assert.ok(row.sourceChecked.includes(' ') || row.sourceChecked.length > 8);
    if (row.status === 'empty') assert.match(row.block, /ban|Token|captcha|forbid|wall|resolve/i);
    if (row.status === 'live') assert.ok(row.feed);
  }
});

test('every scoped place has an explicit crime coverage ledger entry', () => {
  assert.equal(CRIME_PLACE_COVERAGE['knoxville-tn'].status, 'live');
  assert.match(CRIME_PLACE_COVERAGE['knoxville-tn'].feed, /unsolved/i);
  assert.equal(CRIME_PLACE_COVERAGE['lima-oh'].status, 'empty');
  assert.match(CRIME_PLACE_COVERAGE['lima-oh'].block, /499|Token/i);
  assert.match(CRIME_PLACE_COVERAGE['findlay-oh'].block, /LexisNexis|programmatic/i);
  const note = coverageNoteForPlaces(
    ['lima-oh', 'findlay-oh'],
    CRIME_PLACE_COVERAGE,
  );
  assert.match(note, /Lima, OH/);
  assert.match(note, /Findlay, OH/);
});
