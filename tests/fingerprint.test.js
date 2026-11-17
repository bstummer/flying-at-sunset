// The world's fingerprint (tools/world/fingerprint.js): a part tells values, and the places they come
// in, apart, allowing only for the last bit of rounding (tests/world.test.js compares the world)

import test from 'node:test';
import assert from 'node:assert/strict';
import { differences, summary } from '../tools/world/fingerprint.js';

const fp = (values) => ({ parts: { part: summary(values) } });

test('a fingerprint part tells the same values apart from other values, and from the same values in another place', () => {
  const values = Array.from({ length: 300 }, (_, k) => Math.sin(k) * 1000);
  assert.deepEqual(differences(fp(values), fp([...values])), []);
  assert.equal(differences(fp(values), fp(values.map((v, k) => (k === 7 ? v + 1 : v)))).length, 1, 'one value changed');
  const swapped = [...values];
  [swapped[3], swapped[200]] = [swapped[200], swapped[3]];
  assert.equal(differences(fp(values), fp(swapped)).length, 1, 'two values swapped');
  assert.equal(differences(fp(values), fp(values.slice(0, 299))).length, 1, 'one value fewer');
});

test('a fingerprint part allows for the last bit of rounding, not more', () => {
  const values = Array.from({ length: 300 }, (_, k) => Math.exp(Math.sin(k)) * 900);
  assert.deepEqual(differences(fp(values), fp(values.map((v) => v * (1 + 2 ** -50)))), []);
  assert.equal(differences(fp(values), fp(values.map((v) => v * (1 + 1e-6)))).length, 1);
});
