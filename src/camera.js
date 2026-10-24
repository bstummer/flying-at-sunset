// The chase camera

import { Q } from './params.js';
import { add, clamp, cross, damp, DEG, mix3, norm, sat, scl, spring, sub } from './math.js';
import { R } from './render/targets.js';
import { inCloud } from './render/probe.js';
import { bird_, FLIGHT } from './flight.js';

export const cam = {
  pos: [0, 0, 0], prevPos: [0, 0, 0], offset: null, fwdSmooth: null, roll: 0, fov: 50 * DEG, shake: [0, 0],
  right: [1, 0, 0], up: [0, 1, 0], fwd: [0, 0, -1],
};
const CLOSEUP = Q.has('closeup') ? Q.get('closeup').split(',').map(Number) : null;   // (?closeup: a test camera)

export function updateCamera(dt, snap, time) {
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
  const flatFwd = norm([b.vel[0], b.vel[1] * 0.55, b.vel[2]]);
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
  // look a little ahead of and above the bird
  const target = add(add(b.pos, scl(b.vel, 7.0)), [0, 0.55, 0]);
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
  const aspect = R.w / R.h;
  const baseFovY = clamp(2 * Math.atan(Math.tan(37 * DEG) / aspect), 47 * DEG, 78 * DEG);
  const fovT = baseFovY * (1 + 0.24 * sp);
  cam.fov = snap ? fovT : damp(cam.fov, fovT, 2.0, dt);
  if (snap) cam.prevPos = cam.pos;
}
