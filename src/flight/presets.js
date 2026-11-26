// Where the bird starts for the test views (?preset=..., ?pose=...)
//
// Around the start: start sun away side skim high bank fastdive humps high2 upward. At towers the
// world generated within 200 km, picked sunlit and in clear sight: tower giant far close approach
// inside under. presetPose runs in the
// world's worker (src/worker.js), and only when a preset is asked for: the search takes seconds;
// placeBird puts the page's bird there, then at ?pose (main.js).

import { lerp, PI } from '../math.js';
import { SUN_DIR } from '../constants.js';
import { forEachSys } from '../world/cells.js';
import { START_UP } from './flight.js';
import { cloudTopAt, seaTopAt, towerDistAt, towersNear } from '../world/queries.js';

// where preset `pre` puts the bird: { x, y, z, yaw, gamma, bank, speed } (what is left out: 0, or
// as it was: the start's heading is the screen's), or { refused: why } (a test capture with the
// start in its place would pass)
export function presetPose(pre) {
  const sea0 = seaTopAt(0, 0);
  const presets = {
    start: { y: sea0 + START_UP, gamma: 0 },
    sun: { y: sea0 + 900, yaw: 0.0, gamma: -0.06 },
    away: { y: sea0 + 900, yaw: PI, gamma: -0.06 },
    side: { y: sea0 + 850, yaw: PI / 2, gamma: -0.05 },
    // (in the billows, which rise 300-380 m over the sea's top here: the skim flight dives through
    // them, tools/flights.js; the skim view looks from just over them, tools/views.js)
    skim: { y: sea0 + 170, yaw: 0.35, gamma: -0.03 },
    high: { y: 6200, yaw: -0.4, gamma: -0.25 },
    bank: { y: sea0 + 1000, yaw: 0.6, gamma: 0, bank: 0.7 },
    fastdive: { y: sea0 + 420, yaw: 0.5, gamma: -0.55, speed: 150 },
    humps: { x: 0, z: 0, y: sea0 + 260, yaw: 0.1, gamma: -0.03 },
    high2: { x: 0, z: 0, y: 5200, yaw: 0.1, gamma: -0.12 },
    upward: { x: 0, z: 0, y: sea0 + 900, yaw: -0.5, gamma: 0.42 },
  };
  // views of generated towers near the start: from a distance with the sun to the side, close
  // under one, inside one
  const ts = towersNear(0, 0, 200000).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  // walk out from a tower (from dmin on) until the air is clear of every tower by `gap` and of the
  // sea's heaps, and nothing stands between there and the tower (sight: up against its flank, the
  // flank is what is in view, and a line toward its middle runs into its own body)
  const clearOf = (t, dir, y, gap, dmin = 0, sight = true) => {
    const ym = lerp(t.y0, t.top, 0.4);
    for (let d = Math.max(t.R0, dmin); d < t.R0 * 6 + 60000; d += 400) {
      const x = t.x + Math.cos(dir) * d, z = t.z + Math.sin(dir) * d, yy = y === null ? seaTopAt(x, z) + 900 : y;
      if (yy < cloudTopAt(x, z) + 650 || towerDistAt(x, yy, z, Math.min(gap, 4000) + 1000) < gap) continue;
      let seen = true;
      for (let f = 0.03; f < 0.7 && seen && sight; f += 0.05) {
        const px = lerp(x, t.x, f), pz = lerp(z, t.z, f), py = lerp(yy, ym, f);
        if (py < cloudTopAt(px, pz) + 150 || towerDistAt(px, py, pz, 1500) < 0) seen = false;
      }
      if (seen) return { x, z, y: yy, yaw: Math.atan2(t.x - x, -(t.z - z)) };
    }
    return null;
  };
  // seen from the sun's side (the sun behind the viewer, a little to one side); prefer towers whose
  // sunward face no other tower shades
  const sideDir = -PI / 2 + 1.1;
  const sunlit = t => {
    const H = t.top - t.y0;
    for (const f of [0.35, 0.6]) {
      const x0 = t.x, y0 = t.y0 + H * f, z0 = t.z - t.R0 * 1.4;
      for (let s = 2000; s < 90000; s += 1500) if (towerDistAt(x0 + SUN_DIR[0] * s, y0 + SUN_DIR[1] * s, z0 + SUN_DIR[2] * s, 2500) < 0) return false;
    }
    return true;
  };
  const big = ts.filter(t => t.top > 8000 && Math.hypot(t.x, t.z) < 70000);
  // the nearest place around a tower's sunward side with such a view (the sun behind the viewer,
  // to one side or the other: a neighbour may stand in any one of them)
  const sideOf = (t, y, gap, dmin) => {
    let best = null;
    for (const a of [1.1, 0.8, 1.4, -1.1, -0.8, -1.4]) {
      const v = clearOf(t, -PI / 2 + a, y, gap, dmin);
      if (v && (!best || Math.hypot(v.x - t.x, v.z - t.z) < Math.hypot(best.x - t.x, best.z - t.z))) best = v;
    }
    return best;
  };
  // (the nearest with such a view, sunlit ones first; from 9 km or its own height away, whichever is more)
  let bt = null;
  for (const t of [...big.filter(sunlit), ...big]) {
    const v = sideOf(t, t.y0 + 1500, 2500, Math.max(9000, 1.1 * (t.top - t.y0)));
    if (v) { presets.tower = Object.assign(v, { gamma: 0.1 }); bt = t; break; }
  }
  bt ??= big[0] || ts[0];
  // (the tallest, from a little over twice its height away and a quarter of the way up it, over
  // the sea's heaps: its top near the frame's, its width half the frame's or more; from the sun's
  // side, lit from either side, wherever it is nearest in clear sight; in a crowd, the next tallest
  // that can be seen)
  const tallest = [...big].sort((a, b) => b.top - a.top);
  for (const g of tallest) {
    let best = null;
    for (const a of [1.1, 0.8, 0.5, -0.5, -0.8, -1.1]) {
      const v = clearOf(g, -PI / 2 + a, g.y0 + 0.25 * (g.top - g.y0), 3000, 2.2 * (g.top - g.y0));
      if (v && (!best || Math.hypot(v.x - g.x, v.z - g.z) < Math.hypot(best.x - g.x, best.z - g.z))) best = v;
    }
    if (best) { presets.giant = Object.assign(best, { gamma: 0.1 }); break; }
  }
  // (a tall tower from high up and far off, against the sun, as from an airliner: the tallest with
  // such a place)
  for (const g of tallest) {
    const v = clearOf(g, PI / 2 + 0.08, 7000, 3000, 40000);
    if (v) { presets.far = Object.assign(v, { gamma: 0.02 }); break; }
  }
  // up against a flank, under it, 1.5 km off its bubbles (their billows reach some hundreds of
  // metres out), where the sun reaches the flank in view: the nearest big tower with such a place
  const flankLit = v => {
    let d = 0, y = v.y + 600;
    const dx = Math.sin(v.yaw), dz = -Math.cos(v.yaw);
    while (d < 4000 && towerDistAt(v.x + dx * d, y, v.z + dz * d, 1500) > 150) d += 100;
    for (let s = 300; s < 60000; s += 800) if (towerDistAt(v.x + dx * d + SUN_DIR[0] * s, y + SUN_DIR[1] * s, v.z + dz * d + SUN_DIR[2] * s, 1500) < 0) return false;
    return d < 4000;
  };
  for (const t of big) {
    const v = clearOf(t, sideDir, t.y0 + 1100, 1500, 3000, false);
    if (v && flankLit(v)) { presets.close = Object.assign(v, { gamma: 0.42 }); break; }
  }
  if (bt) {
    const w = sideOf(bt, bt.y0 + 1500, 5000, 7000);
    if (w) presets.approach = Object.assign(w, { gamma: 0.0 });
    presets.inside = { x: bt.x, z: bt.z, y: bt.y0 + (bt.top - bt.y0) * 0.4, yaw: 0.3, gamma: 0.0 };
  }
  // under an overhang: beneath the outer part of a big turret of a tower with clear air below it
  // (where a tower leans out over the sea, in strongly sheared air), looking up at it and in toward
  // the tower: of the towers nearest the start, the place with the most room (most towers have
  // none, and some worlds: the heaps stand on their feet)
  let under = null;
  for (const t of ts.slice(0, 48)) {
    forEachSys(t.x - 30000, t.z - 30000, t.x + 30000, t.z + 30000, c => {
      for (const b of c.bub) if (b.cell === t.cell && b.rh > 600) for (let q = 0; q < 8; q++) {
        const x = b.x + Math.cos(q * PI / 4) * 0.7 * b.rh, z = b.z + Math.sin(q * PI / 4) * 0.7 * b.rh, bottom = b.y - 0.71 * b.ryD;
        const y = Math.max(cloudTopAt(x, z) + 600, bottom - 1000);
        if (y > bottom - 400) continue;
        const room = towerDistAt(x, y, z, 3500);
        if (room > 600 && (!under || room > under.room)) under = { room, x, z, y, yaw: Math.atan2(t.x - x, -(t.z - z)), gamma: 0.42 };
      }
    });
    if (under) break;
  }
  if (under) presets.under = under;
  // (only the table's own entries, not what every object inherits, such as "constructor")
  const towers = ['tower', 'giant', 'far', 'close', 'approach', 'inside', 'under'];
  if (!Object.hasOwn(presets, pre)) return { refused: towers.includes(pre) ? `this world has no place for the preset "${pre}"` : `no preset "${pre}"` };
  return presets[pre];
}
// the bird b at a preset's pose p (presetPose), then at ?pose ([x, y, z, yaw, pitch, bank, speed])
export function placeBird(b, p, pose) {
  if (p) {
    b.pos = [p.x || 0, p.y, p.z || 0];
    b.yaw = p.yaw ?? b.yaw; b.gamma = p.gamma; b.bank = p.bank || 0;
    if (p.speed) b.speed = p.speed;
  }
  if (pose) { b.pos = [pose[0], pose[1], pose[2]]; b.yaw = pose[3] || 0; b.gamma = pose[4] || 0; b.bank = pose[5] || 0; if (pose[6]) b.speed = pose[6]; }
}
