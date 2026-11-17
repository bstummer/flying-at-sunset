
// Value noise on a 2D lattice that tiles every `per` cells (per axis), and its fbm: 6 octaves, each
// twice as fine and half as strong (the cirrus and the high layers)
fn vnoise(p: vec2f, per: vec2f, seed: u32) -> f32 {
  let i = floor(p);
  let f = p - i;
  let fu = f * f * (3.0 - 2.0 * f);
  let a = hash33(vec3u(vec2u(mod2(i, per)), seed)).x;
  let b = hash33(vec3u(vec2u(mod2(i + vec2f(1.0, 0.0), per)), seed)).x;
  let c = hash33(vec3u(vec2u(mod2(i + vec2f(0.0, 1.0), per)), seed)).x;
  let d = hash33(vec3u(vec2u(mod2(i + vec2f(1.0, 1.0), per)), seed)).x;
  return mix(mix(a, b, fu.x), mix(c, d, fu.x), fu.y);
}
fn fbm(p: vec2f, per0: vec2f, seed: u32) -> f32 {
  var s = 0.0;
  var a = 0.5;
  var per = per0;
  for (var i = 0; i < 6; i++) { s += a * vnoise(p * per, per, seed + u32(i)); a *= 0.5; per *= 2.0; }
  return s;
}
