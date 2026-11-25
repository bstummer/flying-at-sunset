// The exposure the final pass applies, made on the GPU from the frame itself (shaders/exposure.wgsl;
// bExpo): this frame's log-mean luminance, the one adapted to over time, how much of the frame is
// the fog of the camera's own cloud (adapted), the exposure
struct Exposure { mean: f32, adapted: f32, fog: f32, exposure: f32 }
