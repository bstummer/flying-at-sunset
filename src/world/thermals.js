// Thermals: bubbles of warm air rising out of the sea of clouds, and what becomes of them
//
// lift: one bubble rising, an entraining parcel stepped in height (short steps through the
// inversion, so a big bubble can't hop over it). It mixes with the air around it (the smaller, the
// faster; less inside cloud earlier bubbles left), which dilutes its buoyancy and chills it with dry
// air; drag slows it; it stops when its speed runs out, or is still rising at the moment the world
// shows. On the way it swells, drifts with the wind of its height, is pushed aside by earlier heads,
// leaves a wake of lumps and sheds smaller bubbles; at the top it boils into a few crowns, which
// rise in turn (C.depth levels deep, none smaller than C.minR). Lifted alone first (C.log: its
// wake and what it would shed go to the log), its path decides what a pulse becomes: a low one,
// replay grows what it shed, without lifting it again; a tall one, heap builds on its wake.
// roofOf: how far a piece may bulge above its centre (the inversion while below it, the ceiling,
// CLOUD_TOP).
// settle: what became of a head by that moment: it drifted with the wind and evaporates (sooner
// higher up and in dry air, the small first; ice lingers); it is pressed flat by the air that
// stopped it (a heap under the inversion; in a tower only where it pushed far into stable air, or
// into the ceiling: else it keeps its dome), sags, and a low one stopped hard spreads out beneath
// that air in lobes.
// heap: a tall pulse as a heap of turrets, as a cumulus tower is built: the wake's lumps its body,
// broad where it leaves the sea, and all over the body and the head turrets of many sizes, packed
// so that each shows as a cap among creases; it leans with the wind, goes from the top down and
// softens as it ages. (The wake alone, a drum of lumps under one ball of a head with a few crowns
// perched on it, was a bollard or a mushroom under a skin of bumps: PLAN.md.)
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
// strength runs out it stops; if the moment the world shows comes first, it is still rising. What
// it shed goes to `out`; returns its head. With C.log (an array) it sheds nothing yet: its wake
// and what it would shed (as lift's arguments) go to the log, in order, for replay and heap (its
// path never depends on what it sheds).
export const MIX = 0.6, DRAG = 0.35, SWELL = 0.04, SHED = 0.8, ICE_Y = 8000, H_FLAT = 2200, R_TH = 3500;
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
      // the wake it leaves behind: turbulent lumps of cloud around its path (with where and how
      // big the bubble was as it left them: ax, ay, az, ar)
      for (let q = r > 700 ? 2 : 1; q > 0; q--) {
        const ja = rng() * 2 * PI, jr = r * lerp(0.15, 0.45, rng()), jy = r * (rng() - 0.5) * 0.3, rr = r * lerp(0.62, 0.85, rng());
        if (log) log.push({ x: x + Math.cos(ja) * jr, y: y + jy, z: z + Math.sin(ja) * jr, r: rr, t, ax: x, ay: y, az: z, ar: r });
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
    const e = [x + Math.cos(a) * Math.cos(el) * 0.92 * r, y + Math.sin(el) * up, z + Math.sin(a) * Math.cos(el) * 0.92 * r, rc, wc, 0.3, t, vx, vz, depth - 1, seed];
    if (log) log.push(e); else shed(C, e, out, hd);
  }
  out.push(hd);
  return hd;
}
// a smaller bubble breaking away from hd, lifted if it is bigger than C.minR
function shed(C, e, out, hd) {
  if (e[3] > C.minR) lift(C, e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7], e[8], e[9], mulberry32(e[10]), out, hd);
}
// what a bubble lifted alone (with C.log) sheds, grown (what is bigger than C.minR, in lift's
// order), then its head hd
export function replay(C, log, hd, out) {
  for (const e of log) if (Array.isArray(e)) shed(C, e, out, hd);
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
// What became of a head by the moment the world shows. It drifted with the wind of its height
// since it stopped, and evaporates (ice high up lingers longer). A head that stopped settles into
// a dome, flattens and sags; a low one, where the air above stopped it hard, also spreads out
// beneath it in lobes, the farther the more stable that air and the harder it pushed (not in a
// tower: there its lobes were discs and lenses hanging in the sky, mushroom caps).
// Appends the pieces to `out`; returns the head's (null if it is gone). tall: the pulse grew a
// tower (heap leans it).
export function settle(c, e, out, tall = false) {
  const A = c.A, age = Math.max(c.age - e.t, 0), r = e.r, hgt = e.y - A.zs;
  // (a tower's head no less far than the column under it, e.colEv: heap)
  const ev = Math.max(age / lifeOf(c, e), e.colEv ?? 0);
  if (ev >= 1) return null;
  const g = Math.sqrt(1 - ev * ev), ad = tall ? 0 : age, x = e.x + A.ux * hgt * ad, z = e.z + A.uz * hgt * ad;
  const roof = roofOf(A, e.y, r);
  const put = (px, py, pz, rh, ryU, ryD, an, ang, kf, kind, parent) => {
    const p = { x: px, y: py, z: pz, rh, ryU, ryD, an, ang, kf, age, kind, parent };
    out.push(p);
    return p;
  };
  if (e.still) return put(x, e.y, z, r, Math.min(0.86 * r, roof), 0.6 * r, 1, 0, 0.25, 1, null);
  const rng = mulberry32(e.seed), grow = 1 - Math.exp(-age / (600 * Math.sqrt(r / 1000)));
  // (how far it spreads: by how stable the air that stopped it is, and how hard it was rising; in a
  // tower only under the ceiling)
  const stab = tall ? stabTall(A, e) : stabOf(e), S = sat(-e.bu / 0.6) * (0.5 + 3 * Math.pow(sat((e.w - 4) / 22), 1.5));
  const sp = (tall && e.bu > -1 ? 0 : 0.3) * grow * (0.35 + 0.65 * stab), yc = e.y - Math.min(0.25 * age, 0.35 * r);
  // pressed flat under the air that stopped it; the underside sags as it ages; old domes soften
  const hp = put(x, yc, z, r * (1 + sp) * g, Math.min(r * lerp(tall ? 0.95 : 0.85, 0.3, stab) * lerp(0.85, 1.05, rng()) / (1 + 0.6 * sp), roof) * g,
    r * (0.6 + 0.45 * grow) * g, lerp(1, 1.35, rng()) * (1 + 0.2 * sp), rng() * PI, 0.3 + 0.15 * sat(age / 1500), 1, null);
  if (S > 0.15 && r > 350 && !tall) {
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
// A tall pulse as a heap of turrets: what one thermal after another, each a third to a half the
// size of what it rose through, leaves of a rising column. wake: the lumps the pulse left on its
// way up, in order (lift, with C.log: each with the bubble's own place and size as it passed), hd
// its head. The lumps, drawn in toward the path, are its body: broad where it leaves the sea,
// and narrower in stages, each standing to one side of the one that carries it (fewer thermals
// reach each height: a shoulder, not a drum's wall). All over the body and on its shoulders
// turrets stand out of it, of many sizes, packed so that each shows as a cap with creases around
// it, none in a row; the head a body of its own under the same turrets, the highest off its middle.
// Everything ages as a wake does (it widens, evaporates; nothing sooner than what stands on it),
// and as it ages its turrets melt into it: old parts soften. The wind leans the heap, a little
// in most air, far where it is strongly sheared (LEAN: there a tower leans out over the sea,
// something to fly under). None smaller than minR; a body too thin for turrets is the plain column
// of lumps a wake is.
// Its measures, against the bubble that rose through it: BODY, the body's radius (that of a body
// without turrets: WAKE); TURRET, a turret's radius, least to most (most are small, a few great:
// the mean lies 1/SKEW of the way), its centre SUNK of its radius under the body's surface, PACK
// radii from the next; FLARE, how much broader the foot; STAGE, how much of itself a stage keeps;
// LEAN, how far the heap may lean (m per m of height), in the usual shear and in the strongest;
// TURRET_MIN (m): a body whose turrets would be smaller has none.
const BODY = 0.62, WAKE = 0.85, TURRET = [0.25, 0.7], SKEW = 2.5, SUNK = [0.1, 0.4], PACK = 1.45, FLARE = 0.45, STAGE = [0.58, 0.85], LEAN = [0.25, 0.6], TURRET_MIN = 700;
export function heap(c, zs, wake, hd, seed, minR, out) {
  const A = c.A, rng = mulberry32(seed), H = Math.max(hd.y - zs, 1500);
  const tmin = Math.max(TURRET_MIN, 1.3 * minR), mean = TURRET[0] + (TURRET[1] - TURRET[0]) / SKEW, cover = PACK * PACK * 0.87;
  // the path: where the bubble was as it left each lump (a lump or two a step)
  const axis = [], step = [];
  for (const w of wake) {
    if (!axis.length || axis[axis.length - 1].t !== w.t) axis.push({ x: w.ax, y: w.ay, z: w.az, r: w.ar, t: w.t });
    step.push(axis.length - 1);
  }
  const x0 = axis.length ? axis[0].x : hd.x, z0 = axis.length ? axis[0].z : hd.z;
  // (a little narrower at its head than where it leaves the sea, its stages apart)
  const taper = lerp(0.8, 1, rng()), tap = y => lerp(1, taper, sat((y - zs) / H));
  // its stages, lowest first: around height y the body narrows to f of itself and steps aside, by
  // the share o of what it lost, toward a (stage: how narrow at a height, and how far aside by
  // then; never a finger: half the body's width at least, and wide enough for turrets of its own)
  const slim = clamp(1.4 * tmin / (mean * hd.r * taper), 0.5, 1);
  const stages = Array.from({ length: (rng() < 0.85) + (rng() < 0.55) + (rng() < 0.25) }, () => ({ y: zs + H * lerp(0.22, 0.82, rng()), f: lerp(STAGE[0], STAGE[1], rng()), a: rng() * 2 * PI, o: lerp(0.3, 1, rng()) })).sort((p, q) => p.y - q.y);
  const stage = y => {
    let f = 1, ox = 0, oz = 0;
    for (const s of stages) { const u = smoothstep(s.y - 0.05 * H, s.y + 0.05 * H, y), d = (1 - s.f) * s.o * BODY * hd.r * f * u; ox += Math.cos(s.a) * d; oz += Math.sin(s.a) * d; f *= lerp(1, s.f, u); }
    return { f: Math.max(f, slim), ox, oz };
  };
  // (a body too thin for turrets of its own keeps a wake's width: its billows are its turrets)
  const bare = rtm => 1 - smoothstep(0.75 * tmin, 1.25 * tmin, rtm), melt = ev => lerp(0.12, 0.8, smoothstep(0.35, 0.9, ev));
  // how far gone the path is at each height: nothing is further gone than what stands on it (the
  // dry air ate a neck into the heap under a head it had not reached yet: a mushroom), and the
  // head no less than the middle of the column under it
  const evOf = a => Math.max(c.age - a.t, 0) / lifeOf(c, { y: a.y, r: a.r, head: false });
  const evs = axis.map(evOf), upper = evs.filter((e, i) => axis[i].y > zs + H / 3).sort((p, q) => p - q);
  const evH = Math.max(Math.max(c.age - hd.t, 0) / lifeOf(c, hd), upper.length ? upper[upper.length >> 1] : 0);
  for (let i = axis.length - 1, m = evH; i >= 0; i--) m = evs[i] = Math.min(evs[i], m);
  // where the wind has taken what was at (x, y, z), `age` ago: with the wind of its height, but
  // the heap leans only so far (rising, and standing, it is fed from below: sheared as far as the
  // wind would take it, its upper parts hung in mid-air beside its foot, boulders over the sea)
  const most = lerp(LEAN[0], LEAN[1], smoothstep(1.4e-3, 1.7e-3, Math.hypot(A.ux, A.uz)));
  const lean = (x, y, z, age) => {
    const h = y - A.zs, dx = x + A.ux * h * age - x0, dz = z + A.uz * h * age - z0, k = Math.min(1, most * Math.max(y - zs, 0) / Math.max(Math.hypot(dx, dz), 1));
    return [x0 + dx * k, z0 + dz * k];
  };
  // the body at a place on the path: where it is now, how wide, how far gone
  const at = (a, ev) => {
    const age = Math.max(c.age - a.t, 0), g = Math.sqrt(Math.max(1 - ev * ev, 0)), [x, z] = lean(a.x, a.y, a.z, age), st = stage(a.y);
    // (broad where it swells out of the sea, and where the wake has had time to spread)
    const wid = Math.max(1 + 0.5 * (1 - Math.exp(-age / (900 * Math.sqrt(a.r / 1000)))), 1 + FLARE * smoothstep(0.5 * H, 0, a.y - zs));
    const rr = a.r * tap(a.y) * g * st.f, rtm = mean * rr;
    return { x: x + st.ox, y: a.y, z: z + st.oz, age, ev, g, wid, rr, rtm, R: lerp(BODY, WAKE, bare(rtm)) * rr * wid };
  };
  // the head: where settle has it (pressed, sagged), leaning with the heap, the size of its stage
  // (a smaller bubble's, its top where the pulse's was, its underside reaching down to the body)
  hd.colEv = evH;
  const hp = settle(c, hd, [], true), sh = stage(hd.y), yBody = hd.y - 0.45 * hd.r;
  if (hp) {
    [hp.x, hp.z] = lean(hd.x, hd.y, hd.z, hp.age);
    hp.x += sh.ox; hp.z += sh.oz; hp.y += (1 - sh.f) * hp.ryU; hp.ryU *= sh.f; hp.ryD = Math.max(hp.ryD * sh.f, hp.y - yBody);
  }
  // (the body's turrets go on up to the head)
  const yTop = hp ? hp.y - 0.45 * hd.r * sh.f : yBody;
  wake.forEach((w, n) => {
    const i = step[n];
    if (evs[i] >= 1 || w.ay > yBody) return;
    // (a lump 0.62 to 0.85 of the bubble that left it, 0.15 to 0.45 of it off the path: a quarter of
    // that here, or a small turret where the body had drawn back stood beside it, a stray ball)
    const p = at(axis[i], evs[i]), f = w.r / (0.735 * w.ar);
    out.push({ x: p.x + 0.25 * (w.x - w.ax), y: w.ay + 0.25 * (w.y - w.ay), z: p.z + 0.25 * (w.z - w.az), rh: p.R * f, ryU: Math.min(0.75 * w.ar, roofOf(A, w.ay, w.ar)) * p.g, ryD: 0.75 * w.ar * p.g,
      an: 1 + 0.25 * (p.wid - 1), ang: A.turn, kf: 0.9, age: p.age, kind: 0 });
  });
  // a turret of radius rt at (x, y, z) (it meets the others in a crease; old, in a fillet)
  const turret = (x, y, z, rt, age, ev, kind) => {
    const ryU = Math.min(rt * lerp(0.85, 1.2, rng()), Math.max(roofOf(A, y, rt), 0.3 * rt));
    const T = { x, y, z, rh: rt, ryU, ryD: rt * lerp(0.7, 0.95, rng()), an: lerp(1, 1.3, rng()), ang: rng() * PI, kf: melt(ev), age, kind };
    if (Math.min(rt, ryU) >= minR) out.push(T);
  };
  const size = rr => lerp(TURRET[0], TURRET[1], Math.pow(rng(), SKEW - 1)) * rr, sunk = () => lerp(SUNK[0], SUNK[1], rng());
  // each new turret where the ones before it left the most room, of a few places tried (dist: how
  // far apart two places on the surface are, in turrets)
  const last = [], place = dist => {
    let best = null, bd = -1;
    for (let k = 0; k < 4; k++) {
      const p = [rng(), rng(), 0];
      let d = 1e9;
      for (const o of last) d = Math.min(d, dist(p, o));
      if (d > bd) { bd = d; best = p; }
    }
    last.push(best);
    if (last.length > 16) last.shift();
    return best;
  };
  // the body at height y of the path
  const path = [...axis, { x: hd.x, y: hd.y, z: hd.z, r: hd.r, t: hd.t }].filter((a, i, l) => !i || a.y > l[i - 1].y);
  const along = y => {
    let k = 0;
    while (k < path.length - 2 && path[k + 1].y < y) k++;
    const p0 = path[k], p1 = path[k + 1], u = sat((y - p0.y) / Math.max(p1.y - p0.y, 1));
    return at({ x: lerp(p0.x, p1.x, u), y, z: lerp(p0.z, p1.z, u), r: lerp(p0.r, p1.r, u), t: lerp(p0.t, p1.t, u) }, evs[Math.min(k, evs.length - 1)] ?? evH);
  };
  // the body's turrets, a band of them at a time, from in the sea up (the lowest half sunk in it:
  // the heap swells out of the sea; on it, it was a ball on a table)
  for (let y = path.length > 1 ? zs - 0.5 * along(zs).rtm : 0; y < yTop && path.length > 1;) {
    const p = along(y), band = Math.max(1.6 * p.rtm, 500);
    if (p.ev < 1 && p.rtm > 0.75 * tmin) {
      // (fewer on old cloud: melted in, they hardly show)
      const turns = 2 * PI * p.R / p.rtm, n = Math.round(turns * band / (cover * p.rtm) * (1 - 0.5 * smoothstep(0.45, 0.9, p.ev)));
      for (let j = 0; j < n; j++) {
        const [fa, fy] = place((q, o) => { const da = Math.abs(q[0] - o[0]); return Math.hypot(Math.min(da, 1 - da) * turns, (q[1] - o[1] + o[2]) * band / p.rtm); });
        const rt = size(p.rr), rho = p.R - sunk() * rt, az = fa * 2 * PI;
        turret(p.x + Math.cos(az) * rho, y + fy * band, p.z + Math.sin(az) * rho, rt, p.age, p.ev, 3);
      }
      // (the band above sees these a band below)
      for (const o of last) o[2]++;
    }
    y += band;
  }
  // and on each stage's shoulder: on the body below it, beside the body above
  for (const s of path.length > 1 ? stages : []) {
    const lo = along(s.y - 0.06 * H), hi = along(s.y + 0.06 * H);
    if (s.y > yTop || lo.ev >= 1 || lo.rtm <= 0.75 * tmin) continue;
    for (let n = Math.round(PI * Math.max(lo.R * lo.R - hi.R * hi.R, 0) / (cover * lo.rtm * lo.rtm)); n > 0; n--) {
      const a = rng() * 2 * PI, rt = size(lo.rr), d = Math.max(lo.R - 0.5 * rt, 0) * Math.sqrt(rng()), x = lo.x + Math.cos(a) * d, z = lo.z + Math.sin(a) * d, up = lerp(-0.3, 0.2, rng()) * rt;
      if (Math.hypot(x - hi.x, z - hi.z) > hi.R - 0.3 * rt) turret(x, s.y + up, z, rt, lo.age, lo.ev, 3);
    }
  }
  // the head's own turrets
  if (!hp) return;
  const rr = hp.rh * taper * sh.f, rtm = mean * rr, hb = bare(rtm);
  hp.rh = lerp(BODY, 1, hb) * rr;
  if (hb >= 1) { out.push(hp); return; }
  hp.ryU *= lerp(0.6, 1, hb);
  out.push({ ...hp, kf: 0.6 });
  last.length = 0;
  // (the first is the summit, the greatest, off the middle; the others over the dome below it,
  // down to its widest)
  const n = Math.round(2 * PI * hp.rh * hp.rh / (cover * rtm * rtm) * 0.8), dome = (q, o) => { const da = Math.abs(q[0] - o[0]), e = 0.5 * (q[1] + o[1]); return Math.hypot(Math.min(da, 1 - da) * 2 * PI * Math.sqrt(1 - e * e), q[1] - o[1]) * hp.rh / rtm; };
  for (let i = 0; i < n; i++) {
    const [fa, fe] = i ? place(dome) : (last.push([rng(), lerp(0.75, 0.97, rng()), 0]), last[0]);
    const se = i ? 0.85 * fe : fe, ce = Math.sqrt(1 - se * se), rt = i ? size(rr) : lerp(0.8, 1.1, rng()) * TURRET[1] * rr, s = sunk(), rho = hp.rh - s * rt, az = fa * 2 * PI;
    turret(hp.x + Math.cos(az) * ce * rho, hp.y + se * (hp.ryU - s * Math.min(rt, hp.ryU)), hp.z + Math.sin(az) * ce * rho, rt, hp.age, evH, 1);
  }
}
// keep the start clear: nothing stands where the bird sets out (its height set again by the spawn
// draw, cells.js, as it moves the restless air, which raises the sea)
export let START_Y = seaLevelAt(0, 0) + 750;
export function setStartY() { START_Y = seaLevelAt(0, 0) + 750; }
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
