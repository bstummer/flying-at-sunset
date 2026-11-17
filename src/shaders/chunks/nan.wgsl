// NaN / infinity tests on the bits (a compiler may assume floats are never NaN)
fn isnan3(c: vec3f) -> bool {
  let b = bitcast<vec3u>(c);
  return any(((b & vec3u(0x7f800000u)) == vec3u(0x7f800000u)) & ((b & vec3u(0x007fffffu)) != vec3u(0u)));
}
fn isinf3(c: vec3f) -> bool { return any((bitcast<vec3u>(c) & vec3u(0x7fffffffu)) == vec3u(0x7f800000u)); }
