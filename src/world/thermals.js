// Thermals: bubbles of warm air rising out of the sea of clouds, and what becomes of them
//
// lift: one bubble rising, an entraining parcel stepped in height (short steps through the
// inversion, so a big bubble can't hop over it). It mixes with the air around it (the smaller, the
// faster; less inside cloud earlier bubbles left), which dilutes its buoyancy and chills it with dry
// air; drag slows it; it stops when its speed runs out, or is still rising at the moment the world
// shows. On the way it swells, drifts with the wind of its height, is pushed aside by earlier heads,
// leaves a wake of lumps and sheds smaller bubbles; at the top it boils into a few crowns, which
// rise in turn (C.depth levels deep, none smaller than C.minR; in a tower none small beside the
// bubble they burst from or the pulse's head: those stay in it, whose billows show them). Lifted
// alone first (C.log), its path decides what a pulse becomes; replay then grows what it shed,
// without lifting it again. roofOf: how far a piece may bulge above its centre (the inversion
// while below it, the ceiling, CLOUD_TOP).
// settle: what became of each piece by that moment: it drifted with the wind and evaporates (sooner
// higher up and in dry air, the small first; ice lingers; dying towers crumble from the top); a
// tower's column is about as wide as the bubbles that rose through it; a stopped head is pressed
// flat by the air that stopped it (a heap under the inversion; in a tower only where it pushed far
// into stable air, or into the ceiling: else it keeps its dome), sags, and where stopped hard
// spreads out beneath that air in lobes: a little under the inversion, far under the ceiling
// (anvils). Its pieces meet the others in broad fillets, not creases (a ball perched on a ball).
// placeDome: the pieces of a low pulse become 2D domes raising the sea's surface, standing on what
// they grew from, their flanks never steeper than ~60°. START_Y, nearStart: the start is kept clear.

import { clamp, lerp, mulberry32, PI, sat, smoothstep } from '../math.js';
import { CLOUD_TOP } from '../constants.js';
import { buoyAt, seaLevelAt } from './air.js';
import { domeHeightAt, domeSteepness, makeDome } from './shapes.js';

