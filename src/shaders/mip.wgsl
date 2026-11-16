
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  return textureSampleLevel(tSrc, sLin, pos.xy / u.size, 0.0);
}