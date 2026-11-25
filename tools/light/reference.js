// The trace's light against the ground truth (tools/light/), on shapes of cloud lit by the sun alone:
// a flat top, slopes turned to the sun, a face square to it, walls lit from behind (a tower's shaded
// side: what diffuses through), and balls (a tower, a billow) lit, edge-on and shaded. Per view, the
// radiance per unit of sunlight from the Monte Carlo (mc.js) with a cloud's phase (g 0.85): all of it,
// and what scattered more than once; with the trace's own phase (its single scattering's, more light
// back toward the sun); and the trace's (model.js): all of it and past single scattering (its first
// octave, with the exact optical depth), each against the cloud's. The trace's light was fitted to
// these (sunScatter's DIFFUSE and powers, the octaves' lobes); isolated small balls are off by design
// (the trace can't know how much cloud lies behind a billow; on a real cloud, a whole body). Views:
// the heading from the sun's (0 toward it, 180 away), how far down (°).
// Then the shade (shadeReference): the same shapes in colour under the sky the page computes
// (sky.js), in another cloud's shadow or lit, beside a sunlit wall, folds between walls at 30–60°,
// an overhang's underside over a sea lit or in shadow; and the trace's light with its sky light
// (model.js, traceUnder), against it and, on the tops, each against the lit top seen the same way.
// The trace's sky light was fitted to these (the openness, the sea's bounce, the view's angle).
//
//   node tools/light/reference.js [--paths 100000] [--cases top,face] [--shade] [--fresh]
// (--shade: the shade alone.) The Monte Carlo's results are kept in screenshots/light/reference.json
// and shade.json (--fresh: again; made again on their own once the medium or the sky changes).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEDIUM, PHASES, SUN, ball, fold, radiance, radianceUnder, slab, viewDir } from './mc.js';
import { traceRadiance, traceUnder } from './model.js';
import { loadSky } from './sky.js';
import { sunColorAt } from '../../src/render/sun.js';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const PATHS = +arg('paths', 1e5);
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'screenshots', 'light', 'reference.json');
// a slope turned to the sun by a from level (90: upright)
const slope = a => { const r = a * Math.PI / 180; return [0, Math.cos(r), -Math.sin(r)]; };
const LIT = [[180, 0], [180, 20]], SHADE = [[0, 0], [0, 20]], EDGE = [[-90, 10]];
const CASES = [
  { name: 'top', shape: slab([0, 1, 0], 800), views: [[0, 3], [0, 10], [0, 30], [90, 10], [90, 30], [180, 10], [180, 30], [180, 60], [0, 90]] },
  { name: 'slope20', shape: slab(slope(20), 2000), views: [[180, 10], [180, 30], [90, 20]] },
  { name: 'slope45', shape: slab(slope(45), 2000), views: [[180, 10], [180, 30], [90, 20]] },
  { name: 'face', shape: slab(SUN, 2000), views: [[180, 0], [180, 20], [135, 10], [100, 10]] },
  { name: 'wall150', shape: slab([0, 0, 1], 150), views: [...SHADE, [45, 10]] },
  { name: 'wall500', shape: slab([0, 0, 1], 500), views: [...SHADE, [45, 10]] },
  { name: 'wall1500', shape: slab([0, 0, 1], 1500), views: [[0, 0], [45, 10]] },
  { name: 'tower-lit', shape: ball(SUN, 750), views: LIT },
  { name: 'tower-edge', shape: ball([1, 0, 0], 750), views: EDGE },
  { name: 'tower-shade', shape: ball([0, 0, 1], 750), views: SHADE },
  { name: 'billow-lit', shape: ball(SUN, 100), views: LIT },
  { name: 'billow-edge', shape: ball([1, 0, 0], 100), views: EDGE },
  { name: 'billow-shade', shape: ball([0, 0, 1], 100), views: SHADE },
];

// every case's views the viewer can see, with the Monte Carlo's numbers (from the cache when there)
export function reference({ paths = PATHS, fresh = false, only = null } = {}) {
  const cache = !fresh && existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
  const rows = [];
  for (const c of CASES) {
    if (only && !only.includes(c.name)) continue;
    const s = c.shape;
    for (const [az, dep] of c.views) {
      const v = viewDir(az, dep);
      if (v[0] * s.n[0] + v[1] * s.n[1] + v[2] * s.n[2] >= 0) continue;
      const key = `${c.name} ${az}/${dep}`;
      let mc = cache[key];
      if (!mc || mc.paths < paths || mc.medium !== MEDIUM) {
        const all = radiance(s, v, { phase: PHASES.cloud, paths }), ss = radiance(s, v, { phase: PHASES.cloud, orders: 1, paths });
        mc = cache[key] = { medium: MEDIUM, paths, L: all.L, err: all.err, ss: ss.L, trace: radiance(s, v, { phase: PHASES.trace, paths, seed: 2 }).L };
      }
      rows.push({ key, name: c.name, shape: s, v, ...mc, ms: mc.L - mc.ss });
    }
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(cache, null, 1));
  return rows;
}

