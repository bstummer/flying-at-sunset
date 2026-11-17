
// the resolved bird (premultiplied), texel for texel in its box on the scene (blended over it)
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  return textureLoad(tBird, vec2i(pos.xy) - u.origin, 0);
}
