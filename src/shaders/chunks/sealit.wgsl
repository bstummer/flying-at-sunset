
// The sunlit sea of clouds around a point (the lit map, render/sunmap.js; the trace and the probe:
// a pass drawing the map can't read it). SEA_LIT: how much of an open sea is lit, past the map.
const SEA_LIT = 0.75;
// how much of the sea around render-space xz is lit, over about r metres (the map's mip levels),
// fading to SEA_LIT over its window's last tenth
fn seaLitAt(xz: vec2f, r: f32) -> f32 {
  let hs = normalize(u.sunDir.xz);
  let uv = vec2f((dot(xz, hs) - u.litA.x) * u.litA.z, (dot(xz, vec2f(-hs.y, hs.x)) - u.litA.y) * u.litA.w);
  let edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  let lit = textureSampleLevel(tLit, sMipClamp, uv, log2(max(r, 80.0) / 80.0)).r;
  return mix(SEA_LIT, lit, saturate(edge * 10.0));
}
// how much of the sea below a point h metres over it is lit, over as wide a stretch as it sees (and
// at least the heaps around it)
fn seaLitBelow(xz: vec2f, h: f32) -> f32 { return seaLitAt(xz, max(1.5 * h, 400.0)); }
// The light the sea of clouds below sends up, lit share of it in the sun: the sky's as the deck
// reflects it (0.8 of it: tools/light/reference.js), and the sun's where it is in the sun (sunlit:
// render/frame.js, albedo · sin of the sun's height / π)
fn seaBounce(lit: f32, sunlit: vec3f, sky: vec3f) -> vec3f { return sky * 0.8 + sunlit * lit; }
