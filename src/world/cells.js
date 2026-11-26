// Convective cells: places where bubbles keep rising for a while
//
// - Sites (tierSites): a cell's potential P, the size of its strongest bubbles, follows a power law,
//   with more cells where the air is restless (×TOWER_RATE, ?towers); they are kept in three grids
//   ("tiers") by size, 8, 16 and 32 km across.
// - growCell: a cell sends up pulses through its life, weak as it builds up, strongest in its prime;
//   no bubble bigger than R_TH (a bigger cell sends more of them). Each pulse is lifted alone first
//   (thermals.js): if it rises past H_FLAT it is tall, a heap of turrets (3D bubbles: heap), else
//   what it shed is grown and its pieces become 2D domes on the sea. Each 3D bubble carries how big
//   its billows are (bs: its own size to half again, drawn per bubble: a turret carries lobes, the
//   shaders grow them only on big ones) and how lively (act: young ones 1, fading with age, sooner
//   in the body: old parts soften).
// - subsidenceAt: air sinking around a stronger cell nearby holds weaker ones down (a stronger
//   inversion, less buoyancy, a lower top), which spaces the towers. A cell's outflow also sets off
//   younger cells near it, mostly downwind, two generations deep.
// - tierCell grows the cells of one grid cell, dropping a cell's 3D bubbles if any comes near the
//   bird's start, bubbles a bigger one holds (pruneBubbles) or the others hide between them
//   (dropBuried; not for the coarsest level, whose towers have few turrets) and pieces that don't hang together with the sea (dropAdrift: cut off, they would
//   evaporate first), and sums up each tower for the test
//   views and the tools. Grid cells are cached (separately for the coarsest clipmap level, grown
//   without the pieces under 600 m); worldGC forgets far ones. What a place holds never depends on
//   what was asked before (tests/world.test.js). forEachDome, forEachSys: what lies over a box.
// - The spawn draw (spawnDraw, once, in the world's worker): the weather (the restless air, REST_O,
//   and the grids of sites, SITE_O) is moved against the sea until one of its strong cells stands
//   ahead of the start as the first tower, beside the sun, where the bird flies into its rising air
//   if it just flies on, with towers near and far around it but toward the sun; ?weather moves it
//   so instead. If the sun's azimuth, the start's heading or the
//   wind change, revisit its bearings. A living tower's air rises (lift: queries.js's liftAt).

import { params } from '../core/params.js';
import { clamp, lerp, mulberry32, PI, sat } from '../math.js';
import { cellRng, gauss, hashU, poisson } from './noise.js';
import { airAt, REST_O, restAt, seaLevelAt, setRestOffset, warpAt } from './air.js';
import { ellDist } from './shapes.js';
import { H_FLAT, headUp, heap, lift, nearStart, placeDome, R_TH, replay, settle, setStartY, START_Y } from './thermals.js';

