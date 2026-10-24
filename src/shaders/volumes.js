// Baking the streamed world volumes: the shadow volume and the distance volumes of the clipmaps

import { MRT_OUT, MRT_WRITE } from '../render/gl.js';
import { GLSL_COMMON } from './common.js';
import { GLSL_CLOUD } from './cloud.js';

// shadow volume (camera-centred, streamed like the clipmaps): optical depth toward the sun from
// each texel, marched through the large shapes of the coarser levels. Bakes NOUT slices at once.
export const FS_TSV = GLSL_COMMON + GLSL_CLOUD + /* glsl */ `
uniform ivec2 uTex0;      // first texel of this block
uniform vec2 uP0;         // render-space xz of that texel's centre
uniform float uCellT, uCellTV;
uniform int uZ0;
${MRT_OUT}
float march(vec2 xz, float y0, float jit) {
  float trans = 1.0;
  float s = 200.0 + 320.0 * jit;
  bool out_ = false;     // shading only starts once the ray has left the cloud it started in
  for (int i = 0; i < 320; i++) {
    vec3 p = vec3(xz.x, y0, xz.y) + uSunDir * s;
    if (p.y > CLOUD_TOP || s > 150000.0) break;
    int l = inLv(p.xz, 1) ? 1 : 2;
    float d = macroAt(p, l);
    // far from every cloud: skip ahead
    float m = d - LV_MARGIN[l] - 300.0;
    if (m > 0.0) { out_ = true; s += max(m, 320.0); continue; }
    float step = d < 400.0 ? 200.0 : 320.0;
    // inside the large shapes, and the larger billows on them
    float occ = sat((120.0 - d) / 380.0);
    if (!out_) { if (occ < 0.05) out_ = true; occ = 0.0; }
    // distant occluders cast fainter shadows (sky light and haze fill them in)
    trans *= mix(1.0, exp(-SIGMA * step * occ), exp(-s / 28000.0));
    s += step;
  }
  return min(-log(max(trans, 1e-6)), 14.0);
}
void main() {
  vec2 xz = uP0 + vec2(ivec2(gl_FragCoord.xy) - uTex0) * uCellT;
  float jit = ign(gl_FragCoord.xy);
${MRT_WRITE('march(xz, (float(uZ0 + K) + 0.5) * uCellTV, fract(jit + float(K) * 0.618))')}
}`;

// Bakes NOUT slices of a block of one clipmap level: the sea (from the column map: its surface
// and slope) united with the tower bubbles near the block (ellipsoids; crisp creases between
// them, a broad fillet where they swell out of the sea). Positions are relative to the block.
export const FS_BAKE = GLSL_COMMON + /* glsl */ `
uniform sampler2D uCol;
uniform highp sampler2D uBub;
uniform int uNB;
uniform ivec2 uTex0;
uniform float uCellH, uCellV, uMaxD;
uniform int uZ0;
uniform int uMask;
${MRT_OUT}
float ellD(vec3 q, vec3 r) {   // distance to an ellipsoid (good near its surface)
  float k0 = length(q / r), k1 = length(q / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 1e-9);
}
void main() {
  ivec2 tx = ivec2(gl_FragCoord.xy);
  vec2 pl = (vec2(tx - uTex0) + 0.5) * uCellH;
  float hs = texelFetch(uCol, tx, 0).r;
  float gx = texelFetch(uCol, ivec2((tx.x + 1) & uMask, tx.y), 0).r - texelFetch(uCol, ivec2((tx.x - 1) & uMask, tx.y), 0).r;
  float gz = texelFetch(uCol, ivec2(tx.x, (tx.y + 1) & uMask), 0).r - texelFetch(uCol, ivec2(tx.x, (tx.y - 1) & uMask), 0).r;
  float cs = max(inversesqrt(1.0 + (gx * gx + gz * gz) / (4.0 * uCellH * uCellH)), 0.3);
  float y0 = (float(uZ0) + 0.5) * uCellV, y1 = y0 + uCellV * float(NOUT - 1);
  float acc[NOUT];
  for (int k = 0; k < NOUT; k++) acc[k] = uMaxD;
  for (int b = 0; b < uNB; b++) {
    ivec2 bt = ivec2(b & 1023, (b >> 10) * 3);
    vec4 A = texelFetch(uBub, bt, 0);
    vec4 E = texelFetch(uBub, bt + ivec2(0, 2), 0);
    vec2 dxz = pl - A.xz;
    if (length(dxz) - E.y > uMaxD || y0 - (A.y + E.y) > uMaxD || (A.y - E.y) - y1 > uMaxD) continue;
    vec4 B = texelFetch(uBub, bt + ivec2(0, 1), 0);
    float ca = cos(B.w), sa = sin(B.w);
    vec2 q = vec2(dxz.x * ca + dxz.y * sa, -dxz.x * sa + dxz.y * ca);
    vec2 rxz = vec2(A.w * B.z, A.w / B.z);
    for (int k = 0; k < NOUT; k++) {
      float dy = y0 + float(k) * uCellV - A.y;
      acc[k] = smin(acc[k], ellD(vec3(q.x, dy, q.y), vec3(rxz.x, dy > 0.0 ? B.x : B.y, rxz.y)), E.x);
    }
  }
  float res[NOUT];
  for (int k = 0; k < NOUT; k++) {
    float above = y0 + float(k) * uCellV - hs;
    res[k] = clamp(smin(above * cs, acc[k], mix(700.0, 60.0, smoothstep(0.0, 1800.0, above))), -uMaxD, uMaxD);
  }
${MRT_WRITE('res[K]')}
}`;
