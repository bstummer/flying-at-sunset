// The sky's light for the light's reference (tools/light/): the sky view the page computes on the GPU
// (shaders/skyview.wgsl, 192 × 108, at the start's height) and the ambient light it makes of it
// (bAmb: irradiance / π on a face up, toward the sun and away from it), read out of the built page
// once and kept in screenshots/light/sky.json (made again when the atmosphere's shaders or constants
// change), and looked up in Node as chunks/atmo.wgsl does (skyLookup). In units of sunlight above
// the atmosphere, as the sun's colour (render/sun.js).
//
//   import { loadSky } from './sky.js';
//   const sky = await loadSky();
//   sky.radiance([0, 1, 0])             // the zenith's [r, g, b]
//   sky.amb.up                          // the trace's bAmb.up
//
//   node tools/light/sky.js             // capture it again (needs a fresh build: npm run build)

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIE_A, MIE_H, MIE_S, OZO_A, RAY_H, RAY_S, RG, RT, SUN_DIR } from '../../src/constants.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'screenshots', 'light', 'sky.json');
const W = 192, H = 108;
// what the sky is made of: the shaders that make it, the atmosphere and the sun
const KEY = createHash('sha1').update(JSON.stringify([RG, RT, RAY_S, RAY_H, MIE_S, MIE_A, MIE_H, OZO_A, SUN_DIR]))
  .update(['skyview', 'multiscatter', 'transmittance', 'chunks/atmo', 'chunks/common'].map(f => readFileSync(join(ROOT, 'src', 'shaders', `${f}.wgsl`), 'utf8')).join('')).digest('hex');

// what the page hands over: the sky view as the trace samples it, the ambient buffer, the height
const read = async () => {
  const D = window.__debug;
  const sky = await D.readTexture(D.T.sky);
  const p = await D.probe();
  return { camH: D.cam.pos[1], sky: Array.from(sky), amb: p.amb };
};

async function capture() {
  const { assertFreshBuild, launch, testRender } = await import('../browser.js');
  assertFreshBuild();
  const { browser, gl } = await launch('auto');
  try {
    const r = await testRender(browser, { frames: '3', w: '160', h: '90' }, { read });
    if (r.problems.length) throw new Error(`the page failed: ${r.problems.map(p => p.text).join('; ')}`);
    const out = { gl, key: KEY, ...r.read };
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(out));
    return out;
  } finally {
    await browser.close();
  }
}

// skyParamsToUv and a bilinear lookup (the texture's rows in memory order: row 0 is uv.y 0)
function lookup(d, dir) {
  const r = RG + Math.max(d.camH * 0.001, 0.01);
  const vH = Math.sqrt(Math.max(r * r - RG * RG, 0)), beta = Math.acos(Math.min(Math.max(vH / r, -1), 1)), zha = Math.PI - beta;
  const l1 = Math.hypot(dir[0], dir[2]), l2 = Math.hypot(SUN_DIR[0], SUN_DIR[2]);
  const lvc = l1 > 1e-5 ? (dir[0] * SUN_DIR[0] + dir[2] * SUN_DIR[2]) / (l1 * l2) : 1;
  // (below the horizon the planet's ground: distToGround > 0)
  const disc = r * r * (dir[1] * dir[1] - 1) + RG * RG, ground = dir[1] < 0 && disc >= 0 && -r * dir[1] - Math.sqrt(disc) > 0;
  const a = Math.acos(Math.min(Math.max(dir[1], -1), 1));
  let v;
  if (!ground) { const c = a / zha; v = (1 - Math.sqrt(Math.max(1 - c, 0))) * 0.5; }
  else { const c = (a - zha) / beta; v = Math.sqrt(Math.max(c, 0)) * 0.5 + 0.5; }
  const u = Math.sqrt(Math.min(Math.max(-lvc * 0.5 + 0.5, 0), 1));
  const fx = u * (W - 1), fy = v * (H - 1), x0 = Math.min(Math.floor(fx), W - 2), y0 = Math.min(Math.floor(fy), H - 2), tx = fx - x0, ty = fy - y0;
  const at = (x, y, c) => d.sky[(y * W + x) * 4 + c];
  return [0, 1, 2].map(c => (at(x0, y0, c) * (1 - tx) + at(x0 + 1, y0, c) * tx) * (1 - ty) + (at(x0, y0 + 1, c) * (1 - tx) + at(x0 + 1, y0 + 1, c) * tx) * ty);
}

// The sky, captured again if it is missing or the atmosphere changed
export async function loadSky({ fresh = false } = {}) {
  let d = !fresh && existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
  if (!d || d.key !== KEY) d = await capture();
  return { camH: d.camH, amb: d.amb, radiance: dir => lookup(d, dir) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await loadSky({ fresh: true });
  const f = v => v.map(x => x.toFixed(4)).join(', ');
  console.log(`the sky at ${s.camH.toFixed(0)} m: zenith ${f(s.radiance([0, 1, 0]))}, horizon toward the sun ${f(s.radiance([0, 0.02, -1]))}, away ${f(s.radiance([0, 0.02, 1]))}`);
  console.log(`bAmb up ${f(s.amb.up)}, sunSide ${f(s.amb.sunSide)}, antiSun ${f(s.amb.antiSun)}`);
}
