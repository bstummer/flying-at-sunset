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
//
//   node tools/light/reference.js [--paths 100000] [--cases top,face] [--fresh]
// The Monte Carlo's results are kept in screenshots/light/reference.json (--fresh: again; made again
// on their own once the medium changes, constants.js).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEDIUM, PHASES, SUN, ball, radiance, slab, viewDir } from './mc.js';
import { traceRadiance } from './model.js';

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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rows = reference({ fresh: process.argv.includes('--fresh'), only: arg('cases', null)?.split(',') });
  const f = x => x.toFixed(4).padStart(8), r2 = x => x.toFixed(2).padStart(6);
  console.log('                    cloud (g 0.85)                trace phase   trace');
  console.log('case          view     all ± err        past ss   all           all      /cloud   past ss  /cloud');
  for (const r of rows) {
    const all = traceRadiance(r.shape, r.v), ms = all - traceRadiance(r.shape, r.v, { light: ssOnly });
    console.log(`${r.key.padEnd(20)} ${f(r.L)} ± ${(r.err / r.L * 100).toFixed(1).padStart(4)}%  ${f(r.ms)}  ${f(r.trace)}     ${f(all)} ${r2(all / r.L)}  ${f(ms)} ${r2(ms / r.ms)}`);
  }
}
