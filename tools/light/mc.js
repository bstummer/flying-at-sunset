// The light of a cloud by Monte Carlo (tools/light/): a slab of the clouds' medium (constants.js:
// σ 0.07/m, no absorption, thinner over its first metres below the surface) facing any way, as thick
// as asked, a ball, or a fold (a crease between two slopes), lit by the sun alone (SUN_DIR: 5° up,
// toward −Z, irradiance 1), and the radiance it sends toward a viewer; or in colour under a sky and
// beside other clouds (radianceUnder: what a path meets when it leaves, the sun's colour or its
// shadow). Backward path tracing from the viewer, the sun sampled at every
// scattering (next-event estimation), free paths through the profile by delta tracking and the
// sun's optical depth through it in closed form: the ground truth the trace's light (model.js) is
// held to.
//
//   import { slab, viewDir, radiance, radianceUnder, PHASES } from './mc.js';
//   const s = slab([0, 1, 0], 800);                   // a flat top, 800 m of cloud below it
//   radiance(s, viewDir(180, 30), { phase: PHASES.cloud, paths: 2e5 })   // seen from the sun's side, 30° down
//   radianceUnder(s, viewDir(0, 90), { sun: null, env: sky.radiance })  // in another cloud's shadow, sky.js's sky
//
// A slab is the cloud between the plane through the origin with outward normal n and the plane H
// behind it; the viewer looks at the origin from outside. The sun may light it from the back
// (a tower's shaded side: the light that diffuses through).

import { mulberry32 } from '../../src/math.js';
import { CLOUD_EDGE0, CLOUD_EDGE_W, SIGMA, SUN_DIR } from '../../src/constants.js';

export { SIGMA };
export const SUN = SUN_DIR;
// the medium's profile as chunks/cloud.wgsl's: the density at depth x below the surface, the depth
// of full density as much cloud as lies above x, and the mean density over depths x ± r (inside)
const E0 = CLOUD_EDGE0, EW = CLOUD_EDGE_W;
export const profile = x => x < 0 ? 0 : E0 + (1 - E0) * Math.min(x / EW, 1);
export function profileDepth(x) {
  const a = Math.min(Math.max(x, 0), EW);
  return E0 * Math.max(x, 0) + (1 - E0) * (a * a / (2 * EW) + Math.max(x - EW, 0));
}
export function profileMean(x, r) {
  const a = Math.max(x - r, 0), b = Math.max(x + r, 0);
  return b - a < 0.5 ? profile(b) : (profileDepth(b) - profileDepth(a)) / (b - a);
}
// the medium as the cache knows it (reference.js: numbers of another medium are made again)
export const MEDIUM = `σ ${SIGMA}, edge ${E0} over ${EW} m`;

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
    // the depth of full density as much cloud as lies along that ray for a length l (the depth
    // below the nearer face runs linearly on either side of the middle plane)
    od(x, y, z, w0, w1, w2, l) {
      const a0 = dot(x, y, z), b = dot(w0, w1, w2), a1 = a0 + b * l, m = -H / 2;
      const piece = (p, q) => {   // a from p to q on one side of the middle
        const u = c => c > m ? -c : H + c, du = Math.abs(u(q) - u(p));
        return du < 1e-9 ? profile(u(p)) * Math.abs(q - p) / Math.max(Math.abs(b), 1e-12) : Math.abs(profileDepth(u(q)) - profileDepth(u(p))) * Math.abs(q - p) / du / Math.max(Math.abs(b), 1e-12);
      };
      if (Math.abs(b) < 1e-12) return profile(Math.min(-a0, H + a0)) * l;
      return (a0 - m) * (a1 - m) < 0 ? piece(a0, m) + piece(m, a1) : piece(a0, a1);
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
    // the same for a ball: all of the length, less what the profile takes where the ray is within
    // its width of the surface (r from the centre over R - EW: the deficit (1 - E0)(r - R + EW) / EW,
    // r = √(h² + s²) along the ray, integrated in closed form)
    od(x, y, z, w0, w1, w2, l) {
      const q0 = x - c[0], q1 = y - c[1], q2 = z - c[2];
      const s0 = q0 * w0 + q1 * w1 + q2 * w2, h2 = Math.max(q0 * q0 + q1 * q1 + q2 * q2 - s0 * s0, 0), Ri = R - EW;
      const F = s => { const r = Math.sqrt(h2 + s * s); return 0.5 * (s * r + h2 * Math.log(Math.max(s + r, 1e-12))) - Ri * s; };
      const part = (p, q) => q > p ? F(q) - F(p) : 0;
      const x0 = s0, x1 = s0 + l, xw = h2 < Ri * Ri ? Math.sqrt(Ri * Ri - h2) : 0;
      const def = part(x0, Math.min(x1, -xw)) + part(Math.max(x0, xw), x1);
      return l - (1 - E0) / EW * def;
    },
  };
}
// a view direction: az the heading from the sun's (0 toward it, 180 away), dep how far down (degrees)
export function viewDir(az, dep) {
  const a = az * Math.PI / 180, e = dep * Math.PI / 180;
  return [Math.sin(a) * Math.cos(e), -Math.sin(e), -Math.cos(a) * Math.cos(e)];
}

