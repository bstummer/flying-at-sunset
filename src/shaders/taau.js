// Temporal upsampling and the sky composite (FS_TAAU)
//
// The low-resolution clouds, jittered by Halton(2,3) over 16 frames, build up at full resolution:
// the history is reprojected by the nearest of the clouds' depths around (at a silhouette the pixels
// on both sides move as the near cloud does), sampled Catmull-Rom and clamped smoothly to the 3×3
// neighbourhood (bilinear taps per output pixel: no low-resolution grid shows). The clamp tightens
// and the blend quickens with the parallax of the camera's movement, not with the image's motion: a
// turn reprojects exactly. Its first 8 frames (the start, a resize) the history is their plain mean;
// where a turn brings in the frame's edge, it starts from the neighbourhood's mean. Behind them the
// sky (the sky view, the cirrus veil, the sun's disk); the two high layers are sheets at their
// heights, in front of or behind the clouds by depth. Outputs: the history, and the scene, whose
// alpha (how much sky shows past the clouds) masks the sun rays.

export const U_TAAU = {
  prevVP: 'mat4x4f',
  lowRes: 'vec2f', lowTex: 'vec2f', res: 'vec2f', jitter: 'vec2f', tanHalf: 'vec2f', cirrusOff: 'vec2f', layerOff: 'vec2f',
  camRight: 'vec3f', histFrames: 'f32', camUp: 'vec3f', camFwd: 'vec3f', camDelta: 'vec3f', sunDir: 'vec3f', camPos: 'vec3f',
  sunDisk: 'vec3f', cirrusCol: 'vec3f',
  layerCol: 'vec3f[2]',      // sunlight at the height of each high layer
};
export { default as FS_TAAU } from './taau.wgsl';
