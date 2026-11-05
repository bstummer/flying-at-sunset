// The probe: lighting at the bird and mist at the camera

import { WGSL_COMMON } from './common.js';
import { WGSL_ATMO } from './sky.js';
import { U_CLIP, U_CLOUD, WGSL_CLOUD } from './cloud.js';

export const U_PROBE = {
  ...U_CLIP, ...U_CLOUD,
  camPos: 'vec3f',      // render space
  birdRel: 'vec3f',     // bird - camera
  ambSea: 'vec3f',
};
export const FS_PROBE = WGSL_COMMON + WGSL_ATMO + WGSL_CLOUD + /* wgsl */ `
// (extinction, signed distance) at a point
fn sigmaAt(wp: vec3f, h: f32) -> vec2f {
  let C = colAt(wp.xz, 0);
  let dm = macroAt(vec3f(wp.x, h, wp.z), 0);
  let b = dm - shellOf(C.y) - lvMargin(0);
  if (b > 0.0) { return vec2f(0.0, b); }
  let sdf = cloudSDF(wp, h, dm, C, 0.0);
  return vec2f(densityFromSDF(sdf, wp, 0.6, 40.0, 0.0) * SIGMA, sdf);
}
fn floorH(xz: vec2f) -> f32 { let C = colAt(xz, 0); return min(C.x, C.w + 330.0); }
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let px = i32(pos.x);
  let bwp = u.camPos + u.birdRel;
  let bh = bwp.y;
  let C = colAt(bwp.xz, 0);
  let ambSky = textureLoad(tAmb, vec2i(0, 0), 0).rgb;
  if (px == 0) {
    var tau = 0.0;
    for (var k = 0; k < 4; k++) { tau += lightTau(bwp, bh, 0, C, (f32(k) + 0.5) / 4.0, 0.0); }
    tau = tau * 0.25 * 0.6 + tsvTau(bwp, bh);
    let tr = exp(-tau);
    return vec4f(sunColorAt(bh) * tr, tr);
  }
  if (px == 1) {
    let sb = sigmaAt(bwp, bh);
    let occ = exp(-max(-sb.y, 0.0) / 150.0);
    return vec4f(ambSky * 3.14159 * occ, 1.0);
  }
  if (px == 2) {
    // light from the sunlit cloud sea below
    return vec4f(u.ambSea * 3.14159, 1.0);
  }
  if (px == 3) {
    let sc = sigmaAt(u.camPos, u.camPos.y);
    let sb = sigmaAt(bwp, bh);
    return vec4f(sc.x, sb.x, sb.y, C.x);
  }
  if (px == 5) {
    // distance to the sea of clouds the bird skims (heaps piled high above it and towers may be
    // entered): drives the gentle floor
    var Cf = C;
    Cf.x = min(C.x, C.w + 330.0);
    let gx = floorH(bwp.xz + vec2f(64.0, 0.0)) - floorH(bwp.xz - vec2f(64.0, 0.0));
    let gz = floorH(bwp.xz + vec2f(0.0, 64.0)) - floorH(bwp.xz - vec2f(0.0, 64.0));
    let cs = inverseSqrt(1.0 + (gx * gx + gz * gz) / (128.0 * 128.0));
    let b = (bh - (Cf.x + shellOf(C.y))) * cs;
    if (b > 0.0) { return vec4f(b, 0.0, 0.0, 1.0); }
    return vec4f(cloudSDF(bwp, bh, (bh - Cf.x) * cs, Cf, 0.0), 0.0, 0.0, 1.0);
  }
  // in-cloud mist radiance around the camera (same light model as the cloud volume)
  let scam = sigmaAt(u.camPos, u.camPos.y);
  let depth = max(-scam.y, 0.0);
  let tau = lightTau(u.camPos, u.camPos.y, 0, colAt(u.camPos.xz, 0), 0.5, 0.0);
  let farT = exp(-tsvTau(u.camPos, u.camPos.y));
  let diffu = 0.032 / (1.0 + 0.025 * tau) * (1.0 - exp(-depth / 80.0));
  let sunL = sunColorAt(u.camPos.y) * ((msScatterP(tau, phaseOctaves(0.3)) + diffu) * farT + 0.007 * (1.0 - farT));
  return vec4f(sunL + ambSky * 1.95 * 0.75 * mix(0.5, 1.0, exp(-depth / 55.0)), 1.0);
}`;
