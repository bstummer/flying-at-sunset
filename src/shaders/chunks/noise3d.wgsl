// Tileable 3D noise for the noise volumes (shaders/textures.js): random spheres, Worley, Perlin

// a field of random spheres on a tileable lattice: the signed distance, in cell units
fn sphereField(p: vec3f, cells: f32, seed: u32) -> f32 {
  let pc = p * cells;
  let id = floor(pc);
  let f = pc - id;
  var d = 1.0;
  for (var z = -1; z <= 1; z++) {
    for (var y = -1; y <= 1; y++) {
      for (var x = -1; x <= 1; x++) {
        let o3 = vec3f(f32(x), f32(y), f32(z));
        let c = mod3(id + o3, vec3f(cells));
        let ci = vec3u(c);
        let h = hash33(ci + vec3u(seed * 101u, seed * 211u, seed * 307u));
        let h2 = hash33(ci * 3u + vec3u(seed * 13u + 7u, seed * 5u + 1u, 11u));
        // (the large billows pack close; the small ones over them a little looser)
        let big = seed <= 2u;
        if (h2.y < select(0.16, 0.1, big)) { continue; }
        let center = o3 + 0.1 + 0.8 * h;
        let rad = select(mix(0.36, 0.72, h2.x), mix(0.4, 0.78, h2.x), big);
        d = min(d, length(center - f) - rad);
      }
    }
  }
  return d;
}
fn worley(p: vec3f, cells: f32, seed: u32) -> f32 {
  let pc = p * cells;
  let id = floor(pc);
  let f = pc - id;
  var d = 1e9;
  for (var z = -1; z <= 1; z++) {
    for (var y = -1; y <= 1; y++) {
      for (var x = -1; x <= 1; x++) {
        let o3 = vec3f(f32(x), f32(y), f32(z));
        let c = mod3(id + o3, vec3f(cells));
        let h = hash33(vec3u(c) + vec3u(seed * 97u, seed * 193u, seed * 389u));
        let q = o3 + h - f;
        d = min(d, dot(q, q));
      }
    }
  }
  return sqrt(d);
}
fn grad3(c: vec3f, period: f32, seed: u32) -> vec3f {
  let h = hash33(vec3u(mod3(c, vec3f(period))) + vec3u(seed * 53u, seed * 59u, seed * 61u)) * 2.0 - 1.0;
  return normalize(h + 1e-4);
}
fn perlin(p: vec3f, period: f32, seed: u32) -> f32 {
  let i = floor(p);
  let f = p - i;
  let fu = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  let n000 = dot(grad3(i, period, seed), f);
  let n100 = dot(grad3(i + vec3f(1.0, 0.0, 0.0), period, seed), f - vec3f(1.0, 0.0, 0.0));
  let n010 = dot(grad3(i + vec3f(0.0, 1.0, 0.0), period, seed), f - vec3f(0.0, 1.0, 0.0));
  let n110 = dot(grad3(i + vec3f(1.0, 1.0, 0.0), period, seed), f - vec3f(1.0, 1.0, 0.0));
  let n001 = dot(grad3(i + vec3f(0.0, 0.0, 1.0), period, seed), f - vec3f(0.0, 0.0, 1.0));
  let n101 = dot(grad3(i + vec3f(1.0, 0.0, 1.0), period, seed), f - vec3f(1.0, 0.0, 1.0));
  let n011 = dot(grad3(i + vec3f(0.0, 1.0, 1.0), period, seed), f - vec3f(0.0, 1.0, 1.0));
  let n111 = dot(grad3(i + vec3f(1.0, 1.0, 1.0), period, seed), f - vec3f(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, fu.x), mix(n010, n110, fu.x), fu.y), mix(mix(n001, n101, fu.x), mix(n011, n111, fu.x), fu.y), fu.z);
}
