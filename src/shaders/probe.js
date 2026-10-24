// The probe: lighting at the bird and mist at the camera

import { GLSL_COMMON } from './common.js';
import { GLSL_ATMO } from './sky.js';
import { GLSL_CLOUD } from './cloud.js';

export const FS_PROBE = GLSL_COMMON + GLSL_ATMO + GLSL_CLOUD + /* glsl */ `
uniform sampler2D uAmb;
uniform sampler2D uSky;
uniform vec3 uCamPos;     // render space
uniform vec3 uBirdRel;    // bird - camera
uniform vec3 uAmbSea;
uniform float uFrame;
out vec4 o;
float sigmaAt(vec3 wp, float h, out float sdf) {
  vec4 C = colAt(wp.xz, 0);
  float dm = macroAt(vec3(wp.x, h, wp.z), 0);
  float b = dm - shellOf(C.y) - LV_MARGIN[0];
  if (b > 0.0) { sdf = b; return 0.0; }
  sdf = cloudSDF(wp, h, dm, C, 0.0);
  return densityFromSDF(sdf, wp, 0.6, 40.0, 0.0) * SIGMA;
}
float floorH(vec2 xz) { vec4 C = colAt(xz, 0); return min(C.x, C.w + 330.0); }
void main() {
  int px = int(gl_FragCoord.x);
  vec3 bwp = uCamPos + uBirdRel;
  float bh = bwp.y;
  vec4 C = colAt(bwp.xz, 0);
  vec3 ambSky = texelFetch(uAmb, ivec2(0, 0), 0).rgb;
  if (px == 0) {
    float tau = 0.0;
    for (int k = 0; k < 4; k++) tau += lightTau(bwp, bh, 0, C, (float(k) + 0.5) / 4.0, 0.0);
    tau = tau * 0.25 * 0.6 + tsvTau(bwp, bh);
    float tr = exp(-tau);
    o = vec4(sunColorAt(bh) * tr, tr);
  } else if (px == 1) {
    float sdf; float s = sigmaAt(bwp, bh, sdf);
    float occ = exp(-max(-sdf, 0.0) / 150.0);
    o = vec4(ambSky * 3.14159 * occ, 1.0);
  } else if (px == 2) {
    // light from the sunlit cloud sea below
    o = vec4(uAmbSea * 3.14159, 1.0);
  } else if (px == 3) {
    float sdfC, sdfB;
    float sc = sigmaAt(uCamPos, uCamPos.y, sdfC);
    float sb = sigmaAt(bwp, bh, sdfB);
    o = vec4(sc, sb, sdfB, C.x);
  } else if (px == 5) {
    // distance to the sea of clouds the bird skims (heaps piled high above it and towers may be
    // entered): drives the gentle floor
    vec4 Cf = C;
    Cf.x = min(C.x, C.w + 330.0);
    float gx = floorH(bwp.xz + vec2(64.0, 0.0)) - floorH(bwp.xz - vec2(64.0, 0.0));
    float gz = floorH(bwp.xz + vec2(0.0, 64.0)) - floorH(bwp.xz - vec2(0.0, 64.0));
    float cs = inversesqrt(1.0 + (gx * gx + gz * gz) / (128.0 * 128.0));
    float b = (bh - (Cf.x + shellOf(C.y))) * cs;
    o = vec4(b > 0.0 ? b : cloudSDF(bwp, bh, (bh - Cf.x) * cs, Cf, 0.0), 0.0, 0.0, 1.0);
  } else {
    // in-cloud mist radiance around the camera (same light model as the cloud volume)
    float sdfC;
    sigmaAt(uCamPos, uCamPos.y, sdfC);
    float depth = max(-sdfC, 0.0);
    float tau = lightTau(uCamPos, uCamPos.y, 0, colAt(uCamPos.xz, 0), 0.5, 0.0);
    float farT = exp(-tsvTau(uCamPos, uCamPos.y));
    float diffu = 0.032 / (1.0 + 0.025 * tau) * (1.0 - exp(-depth / 80.0));
    vec3 sunL = sunColorAt(uCamPos.y) * ((msScatterP(tau, phaseOctaves(0.3)) + diffu) * farT + 0.007 * (1.0 - farT));
    o = vec4(sunL + ambSky * 1.95 * 0.75 * mix(0.5, 1.0, exp(-depth / 55.0)), 1.0);
  }
}`;
