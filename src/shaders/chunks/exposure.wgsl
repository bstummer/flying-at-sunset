// The exposure the final pass applies, metered on the GPU from the frame itself
// (shaders/exposure.wgsl; bExpo): the luminance this frame's brightest tenth starts at (ln, before
// the exposure), the gain over the base exposure it asks for, that gain adapted to over time, the
// exposure; the frame's mean light (rgb, before the exposure: the veiling glare's)
struct Exposure { high: f32, asked: f32, gain: f32, exposure: f32, mean: vec4f }
