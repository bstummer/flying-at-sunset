// Post: bloom, sun rays, tone mapping

import { WGSL_COMMON } from './common.js';

// NaN / infinity tests on the bits (a compiler may assume floats are never NaN)
const WGSL_NAN = /* wgsl */ `
fn isnan3(c: vec3f) -> bool {
  let b = bitcast<vec3u>(c);
  return any(((b & vec3u(0x7f800000u)) == vec3u(0x7f800000u)) & ((b & vec3u(0x007fffffu)) != vec3u(0u)));
}
fn isinf3(c: vec3f) -> bool { return any((bitcast<vec3u>(c) & vec3u(0x7fffffffu)) == vec3u(0x7f800000u)); }
`;

export const U_DOWN = { birdBox: 'vec4f', srcTexel: 'vec2f', first: 'i32', clampHi: 'f32' };
export const FS_DOWN = WGSL_COMMON + WGSL_NAN + /* wgsl */ `
fn src(uv: vec2f) -> vec3f {
  var c = textureSampleLevel(tSrc, sLin, uv, 0.0).rgb;
  if (u.first == 1 && uv.x > u.birdBox.x && uv.y > u.birdBox.y && uv.x < u.birdBox.z && uv.y < u.birdBox.w) {
    let b = textureSampleLevel(tBird, sLin, uv, 0.0);
    c = c * (1.0 - b.a) + b.rgb;
  }
  if (isnan3(c) || isinf3(c)) { c = vec3f(0.0); }
  return min(c, vec3f(u.clampHi));
}
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = (floor(pos.xy) * 2.0 + 1.0) * u.srcTexel;
  let t = u.srcTexel;
  let a = src(uv + t * vec2f(-2.0, 2.0));
  let b = src(uv + t * vec2f(0.0, 2.0));
  let c = src(uv + t * vec2f(2.0, 2.0));
  let d = src(uv + t * vec2f(-2.0, 0.0));
  let e = src(uv);
  let f = src(uv + t * vec2f(2.0, 0.0));
  let g = src(uv + t * vec2f(-2.0, -2.0));
  let h = src(uv + t * vec2f(0.0, -2.0));
  let i = src(uv + t * vec2f(2.0, -2.0));
  let j = src(uv + t * vec2f(-1.0, 1.0));
  let k = src(uv + t * vec2f(1.0, 1.0));
  let l = src(uv + t * vec2f(-1.0, -1.0));
  let m = src(uv + t * vec2f(1.0, -1.0));
  // 13-tap downsample (no Karis average: the sun is a big stable disk and must bloom fully)
  let r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  return vec4f(r, 1.0);
}`;

export const U_UP = { srcTexel: 'vec2f', dstTexel: 'vec2f', weight: 'f32' };
export const FS_UP = WGSL_COMMON + /* wgsl */ `
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = pos.xy * u.dstTexel;
  let t = u.srcTexel;
  var s = textureSampleLevel(tSrc, sLin, uv, 0.0).rgb * 4.0;
  s += (textureSampleLevel(tSrc, sLin, uv + t * vec2f(1.0, 0.0), 0.0).rgb + textureSampleLevel(tSrc, sLin, uv + t * vec2f(-1.0, 0.0), 0.0).rgb
      + textureSampleLevel(tSrc, sLin, uv + t * vec2f(0.0, 1.0), 0.0).rgb + textureSampleLevel(tSrc, sLin, uv + t * vec2f(0.0, -1.0), 0.0).rgb) * 2.0;
  s += textureSampleLevel(tSrc, sLin, uv + t * vec2f(1.0, 1.0), 0.0).rgb + textureSampleLevel(tSrc, sLin, uv + t * vec2f(-1.0, 1.0), 0.0).rgb
     + textureSampleLevel(tSrc, sLin, uv + t * vec2f(1.0, -1.0), 0.0).rgb + textureSampleLevel(tSrc, sLin, uv + t * vec2f(-1.0, -1.0), 0.0).rgb;
  return vec4f(s / 16.0 * u.weight, 1.0);
}`;

export const U_RAYMASK = { birdBox: 'vec4f', camRight: 'vec3f', camUp: 'vec3f', camFwd: 'vec3f', sunDir: 'vec3f', tanHalf: 'vec2f', dstTexel: 'vec2f' };
export const FS_RAYMASK = WGSL_COMMON + /* wgsl */ `
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = pos.xy * u.dstTexel;
  let ndc = uv * 2.0 - 1.0;
  let dir = normalize(u.camFwd + ndc.x * u.tanHalf.x * u.camRight + ndc.y * u.tanHalf.y * u.camUp);
  let c = max(dot(dir, u.sunDir), 0.0);
  let glow = pow(c, 600.0) * 3.0 + pow(c, 60.0) * 0.4 + pow(c, 8.0) * 0.04;
  var T = textureSampleLevel(tHist, sLin, uv, 0.0).a;
  if (uv.x > u.birdBox.x && uv.y > u.birdBox.y && uv.x < u.birdBox.z && uv.y < u.birdBox.w) { T *= 1.0 - textureSampleLevel(tBird, sLin, uv, 0.0).a; }
  return vec4f(vec3f(glow * T), 1.0);
}`;