// One bubble of warm air rising from (x, y, z) (its centre) with radius r and vertical speed w,
// keeping the share f of its buoyancy (it mixes with the air around it as it rises, the faster
// the smaller it is; through cloud left by earlier bubbles it mixes less). Mixed-in dry air chills
// it, so small bubbles soon stall. It drifts with the wind of its height, and outward at (vx, vz)
// if a larger one shed it; it swells as it rises and sheds smaller bubbles in turn. When its
// strength runs out it stops; if the moment the world shows comes first, it is still rising. Its
// wake and everything it shed go to `out`; returns its head. With C.log (an array) it sheds nothing
// yet: its wake and what it would shed (as lift's arguments) go to the log, in order, for replay
// (its path never depends on what it sheds).
export const MIX = 0.6, DRAG = 0.35, SWELL = 0.04, SHED = 0.8, ICE_Y = 8000, H_FLAT = 2200, R_TH = 3500, CROWN_MIN = 0.28, CROWN_MIN_HEAD = 0.2;
export function lift(C, x, y, z, r, w, f, t, vx, vz, depth, rng, out, parent) {
  const A = C.A, hd = { head: true, x, y, z, r, t, w, depth, parent, still: false, bu: 0, seed: 0 }, log = depth === C.depth ? C.log : null;
  let w2 = w * w, wPeak = w, trailY = y + 0.3 * r;
  for (let s = 0; s < 200; s++) {
    // (short steps through the thin inversion, or a big bubble would hop over it)
    const dz = y < A.zs + A.dInv + 60 && y + 450 > A.zs - 60 ? 60 : clamp(0.3 * r, 40, 450);
    // (inside the sea, and to a degree inside what earlier bubbles left, it mixes with cloud)
    const prot = y < A.zs ? 0 : depth === C.depth && y + 0.4 * r < C.cloudTop(t) ? 0.7 : 1;
    f *= Math.exp(-MIX * prot * dz / r);
    const bu = buoyAt(A, y + 0.5 * dz);
    w2 += 2 * dz * ((bu > 0 ? bu * f : bu) - (1 - f) * A.dry - DRAG * w2 / r);
    if (w2 <= 0) break;
    const ws = Math.sqrt(w2), dt = dz / Math.max(ws, 1.5);
    if (t + dt > C.age) { hd.still = true; break; }
    t += dt;
    // domes that earlier bubbles left are in the way: it squeezes past them, bulging outward
    if (depth === C.depth) for (const o of C.heads) {
      if (o.t > t || t - o.t > 1500) continue;
      const ox = o.x + A.ux * (o.y - A.zs) * (t - o.t), oz = o.z + A.uz * (o.y - A.zs) * (t - o.t);
      const dx = x - ox, dzz = z - oz, dy = y - o.y, rr = 0.8 * (r + o.r), d2 = dx * dx + dzz * dzz + dy * dy;
      if (d2 > rr * rr) continue;
      const dh = Math.hypot(dx, dzz) + 1, push = 0.3 * ws * (1 - Math.sqrt(d2) / rr);
      vx += dx / dh * push; vz += dzz / dh * push;
    }
    const h = y - A.zs, dmp = Math.exp(-dt / 400);
    x += (A.ux * h + vx) * dt; z += (A.uz * h + vz) * dt; vx *= dmp; vz *= dmp;
    y += dz; r += SWELL * dz + r * dz / 60000;
    if (ws > wPeak) wPeak = ws;
    if (y > trailY) {
      if (depth === C.depth) { C.path.push(t, y + 0.5 * r); C.top = Math.max(C.top, y + Math.min(0.62 * r, roofOf(A, y, r))); }
      // the wake it leaves behind: turbulent lumps of cloud around its path
      for (let q = r > 700 ? 2 : 1; q > 0; q--) {
        const ja = rng() * 2 * PI, jr = r * lerp(0.15, 0.45, rng()), jy = r * (rng() - 0.5) * 0.3, rr = r * lerp(0.62, 0.85, rng());
        if (log || C.trails) (log || out).push({ head: false, x: x + Math.cos(ja) * jr, y: y + jy, z: z + Math.sin(ja) * jr, r: rr, t, depth, of: hd });
      }
      trailY = y + 0.55 * r;
    }
    if (depth > 1 && rng() < dz / (SHED * r)) {
      // a smaller bubble breaks away from the head and crowds outward
      const a = rng() * 2 * PI, d = r * lerp(0.35, 0.8, rng()), rc = r * lerp(0.3, 0.62, rng());
      const wc = ws * lerp(0.5, 1.05, rng()), fc = f * lerp(0.7, 1.02, rng()), vo = ws * lerp(0.04, 0.2, rng());
      const yc = y + r * lerp(-0.25, 0.35, rng()), seed = (rng() * 4294967296) >>> 0;
      const e = [x + Math.cos(a) * d, yc, z + Math.sin(a) * d, rc, wc, fc, t, vx + Math.cos(a) * vo, vz + Math.sin(a) * vo, depth - 1, seed];
      if (log) log.push(e); else shed(C, e, out, hd);
    }
  }
  hd.x = x; hd.y = y; hd.z = z; hd.r = r; hd.t = t; hd.w = wPeak; hd.bu = buoyAt(A, y + 60);
  hd.seed = (rng() * 4294967296) >>> 0;
  // its top boils up into a few smaller bubbles, which boil in turn
  const nb = depth === 0 || r < 250 ? 0 : Math.floor(lerp(2, 4 + 3 * sat(wPeak / 8), rng()));
  for (let i = 0; i < nb; i++) {
    const a = rng() * 2 * PI, el = lerp(0.1, 1.3, rng()), rc = r * lerp(0.18, 0.5, Math.pow(rng(), 1.3)), wc = wPeak * lerp(0.15, 0.4, rng()), seed = (rng() * 4294967296) >>> 0;
    const up = Math.min(0.75 * r, 0.9 * roofOf(A, y, r));     // (on its surface, pressed as flat as it is)
    const e = [x + Math.cos(a) * Math.cos(el) * 0.92 * r, y + Math.sin(el) * up, z + Math.sin(a) * Math.cos(el) * 0.92 * r, rc, wc, 0.3, t, vx, vz, depth - 1, seed, true];
    if (log) log.push(e); else shed(C, e, out, hd);
  }
  out.push(hd);
  return hd;
}
// a smaller bubble breaking away from hd (e[11]: a crown on its top), lifted if it is bigger than
// C.minR. In a tower (C.trails) the smallest crowns stay in hd, which boils with billows their
// size: grown on their own, they were balls perched on it, or on the pulse's head
function shed(C, e, out, hd) {
  if (e[3] <= C.minR) return;
  if (C.trails && e[11]) {
    let root = hd;
    while (root.parent) root = root.parent;
    if (e[3] < CROWN_MIN * hd.r || e[3] < CROWN_MIN_HEAD * root.r) return;
  }
  lift(C, e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7], e[8], e[9], mulberry32(e[10]), out, hd);
}
// what a bubble lifted alone (with C.log) left, grown: its wake (if C.trails) and what it sheds
// bigger than C.minR, in lift's order, then its head hd
export function replay(C, log, hd, out) {
  for (const e of log) if (Array.isArray(e)) shed(C, e, out, hd); else if (C.trails) out.push(e);
  out.push(hd);
}
// how far a piece may bulge above its centre: stable air presses it flat, the inversion while it
// is still below it, the ceiling (which nothing passes) always
const roofOf = (A, y, r) => Math.min(Math.max(Math.min(y < A.zs + A.dInv ? A.zs + A.dInv + 150 - y : 1e9, A.ceil + 500 - y), 0.2 * r), CLOUD_TOP - 300 - y);
// how hard the air that stopped a head presses it flat (0 .. 1). A heap on the sea is pressed under
// the inversion; in a tower the inversion and the ceiling are thin, strongly stable layers that
// flatten whatever they stop, but between them the air is only weakly stable, and a head that ran
// out of strength there keeps its dome unless it pushed far into that air
const stabOf = e => Math.pow(sat(-e.bu / 0.04), 0.7);
const stabTall = (A, e) => Math.pow(sat(-e.bu / (e.y < A.zs + A.dInv + 150 ? 0.04 : 1.0)), 0.7);
export const headUp = (A, e) => Math.min(e.still ? 0.86 * e.r : e.r * lerp(0.85, 0.3, stabOf(e)) * 1.05, roofOf(A, e.y, e.r));
// How long a piece lasts (s) once it is left behind: the air is moist just above the sea and dry
// higher up; the bigger, the longer; ice lingers; and what is high up does not outlast the column
// that holds it up for long (dying towers crumble from the top down)
export function lifeOf(c, e) {
  const A = c.A, hgt = e.y - A.zs, sq = Math.sqrt(e.r / 1000), col = lerp(450, 1600, A.moist) * sq;
  // (while the cell still sends air up, its column stays saturated)
  let life = (e.y > ICE_Y ? 1700 * sq : col * (1 + 2.5 * smoothstep(2500, 0, hgt))) * (e.head ? 1 : c.age < c.life ? 1.5 : 0.8);
  if (e.head && hgt > 2500) life = Math.min(life, 0.75 * col);
  return life;
}
// What became of a piece of a bubble by the moment the world shows. It drifted with the wind of
// its height since it was there, and evaporates (ice high up lingers longer), the small parts
// first. A head that stopped settles into a dome, flattens and sags; where the air above stopped
// it hard it also spreads out beneath it in lobes, the farther the more stable that air and the
// harder it pushed: a little under a strong inversion, far under the ceiling.
// Appends the pieces to `out`; returns the head's (null if it is gone). tall: the pulse grew a tower.
export function settle(c, e, out, tall = false) {
  const A = c.A, age = Math.max(c.age - e.t, 0), r = e.r, hgt = e.y - A.zs;
  // (a head no less far than the column under it, e.colEv: growCell)
  const ev = Math.max(age / lifeOf(c, e), e.colEv ?? 0);
  if (ev >= 1) return null;
  const g = Math.sqrt(1 - ev * ev), x = e.x + A.ux * hgt * age, z = e.z + A.uz * hgt * age;
  const roof = roofOf(A, e.y, r);
  const put = (px, py, pz, rh, ryU, ryD, an, ang, kf, kind, parent) => {
    const p = { x: px, y: py, z: pz, rh, ryU, ryD, an, ang, kf, age, kind, parent };
    out.push(p);
    return p;
  };
  // the wake: cloudy air keeps spilling out of the rising column, so it widens as it ages; its lumps
  // blend into each other by about their size (one trunk widening with height, not a string of
  // beads), about as wide as the bubbles that rose through it (a wide top on a narrower stem was a
  // mushroom)
  if (!e.head) {
    const wid = 1 + 0.7 * (1 - Math.exp(-age / (900 * Math.sqrt(r / 1000))));
    return put(x, e.y, z, 0.85 * r * wid * g, Math.min(0.62 * r, roof) * g, 0.62 * r * g, 1 + 0.25 * (wid - 1), A.turn, 0.9, 0, null);
  }
  if (e.still) return put(x, e.y, z, r, Math.min(0.86 * r, roof), 0.6 * r, 1, 0, 0.25, 1, null);
  const rng = mulberry32(e.seed), grow = 1 - Math.exp(-age / (600 * Math.sqrt(r / 1000)));
  // (how far it spreads: by how stable the air that stopped it is, and how hard it was rising)
  const stab = tall ? stabTall(A, e) : stabOf(e), S = sat(-e.bu / 0.6) * (0.5 + 3 * Math.pow(sat((e.w - 4) / 22), 1.5));
  const sp = 0.3 * grow * (0.35 + 0.65 * stab), yc = e.y - Math.min(0.25 * age, 0.35 * r);
  // pressed flat under the air that stopped it; the underside sags as it ages; old domes soften; a
  // crown blends into the head it burst from by a fillet its own size (a bulge, not a ball on a ball)
  const hp = put(x, yc, z, r * (1 + sp) * g, Math.min(r * lerp(tall ? 0.95 : 0.85, 0.3, stab) * lerp(0.85, 1.05, rng()) / (1 + 0.6 * sp), roof) * g,
    r * (0.6 + 0.45 * grow) * g, lerp(1, 1.35, rng()) * (1 + 0.2 * sp), rng() * PI, e.parent ? 0.7 : 0.3 + 0.15 * sat(age / 1500), 1, null);
  if (S > 0.15 && r > 350) {
    const n = Math.min(7, Math.round(1 + 2.5 * S)), a0 = rng() * 2 * PI;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i + 0.6 * rng()) * 2 * PI / n, d = r * (0.4 + S * lerp(0.5, 1, rng())) * grow;
      const rl = r * lerp(0.45, 0.75, rng()) * g;
      put(x + Math.cos(a) * d, yc + r * lerp(-0.2, 0.1, rng()), z + Math.sin(a) * d, rl, Math.min(rl * lerp(0.3, 0.45, rng()), roof),
        rl * lerp(0.45, 0.65, rng()), lerp(1, 1.4, rng()), rng() * PI, 0.3, 2, hp);
    }
  }
  return hp;
}
// keep the start clear: nothing stands where the bird sets out
export const START_Y = seaLevelAt(0, 0) + 750;
export const nearStart = (x, z, r) => Math.hypot(x, z) < r + 600;
// a piece lying low on the sea becomes a dome of its surface, standing on what it grew from
// (sea: the sea level near it as a plane [level, slope x, slope z, x, z])
const surfAt = (pd, sea, x, z) => Math.max(pd ? domeHeightAt(pd, x, z) : -1e9, sea[0] + sea[1] * (x - sea[3]) + sea[2] * (z - sea[4]));
const MAX_FLANK = 1.8;   // the steepest a dome's flank may be (61°; the volumes hold 2.2)
export function placeDome(p, sea, out) {
  if (p.rh < 150) return;
  const pd = p.parent && p.parent.dome, under = surfAt(pd, sea, p.x, p.z), top = p.y + p.ryU;
  if (top < under + 30) return;
  // never steeper than cloud can stand (its skirt spreads to hold it up)
  let r = Math.max(p.rh, (top - under) / 0.5);
  if (top > START_Y - 350 && nearStart(p.x, p.z, 1.2 * r * p.an)) return;
  let base = under - 0.3 * (top - under), h = top - base;
  if (pd) {
    // where it reaches beyond its parent its flank comes down to meet what is there
    const ca = Math.cos(p.ang), sa = Math.sin(p.ang);
    let low = under;
    for (let q = 0; q < 8; q++) {
      const aa = Math.cos(q * PI / 4) * r * 0.9 * p.an, bb = Math.sin(q * PI / 4) * r * 0.9;
      low = Math.min(low, surfAt(pd, sea, p.x + aa * ca - bb * sa, p.z + aa * sa + bb * ca));
    }
    if (low < base) { h += base - low; base = low; }
  }
  // no flank steeper than cloud can stand: wider, not lower (steeper, the volumes' slope limit
  // would cut it into flat faces with straight corners, columns.js)
  const prof = p.kind === 2 ? 1.1 : lerp(0.8, 1.4, sat(p.age / 1500));
  r = Math.max(r, h * domeSteepness(prof) / MAX_FLANK);
  if (top > START_Y - 350 && nearStart(p.x, p.z, 1.2 * r * p.an)) return;
  const seaHere = sea[0] + sea[1] * (p.x - sea[3]) + sea[2] * (p.z - sea[4]);
  const d = makeDome(p.x, p.z, r, h, base, prof, p.an, p.ang, seaHere);
  p.dome = d;
  out.push(d);
}
