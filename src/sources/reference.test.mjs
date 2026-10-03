import test from 'node:test';
import assert from 'node:assert/strict';
import { createReferenceSources } from './reference.js';
import { createStandaloneReferenceSources } from '../standalone/layerSources.js';

test('reference factories retain compatibility without starting acquisition or sharing instances', (t) => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', () => {
    requests++;
    throw new Error('unexpected acquisition');
  });
  assert.equal(createReferenceSources, createStandaloneReferenceSources);
  const first = createReferenceSources();
  const second = createReferenceSources();
  assert.deepEqual(Object.keys(first), [
    'earthquakes',
    'fire-perimeters',
    'cables',
    'sex-offenders',
    'crime-incidents',
  ]);
  assert.notEqual(first.earthquakes, second.earthquakes);
  assert.notEqual(first['fire-perimeters'], second['fire-perimeters']);
  assert.notEqual(first.cables, second.cables);
  assert.notEqual(first['sex-offenders'], second['sex-offenders']);
  assert.notEqual(first['crime-incidents'], second['crime-incidents']);
  assert.equal(typeof first.earthquakes.getSnapshot, 'function');
  assert.equal(typeof first['fire-perimeters'].getSnapshot, 'function');
  assert.equal(typeof first.cables.fetch, 'function');
  assert.equal(typeof first['sex-offenders'].getSnapshot, 'function');
  assert.equal(typeof first['crime-incidents'].getSnapshot, 'function');
  assert.equal(requests, 0);
});
