// What the flight, the camera and the test views ask of the world
//
// seaSurfaceAt(x, z): hb, the sea's level; hs, with its domes (cloudTopAt); and the floor the bird
// skims, min(hs, hb + 330) (seaTopAt): heaps piled higher may be flown into. towerDistAt: a rough
// distance to the bubbles, united as the bake unites them (where presets may go); towersNear: the towers' summaries (world/cells.js);
// liftAt: the air rising around living towers.
// The domes come from the world's cells, grown as needed; the page, whose world grows in a worker,
// hands over the domes it has around the bird instead (setDomeSource, core/world.js): the same ones
// in the same order, so the same surface.

import { smoothstep } from '../math.js';
import { seaLevelAt } from './air.js';
import { domeBlend, domeHeightAt, ellDist, smaxJS } from './shapes.js';
import { forEachDome, forEachSys } from './cells.js';

// the sea surface the bird skims (heaps piled high above it may be entered) and the full top
let domesAt = (x, z, fn) => forEachDome(x, z, x, z, fn);
// fn(x, z, each): calls each(d) for every dome forEachDome(x, z, x, z) calls it for, in its order
export function setDomeSource(fn) { domesAt = fn; }
export function seaSurfaceAt(x, z) {
  const hb = seaLevelAt(x, z);
  let hs = hb;
  domesAt(x, z, d => { const v = domeHeightAt(d, x, z); if (v > -1e8) hs = smaxJS(hs, v, domeBlend(d.h)); });
  return { hb, hs, floor: Math.min(hs, hb + 330) };
}
export const seaTopAt = (x, z) => seaSurfaceAt(x, z).floor;
export const cloudTopAt = (x, z) => seaSurfaceAt(x, z).hs;
// a rough distance to the bubbles near a point (not the sea), united as the bake unites them (the
// fillets between them fill the corners a turret makes with its tower): where presets may go
const sminJS = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
export function towerDistAt(x, y, z, reach = 3000) {
  let d = 1e9;
  forEachSys(x - reach, z - reach, x + reach, z + reach, c => { for (const b of c.bub) if (Math.abs(b.x - x) < b.br + reach && Math.abs(b.z - z) < b.br + reach) d = sminJS(d, ellDist(b, x, y, z), b.k); });
  return d;
}
// The air rising around living towers (m/s), which carries the bird up their flanks and through
// them: a tower's own (cells.js: its strength while it lives) within LIFT_REACH of its bubbles,
// fading out over its head and under the ceiling. The page's world sends the bubbles over the
// bird's patch (liftBubbles; setLiftSource, core/world.js), as it does the domes.
export const LIFT_REACH = 1200;
const liftBubble = b => ({ x: b.x, y: b.y, z: b.z, rh: b.rh, ryU: b.ryU, ryD: b.ryD, an: b.an, ang: b.ang, br: b.br, w: b.cell.lift, top: b.cell.top });
// the bubbles of living towers whose rising air reaches into the box
export function liftBubbles(x0, z0, x1, z1) {
  const out = [], m = LIFT_REACH;
  forEachSys(x0 - m, z0 - m, x1 + m, z1 + m, c => {
    for (const b of c.bub) if (b.cell.lift > 0 && b.x + b.br + m > x0 && b.x - b.br - m < x1 && b.z + b.br + m > z0 && b.z - b.br - m < z1) out.push(liftBubble(b));
  });
  return out;
}
let liftsAt = (x, z, fn) => { for (const b of liftBubbles(x, z, x, z)) fn(b); };
// fn(x, z, each): calls each(b) for (at least) every bubble liftBubbles(x, z, x, z) gives
export function setLiftSource(fn) { liftsAt = fn; }
export function liftAt(x, y, z) {
  let w = 0;
  liftsAt(x, z, b => {
    if (b.w <= w || Math.abs(b.x - x) > b.br + LIFT_REACH || Math.abs(b.z - z) > b.br + LIFT_REACH || y > b.top + 300) return;
    w = Math.max(w, b.w * smoothstep(LIFT_REACH, 150, ellDist(b, x, y, z)) * smoothstep(b.top + 300, b.top - 500, y));
  });
  return w * smoothstep(11600, 11000, y);
}
export function towersNear(x, z, R) {
  const out = [];
  forEachSys(x - R, z - R, x + R, z + R, c => { for (const t of c.towers) if (Math.hypot(t.x - x, t.z - z) < R) out.push(t); });
  return out;
}