// a fold: the crease between two slopes rising at a (degrees) on either side of a line through the
// origin across the sun's way (along x), or along it; the cloud below both, down to H under the
// crease. In shade only (the sun can't come out of it but along the crease): it has no optical
// depth toward the sun.
export function fold(a, H, along = false) {
  const t = Math.tan(a * Math.PI / 180), c = Math.cos(a * Math.PI / 180), sn = Math.sin(a * Math.PI / 180);
  const edges = [[c, sn], [-c, sn]];
  return {
    n: [0, 1, 0], H,
    // (q: the coordinate across the crease) in the open wedge the nearer slope; inside, the
    // distance to the wedge (to its edges) or to the bottom
    sdf(p) {
      const q = along ? p[0] : p[2], y = p[1];
      if (y > Math.abs(q) * t) return Math.min(y * c - q * sn, y * c + q * sn);
      return Math.max(-Math.min(...edges.map(([eq, ey]) => { const s = Math.max(q * eq + y * ey, 0); return Math.hypot(q - s * eq, y - s * ey); })), -H - y);
    },
    // a ray leaves for good through the bottom, or into the open wedge heading up out of it
    exit(x, y, z, w0, w1, w2) {
      const q = along ? x : z, wq = along ? w0 : w2;
      if (w1 < 0) return (-H - y) / w1;
      if (w1 <= Math.abs(wq) * t) return Infinity;
      // where it enters the wedge: past both slopes
      const ta = (q * sn - y * c) / (w1 * c - wq * sn), tb = (-q * sn - y * c) / (w1 * c + wq * sn);
      return Math.max(ta, tb, 0);
    },
    od: () => Infinity,
  };
}

// The radiance toward the viewer looking along v at the slab's origin, per unit of sunlight, and its
// standard error. orders: how many scatterings to follow (1: single scattering alone).
export function radiance(s, v, { phase = PHASES.cloud, paths = 1e5, orders = Infinity, maxEvents = 1e5, seed = 1 } = {}) {
  const { L, err } = walk(s, v, { phase, paths, orders, maxEvents, seed, sun: [1, 0, 0], env: null });
  return { L: L[0], err: err[0] };
}
// The same in colour, under a sky and beside other clouds: the sun's colour (sun; null: in another
// cloud's shadow), and env(w), the radiance [r, g, b] arriving along w from where a path leaving
// the shape heads (the sky, sunlit cloud around)
export function radianceUnder(s, v, { sun, env, phase = PHASES.cloud, paths = 1e5, maxEvents = 1e5, seed = 1 }) {
  return walk(s, v, { phase, paths, orders: Infinity, maxEvents, seed, sun, env });
}
function walk(s, v, { phase, paths, orders, maxEvents, seed, sun, env }) {
  const r = mulberry32(seed), [L0, L1, L2] = SUN;
  const sum = [0, 0, 0], sum2 = [0, 0, 0];
  for (let p = 0; p < paths; p++) {
    let x = 0, y = 0, z = 0, [w0, w1, w2] = v, acc = 0;
    const accE = [0, 0, 0];
    for (let k = 0; k < maxEvents; k++) {
      // (a tentative collision at the full density, real by the profile's share there)
      const te = s.exit(x, y, z, w0, w1, w2);
      let t = 0;
      do { t += -Math.log(1 - r()) / SIGMA; } while (t < te && r() >= profile(-s.sdf([x + w0 * t, y + w1 * t, z + w2 * t])));
      if (t >= te) {
        // (left for good: what arrives from there)
        if (env && k > 0) { const e = env([w0, w1, w2]); accE[0] += e[0]; accE[1] += e[1]; accE[2] += e[2]; }
        break;
      }
      x += w0 * t; y += w1 * t; z += w2 * t;
      if (sun) {
        const tl = s.exit(x, y, z, L0, L1, L2);
        acc += phase.eval(w0 * L0 + w1 * L1 + w2 * L2) * Math.exp(-SIGMA * s.od(x, y, z, L0, L1, L2, tl));
      }
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
    for (let c = 0; c < 3; c++) {
      const a = acc * (sun ? sun[c] : 0) + accE[c];
      sum[c] += a; sum2[c] += a * a;
    }
  }
  const m = sum.map(x => x / paths);
  return { L: m, err: m.map((x, c) => Math.sqrt(Math.max(sum2[c] / paths - x * x, 0) / paths)) };
}
