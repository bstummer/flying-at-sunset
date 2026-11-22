#include "chunks/common.wgsl"
#include "chunks/nan.wgsl"
#include "chunks/exposure.wgsl"

// The final image: bloom and sun rays added, the exposure (bExpo, shaders/exposure.wgsl) and contrast, the tone curve (tm 1: filmic,
// hue-preserving through the mid-tones, only the brightest faces rolling off toward cream as on
// film, with a golden-hour split tone; 0: ACES), vignette, sRGB and grain, its rows turned
// top-down for the canvas; view 1..5 shows what goes into it

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
  let exposure = bExpo.exposure;
  if (u.view == 1) { return vec4f(vec3f(textureSampleLevel(tDbg, sLin, uv, 0.0).a), 1.0); }
  if (u.view == 2) { return vec4f(toSRGB(saturate(textureSampleLevel(tDbg, sLin, uv, 0.0).rgb * exposure * 0.5)), 1.0); }
  if (u.view == 3) { let d = textureSampleLevel(tDbg2, sNear, uv * u.dbgScale, 0.0).r; return vec4f(vec3f(saturate(log2(1.0 + d) / 8.0)), 1.0); }
  if (u.view == 4) { return vec4f(toSRGB(saturate(textureSampleLevel(tRays, sLin, uv, 0.0).rgb * u.rayCol * exposure)), 1.0); }
  if (u.view == 5) { return vec4f(toSRGB(saturate(textureSampleLevel(tBloom, sLin, uv, 0.0).rgb * exposure * 0.25)), 1.0); }
  var c = textureSampleLevel(tScene, sLin, uv, 0.0).rgb;
  if (isnan3(c)) { c = vec3f(0.0); }
  let bloom = textureSampleLevel(tBloom, sLin, uv, 0.0).rgb;
  c = c * (1.0 - u.bloomMix) + bloom * u.bloomScale;   // energy-conserving mix with the normalised bloom
  c += textureSampleLevel(tRays, sLin, uv, 0.0).rgb * u.rayCol;
  c *= exposure;
  // gentle contrast around middle grey (pre-curve)
  let lc = max(luma(c), 1e-6);
  c *= pow(lc / 0.18, u.contrast - 1.0);
  if (u.tm == 0) {
    let l = luma(c);
    c = mix(c, c * vec3f(0.95, 0.985, 1.07), 0.35 * (1.0 - saturate(l * 2.0)));
    c = aces(c * 1.05);
  } else {
    // filmic: hue-preserving through the mid-tones (tone map luminance, keep chroma: the golden-hour
    // peach; per channel ACES there turns sunlit orange into tan), per channel only in the highlights,
    // so the brightest sunlit faces go toward cream like light on film
    let l = max(luma(c), 1e-6);
    let a = aces(c);
    let lt = luma(aces(vec3f(l)));
    var hp = c * (lt / l);
    // keep saturated highlights in gamut by desaturating toward luminance as needed
    let mx = max(hp.r, max(hp.g, hp.b));
    if (mx > 1.0) { hp = mix(vec3f(lt), hp, (1.0 - lt) / max(mx - lt, 1e-4)); }
    c = mix(hp, a, mix(0.05, 0.6, smoothstep(0.7, 1.0, lt)));
    // golden hour split tone: warm highlights, cool violet shadows
    let t = saturate(lt * 1.4);
    c *= mix(vec3f(0.95, 0.96, 1.07), vec3f(1.05, 0.99, 0.9), t);
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
}