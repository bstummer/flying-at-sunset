// The sun map's scan (shaders/volumes.js): an invocation per ray of a slab, adding up its stretches
// (bSmSeg) from the march past the window (bSmTail) toward the camera, and writing at each texel
// the light toward the sun that the clouds past the one the texel sits in let through (where it is
// clear, all of them): the shadow those clouds cast, without the light diffusing through its own;
// and that light's SM_ROOTth root (what the lookups interpolate: chunks/cloud.wgsl, sunMapAt).
// The texels go along the ray (x, two bytes each, in pairs into bSunMap, rows of u.row u32), across
// it (y, the slab's) and up its height (z, wrapped: render/sunmap.js).
@compute @workgroup_size(64, 1, 1) fn cs(@builtin(global_invocation_id) g: vec3u) {
  let j = i32(g.x);
  let i = i32(g.y);
  if (i >= u.slab || j >= u.nRays) { return; }
  let nw = i32(SM_NW);
  let nv = u.nv;
  let at = i * u.nRays + j;
  var t0 = vec2f(0.0);
  let np = i32(SM_PIECES);
  for (var c = 0; c < np; c++) { t0 += bSmTail[at * np + c]; }
  var tau = t0.x;
  var lc = t0.y;        // the optical depth from where the ray was last clear of cloud
  var hold = vec2f(0.0);
  let base = (((u.vb + j) % nv) * u.slab + i) * u.row;
  for (var k = nw - 1; k >= 0; k--) {
    let s = bSmSeg[at * nw + k];
    if (s.y >= 0.0) { lc = tau + s.y; }
    tau += s.x;
    // (as the light that gets through: interpolated between texels, the optical depth put a cloud's
    // shadow where a tenth of the deepest one's was, and its edge became a staircase)
    let od = min(lc, 14.0);
    let other = vec2f(exp(-od), exp(-od / SM_ROOT));
    // (texels in pairs along the ray; the pair's slot belongs to this ray where it lies in the map's
    // height band, which sinks along the ray: past it, the ray of the same slot a band higher)
    let kx = (u.k0m + k) % nw;
    if (kx % 2 == 1) { hold = other; continue; }
    let lo0 = i32(floor(u.c0 - f32(k) * u.r));
    let lo1 = i32(floor(u.c0 - f32(k + 1) * u.r));
    if ((j >= lo0 && j < lo0 + nv) || (j >= lo1 && j < lo1 + nv)) {
      bSunMap[base + kx / 2] = pack4x8unorm(vec4f(other, hold));
    }
  }
}
