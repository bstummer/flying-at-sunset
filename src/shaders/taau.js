// Temporal upsampling and the sky composite (FS_TAAU)
//
// The low-resolution clouds, jittered by Halton(2,3) over 16 frames, build up at full resolution:
// the history is reprojected by the nearest of the clouds' depths around (at a silhouette the pixels
// on both sides move as the near cloud does), sampled Catmull-Rom and clamped smoothly to the 3×3
// neighbourhood (bilinear taps per output pixel: no low-resolution grid shows). The clamp tightens
// and the blend quickens with the parallax of the camera's movement, not with the image's motion: a
// turn reprojects exactly. Its first 8 frames (the start, a resize) the history is their plain mean;
// where a turn brings in the frame's edge, it starts from the neighbourhood's mean. Beside it, how
// much of the camera's own fog it holds (an r8 target of its own): where that lies well outside the
// fog around the pixel now, the history is stale (out of a cloud's edge) and gives way to the
// neighbourhood's mean. Behind them the
// sky (the sky view, the cirrus veil, the sun's disk); the two high layers are sheets at their
// heights in the clouds' air (hazed as the clouds are, chunks/atmo.wgsl), in front of or behind the
// clouds by depth (passing from one to the other over a tenth of the distance where they meet). Outputs: the history, the scene, whose
// alpha (how much sky shows past the clouds) masks the sun rays, and the history's fog.

export const U_TAAU = {
  prevVP: 'mat4x4f',
  lowRes: 'vec2f', lowTex: 'vec2f', res: 'vec2f', jitter: 'vec2f', tanHalf: 'vec2f', cirrusOff: 'vec2f', layerOff: 'vec2f',
  camRight: 'vec3f', histFrames: 'f32', camUp: 'vec3f', camFwd: 'vec3f', camDelta: 'vec3f', sunDir: 'vec3f', camPos: 'vec3f',
  sunDisk: 'vec3f', cirrusCol: 'vec3f', hazeK: 'f32',
  layerCol: 'vec3f[2]',      // sunlight at the height of each high layer
};
export { default as FS_TAAU } from './taau.wgsl';
