#include "chunks/common.wgsl"
#include "chunks/atmo.wgsl"
#include "chunks/cloud.wgsl"
#include "chunks/ambient.wgsl"
#include "chunks/probe.wgsl"

// The probe: the light and cloud at the bird and around the camera (shaders/probe.js)

// (extinction, signed distance) at a point
fn sigmaAt(wp: vec3f, h: f32) -> vec2f {
  let C = colAt(wp.xz, 0);
  let sh = shapeAt(vec3f(wp.x, h, wp.z), 0);
  let b = sh.x - shellOf(C.y) - lvMargin(0);
  if (b > 0.0) { return vec2f(0.0, b); }
  let sdf = cloudSDF(wp, h, sh, C, 0.0);
  return vec2f(densityFromSDF(sdf, wp, 0.6, 40.0, 0.0) * SIGMA, sdf);
}
fn floorH(xz: vec2f) -> f32 { let C = colAt(xz, 0); return min(C.x, C.w + 330.0); }
// One workgroup per field of Probe: they cost very differently, and none waits for another.
@compute @workgroup_size(1) fn cs(@builtin(workgroup_id) wg: vec3u) {
  let bwp = u.camPos + u.birdRel;
  let bh = bwp.y;
  let C = colAt(bwp.xz, 0);
  let ambSky = bAmb.up.rgb;
  switch wg.x {
    case 0u: {
      let far = tsvTau(bwp, bh);
      let tau = lightTau(bwp, bh, 0, C, billowAt(vec3f(bwp.x, bh, bwp.z), 0), 0.0) * 0.6 + far.x + far.y;
      let tr = exp(-tau);
      bProbe.sun = vec4f(sunColorAt(bh) * tr, tr);
    }
    case 1u: {
      let sb = sigmaAt(bwp, bh);
      let occ = exp(-max(-sb.y, 0.0) / 150.0);
      bProbe.ambUp = vec4f(ambSky * 3.14159 * occ, 1.0);
    }
    case 2u: {
      // light from the sunlit cloud sea below
      bProbe.ambDn = vec4f(u.ambSea * 3.14159, 1.0);
    }
    case 3u: {
      let sc = sigmaAt(u.camPos, u.camPos.y);
      let sb = sigmaAt(bwp, bh);
      bProbe.medium = vec4f(sc.x, sb.x, sb.y, C.x);
    }
    case 4u: {
      // in-cloud mist radiance around the camera (same light model as the cloud volume)
      let scam = sigmaAt(u.camPos, u.camPos.y);
      let depth = max(-scam.y, 0.0);
      let tau = lightTau(u.camPos, u.camPos.y, 0, colAt(u.camPos.xz, 0), billowAt(u.camPos, 0), 0.0);
      let far = tsvTau(u.camPos, u.camPos.y);
      let sunL = sunColorAt(u.camPos.y) * sunScatter(tau, far, phaseOctaves(0.3), 1.0, depth, 0.4, 0.4);
      bProbe.mistL = vec4f(sunL + ambSky * AMB_K * 0.75 * mix(0.5, 1.0, exp(-depth / 55.0)), 1.0);
    }
    default: {
      // distance to the sea of clouds the bird skims (heaps piled high above it and towers may be
      // entered): drives the gentle floor
      var Cf = C;
      Cf.x = min(C.x, C.w + 330.0);
      let gx = floorH(bwp.xz + vec2f(64.0, 0.0)) - floorH(bwp.xz - vec2f(64.0, 0.0));
      let gz = floorH(bwp.xz + vec2f(0.0, 64.0)) - floorH(bwp.xz - vec2f(0.0, 64.0));
      let cs = inverseSqrt(1.0 + (gx * gx + gz * gz) / (128.0 * 128.0));
      var b = (bh - (Cf.x + shellOf(C.y))) * cs;
      if (b <= 0.0) { b = cloudSDF(bwp, bh, vec3f((bh - Cf.x) * cs, SEA_BS, 1.0), Cf, 0.0); }
      bProbe.floorD = vec4f(b, 0.0, 0.0, 1.0);
    }
  }
}