// the trace's single scattering: its first octave with the exact optical depth
export const ssOnly = c => Math.exp(-c.tauExact) * c.ph[0] * c.pw;

// The shade: shapes under the sky (sky.js, at the start's height) and beside sunlit cloud, in colour.
// The sun lights a case (its colour at that height) or lies behind another cloud (null: in its
// shadow); env: what a path leaving the shape meets (the sky; a sunlit wall standing on the side
// away from the sun, 0–15° up over 120° around; under an overhang, the sea below, lit or itself in
// shadow, as the Monte Carlo's own top sends it that way). seaLit: how much of the sea below the
// trace takes as lit (its lit map's). The reference knows no absorption and no other light.
const TOPV = [[0, 10], [0, 30], [90, 20], [180, 10], [180, 30], [0, 90]];
const SHADE_CASES = [
  { name: 'top lit', shape: slab([0, 1, 0], 800), sun: true, env: 'sky', seaLit: 1, views: TOPV },
  { name: 'top in shadow', shape: slab([0, 1, 0], 800), sun: false, env: 'sky', seaLit: 0, views: TOPV },
  { name: 'top in shadow, lit wall', shape: slab([0, 1, 0], 800), sun: false, env: 'wall', seaLit: 0, views: TOPV },
  { name: 'fold in shadow', shape: fold(45, 1500), sun: false, env: 'sky', seaLit: 0, views: [[90, 30], [90, 60], [180, 60], [0, 60], [0, 90]] },
  { name: 'fold 30° in shadow', shape: fold(30, 1500), sun: false, env: 'sky', seaLit: 0, views: [[90, 60], [0, 90]] },
  { name: 'fold 60° in shadow', shape: fold(60, 1500), sun: false, env: 'sky', seaLit: 0, views: [[90, 70], [0, 90]] },
  { name: 'belly, lit sea', shape: slab([0, -1, 0], 800), sun: true, env: 'sea lit', seaLit: 1, views: [[0, -30], [180, -30], [90, -60], [0, -90]] },
  { name: 'belly, sea in shadow', shape: slab([0, -1, 0], 800), sun: true, env: 'sea shade', seaLit: 0, views: [[0, -30], [180, -30], [90, -60], [0, -90]] },
  { name: 'face lit', shape: slab(SUN, 2000), sun: true, env: 'sky', seaLit: 1, views: [[180, 0], [135, 10]] },
  { name: 'tower shade', shape: slab([0, 0, 1], 1500), sun: true, env: 'sky', seaLit: 1, views: [[0, 0], [0, 20]] },
];
const SEA_DEPS = [2, 10, 30, 60, 90], SEA_AZS = [0, 45, 90, 135, 180];

