// The shared constants (src/constants.js): the detail volume's turn keeps its domes from repeating
// along a level stretch of cloud

import test from 'node:test';
import assert from 'node:assert/strict';
import { DETAIL_ROT, DETAIL_TILE } from '../src/constants.js';
import { mat3Apply } from '../src/math.js';

test('the detail volume\'s turn is a rotation', () => {
  const R = DETAIL_ROT, row = i => R.slice(i * 3, i * 3 + 3);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) assert.ok(Math.abs(dot(row(i), row(j)) - (i === j ? 1 : 0)) < 1e-12);
  const det = R[0] * (R[4] * R[8] - R[5] * R[7]) - R[1] * (R[3] * R[8] - R[5] * R[6]) + R[2] * (R[3] * R[7] - R[4] * R[6]);
  assert.ok(Math.abs(det - 1) < 1e-12);
});

// The tile repeats along its lattice: a world vector w shows the same pattern where DETAIL_ROT w is a
// multiple of the tile on every axis. On a level stretch (w level) that never happens nearby: every
// such w leaves the level by at least `miss` metres within `reach`.
test('a level stretch meets no copy of the detail nearby', () => {
  const RT = [0, 3, 6, 1, 4, 7, 2, 5, 8].map(i => DETAIL_ROT[i]);    // the inverse turn
  for (const [reach, miss] of [[1500, 26], [3000, 12]]) {
    let worst = Infinity;
    for (let a = -8; a <= 8; a++) for (let b = -8; b <= 8; b++) for (let c = -8; c <= 8; c++) {
      if (!a && !b && !c) continue;
      const w = mat3Apply(RT, [a * DETAIL_TILE, b * DETAIL_TILE, c * DETAIL_TILE]);
      if (Math.hypot(w[0], w[2]) <= reach) worst = Math.min(worst, Math.abs(w[1]));
    }
    assert.ok(worst >= miss, `within ${reach} m a copy lies ${worst.toFixed(1)} m off the level (at least ${miss} m)`);
  }
});
