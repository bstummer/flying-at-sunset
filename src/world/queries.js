// What the flight, the camera and the test views ask of the world

import { seaLevelAt } from './air.js';
import { domeHeightAt, ellDist, smaxJS } from './shapes.js';
import { forEachDome, forEachSys } from './cells.js';

// the sea surface the bird skims (heaps piled high above it may be entered) and the full top
function seaSurfaceAt(x, z) {
  const hb = seaLevelAt(x, z);
  let hs = hb;
  forEachDome(x, z, x, z, d => { const v = domeHeightAt(d, x, z); if (v > -1e8) hs = smaxJS(hs, v, 0.12 * d.h + 25); });
  return { hb, hs, floor: Math.min(hs, hb + 330) };
}
export const seaTopAt = (x, z) => seaSurfaceAt(x, z).floor;
export const cloudTopAt = (x, z) => seaSurfaceAt(x, z).hs;
// rough distance to the large shapes (bubbles and the sea surface): where presets may go
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