export async function shadeReference({ paths = PATHS / 5, fresh = false, only = null } = {}) {
  const sky = await loadSky();
  const sun = sunColorAt(sky.camH), SKY = `${MEDIUM}, sky at ${sky.camH.toFixed(0)} m ${sky.amb.up.map(x => x.toFixed(5))}`;
  const cache = !fresh && existsSync(OUT_SHADE) ? JSON.parse(readFileSync(OUT_SHADE, 'utf8')) : {};
  const run = (key, s, v, opts, n = paths) => {
    let mc = cache[key];
    if (!mc || mc.paths < n || mc.medium !== SKY) mc = cache[key] = { medium: SKY, paths: n, ...radianceUnder(s, v, { ...opts, paths: n }) };
    return mc;
  };
  // the sea seen from above, lit or in shadow, along each way down (as the overhang's paths meet it)
  const top = slab([0, 1, 0], 800);
  const seaTable = lit => SEA_DEPS.map(d => SEA_AZS.map(a => run(`sea ${lit ? 'lit' : 'shade'} ${a}/${d}`, top, viewDir(a, d), { sun: lit ? sun : null, env: sky.radiance }, paths / 4).L));
  const seen = (table, w) => {
    const dep = Math.asin(Math.min(-w[1], 1)) * 180 / Math.PI, h = Math.hypot(w[0], w[2]);
    const az = h > 1e-6 ? Math.acos(Math.max(-1, Math.min(1, -w[2] / h))) * 180 / Math.PI : 0;
    const k = (xs, x) => { let i = 0; while (i < xs.length - 2 && x > xs[i + 1]) i++; return [i, Math.max(0, Math.min(1, (x - xs[i]) / (xs[i + 1] - xs[i])))]; };
    const [i, ti] = k(SEA_DEPS, dep), [j, tj] = k(SEA_AZS, az);
    return [0, 1, 2].map(c => mix(mix(table[i][j][c], table[i][j + 1][c], tj), mix(table[i + 1][j][c], table[i + 1][j + 1][c], tj), ti));
  };
  const seaLit = seaTable(true), seaShade = seaTable(false);
  const wallL = run('wall', slab(SUN, 2000), viewDir(180, 0), { sun, env: sky.radiance }).L;
  const ENV = {
    sky: sky.radiance,
    wall: w => { const el = Math.asin(w[1]) * 180 / Math.PI, az = Math.atan2(Math.abs(w[0]), w[2]) * 180 / Math.PI; return el >= 0 && el < 15 && az < 60 ? wallL : sky.radiance(w); },
    'sea lit': w => w[1] < 0 ? seen(seaLit, w) : sky.radiance(w),
    'sea shade': w => w[1] < 0 ? seen(seaShade, w) : sky.radiance(w),
  };
  // the trace's: the sky as the ambient buffer has it, the sea's bounce as render/frame.js makes it
  const sea = sunColorAt(1500).map(x => x * SEA_ALBEDO * SUN[1] / Math.PI);
  const rows = [];
  for (const c of SHADE_CASES) {
    if (only && !only.includes(c.name)) continue;
    for (const [az, dep] of c.views) {
      const v = viewDir(az, dep), key = `${c.name} ${az}/${dep}`;
      const mc = run(key, c.shape, v, { sun: c.sun ? sun : null, env: ENV[c.env] });
      const trace = traceUnder(c.shape, v, { sky: sky.amb, sea, seaLit: c.seaLit, dist: 1000, sun: c.sun ? sun : null });
      rows.push({ key, name: c.name, view: `${az}/${dep}`, mc: mc.L, err: mc.err, trace });
    }
  }
  mkdirSync(dirname(OUT_SHADE), { recursive: true });
  writeFileSync(OUT_SHADE, JSON.stringify(cache, null, 1));
  return { rows, sky, sun };
}
const SEA_ALBEDO = 0.89;
const OUT_SHADE = join(dirname(OUT), 'shade.json');
const mix = (a, b, t) => a + (b - a) * t;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const only = arg('cases', null)?.split(',');
  if (!process.argv.includes('--shade')) {
    const rows = reference({ fresh: process.argv.includes('--fresh'), only });
    const f = x => x.toFixed(4).padStart(8), r2 = x => x.toFixed(2).padStart(6);
    console.log('                    cloud (g 0.85)                trace phase   trace');
    console.log('case          view     all ± err        past ss   all           all      /cloud   past ss  /cloud');
    for (const r of rows) {
      const all = traceRadiance(r.shape, r.v), ms = all - traceRadiance(r.shape, r.v, { light: ssOnly });
      console.log(`${r.key.padEnd(20)} ${f(r.L)} ± ${(r.err / r.L * 100).toFixed(1).padStart(4)}%  ${f(r.ms)}  ${f(r.trace)}     ${f(all)} ${r2(all / r.L)}  ${f(ms)} ${r2(ms / r.ms)}`);
    }
  }
  if (process.argv.includes('--shade') || !only) {
    const { rows, sky } = await shadeReference({ fresh: process.argv.includes('--fresh'), only });
    const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const rgb = c => c.map(x => (x * 1000).toFixed(1).padStart(6)).join('');
    const litTop = Object.fromEntries(rows.filter(r => r.name === 'top lit').map(r => [r.view, r]));
    console.log(`\nThe shade (×1000 per unit of sunlight; the sky at ${sky.camH.toFixed(0)} m, sky.js): the Monte Carlo and the trace (before its`);
    console.log('saturation), each in rgb and luminance; the trace against it; and, on the tops, each against the lit top seen the same way');
    console.log('case                      view        cloud (rgb)          lum  ± err        trace (rgb)        lum  /cloud   cloud/lit  trace/lit');
    for (const r of rows) {
      const l = litTop[r.view], shareM = l && r.name.startsWith('top') ? (lum(r.mc) / lum(l.mc) * 100).toFixed(0).padStart(5) + '%' : '', shareT = l && r.name.startsWith('top') ? (lum(r.trace) / lum(l.trace) * 100).toFixed(0).padStart(5) + '%' : '';
      console.log(`${r.name.padEnd(25)} ${r.view.padEnd(8)} ${rgb(r.mc)} ${(lum(r.mc) * 1000).toFixed(2).padStart(7)} ${(lum(r.err) / lum(r.mc) * 100).toFixed(1).padStart(4)}%   ${rgb(r.trace)} ${(lum(r.trace) * 1000).toFixed(2).padStart(7)} ${(lum(r.trace) / lum(r.mc)).toFixed(2).padStart(6)}   ${shareM.padStart(8)}   ${shareT.padStart(8)}`);
    }
  }
}