// A cell is a place where bubbles keep rising for a while. Its potential P (m) is the size of the
// strongest bubbles it can send up: small cells are common, big ones rare (a power law), a little
// more of them where the air is restless. Calm air holds even big ones down under its inversion
// (they spread out into broad low heaps); restless air lets them through. It sends bubbles up at
// intervals, weak while it builds up, strongest in its prime, dying down at the end; it may also
// drift. Cells are kept by size in grids of three sizes (only for quick lookups).
const P_MIN = 600, ALPHA = 2.0, P_CUT = 2800;
const TOWER_RATE = params.towers ?? 1;
const cellDensity = I => 0.36e-6 * (0.12 + 0.88 * I);       // cells per m^2 with P > P_MIN
const TIERS = [
  { S: 8000, pa: P_MIN, pb: 1000, salt: 0x4ea9, small: true, cache: new Map(), coarse: new Map(), sites: new Map() },
  { S: 16000, pa: 1000, pb: 3000, salt: 0x51a3, cache: new Map(), coarse: new Map(), sites: new Map() },
  { S: 32000, pa: 3000, pb: 8000, salt: 0x70e5, cache: new Map(), coarse: new Map(), sites: new Map() },
];
const TIER_REACH = 2;   // grid cells: how far a cell's clouds may reach from its own grid cell
const LIFT = 30;        // m/s: the rising air of the strongest living tower
// (m) how far the grids are shifted against the sea: the spawn draw's, with the restless air's REST_O
let SITE_O = [0, 0];
// coarse: for the coarsest clipmap level, every pulse grown as for the others but without the pieces
// under COARSE_R, which it can't hold (grown across its 524 km they would take seconds), and of a
// tower's turrets only those of COARSE_T or more (its cells are 2 km: a body without turrets
// keeps a wake's width, about what they add up to): its heaps and towers are the others'
// (tools/world/levels.js)
const COARSE_R = 600, COARSE_T = 1400;
function growCell(c, coarse, out3, out2) {
  const A = c.A, rng = mulberry32(c.seed);
  const C = { A, age: c.age, depth: c.P < 1000 ? 2 : 3, log: null, paths: [], heads: [] };
  // the top of the cloud the earlier bubbles have built by time t (they rise through it)
  C.cloudTop = t => {
    let top = -1e9;
    for (const p of C.paths) {
      const n = p.length;
      if (t < p[0]) continue;
      if (t >= p[n - 2]) { if (t - p[n - 2] < 1500) top = Math.max(top, p[n - 1]); continue; }
      for (let i = 2; i < n; i += 2) if (p[i] >= t) { top = Math.max(top, p[i - 1] + (p[i + 1] - p[i - 1]) * (t - p[i - 2]) / Math.max(p[i] - p[i - 2], 1e-3)); break; }
    }
    return top;
  };
  // bubbles are never much bigger than the layer they rise from is deep: a big cell sends up more
  // of them, not bigger ones
  const pr = Math.min(c.P, R_TH), gap = 240 * Math.pow(pr / 1000, 0.3) * Math.min(1, Math.pow(R_TH / c.P, 2));
  // the sea around it, as a plane (level, slope x, slope z, at x, z)
  const zc = A.zs, sea = [zc, (seaLevelAt(c.x + 500, c.z) - zc) / 500, (seaLevelAt(c.x, c.z + 500) - zc) / 500, c.x, c.z];
  let k = 0;
  for (let t = gap * rng(); t < c.age && k < 24; t += gap * lerp(0.6, 1.4, rng()), k++) {
    const u = t / c.life, a = rng() * 2 * PI, q = rng(), gs = gauss(rng), seed = (rng() * 4294967296) >>> 0;
    const s = u < 1 ? Math.pow(Math.sin(PI * u), 0.5) * Math.exp(0.3 * gs) : 0;
    if (s < 0.1) continue;
    const r0 = pr * lerp(0.35, 1, Math.min(s, 1)), w0 = (1.5 + 4.5 * Math.sqrt(r0 / 1000)) * lerp(0.75, 1.1, Math.min(s, 1));
    const rho = 0.6 * c.P * Math.sqrt(q) * (1 - 0.5 * Math.min(s, 1));
    const lx = c.x + c.vx * (t - c.age) + Math.cos(a) * rho, lz = c.z + c.vz * (t - c.age) + Math.sin(a) * rho;
    const zs = clamp(sea[0] + sea[1] * (lx - sea[3]) + sea[2] * (lz - sea[4]), zc - 1500, zc + 1500);
    // the bubble alone first: how high it gets decides whether this pulse stays low; then what it
    // shed (its path is the same whatever it sheds: that draws from streams of its own)
    const path = [t, zs], log = [], list = [];
    Object.assign(C, { log, path, top: -1e9 });
    const hd = lift(C, lx, zs - 0.6 * r0, lz, r0, w0, 1, t, 0, 0, C.depth, mulberry32(seed), [], null);
    const tall = Math.max(C.top, hd.y + headUp(A, hd)) >= zs + H_FLAT;
    path.push(Math.max(hd.t, t + 1), hd.y + 0.5 * hd.r);
    Object.assign(C, { log: null, minR: coarse ? COARSE_R : 150 });
    C.paths.push(path);
    if (!hd.still) C.heads.push(hd);
    // what it left, aged to the moment the world shows: a low pulse as domes on the sea (2D: heads
    // and lobes, each on the dome of what it grew from), a tall one as a heap of turrets (3D
    // bubbles, none under 420 m: the billows are that size)
    const pieces = [];
    if (!tall) {
      replay(C, log, hd, list);
      list.sort((p, q) => q.depth - p.depth);
      for (const e of list) {
        pieces.length = 0;
        const hp = settle(c, e, pieces);
        if (!hp) continue;
        hp.parent = e.parent && e.parent.piece;
        e.piece = hp;
        for (const p of pieces) placeDome(p, sea, out2);
      }
    } else {
      heap(c, zs, log.filter(e => !Array.isArray(e)), hd, seed ^ 0x5bd1e995, coarse ? COARSE_T : 420, pieces);
      for (const p of pieces) {
        if (Math.max(p.rh, p.ryU) < 200 || p.y + p.ryU < zs - 150) continue;
        const rmin = Math.min(p.rh * Math.min(p.an, 1 / p.an), p.ryU, p.ryD);
        // how big the billows on it are: its own size to half again, each bubble its own (so a
        // turret carries lobes and those carry turrets: shaders/cloud.js; one boils finer than its
        // neighbour); and how lively they still are: the eddies die down as a piece ages, sooner in
        // the body than in a turret (old parts soften)
        const bs = p.rh * lerp(1, 1.6, hashU(Math.floor(p.x), Math.floor(p.z), 0xb105) / 4294967296);
        const act = Math.exp(-p.age / 700) * (p.kind === 0 ? 0.8 : 1);
        out3.push({ x: p.x, y: p.y, z: p.z, rh: p.rh, ryU: p.ryU, ryD: p.ryD, an: p.an, ang: p.ang, k: p.kf * rmin, bs, act,
          br: Math.max(p.rh * Math.max(p.an, 1 / p.an), p.ryU, p.ryD), cell: c });
      }
    }
  }
}
// drop the bubbles (of out[from..]) that bigger ones around them already hold
function pruneBubbles(out, from) {
  const bub = out.splice(from).sort((a, b) => b.br - a.br);
  for (const b of bub) {
    let inside = false;
    for (let i = from; i < out.length; i++) {
      const o = out[i];
      if (o.br < 1.2 * b.br) break;     // (only a clearly bigger one can hold it)
      if (Math.abs(o.x - b.x) > o.br || Math.abs(o.z - b.z) > o.br || Math.abs(o.y - b.y) > o.br) continue;
      if (ellDist(o, b.x, b.y, b.z) < -0.5 * b.br) { inside = true; break; }
    }
    if (!inside) out.push(b);
  }
}
// drop the bubbles (of out[from..]) that lie wholly inside the others (a turret on the side
// another body covers): nothing of them shows, and the bakes loop over every one. (Each against
// its neighbours along x only: against every other, a cell took a third longer to grow.)
const DIRS = [];
for (let i = 0; i < 20; i++) { const y = 1 - (i + 0.5) / 10, r = Math.sqrt(1 - y * y), a = i * 2.39996; DIRS.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
function dropBuried(out, from) {
  const bub = out.splice(from).sort((a, b) => a.br - b.br), n = bub.length, gone = new Uint8Array(n);
  const byX = bub.map((b, i) => i).sort((i, j) => bub[i].x - bub[j].x), at = new Int32Array(n);
  byX.forEach((i, k) => { at[i] = k; });
  const big = n ? bub[n - 1].br : 0;
  for (let i = 0; i < n; i++) {
    const b = bub[i], near = [], reach = b.br + big;
    const take = j => { const o = bub[j]; if (!gone[j] && Math.abs(o.x - b.x) < o.br + b.br && Math.abs(o.z - b.z) < o.br + b.br && Math.abs(o.y - b.y) < o.br + b.br) near.push(o); };
    for (let k = at[i] - 1; k >= 0 && b.x - bub[byX[k]].x < reach; k--) take(byX[k]);
    for (let k = at[i] + 1; k < n && bub[byX[k]].x - b.x < reach; k++) take(byX[k]);
    const ca = Math.cos(b.ang), sa = Math.sin(b.ang);
    let buried = near.length > 0;
    for (const d of DIRS) {
      const qx = d[0] * b.rh * b.an, qz = d[2] * b.rh / b.an, px = b.x + qx * ca - qz * sa, py = b.y + d[1] * (d[1] > 0 ? b.ryU : b.ryD), pz = b.z + qx * sa + qz * ca;
      let inside = false;
      for (const o of near) if (ellDist(o, px, py, pz) < -40) { inside = true; break; }
      if (!inside) { buried = false; break; }
    }
    if (buried) gone[i] = 1;
  }
  for (let i = n - 1; i >= 0; i--) if (!gone[i]) out.push(bub[i]);
}
// a piece of cloud cut off from the rest, up in the air, is surrounded by dry air and evaporates
// first: keep only the pieces (of out[from..]) that hang together, piece by piece, with the sea (zs)
function dropAdrift(out, from, zs) {
  const n = out.length - from, held = new Uint8Array(n), todo = [];
  // (does the surface of b, toward the centre of o, reach o?)
  const touch = (b, o) => {
    const dx = o.x - b.x, dy = o.y - b.y, dz = o.z - b.z, ca = Math.cos(b.ang), sa = Math.sin(b.ang);
    const qx = (dx * ca + dz * sa) / (b.rh * b.an), qz = (-dx * sa + dz * ca) * b.an / b.rh, qy = dy / (dy > 0 ? b.ryU : b.ryD);
    const f = 0.95 / (Math.hypot(qx, qy, qz) || 1);
    return f >= 1 || ellDist(o, b.x + dx * f, b.y + dy * f, b.z + dz * f) < 60;
  };
  for (let i = 0; i < n; i++) if (out[from + i].y - out[from + i].ryD < zs + 500) { held[i] = 1; todo.push(i); }
  while (todo.length) {
    const b = out[from + todo.pop()];
    for (let j = 0; j < n; j++) {
      const o = out[from + j];
      if (held[j] || Math.abs(o.x - b.x) > o.br + b.br || Math.abs(o.z - b.z) > o.br + b.br || Math.abs(o.y - b.y) > o.br + b.br) continue;
      if (touch(b, o) || touch(o, b)) { held[j] = 1; todo.push(j); }
    }
  }
  const keep = out.splice(from).filter((_, i) => held[i]);
  out.push(...keep);
}
// where the cells of grid cell (ci, cj) of a tier start (only where, how big, how restless the air:
// cheap, so cells can feel their neighbours): candidates drawn as thick as in the most restless air,
// each kept as likely as the air where it lies allows; each with its own random stream
function tierSites(T, ci, cj) {
  const key = ci + ',' + cj;
  let st = T.sites.get(key);
  if (st) return st;
  st = [];
  const S = T.S, rng = cellRng(ci, cj, T.salt);
  const lam = TOWER_RATE * cellDensity(1) * (Math.pow(T.pa / P_MIN, -ALPHA) - Math.pow(T.pb / P_MIN, -ALPHA)) * S * S, n = poisson(rng, lam);
  for (let k = 0; k < n; k++) {
    const r = mulberry32(hashU(ci, cj, T.salt + 7919 * (k + 1)));
    const x = (ci + r()) * S - SITE_O[0], z = (cj + r()) * S - SITE_O[1], u = r(), v = r();
    const P = T.pa * Math.pow(1 - u * (1 - Math.pow(T.pb / T.pa, -ALPHA)), -1 / ALPHA), I = restAt(x, z);
    if (v <= cellDensity(I) / cellDensity(1) * Math.exp(-(P - P_MIN) / P_CUT)) st.push({ x, z, P, I, k });
  }
  T.sites.set(key, st);
  return st;
}
// Air rising hard in a strong cell sinks again around it, and holds weaker cells nearby down:
// 0 (free) .. 1 (right beside a far stronger one)
const SUB_R = 2.6;
function subsidenceAt(x, z, P) {
  let sup = 0;
  for (let t = 1; t < TIERS.length; t++) {
    const T = TIERS[t], R = 1.8 * SUB_R * T.pb;
    const gx = x + SITE_O[0], gz = z + SITE_O[1];
    for (let j = Math.floor((gz - R) / T.S); j <= Math.floor((gz + R) / T.S); j++) for (let i = Math.floor((gx - R) / T.S); i <= Math.floor((gx + R) / T.S); i++)
      for (const o of tierSites(T, i, j)) {
        if (o.P <= P || o.I < 0.35) continue;
        const d = Math.hypot(o.x - x, o.z - z) / (SUB_R * o.P);
        if (d < 1.8) sup = Math.max(sup, Math.exp(-d * d) * sat((o.I - 0.35) / 0.3) * sat((o.P - P) / (0.25 * P)));
      }
  }
  return sup;
}
// The spawn draw: the bird sets out where the weather is worth seeing. The weather (the restless air
// and the cells' grids) is moved against the sea so that one of its strong cells, nearest the
// weather's origin first, stands where the first tower should, or, if none fits there, a little
// off it (PLACES): each try is another cell or place, as random as any other. A try holds if that cell, grown, is a
// living tower into whose rising air the bird flies if it just flies on (FIRST: 2-3 minutes at
// cruise, on the heading of a wide screen: flight/camera.js, startYaw), with nothing nearer the
// start, what of it stands in the sky beside the sun but not across it (in frame on wide and tall
// screens), the air toward the sun calm (the sunset open), and strong cells stand near and far in
// each quarter but the sun's (a guess from the sites, not grown); the first try that holds all,
// else the best: of those that hold, by the cells around; else the one that came nearest.
// SPAWN: what it found (tools/world/stats.js prints it).
export const SPAWN = { tries: 0 };
// the first tower: a cell of P pa..pb put at bearing a (0: the sun), d m off; it holds if its top
// is over `top`, its air rises at `lift` m/s or more, a bird flying on at bearing `yaw` is within
// reach of that air m0..m1 m on, nothing of its grid cell stands within `clear` m of the start at
// the bird's height, and the left edge of what stands over the bird's height lies at bearings a0..a1
const FIRST = { pa: 3000, pb: 4500, a: 0.85, d: 13500, top: 8500, lift: 18, yaw: 0.45, m0: 6500, m1: 11200, clear: 6000, a0: 0.27, a1: 0.6 };
// (the places a cell is tried at: how far off FIRST's bearing and distance)
const PLACES = [[0, 0], [-0.1, -1000], [0.1, 1000], [-0.2, -1500]];
// the weather as four numbers: REST_O, SITE_O (?weather; the worker hands the draw's to the page)
export const weatherOf = () => [...REST_O, ...SITE_O];
export function setWeather(w) {
  setRestOffset([w[0], w[1]]); SITE_O = [w[2], w[3]];
  for (const T of TIERS) { T.sites.clear(); T.cache.clear(); T.coarse.clear(); }
  setStartY();
}
// mean restlessness over bearings a0..a1 (0: the sun) and distances d0..d1
function sector(a0, a1, d0, d1) {
  let s = 0;
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const a = lerp(a0, a1, i / 4), d = lerp(d0, d1, j / 4); s += restAt(Math.sin(a) * d, -Math.cos(a) * d); }
  return s / 25;
}
// how near the bubbles bs come to the start at height y (m), and the bearings their outline spans
function outline(bs, y) {
  let near = 1e9, a0 = 1e9, a1 = -1e9;
  for (const b of bs) {
    const d = Math.hypot(b.x, b.z), a = Math.atan2(b.x, -b.z), w = Math.asin(Math.min(b.br / d, 1));
    a0 = Math.min(a0, a - w); a1 = Math.max(a1, a + w);
    const dy = (y - b.y) / (y > b.y ? b.ryU : b.ryD);
    if (Math.abs(dy) < 1) near = Math.min(near, d - b.rh * Math.sqrt(1 - dy * dy));
  }
  return { near, a0, a1 };
}
// how far a bird flying straight on from the start (at bearing FIRST.yaw) flies until it is within
// reach of the air rising around the bubbles bs (queries.js, liftAt: over a third of its strength)
function meets(bs) {
  const sx = Math.sin(FIRST.yaw), sz = -Math.cos(FIRST.yaw);
  for (let d = 2000; d < 16000; d += 150) for (const b of bs) {
    const x = sx * d, z = sz * d;
    if (Math.abs(b.x - x) < b.br + 700 && Math.abs(b.z - z) < b.br + 700 && ellDist(b, x, START_Y, z) < 650) return d;
  }
  return 1e9;
}
// strong cells by quarter (right, behind, left) and range (10-30, 30-60 km): how many of the six
// hold any
function quarters() {
  const bins = new Set();
  for (const T of TIERS.slice(1)) {
    const n = Math.ceil(60000 / T.S) + 1, i0 = Math.floor(SITE_O[0] / T.S), j0 = Math.floor(SITE_O[1] / T.S);
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) for (const o of tierSites(T, i0 + i, j0 + j)) {
      const d = Math.hypot(o.x, o.z), q = Math.floor((Math.atan2(o.x, -o.z) + 2 * PI + PI / 4) / (PI / 2)) % 4;
      if (q === 0 || d < 10000 || d > 60000 || o.P < 2200 || o.I < 0.5 || subsidenceAt(o.x, o.z, o.P) > 0.4) continue;
      bins.add(q * 2 + (d < 30000 ? 0 : 1));
    }
  }
  return bins.size;
}
// Runs once, in the world's worker (and as the Node tools load the world): the page takes its
// weather from there (core/world.js). ?weather skips it.
export function spawnDraw() {
  if (params.weather) { setWeather(params.weather); return; }
  // the candidates: the strong cells of the unmoved weather, nearest its origin first
  setWeather([0, 0, 0, 0]);
  const cands = [];
  for (const T of TIERS.slice(1)) {
    const n = Math.ceil(160000 / T.S);
    for (let j = -n; j < n; j++) for (let i = -n; i < n; i++) for (const o of tierSites(T, i, j)) if (o.P > FIRST.pa && o.P < FIRST.pb && o.I > 0.55) cands.push({ T, i, j, o, w: warpAt(o.x, o.z) });
  }
  cands.sort((p, q) => Math.hypot(p.o.x, p.o.z) - Math.hypot(q.o.x, q.o.z));
  let best = null;
  // (a place at a time, the next only if no cell held at the ones before: every try grows a cell)
  draw: for (const [da, dd] of PLACES) {
    if (best?.ok) break;
    const px = Math.sin(FIRST.a + da) * (FIRST.d + dd), pz = -Math.cos(FIRST.a + da) * (FIRST.d + dd), wp = warpAt(px, pz);
    for (const c of cands.slice(0, 128)) {
      SPAWN.tries++;
      // (the restless air moved with it, as the warp has it: the air around the cell comes along)
      setWeather([c.w[0] - wp[0], c.w[1] - wp[1], c.o.x - px, c.o.z - pz]);
      const o = tierSites(c.T, c.i, c.j).find(s => s.k === c.o.k);
      if (sector(-0.3, 0.1, 6000, 40000) > 0.4 || !o || o.I < 0.5 || subsidenceAt(o.x, o.z, o.P) > 0.45) continue;
      const g = tierCell(c.T, c.i, c.j), t = g.towers.find(t => t.gen === 0 && t.x === o.x && t.z === o.z);
      if (!t || t.top < FIRST.top || t.cell.lift < FIRST.lift) continue;
      const own = g.bub.filter(b => b.cell === t.cell), { near } = outline(g.bub, START_Y), { a0, a1 } = outline(own.filter(b => b.y + b.ryU > START_Y + 800), START_Y), met = meets(own);
      const ok = near > FIRST.clear && met > FIRST.m0 && met < FIRST.m1 && a0 > FIRST.a0 && a0 < FIRST.a1;
      // (how far off a try that does not hold is: km along the flight, a tenth of a radian, km of clear air)
      const miss = Math.min(Math.max(0, FIRST.m0 - met, met - FIRST.m1), 1e4) / 1000 + 10 * Math.max(0, FIRST.a0 - a0, a0 - FIRST.a1) + Math.max(0, FIRST.clear - near) / 1000;
      const q = ok ? quarters() : 0, score = ok ? 10 + q : -miss;
      if (!best || score > best.score) best = { score, ok, weather: weatherOf(), near, met, a0, a1, top: t.top, P: t.P, quarters: q };
      if (ok && q >= 5) break draw;
    }
  }
  setWeather(best ? best.weather : [0, 0, 0, 0]);
  Object.assign(SPAWN, best);
}
// the cells of grid cell (ci, cj) of a tier, grown
function tierCell(T, ci, cj, coarse = false) {
  const cache = coarse ? T.coarse : T.cache, key = ci + ',' + cj;
  let c = cache.get(key);
  if (c) return c;
  const S = T.S, bub = [], domes = [], cells = [];
  // a cell, and the cells its outflow sets off around it (younger; more where the air is restless,
  // mostly on its downwind side), and theirs in turn
  const grow = (x, z, P, age, r, gen) => {
    const A = airAt(x, z), life = 1400 * Math.pow(P / 1000, 0.5) * lerp(0.7, 1.3, r());
    // the sinking air strengthens the inversion and warms and dries the air above it (where an
    // outflow sets a cell off it lifts the air through half of that; small cells never rise far)
    if (P >= 1000) {
      const sub = subsidenceAt(x, z, P) * (gen ? 0.5 : 1);
      A.cap += 0.12 * sub; A.bmax *= 1 - 0.7 * sub; A.el = A.zs + (A.el - A.zs) * (1 - 0.6 * sub);
    }
    // it drifts with the wind of the lower air, and moves on as it renews itself
    const sp = lerp(0, 1.5, r()), pa = r() * 2 * PI, hm = 0.12 * (A.ceil - A.zs);
    const cell = { x, z, P, A, life, age: age < 0 ? life * 1.25 * r() : age, vx: A.ux * hm + Math.cos(pa) * sp, vz: A.uz * hm + Math.sin(pa) * sp, seed: (r() * 4294967296) >>> 0 };
    const n3 = bub.length;
    growCell(cell, coarse, bub, domes);
    for (let i = n3; i < bub.length; i++) {
      const b = bub[i];
      if (nearStart(b.x, b.z, b.br + 2500) && Math.min(ellDist(b, 0, START_Y - 400, 0), ellDist(b, 0, START_Y + 400, 0)) < 2500) { bub.length = n3; break; }
    }
    if (bub.length > n3) {
      pruneBubbles(bub, n3);
      if (!coarse) dropBuried(bub, n3);
      dropAdrift(bub, n3, A.zs);
      // what became of it (for the views of the test presets): its top, how far its top spread
      let top = 0, wide = 0;
      for (let i = n3; i < bub.length; i++) top = Math.max(top, bub[i].y + bub[i].ryU);
      for (let i = n3; i < bub.length; i++) if (bub[i].y + bub[i].ryU > top - 2000) wide = Math.max(wide, Math.hypot(bub[i].x - x, bub[i].z - z) + bub[i].rh);
      cells.push({ x, z, P, y0: A.zs, top, wide, R0: P, ceil: A.ceil, gen, cell });
      // the air rising through it while it lives, and up its flanks (queries.js, liftAt): in a big
      // cell and in its prime the most, as its pulses
      cell.top = top;
      cell.lift = cell.age < cell.life ? LIFT * sat((P - 800) / 2200) * Math.sqrt(Math.sin(PI * cell.age / cell.life)) : 0;
    }
    const nd = gen < 2 ? poisson(r, 1.2 * A.I * sat(cell.age / cell.life)) : 0;
    for (let k = 0; k < nd; k++) {
      const a = r() < 0.6 ? A.turn + (r() - 0.5) * 2.4 : r() * 2 * PI, d = P * lerp(1.8, 3.5, r());
      const Pd = P * lerp(0.4, 1, Math.pow(r(), 0.7)), ad = cell.age - lerp(300, 1500, r());
      if (ad > 0 && Pd > 0.8 * P_MIN) grow(x + Math.cos(a) * d, z + Math.sin(a) * d, Pd, ad, r, gen + 1);
    }
  };
  for (const o of tierSites(T, ci, cj)) {
    const r = mulberry32(hashU(ci, cj, T.salt + 7919 * (o.k + 1)));
    for (let q = 0; q < 4; q++) r();      // (the draws that placed it)
    grow(o.x, o.z, o.P, -1, r, 0);
  }
  let bx0 = 1e30, bz0 = 1e30, bx1 = -1e30, bz1 = -1e30;
  for (const b of bub) { bx0 = Math.min(bx0, b.x - b.br); bx1 = Math.max(bx1, b.x + b.br); bz0 = Math.min(bz0, b.z - b.br); bz1 = Math.max(bz1, b.z + b.br); }
  for (const d of domes) { bx0 = Math.min(bx0, d.x - d.reach); bx1 = Math.max(bx1, d.x + d.reach); bz0 = Math.min(bz0, d.z - d.reach); bz1 = Math.max(bz1, d.z + d.reach); }
  c = { bub, domes, towers: cells, box: [bx0, bz0, bx1, bz1] };
  cache.set(key, c);
  return c;
}
// forget the generated cells far behind (endless flights must not fill the memory)
export function worldGC(cx, cz) {
  for (const T of TIERS) for (const [cache, keep] of [[T.cache, T.small ? 90000 : 160000], [T.coarse, 420000], [T.sites, 480000]]) {
    if (cache.size < 2500) continue;
    for (const k of cache.keys()) {
      const [i, j] = k.split(',').map(Number);
      if (Math.max(Math.abs((i + 0.5) * T.S - SITE_O[0] - cx), Math.abs((j + 0.5) * T.S - SITE_O[1] - cz)) > keep) cache.delete(k);
    }
  }
}
function forEachTierCell(T, x0, z0, x1, z1, fn, coarse) {
  const R = T.small ? 1 : TIER_REACH;
  const i0 = Math.floor((x0 + SITE_O[0]) / T.S) - R, i1 = Math.floor((x1 + SITE_O[0]) / T.S) + R, j0 = Math.floor((z0 + SITE_O[1]) / T.S) - R, j1 = Math.floor((z1 + SITE_O[1]) / T.S) + R;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const c = tierCell(T, i, j, coarse), b = c.box;
    if (b[2] > x0 && b[0] < x1 && b[3] > z0 && b[1] < z1) fn(c);
  }
}
// every dome whose footprint touches the box (coarse: as the coarsest level sees them)
export function forEachDome(x0, z0, x1, z1, fn, coarse = false) {
  for (const T of TIERS) forEachTierCell(T, x0, z0, x1, z1, c => {
    for (const d of c.domes) if (d.x + d.reach > x0 && d.x - d.reach < x1 && d.z + d.reach > z0 && d.z - d.reach < z1) fn(d);
  }, coarse);
}
// every grid cell holding bubbles (3D) near the box (coarse: as the coarsest level sees them)
export function forEachSys(x0, z0, x1, z1, fn, coarse = false) {
  for (const T of TIERS) forEachTierCell(T, x0, z0, x1, z1, c => { if (c.bub.length) fn(c); }, coarse);
}
