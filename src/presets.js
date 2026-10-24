// Test views (?preset=..., ?pose=...): where the bird starts

import { Q } from './params.js';
import { lerp, PI } from './math.js';
import { SUN_DIR } from './constants.js';
import { forEachSys } from './world/cells.js';
import { cloudTopAt, seaTopAt, towerDistAt, towersNear } from './world/queries.js';
import { bird_ } from './flight.js';

function readPreset() {
  const pre = Q.get('preset');
  if (!pre) return;     // (the test views look for towers far around: only when one is asked for)
  const sea0 = seaTopAt(0, 0);
  const presets = {
    start: { y: sea0 + 750, yaw: 0.45, gamma: 0 },
    sun: { y: sea0 + 900, yaw: 0.0, gamma: -0.06 },
    away: { y: sea0 + 900, yaw: PI, gamma: -0.06 },
    side: { y: sea0 + 850, yaw: PI / 2, gamma: -0.05 },
    skim: { y: sea0 + 170, yaw: 0.35, gamma: -0.03 },
    high: { y: 6200, yaw: -0.4, gamma: -0.25 },
    bank: { y: sea0 + 1000, yaw: 0.6, gamma: 0, bank: 0.7 },
    fastdive: { y: sea0 + 420, yaw: 0.5, gamma: -0.55, speed: 150 },
    humps: { x: 0, z: 0, y: sea0 + 260, yaw: 0.1, gamma: -0.03 },
    high2: { x: 0, z: 0, y: 5200, yaw: 0.6, gamma: -0.12 },
    upward: { x: 0, z: 0, y: sea0 + 900, yaw: -0.5, gamma: 0.42 },
  };
  // views of generated towers near the start: from a distance with the sun to the side, close
  // under one, inside one
  const ts = towersNear(0, 0, 200000).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  // walk out from a tower (from dmin on) until the air is clear of every tower by `gap` and of the
  // sea's heaps, and nothing stands between there and the tower
  const clearOf = (t, dir, y, gap, dmin = 0) => {
    const ym = lerp(t.y0, t.top, 0.4);
    for (let d = Math.max(t.R0, dmin); d < t.R0 * 6 + 60000; d += 400) {
      const x = t.x + Math.cos(dir) * d, z = t.z + Math.sin(dir) * d, yy = y === null ? seaTopAt(x, z) + 900 : y;
      if (yy < cloudTopAt(x, z) + 650 || towerDistAt(x, yy, z, Math.min(gap, 4000) + 1000) < gap) continue;
      let seen = true;
      for (let f = 0.1; f < 0.7 && seen; f += 0.1) {
        const px = lerp(x, t.x, f), pz = lerp(z, t.z, f), py = lerp(yy, ym, f);
        if (py < cloudTopAt(px, pz) + 150 || towerDistAt(px, py, pz, 1500) < 0) seen = false;
      }
      if (seen) return { x, z, y: yy, yaw: Math.atan2(t.x - x, -(t.z - z)) };
    }
    return null;
  };
  // seen from the sun's side (the sun behind the viewer, a little to one side); prefer towers whose
  // sunward face no other tower shades
  const sideDir = t => -PI / 2 + 1.1;
  const sunlit = t => {
    const H = t.top - t.y0;
    for (const f of [0.35, 0.6]) {
      const x0 = t.x, y0 = t.y0 + H * f, z0 = t.z - t.R0 * 1.4;
      for (let s = 2000; s < 90000; s += 1500) if (towerDistAt(x0 + SUN_DIR[0] * s, y0 + SUN_DIR[1] * s, z0 + SUN_DIR[2] * s, 2500) < 0) return false;
    }
    return true;
  };
  const big = ts.filter(t => t.top > 8000 && Math.hypot(t.x, t.z) < 70000);
  const bt = big.find(sunlit) || big[0] || ts[0];
  if (bt) { const v = clearOf(bt, sideDir(bt), null, 2500, 9000); if (v) presets.tower = Object.assign(v, { gamma: 0.12 }); }
  if (big.length) {
    const g = big.reduce((a, b) => b.top > a.top ? b : a), v = clearOf(g, sideDir(g), null, 25000);
    if (v) presets.giant = Object.assign(v, { gamma: 0.06 });
  }
  // (an anvil is nothing the world makes on purpose: a tower that hit the ceiling and spread wide)
  const isAnvil = t => t.top > t.ceil - 700 && t.wide > Math.max(2.5 * t.R0, 9000);
  const anv = ts.find(t => isAnvil(t) && sunlit(t)) || ts.find(isAnvil);
  // (seen from high up and far off, against the sun, as from an airliner)
  if (anv) { const v = clearOf(anv, PI / 2 + 0.08, 7000, 3000, 50000); if (v) presets.anvil = Object.assign(v, { gamma: 0.02 }); }
  if (bt) {
    const v = clearOf(bt, sideDir(bt), bt.y0 + 1100, 900, 3000);
    if (v) presets.close = Object.assign(v, { gamma: 0.32 });
    const w = clearOf(bt, sideDir(bt), bt.y0 + 1500, 5000, 7000);
    if (w) presets.approach = Object.assign(w, { gamma: 0.0 });
    presets.inside = { x: bt.x, z: bt.z, y: bt.y0 + (bt.top - bt.y0) * 0.4, yaw: 0.3, gamma: 0.0 };
  }
  // under an overhang: beneath a big dome of a tower with clear air below it, looking up at it
  for (const t of ts.slice(0, 16)) {
    const bs = [];
    forEachSys(t.x - 30000, t.z - 30000, t.x + 30000, t.z + 30000, c => { for (const b of c.bub) if (b.cell === t.cell && b.rh > 700) bs.push(b); });
    bs.sort((a, b) => b.rh - a.rh);
    let found = null;
    for (const b of bs) {
      const bottom = b.y - b.ryD;
      let top = cloudTopAt(b.x, b.z);
      for (let q = 0; q < 8; q++) top = Math.max(top, cloudTopAt(b.x + Math.cos(q * 0.785) * 900, b.z + Math.sin(q * 0.785) * 900));
      const y = Math.max(top + 800, bottom - 1500);
      if (y > bottom - 700 || towerDistAt(b.x, y, b.z, 2500) < 1000) continue;
      found = { x: b.x, z: b.z, y, yaw: Math.atan2(t.x - b.x, -(t.z - b.z)), gamma: 0.42 };
      break;
    }
    if (found) { presets.under = found; break; }
  }
  const p = presets[pre];
  if (!p) return;
  bird_.pos = [p.x || 0, p.y, p.z || 0];
  bird_.yaw = p.yaw; bird_.gamma = p.gamma; bird_.bank = p.bank || 0;
  if (p.speed) bird_.speed = p.speed;
}
readPreset();
if (Q.has('pose')) {
  const v = Q.get('pose').split(',').map(Number);
  bird_.pos = [v[0], v[1], v[2]]; bird_.yaw = v[3] || 0; bird_.gamma = v[4] || 0; bird_.bank = v[5] || 0;
}
