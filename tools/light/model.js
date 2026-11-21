// The trace's light of a shape (tools/light/), as chunks/cloud.wgsl and trace.wgsl compute it: the view
// ray integrated through the outline's density ramp and the medium's profile, each sample lit by
// sunScatter at the depth a skin LIGHT_SKIN thick reaches at the same optical depth along the view
// (lightDepth), through the light march (lightPath). Only the sun: the sky light and the shadow volume are left out (no other
// cloud), and so is the trace's reuse of a sample's light deeper in. Keep it in step with those
// shaders: it is what the reference (mc.js) judges.
//
//   import { traceRadiance } from './model.js';
//   traceRadiance(slab([0, 1, 0], 800), viewDir(180, 30), { edgeW: 2 })

import { CLOUD_EDGE0, CLOUD_EDGE_W } from '../../src/constants.js';
import { SIGMA, SUN, profile, profileDepth, profileMean } from './mc.js';

const sat = x => Math.min(Math.max(x, 0), 1), mix = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
const smoothstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hg = (c, g) => (1 - g * g) / (4 * Math.PI * Math.pow(Math.max(1 + g * g - 2 * g * c, 1e-4), 1.5));
const at = (p, w, t) => [p[0] + w[0] * t, p[1] + w[1] * t, p[2] + w[2] * t];
export const LIGHT_SKIN = 1, DIFFUSE = 0.42;

// the octaves' phases: single scattering's, then each forward lobe keeping its strength, the back lobe fading
export const phaseOctaves = c => [mix(hg(c, -0.3), hg(c, 0.85), 0.95),
  ...[1, 2, 3].map(i => mix(hg(c, -0.3 * Math.pow(0.3, i)), hg(c, 0.8 * Math.pow(0.95, i)), 0.62))];
export const msScatterP = (tau, ph) => [1, 0.5, 0.25, 0.125].reduce((s, k, i) => s + Math.exp(-tau * k) * k * ph[i], 0);

// the depth a skin W thick reaches at the same optical depth along the view as a ramp E wide at z,
// both times the medium's profile
export function lightDepth(z, E, W = LIGHT_SKIN) {
  const q = z < E ? profileMoment(z) / E : profileDepth(z) - profileDepth(E) + profileMoment(E) / E, qW = profileMoment(W) / W;
  return q < qW ? Math.min(Math.sqrt(2 * W * q / CLOUD_EDGE0), W) : profileInv(q + profileDepth(W) - qW);
}
// ∫ x ρ(x) dx from the surface to depth z, and profileDepth's inverse
const K = (1 - CLOUD_EDGE0) / CLOUD_EDGE_W;
function profileMoment(z) { const a = Math.min(z, CLOUD_EDGE_W); return CLOUD_EDGE0 * a * a / 2 + K * a * a * a / 3 + (z * z - a * a) / 2; }
function profileInv(q) {
  if (q > CLOUD_EDGE_W * (1 + CLOUD_EDGE0) / 2) return q + CLOUD_EDGE_W * (1 - CLOUD_EDGE0) / 2;
  return 2 * q / (CLOUD_EDGE0 + Math.sqrt(CLOUD_EDGE0 * CLOUD_EDGE0 + 2 * K * q));
}

