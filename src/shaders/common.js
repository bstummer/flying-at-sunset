// WGSL shared by (almost) every shader

export const WGSL_COMMON = /* wgsl */ `
const PI = 3.14159265359;
fn smin(a: f32, b: f32, k: f32) -> f32 { let h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
fn smax(a: f32, b: f32, k: f32) -> f32 { let h = max(k - abs(a - b), 0.0) / k; return max(a, b) + h * h * k * 0.25; }
fn pcg3d(v0: vec3u) -> vec3u {
  var v = v0 * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> vec3u(16u);
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
fn hash33(v: vec3u) -> vec3f { return vec3f(pcg3d(v)) * (1.0 / 4294967296.0); }
fn ign(p: vec2f) -> f32 { return fract(52.9829189 * fract(dot(p, vec2f(0.06711056, 0.00583715)))); }
fn luma(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }
// GLSL's mod (the remainder takes the sign of y; WGSL's % truncates)
fn mod1(x: f32, y: f32) -> f32 { return x - y * floor(x / y); }
fn mod2(x: vec2f, y: vec2f) -> vec2f { return x - y * floor(x / y); }
fn mod3(x: vec3f, y: vec3f) -> vec3f { return x - y * floor(x / y); }
// clip position from the GL-style matrices (math.js): y flipped so that every texture keeps its rows
// bottom-up, as the screen-space passes read them; depth from [-w, w] to [0, w]
fn toClip(p: vec4f) -> vec4f { return vec4f(p.x, -p.y, (p.z + p.w) * 0.5, p.w); }
`;
