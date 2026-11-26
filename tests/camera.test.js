// The chase camera (src/flight/camera.js) in Node, following the flight model over the piece's own
// world: where the bird sits in the frame on screens of three shapes. Properties, not tuning: the
// camera's numbers may change, these promises may not (CLAUDE.md §1: the bird stays whole in the
// frame, in a long climb too, and the frame is composed on tall screens as on wide ones).

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWorld } from '../tools/world/load.js';

await loadWorld({ query: '' });
const { bird_, newBird, updateFlight } = await import('../src/flight/flight.js');
const { cam, updateCamera } = await import('../src/flight/camera.js');

const SHAPES = { wide: 16 / 9, tablet: 3 / 4, phone: 9 / 19.5 };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// a point on screen, as fractions of the frame from its top left
function onScreen(p, aspect) {
  const d = [0, 1, 2].map((i) => p[i] - cam.pos[i]);
  const z = dot(d, cam.fwd), ty = Math.tan(cam.fov / 2), tx = ty * aspect;
  return [0.5 + 0.5 * dot(d, cam.right) / z / tx, 0.5 - 0.5 * dot(d, cam.up) / z / ty];
}
// the bird's ends: its wingtips (raised by their dihedral), head and tail
const ends = (b) => [[0.52, 0.13, 0], [-0.52, 0.13, 0], [0, 0.15, -0.5], [0, 0.09, 0.45]]
  .map(([r, u, back]) => [0, 1, 2].map((i) => b.pos[i] + r * b.right[i] + u * b.up[i] - back * b.fwd[i]));

// Flies the bird for `seconds` with steer(t) = [sx, sy] and the camera after it on a screen of
// `aspect`; calls each(t) every step.
function fly(seconds, steer, aspect, { start, each } = {}) {
  const dt = 1 / 60;
  Object.assign(bird_, newBird(), start);
  for (let t = 0, k = 0; t < seconds; t += dt, k++) {
    const [sx, sy] = steer(t);
    updateFlight(bird_, dt, t, { sx, sy }, null);
    updateCamera(dt, k === 0, t, aspect, 0);
    each?.(t);
  }
}

test('in level flight the bird sits low in the middle of the frame, 80% down it, on wide screens and tall ones', () => {
  for (const [shape, aspect] of Object.entries(SHAPES)) {
    fly(4, () => [0, 0], aspect);
    const [x, y] = onScreen(bird_.pos, aspect);
    assert.ok(Math.abs(y - 0.8) < 0.03, `${shape}: ${(100 * y).toFixed(0)}% down the frame`);
    assert.ok(Math.abs(x - 0.5) < 0.02, `${shape}: ${(100 * x).toFixed(0)}% across`);
  }
});

test('the bird stays whole in the frame: in a held climb, a held dive and turns at full bank', () => {
  const flights = {
    climb: [40, () => [0, 1]],
    dive: [20, () => [0, -1], { pos: [0, 9000, 0] }],
    weave: [24, (t) => [Math.sin(t * 0.8) > 0 ? 1 : -1, 0]],
    'climbing turn': [24, () => [1, 1]],
  };
  const out = [];
  for (const [shape, aspect] of Object.entries(SHAPES)) {
    for (const [name, [seconds, steer, start]] of Object.entries(flights)) {
      let worst = null;
      fly(seconds, steer, aspect, {
        start,
        each: (t) => {
          if (t < 1) return;
          for (const p of ends(bird_)) {
            const [x, y] = onScreen(p, aspect);
            const out = Math.max(-x, x - 1, -y, y - 1);
            if (!worst || out > worst.out) worst = { out, x, y, t };
          }
        },
      });
      if (worst.out > -0.02) out.push(`${shape}, ${name}: a tip of the bird at ${(100 * worst.x).toFixed(0)}% across, ${(100 * worst.y).toFixed(0)}% down, ${worst.t.toFixed(1)} s in`);
    }
  }
  assert.deepEqual(out, []);
});
