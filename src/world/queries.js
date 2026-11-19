// What the flight, the camera and the test views ask of the world
//
// seaSurfaceAt(x, z): hb, the sea's level; hs, with its domes (cloudTopAt); and the floor the bird
// skims, min(hs, hb + 330) (seaTopAt): heaps piled higher may be flown into. towerDistAt: a rough
// distance to the bubbles (where presets may go); towersNear: the towers' summaries (world/cells.js).
// The domes come from the world's cells, grown as needed; the page, whose world grows in a worker,
// hands over the domes it has around the bird instead (setDomeSource, core/world.js): the same ones
// in the same order, so the same surface.

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
// a rough distance to the bubbles near a point (not the sea): where presets may go
export function towerDistAt(x, y, z, reach = 3000) {
  let d = 1e9;
  forEachSys(x - reach, z - reach, x + reach, z + reach, c => { for (const b of c.bub) if (Math.abs(b.x - x) < b.br + reach && Math.abs(b.z - z) < b.br + reach) d = Math.min(d, ellDist(b, x, y, z)); });
  return d;
}
export function towersNear(x, z, R) {
  const out = [];
  forEachSys(x - R, z - R, x + R, z + R, c => { for (const t of c.towers) if (Math.hypot(t.x - x, t.z - z) < R) out.push(t); });
  return out;
}
