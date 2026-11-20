// The light of a cloud by Monte Carlo (tools/light/): a slab of the trace's medium (σ 0.07/m, no
// absorption) facing any way, as thick as asked, or a ball, lit by the sun alone (SUN_DIR: 5° up,
// toward −Z, irradiance 1), and the radiance it sends toward a viewer. Backward path tracing from the viewer,
// the sun sampled at every scattering (next-event estimation): the ground truth the trace's light
// (model.js) is held to.
//
//   import { slab, viewDir, radiance, PHASES } from './mc.js';
//   const s = slab([0, 1, 0], 800);                   // a flat top, 800 m of cloud below it
//   radiance(s, viewDir(180, 30), { phase: PHASES.cloud, paths: 2e5 })   // seen from the sun's side, 30° down
//
// A slab is the cloud between the plane through the origin with outward normal n and the plane H
// behind it; the viewer looks at the origin from outside. The sun may light it from the back
// (a tower's shaded side: the light that diffuses through).

import { mulberry32 } from '../../src/math.js';
import { SUN_DIR } from '../../src/constants.js';

export const SIGMA = 0.07;      // 1/m, as chunks/clip.wgsl
export const SUN = SUN_DIR;

const hg = (c, g) => (1 - g * g) / (4 * Math.PI * Math.pow(Math.max(1 + g * g - 2 * g * c, 1e-12), 1.5));
// phase functions as lobes of Henyey-Greenstein: [weight, g]
function phase(lobes) {
  return {
    lobes,
    eval: c => lobes.reduce((s, [w, g]) => s + w * hg(c, g), 0),
    sample(r) {
      let u = r(), k = 0;
      while (k < lobes.length - 1 && u > lobes[k][0]) { u -= lobes[k][0]; k++; }
      const g = lobes[k][1], x = r();
      if (Math.abs(g) < 1e-4) return 1 - 2 * x;
      const s = (1 - g * g) / (1 - g + 2 * g * x);
      return (1 + g * g - s * s) / (2 * g);
    },
  };
}
// cloud: real droplets' asymmetry (g 0.85: the diffusion's 0.11 assumes it); trace: the trace's
// first octave (chunks/cloud.wgsl phaseOctaves), more light scattered back
export const PHASES = { cloud: phase([[1, 0.85]]), trace: phase([[0.38, -0.3], [0.62, 0.8]]) };

const norm = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
export function slab(n, H) {
  n = norm(n);
  const dot = (x, y, z) => x * n[0] + y * n[1] + z * n[2];
  return {
    n, H,
    // signed distance (negative inside)
    sdf: p => { const a = dot(p[0], p[1], p[2]); return Math.max(a, -H - a); },
    // the outward normal of the face nearest p
    normal: p => { const a = dot(p[0], p[1], p[2]); return a > -H / 2 ? n : [-n[0], -n[1], -n[2]]; },
    // how far a ray from (x, y, z) inside goes along w before it leaves
    exit(x, y, z, w0, w1, w2) {
      const a = dot(x, y, z), b = dot(w0, w1, w2);
      return b > 1e-12 ? -a / b : b < -1e-12 ? (-H - a) / b : Infinity;
    },
  };
}
// a ball of radius R whose surface passes through the origin with outward normal n there (a bulge,
// a tower: light leaks out of its sides on the way through, unlike a slab)
export function ball(n, R) {
  n = norm(n);
  const c = [-R * n[0], -R * n[1], -R * n[2]];
  return {
    n, R,
    sdf: p => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - R,
    normal: p => norm([p[0] - c[0], p[1] - c[1], p[2] - c[2]]),
    exit(x, y, z, w0, w1, w2) {
      const q0 = x - c[0], q1 = y - c[1], q2 = z - c[2];
      const b = q0 * w0 + q1 * w1 + q2 * w2, cc = q0 * q0 + q1 * q1 + q2 * q2 - R * R;
      return -b + Math.sqrt(Math.max(b * b - cc, 0));
    },
  };
}
// a view direction: az the heading from the sun's (0 toward it, 180 away), dep how far down (degrees)
export function viewDir(az, dep) {
  const a = az * Math.PI / 180, e = dep * Math.PI / 180;
  return [Math.sin(a) * Math.cos(e), -Math.sin(e), -Math.cos(a) * Math.cos(e)];
}

// The radiance toward the viewer looking along v at the slab's origin, per unit of sunlight, and its
// standard error. orders: how many scatterings to follow (1: single scattering alone).
export function radiance(s, v, { phase = PHASES.cloud, paths = 1e5, orders = Infinity, maxEvents = 1e5, seed = 1 } = {}) {
  const r = mulberry32(seed), [L0, L1, L2] = SUN;
  let sum = 0, sum2 = 0;
  for (let p = 0; p < paths; p++) {
    let x = 0, y = 0, z = 0, [w0, w1, w2] = v, acc = 0;
    for (let k = 0; k < maxEvents; k++) {
      const t = -Math.log(1 - r()) / SIGMA;
      if (t >= s.exit(x, y, z, w0, w1, w2)) break;
      x += w0 * t; y += w1 * t; z += w2 * t;
      const tl = s.exit(x, y, z, L0, L1, L2);
      acc += phase.eval(w0 * L0 + w1 * L1 + w2 * L2) * Math.exp(-SIGMA * tl);
      if (k + 1 >= orders) break;
      // a new direction at cos c from the old, around it at a random angle
      const c = phase.sample(r), sn = Math.sqrt(Math.max(0, 1 - c * c)), ph = 2 * Math.PI * r();
      const ax = Math.abs(w0) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      let u0 = ax[1] * w2 - ax[2] * w1, u1 = ax[2] * w0 - ax[0] * w2, u2 = ax[0] * w1 - ax[1] * w0;
      const ul = Math.hypot(u0, u1, u2); u0 /= ul; u1 /= ul; u2 /= ul;
      const b0 = w1 * u2 - w2 * u1, b1 = w2 * u0 - w0 * u2, b2 = w0 * u1 - w1 * u0;
      const cp = Math.cos(ph) * sn, sp = Math.sin(ph) * sn;
      w0 = c * w0 + cp * u0 + sp * b0; w1 = c * w1 + cp * u1 + sp * b1; w2 = c * w2 + cp * u2 + sp * b2;
    }
    sum += acc; sum2 += acc * acc;
  }
  const m = sum / paths;
  return { L: m, err: Math.sqrt(Math.max(sum2 / paths - m * m, 0) / paths) };
}
