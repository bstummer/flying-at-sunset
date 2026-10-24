// Convective cells: places where bubbles keep rising for a while

import { Q } from '../params.js';
import { clamp, lerp, mulberry32, PI, sat } from '../math.js';
import { cellRng, gauss, hashU, poisson } from './noise.js';
import { airAt, REST_O, restAt, seaLevelAt, setRestOffset } from './air.js';
import { ellDist } from './shapes.js';
import { H_FLAT, headUp, lift, nearStart, placeDome, R_TH, settle, START_Y } from './thermals.js';

// A cell is a place where bubbles keep rising for a while. Its potential P (m) is the size of the
// strongest bubbles it can send up: small cells are common, big ones rare (a power law), a little
// more of them where the air is restless. Calm air holds even big ones down under its inversion
// (they spread out into broad low heaps); restless air lets them through. It sends bubbles up at
// intervals, weak while it builds up, strongest in its prime, dying down at the end; it may also
// drift. Cells are kept by size in grids of three sizes (only for quick lookups; for the coarsest
// clipmap level the small ones are grown without the bubbles their bubbles shed).
const P_MIN = 600, ALPHA = 2.0, P_CUT = 2800;
const TOWER_RATE = Q.has('towers') ? parseFloat(Q.get('towers')) : 1;
const cellDensity = I => 0.36e-6 * (0.12 + 0.88 * I);       // cells per m^2 with P > P_MIN
const TIERS = [
  { S: 8000, pa: P_MIN, pb: 1000, salt: 0x4ea9, small: true, cache: new Map(), coarse: new Map(), sites: new Map() },
  { S: 16000, pa: 1000, pb: 3000, salt: 0x51a3, cache: new Map(), coarse: new Map(), sites: new Map() },
  { S: 32000, pa: 3000, pb: 8000, salt: 0x70e5, cache: new Map(), coarse: new Map(), sites: new Map() },
];
const TIER_REACH = 2;   // grid cells: how far a cell's clouds may reach from its own grid cell
// coarse: low pulses without what their bubbles shed (all the coarsest level needs of them; tall
// ones are grown in full but for the small bubbles it leaves out, so towers look the same from
// every distance)
function growCell(c, coarse, out3, out2) {
  const A = c.A, rng = mulberry32(c.seed);
  const C = { A, age: c.age, depth: c.P < 1000 ? 2 : 3, rootsOnly: true, paths: [], heads: [] };
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
    // the bubble alone first: how high it gets decides whether this pulse stays low (its path is
    // the same whatever it sheds: that draws from streams of its own)
    let list = [];
    const path = [t, zs];
    Object.assign(C, { rootsOnly: true, trails: false, path, top: -1e9 });
    let hd = lift(C, lx, zs - 0.6 * r0, lz, r0, w0, 1, t, 0, 0, C.depth, mulberry32(seed), list, null);
    const tall = Math.max(C.top, hd.y + headUp(A, hd)) >= zs + H_FLAT;
    path.push(Math.max(hd.t, t + 1), hd.y + 0.5 * hd.r);
    if (tall || !coarse) {
      // (what the coarsest level would leave out is not grown for it)
      Object.assign(C, { rootsOnly: false, trails: tall, path: [], minR: !tall ? 150 : coarse ? 600 : 250 });
      list = [];
      hd = lift(C, lx, zs - 0.6 * r0, lz, r0, w0, 1, t, 0, 0, C.depth, mulberry32(seed), list, null);
    }
    C.paths.push(path);
    if (!hd.still) C.heads.push(hd);
    // what it left, aged to the moment the world shows: tall pulses as bubbles (3D), low ones as
    // domes on the sea (2D: heads and lobes, each on the dome of what it grew from)
    const pieces = [];
    if (!tall) {
      list.sort((p, q) => q.depth - p.depth);
      for (const e of list) {
        if (!e.head) continue;
        pieces.length = 0;
        const hp = settle(c, e, pieces);
        if (!hp) continue;
        hp.parent = e.parent && e.parent.piece;
        e.piece = hp;
        for (const p of pieces) placeDome(p, sea, out2);
      }
    } else {
      // (bubbles too small to matter beside the billows are left out whole, wake and all)
      for (const e of list) if (e.r > 420) settle(c, e, pieces);
      for (const p of pieces) {
        if (Math.max(p.rh, p.ryU) < 200 || p.y + p.ryU < zs - 150) continue;
        const rmin = Math.min(p.rh * Math.min(p.an, 1 / p.an), p.ryU, p.ryD);
        out3.push({ x: p.x, y: p.y, z: p.z, rh: p.rh, ryU: p.ryU, ryD: p.ryD, an: p.an, ang: p.ang, k: p.kf * rmin,
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
    const x = (ci + r()) * S, z = (cj + r()) * S, u = r(), v = r();
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
    for (let j = Math.floor((z - R) / T.S); j <= Math.floor((z + R) / T.S); j++) for (let i = Math.floor((x - R) / T.S); i <= Math.floor((x + R) / T.S); i++)
      for (const o of tierSites(T, i, j)) {
        if (o.P <= P || o.I < 0.35) continue;
        const d = Math.hypot(o.x - x, o.z - z) / (SUB_R * o.P);
        if (d < 1.8) sup = Math.max(sup, Math.exp(-d * d) * sat((o.I - 0.35) / 0.3) * sat((o.P - P) / (0.25 * P)));
      }
  }
  return sup;
}
// The bird sets out where the weather is worth seeing. The restless air is drawn again and again
// (each draw as random as any other) until one leaves the air around the start calm and open
// toward the sun, with strong cells off to the right of it (lit from the side, their tops drifting
// away downwind); failing that, the best of them.
{
  const sector = (a0, a1, d0, d1) => {   // mean restlessness over bearings a0..a1 (0: the sun)
    let s = 0;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const a = lerp(a0, a1, i / 4), d = lerp(d0, d1, j / 4); s += restAt(Math.sin(a) * d, -Math.cos(a) * d); }
    return s / 25;
  };
  let best = -1e9, bo = REST_O;
  for (let k = 0; k < 64; k++) {
    const r = mulberry32(hashU(k, 17, 0x5eed));
    setRestOffset(k ? [(r() - 0.5) * 6e6, (r() - 0.5) * 6e6] : [0, 0]);
    const sun = sector(-0.35, 0.15, 6000, 35000), near = sector(0, 6.28, 3000, 9000);
    let big = 0;
    for (const T of TIERS) T.sites.clear();
    if (sun < 0.3 && near < 0.3) {
      for (const T of TIERS.slice(1)) {
        for (let j = Math.floor(-42000 / T.S); j <= 0; j++) for (let i = 0; i <= Math.floor(42000 / T.S); i++)
          for (const o of tierSites(T, i, j)) {
            const a = Math.atan2(o.x, -o.z), d = Math.hypot(o.x, o.z);
            if (a > 0.3 && a < 0.95 && d > 12000 && d < 40000 && o.P > 2200 && o.I > 0.5 && subsidenceAt(o.x, o.z, o.P) < 0.4) big++;
          }
      }
    }
    const open = Math.max(sun - 0.3, 0) + Math.max(near - 0.3, 0), score = open > 0 ? -open : Math.min(big, 3);
    if (score > best) { best = score; bo = REST_O; }
    if (big >= 3 && sun < 0.3 && near < 0.3) break;
  }
  setRestOffset(bo);
  for (const T of TIERS) T.sites.clear();
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
      dropAdrift(bub, n3, A.zs);
      // what became of it (for the views of the test presets): its top, how far its top spread
      let top = 0, wide = 0;
      for (let i = n3; i < bub.length; i++) top = Math.max(top, bub[i].y + bub[i].ryU);
      for (let i = n3; i < bub.length; i++) if (bub[i].y + bub[i].ryU > top - 2000) wide = Math.max(wide, Math.hypot(bub[i].x - x, bub[i].z - z) + bub[i].rh);
      cells.push({ x, z, P, y0: A.zs, top, wide, R0: P, ceil: A.ceil, gen, cell });
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
  c = { bub, domes, towers: cells, box: [bx0, bz0, bx1, bz1], x: (ci + 0.5) * S, z: (cj + 0.5) * S };
  cache.set(key, c);
  return c;
}
// forget the generated cells far behind (endless flights must not fill the memory)
export function worldGC(cx, cz) {
  for (const T of TIERS) for (const [cache, keep] of [[T.cache, T.small ? 90000 : 160000], [T.coarse, 420000], [T.sites, 480000]]) {
    if (cache.size < 2500) continue;
    for (const [k, c] of cache) {
      const [i, j] = k.split(',').map(Number);
      if (Math.max(Math.abs((i + 0.5) * T.S - cx), Math.abs((j + 0.5) * T.S - cz)) > keep) cache.delete(k);
    }
  }
}
function forEachTierCell(T, x0, z0, x1, z1, fn, coarse) {
  if (coarse && T.small) return;     // (what small cells make is finer than the coarsest level)
  const R = T.small ? 1 : TIER_REACH;
  const i0 = Math.floor(x0 / T.S) - R, i1 = Math.floor(x1 / T.S) + R, j0 = Math.floor(z0 / T.S) - R, j1 = Math.floor(z1 / T.S) + R;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const c = tierCell(T, i, j, coarse), b = c.box;
    if (b[2] > x0 && b[0] < x1 && b[3] > z0 && b[1] < z1) fn(c);
  }
}
// every dome whose footprint touches the box (rootsOnly: only those that grew straight out of
// the sea: the coarsest level)
export function forEachDome(x0, z0, x1, z1, fn, rootsOnly = false) {
  for (const T of TIERS) forEachTierCell(T, x0, z0, x1, z1, c => {
    for (const d of c.domes) if ((!rootsOnly || d.root) && d.x + d.reach > x0 && d.x - d.reach < x1 && d.z + d.reach > z0 && d.z - d.reach < z1) fn(d);
  }, rootsOnly);
}
// every grid cell holding bubbles (3D) near the box (coarse: as the coarsest level sees them)
export function forEachSys(x0, z0, x1, z1, fn, coarse = false) {
  for (const T of TIERS) forEachTierCell(T, x0, z0, x1, z1, c => { if (c.bub.length) fn(c); }, coarse);
}
