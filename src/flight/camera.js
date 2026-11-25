// The chase camera
//
// It lags, swings wide and leans into turns (roll 0.42 × bank), looks down a dive along the flight
// and up a climb by two thirds of its angle, the bird whole in the frame; a 74° horizontal field of view,
// the vertical one kept within 47–78° (47° on 16:9 and wider screens, 59° at 4:3, up to 78° on
// portrait ones), widening by up to 24% toward top speed; a subtle shake at speed and in cloud.
// updateCamera(dt, snap, time, aspect, inCloud) follows bird_ (aspect: the canvas's width over
// height; inCloud: 0..1, how deep the camera is in cloud, render/probe.js). ?closeup: a test camera
// fixed to the bird instead.

import { params } from '../core/params.js';
import { add, clamp, cross, damp, DEG, mix3, norm, sat, scl, spring, sub } from '../math.js';
import { bird_, FLIGHT } from './flight.js';

export const cam = {
  pos: [0, 0, 0], prevPos: [0, 0, 0], offset: null, fwdSmooth: null, roll: 0, fov: 50 * DEG,
  right: [1, 0, 0], up: [0, 1, 0], fwd: [0, 0, -1],
};
export const CLOSEUP = params.closeup;   // (?closeup: a test camera)
// the vertical field of view at rest (it only widens with speed): 74° across, within 47–78°
export const baseFovY = aspect => clamp(2 * Math.atan(Math.tan(37 * DEG) / aspect), 47 * DEG, 78 * DEG);
// how near the chase camera can come to the bird: 4.1 m behind it, less up to 0.48 m in a hard
// climb (dist below), with room for its spring (render/bird.js sizes the bird's targets by it)
export const CAM_NEAREST = 3.0;
// in a climb the camera sits behind the bird on a slope 0.8 of the flight's (0.55 in a dive, where
// it looks down along the flight) and looks ahead along the same: it sinks behind the bird, which
// stays whole in the frame for as long as the climb is held, and looks up as far as it did when it
// sat on the dive's slope (17° in a 26° climb), where the bird sank under the frame's bottom edge
const CLIMB_SLOPE = 0.8;

export function updateCamera(dt, snap, time, aspect, inCloud) {
  const b = bird_;
  if (CLOSEUP) {
    // test camera: fixed offset in the bird's frame
    const o = CLOSEUP;
    cam.prevPos = cam.pos;
    cam.pos = add(b.pos, add(add(scl(b.right, o[0]), scl(b.up, o[1])), scl(b.fwd, o[2])));
    const fwd = norm(sub(add(b.pos, scl(b.fwd, 0.05)), cam.pos));
    const right = norm(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
    cam.right = right; cam.up = up; cam.fwd = fwd; cam.roll = 0;
    cam.fov = 40 * DEG;
    if (snap) cam.prevPos = cam.pos;
    return;
  }
  const sp = sat((b.speed - FLIGHT.vCruise) / (FLIGHT.vMax - FLIGHT.vCruise));
  // lagging heading -> the camera swings wide in turns
  const flatFwd = norm([b.vel[0], b.vel[1] * (b.vel[1] > 0 ? CLIMB_SLOPE : 0.55), b.vel[2]]);
  if (!cam.fwdSmooth || snap) cam.fwdSmooth = flatFwd;
  cam.fwdSmooth = norm(mix3(cam.fwdSmooth, flatFwd, 1 - Math.exp(-2.1 * dt)));
  const dist = 4.1 + 1.3 * sp + clamp(b.accel, -6, 8) * 0.08;
  const desired = add(scl(cam.fwdSmooth, -dist), [0, 1.3 + 0.25 * sp, 0]);
  if (!cam.offset || snap) { cam.offset = desired; cam.offV = [0, 0, 0]; }
  for (let i = 0; i < 3; i++) {
    const [x, v] = spring(cam.offset[i], cam.offV[i], desired[i], 3.2, dt);
    cam.offset[i] = x; cam.offV[i] = v;
  }
  cam.prevPos = cam.pos;
  cam.pos = add(b.pos, cam.offset);
  // look a little ahead of and above the bird (in a climb along CLIMB_SLOPE of its slope, as the
  // camera sits)
  const ahead = [b.vel[0], b.vel[1] * (b.vel[1] > 0 ? CLIMB_SLOPE : 1), b.vel[2]];
  const target = add(add(b.pos, scl(ahead, 7.0)), [0, 0.55, 0]);
  let fwd = norm(sub(target, cam.pos));
  cam.roll = snap ? b.bank * 0.42 : damp(cam.roll, b.bank * 0.42, 3.0, dt);
  // subtle shake at speed and in cloud
  const shakeAmp = (0.0009 + 0.004 * sp * sp + 0.0025 * inCloud);
  const tt = time;
  const sx = shakeAmp * (Math.sin(tt * 13.1) * 0.6 + Math.sin(tt * 23.7 + 1.0) * 0.4);
  const sy = shakeAmp * (Math.sin(tt * 11.3 + 2.0) * 0.6 + Math.sin(tt * 19.1 + 0.3) * 0.4);
  let right = norm(cross(fwd, [0, 1, 0]));
  let up = cross(right, fwd);
  fwd = norm(add(fwd, add(scl(right, sx), scl(up, sy))));
  right = norm(cross(fwd, [0, 1, 0]));
  up = cross(right, fwd);
  const cr = Math.cos(cam.roll), sr = Math.sin(cam.roll);
  cam.right = norm(sub(scl(right, cr), scl(up, sr)));
  cam.up = norm(add(scl(up, cr), scl(right, sr)));
  cam.fwd = fwd;
  // field of view: wider with speed
  const fovT = baseFovY(aspect) * (1 + 0.24 * sp);
  cam.fov = snap ? fovT : damp(cam.fov, fovT, 2.0, dt);
  if (snap) cam.prevPos = cam.pos;
}