// lightPath: each step's length inside from the distance at its middle and its slope along the ray;
// how surely the path is still in its own cloud (inside), and from its fall, whether the light came
// in close by (near) and the slopes where it leaves (muF); what it meets after is another cloud
// (other; otherD: as the diffusion sees it). The shape is its own large shapes.
export function lightPath(sdf, p, dView) {
  let own = 0, other = 0, otherD = 0, s = 0, ds = 10, dPrev = dView, sPrev = 0, d0 = 0, d1 = 0, nS = 0, nL = 0;
  let inside = 1, wOut = 0, gOut = 0, near = 0;
  for (let i = 0; i < 6; i++) {
    const sm = s + ds * 0.5, d = sdf(at(p, SUN, sm));
    if (i === 0) d0 = d; else if (i === 1) d1 = d; else if (i === 2) nS = clamp((d - d0) / 57.8, -1, 1);
    else if (i === 4) nL = clamp((d - d1) / 374, -1, 1);
    const g = (d - dPrev) / (sm - sPrev), f = clamp(0.5 - d / Math.max(Math.abs(g) * ds, 3), 0, 1);
    const sig = SIGMA * profileMean(-d, 0.5 * Math.max(Math.abs(g) * ds, 3));
    own += f * inside * ds * sig;
    other += f * (1 - inside) * ds * sig;
    otherD += clamp(0.5 - d / Math.max(Math.abs(g) * ds, 0.15 * sm), 0, 1) * (1 - inside) * ds * sig * smoothstep(60, 300, sm);
    const w = Math.max(inside - f, 0);
    wOut += w; gOut += w * sat(g); inside = Math.min(inside, f);
    if (i === 2) near = 1 - inside;
    dPrev = d; sPrev = sm; s += ds; ds *= 2.4;
  }
  ds = 1200;
  for (let i = 0; i < 3; i++) {
    const sm = s + ds * 0.5, d = sdf(at(p, SUN, sm)), f = sat((120 - d) / 380);
    own += f * inside * ds * SIGMA; other += f * (1 - inside) * ds * SIGMA; otherD += f * (1 - inside) * ds * SIGMA;
    const w = Math.max(inside - f, 0);
    wOut += w; gOut += w * sat((d - dPrev) / (sm - sPrev)); inside = Math.min(inside, f);
    if (f < 0.05) break;
    dPrev = d; sPrev = sm; s += ds; ds *= 1.33;
  }
  return { own, other, otherD, nS, muN: sat(0.5 * nS + 0.5 * nL), muF: (gOut + 0.01) / (wOut + 0.02), near, d0 };
}
// sunScatter: the octaves, and diffusion by where the light came in, D mu^1.4 / (1 + 0.11 tau mu)
export function sunScatter(lp, far, ph, pw, depthIn) {
  const tau = lp.own + far[0], mu = Math.max(mix(lp.muF, lp.muN, lp.near), 1e-4);
  const diffu = DIFFUSE * Math.pow(mu, 1.4) / (1 + 0.11 * (tau * mu + lp.otherD)) * (1 - 0.55 * Math.exp(-profileDepth(depthIn) * SIGMA / 1.5));
  return (msScatterP(tau + lp.other, ph) * pw + diffu) * Math.exp(-far[1]);
}

// The radiance the trace gives looking along v at the shape's origin, per unit of sunlight. edgeW:
// the outline's ramp (m); light(ctx): the light to take instead of sunScatter's, given { lp, tauExact,
// ph, pw, depthIn } (the reference's single scattering, a fit's candidates).
export function traceRadiance(s, v, { edgeW = 2, light = null } = {}) {
  const cosT = v[0] * SUN[0] + v[1] * SUN[1] + v[2] * SUN[2];
  const ph = phaseOctaves(cosT), powder = 1 - 0.28 * sat(0.5 - 0.5 * cosT);
  let T = 1, L = 0, t = 0;
  while (T > 1e-5 && t < 4000) {
    const dt = t < edgeW * 2 ? Math.max(edgeW * 0.05, 0.02) : Math.min(0.5 + t * 0.05, 20), tm = t + dt * 0.5;
    const depthV = -s.sdf(at([0, 0, 0], v, tm)), sigma = sat(depthV / edgeW) * profile(depthV) * SIGMA;
    if (sigma > 0) {
      // the light where the view, as far in as the light's depth, would be
      const depthIn = lightDepth(depthV, edgeW), q = at([0, 0, 0], v, tm * depthIn / Math.max(depthV, 1e-3));
      const lp = lightPath(s.sdf, q, -depthIn), tauExact = SIGMA * s.exit(q[0], q[1], q[2], SUN[0], SUN[1], SUN[2]);
      const pw = mix(powder, 1, 1 - Math.exp(-profileDepth(depthIn) * SIGMA));
      const J = light ? light({ lp, tauExact, ph, pw, depthIn }) : sunScatter(lp, [0, 0], ph, pw, depthIn);
      const st = Math.exp(-sigma * dt);
      L += T * 0.985 * J * (1 - st);
      T *= st;
    }
    t += dt;
  }
  return L;
}