export const U_RAYBLUR = { sunUv: 'vec2f', dstTexel: 'vec2f', stepScale: 'f32', decay: 'f32' };
export const FS_RAYBLUR = WGSL_COMMON + /* wgsl */ `
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  // radial blur toward the sun; run twice (short then long strides) for smooth, noise-free rays
  let uv = pos.xy * u.dstTexel;
  let d = (u.sunUv - uv) * u.stepScale;
  var p = uv;
  var acc = vec3f(0.0);
  var w = 1.0;
  var ws = 0.0;
  for (var i = 0; i < 24; i++) {
    acc += textureSampleLevel(tSrc, sLin, p, 0.0).rgb * w;
    ws += w;
    w *= u.decay;
    p += d;
  }
  return vec4f(acc / ws, 1.0);
}`;

export const U_FINAL = {
  birdBox: 'vec4f', rayCol: 'vec3f', exposure: 'f32', res: 'vec2f', dbgScale: 'vec2f',
  bloomMix: 'f32', bloomScale: 'f32', time: 'f32', contrast: 'f32', view: 'i32', tm: 'i32',
};
export const FS_FINAL = WGSL_COMMON + WGSL_NAN + /* wgsl */ `
// ACES fitted (Stephen Hill)
fn RRTAndODTFit(v: vec3f) -> vec3f { let a = v * (v + 0.0245786) - 0.000090537; let b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
fn aces(c0: vec3f) -> vec3f {
  let ACESIn = mat3x3f(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  let ACESOut = mat3x3f(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  var c = ACESIn * c0;
  c = RRTAndODTFit(c);
  c = ACESOut * c;
  return saturate(c);
}
fn toSRGB(c: vec3f) -> vec3f { return mix(c * 12.92, 1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055, step(vec3f(0.0031308), c)); }
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  // the canvas's rows run top-down: count them from the bottom, as every texture is laid out
  let frag = vec2f(pos.x, u.res.y - pos.y);
  let uv = frag / u.res;
  if (u.view == 1) { return vec4f(vec3f(textureSampleLevel(tDbg, sLin, uv, 0.0).a), 1.0); }
  if (u.view == 2) { return vec4f(toSRGB(saturate(textureSampleLevel(tDbg, sLin, uv, 0.0).rgb * u.exposure * 0.5)), 1.0); }
  if (u.view == 3) { let d = textureSampleLevel(tDbg2, sNear, uv * u.dbgScale, 0.0).r; return vec4f(vec3f(saturate(log2(1.0 + d) / 8.0)), 1.0); }
  if (u.view == 4) { return vec4f(toSRGB(saturate(textureSampleLevel(tRays, sLin, uv, 0.0).rgb * u.rayCol * u.exposure)), 1.0); }
  if (u.view == 5) { return vec4f(toSRGB(saturate(textureSampleLevel(tBloom, sLin, uv, 0.0).rgb * u.exposure * 0.25)), 1.0); }
  var c = textureSampleLevel(tScene, sLin, uv, 0.0).rgb;
  if (uv.x > u.birdBox.x && uv.y > u.birdBox.y && uv.x < u.birdBox.z && uv.y < u.birdBox.w) {
    let b = textureSampleLevel(tBird, sLin, uv, 0.0);
    c = c * (1.0 - b.a) + b.rgb;
  }
  if (isnan3(c)) { c = vec3f(0.0); }
  let bloom = textureSampleLevel(tBloom, sLin, uv, 0.0).rgb;
  c = c * (1.0 - u.bloomMix) + bloom * u.bloomScale;   // energy-conserving mix with the normalised bloom
  c += textureSampleLevel(tRays, sLin, uv, 0.0).rgb * u.rayCol;
  c *= u.exposure;
  // gentle contrast around middle grey (pre-curve)
  let lc = max(luma(c), 1e-6);
  c *= pow(lc / 0.18, u.contrast - 1.0);
  if (u.tm == 0) {
    let l = luma(c);
    c = mix(c, c * vec3f(0.95, 0.985, 1.07), 0.35 * (1.0 - saturate(l * 2.0)));
    c = aces(c * 1.05);
  } else {
    // hue-preserving filmic: tone map luminance, keep chroma; extreme highlights roll off to white
    let l = max(luma(c), 1e-6);
    let a = aces(c);
    let lt = luma(aces(vec3f(l)));
    var hp = c * (lt / l);
    // keep saturated highlights in gamut by desaturating toward luminance as needed
    let mx = max(hp.r, max(hp.g, hp.b));
    if (mx > 1.0) { hp = mix(vec3f(lt), hp, (1.0 - lt) / max(mx - lt, 1e-4)); }
    c = mix(hp, a, smoothstep(0.55, 1.0, lt) * 0.85);
    // golden hour split tone: warm highlights, cool violet shadows
    let t = saturate(lt * 1.4);
    c *= mix(vec3f(0.93, 0.95, 1.08), vec3f(1.04, 1.0, 0.93), t);
    c = saturate(c);
  }
  // vignette
  var q = uv - 0.5;
  q.x *= u.res.x / u.res.y;
  c *= mix(1.0, 0.74, smoothstep(0.35, 1.25, length(q)));
  c = toSRGB(c);
  // grain / dither
  let n = ign(frag + fract(u.time * 7.31) * vec2f(113.0, 71.0)) - 0.5;
  c += n * (1.5 / 255.0);
  return vec4f(c, 1.0);
}`;
