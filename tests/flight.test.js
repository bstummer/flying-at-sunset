import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWorld } from '../tools/world/load.js';

// The flight model (src/flight/flight.js) in Node, over the piece's own world (its seed, 7), without the
// GPU's probe (null: the floor height map is all it has), at the page's time step and at a coarse
// one. Properties, not tuning: the numbers of FLIGHT may change, these promises may not.
const W = await loadWorld({ query: '' });
const { FLIGHT, newBird, updateFlight } = await import('../src/flight/flight.js');
const { DEG } = W;

// Flies a fresh bird for `seconds` with steer(t) = [sx, sy]; calls each(bird, t) every step.
function fly(seconds, steer, { dt = 1 / 60, start, each } = {}) {
  const b = Object.assign(newBird(), start);
  for (let t = 0; t < seconds; t += dt) {
    const [sx, sy] = steer(t);
    updateFlight(b, dt, t, { sx, sy }, null);
    each?.(b, t);
  }
  return b;
}
const finite = (b) => [...b.pos, b.speed, b.bank, b.gamma, b.yaw, ...b.fwd, ...b.up, ...b.right].every(Number.isFinite);

test('a held dive gains speed up to the top speed, and never more', () => {
  let fastest = 0;
  const b = fly(40, () => [0, -1], { start: { pos: [0, 9000, 0] }, each: (b) => { fastest = Math.max(fastest, b.speed); } });
  assert.ok(fastest > 150, `fastest ${fastest.toFixed(0)} m/s`);
  assert.ok(fastest <= FLIGHT.vMax, `fastest ${fastest} m/s, above vMax ${FLIGHT.vMax}`);
  assert.ok(finite(b));
});

test('a climb trades speed for height, and the bird never stalls below its floor speed', () => {
  const start = newBird();
  let slowest = Infinity;
  const b = fly(20, () => [0, 1], { each: (b) => { slowest = Math.min(slowest, b.speed); } });
  assert.ok(b.pos[1] - start.pos[1] > 100, `climbed ${(b.pos[1] - start.pos[1]).toFixed(0)} m`);
  assert.ok(slowest < start.speed - 15, `slowest ${slowest.toFixed(0)} m/s`);
  assert.ok(slowest >= FLIGHT.vStall * 0.8, `slowest ${slowest} m/s, under the floor speed`);
});

test('held in a dive over the sea of clouds, the bird is kept from sinking deep into it', () => {
  for (const dt of [1 / 60, 0.25]) {
    let deepest = Infinity;
    fly(60, () => [0, -1], { dt, each: (b) => { deepest = Math.min(deepest, b.pos[1] - W.seaTopAt(b.pos[0], b.pos[2])); } });
    assert.ok(deepest > -200, `dt ${dt}: ${(-deepest).toFixed(0)} m under the sea's top`);
  }
});

test('the ceiling: climbing from high up, the bird levels off near 11.5 km', () => {
  let highest = 0;
  fly(60, () => [0, 1], { start: { pos: [0, 11000, 0], speed: 120 }, each: (b) => { highest = Math.max(highest, b.pos[1]); } });
  assert.ok(highest < 11800, `up to ${highest.toFixed(0)} m`);
});

test('turning banks the bird and turns it; letting go levels it out', () => {
  const start = newBird();
  const turned = fly(8, () => [1, 0]);
  assert.ok(turned.bank > 45 * DEG && turned.bank <= FLIGHT.maxBank * 1.1, `bank ${(turned.bank / DEG).toFixed(1)}°`);
  assert.ok(turned.yaw - start.yaw > 1, `turned ${((turned.yaw - start.yaw) / DEG).toFixed(0)}°`);
  const released = fly(16, (t) => [t < 8 ? 1 : 0, 0]);
  assert.ok(Math.abs(released.bank) < 3 * DEG && Math.abs(released.gamma) < 3 * DEG, `bank ${released.bank / DEG}°, pitch ${released.gamma / DEG}°`);
});

test('at a coarse time step the springs stay stable and every value finite', () => {
  let widest = 0;
  const b = fly(120, (t) => [Math.sin(t * 0.7), 0.6 * Math.sin(t * 0.31)], { dt: 0.25, each: (b) => { widest = Math.max(widest, Math.abs(b.bank)); } });
  assert.ok(finite(b));
  assert.ok(widest < FLIGHT.maxBank * 1.3, `bank up to ${(widest / DEG).toFixed(0)}°`);
});

test('the same steering flies the same flight', () => {
  const steer = (t) => [Math.sin(t * 0.7), 0.4 * Math.sin(t * 0.45)];
  assert.deepEqual(fly(20, steer), fly(20, steer));
});
