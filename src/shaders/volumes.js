// Baking the streamed world volumes: the shadow volume and the distance volumes of the clipmaps

import { WGSL_COMMON } from './common.js';
import { U_CLIP, WGSL_CLIP } from './cloud.js';

// world volumes are baked several slices at a time: NOUT slices of a 3D texture as the colour
// attachments of one pass (WebGPU guarantees 8)
export const NOUT = 8;
const MRT_OUT = `const NOUT = ${NOUT};\nstruct Slices {\n` + Array.from({ length: NOUT }, (_, k) => `  @location(${k}) o${k}: f32,`).join('\n') + '\n}';
const MRT_WRITE = e => '  var o: Slices;\n' + Array.from({ length: NOUT }, (_, k) => `  o.o${k} = ${e.replace(/K/g, k)};`).join('\n') + '\n  return o;';

// shadow volume (camera-centred, streamed like the clipmaps): optical depth toward the sun from
// each texel, marched through the large shapes of the coarser levels. Bakes NOUT slices at once.
export const U_TSV = {
  ...U_CLIP, sunDir: 'vec3f',
  tex0: 'vec2i',        // first texel of this block
  p0: 'vec2f',          // render-space xz of that texel's centre
  cellT: 'f32', cellTV: 'f32', z0: 'i32',
};
export const FS_TSV = WGSL_COMMON + WGSL_CLIP + /* wgsl */ `
${MRT_OUT}
fn march(xz: vec2f, y0: f32, jit: f32) -> f32 {
  var trans = 1.0;
  var s = 200.0 + 320.0 * jit;
  var out_ = false;     // shading only starts once the ray has left the cloud it started in
  for (var i = 0; i < 320; i++) {
    let p = vec3f(xz.x, y0, xz.y) + u.sunDir * s;
    if (p.y > CLOUD_TOP || s > 150000.0) { break; }
    let l = select(2, 1, inLv(p.xz, 1));
    let d = macroAt(p, l);
    // far from every cloud: skip ahead
    let m = d - lvMargin(l) - 300.0;
    if (m > 0.0) { out_ = true; s += max(m, 320.0); continue; }
    let stp = select(320.0, 200.0, d < 400.0);
    // inside the large shapes, and the larger billows on them
    var occ = saturate((120.0 - d) / 380.0);
    if (!out_) { if (occ < 0.05) { out_ = true; } occ = 0.0; }
    // distant occluders cast fainter shadows (sky light and haze fill them in)
    trans *= mix(1.0, exp(-SIGMA * stp * occ), exp(-s / 28000.0));
    s += stp;
  }
  return min(-log(max(trans, 1e-6)), 14.0);
}
@fragment fn fs(@builtin(position) pos: vec4f) -> Slices {
  let xz = u.p0 + vec2f(vec2i(pos.xy) - u.tex0) * u.cellT;
  let jit = ign(pos.xy);
${MRT_WRITE('march(xz, (f32(u.z0 + K) + 0.5) * u.cellTV, fract(jit + f32(K) * 0.618))')}
}`;

// Bakes NOUT slices of a block of one clipmap level: the sea (from the column map: its surface
// and slope) united with the tower bubbles near the block (ellipsoids; crisp creases between
// them, a broad fillet where they swell out of the sea). Positions are relative to the block.
export const U_BAKE = { nb: 'i32', z0: 'i32', mask: 'i32', tex0: 'vec2i', cellH: 'f32', cellV: 'f32', maxD: 'f32' };
export const FS_BAKE = WGSL_COMMON + /* wgsl */ `
${MRT_OUT}
fn ellD(q: vec3f, r: vec3f) -> f32 {   // distance to an ellipsoid (good near its surface)
  let k0 = length(q / r);
  let k1 = length(q / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 1e-9);
}
@fragment fn fs(@builtin(position) pos: vec4f) -> Slices {
  let tx = vec2i(pos.xy);
  let pl = (vec2f(tx - u.tex0) + 0.5) * u.cellH;
  let hs = textureLoad(tCol, tx, 0).r;
  let gx = textureLoad(tCol, vec2i((tx.x + 1) & u.mask, tx.y), 0).r - textureLoad(tCol, vec2i((tx.x - 1) & u.mask, tx.y), 0).r;
  let gz = textureLoad(tCol, vec2i(tx.x, (tx.y + 1) & u.mask), 0).r - textureLoad(tCol, vec2i(tx.x, (tx.y - 1) & u.mask), 0).r;
  let cs = max(inverseSqrt(1.0 + (gx * gx + gz * gz) / (4.0 * u.cellH * u.cellH)), 0.3);
  let y0 = (f32(u.z0) + 0.5) * u.cellV;
  let y1 = y0 + u.cellV * f32(NOUT - 1);
  var acc: array<f32, NOUT>;
  for (var k = 0; k < NOUT; k++) { acc[k] = u.maxD; }
  for (var b = 0; b < u.nb; b++) {
    let bt = vec2i(b & 1023, (b >> 10u) * 3);
    let A = textureLoad(tBub, bt, 0);
    let E = textureLoad(tBub, bt + vec2i(0, 2), 0);
    let dxz = pl - A.xz;
    if (length(dxz) - E.y > u.maxD || y0 - (A.y + E.y) > u.maxD || (A.y - E.y) - y1 > u.maxD) { continue; }
    let B = textureLoad(tBub, bt + vec2i(0, 1), 0);
    let ca = cos(B.w);
    let sa = sin(B.w);
    let q = vec2f(dxz.x * ca + dxz.y * sa, -dxz.x * sa + dxz.y * ca);
    let rxz = vec2f(A.w * B.z, A.w / B.z);
    for (var k = 0; k < NOUT; k++) {
      let dy = y0 + f32(k) * u.cellV - A.y;
      acc[k] = smin(acc[k], ellD(vec3f(q.x, dy, q.y), vec3f(rxz.x, select(B.y, B.x, dy > 0.0), rxz.y)), E.x);
    }
  }
  var res: array<f32, NOUT>;
  for (var k = 0; k < NOUT; k++) {
    let above = y0 + f32(k) * u.cellV - hs;
    res[k] = clamp(smin(above * cs, acc[k], mix(700.0, 60.0, smoothstep(0.0, 1800.0, above))), -u.maxD, u.maxD);
  }
${MRT_WRITE('res[K]')}
}`;
