// The chase camera
//
// It sits 20° over the bird's back and a little to its left, 4.3 m off at cruise (breathing with the
// flight: 6.2 m at top speed), and frames the bird low and in the middle, 80% down the frame
// whatever the screen's shape (it looks up on tall screens, a little down on wide ones). It lags,
// swings wide and leans into turns (roll 0.42 × bank), looks down a dive along the flight and up a
// climb by two thirds of its angle, the bird whole in the frame; a 74° horizontal field of view, the
// vertical one kept within 47–78° (47° on 16:9 and wider screens, 59° at 4:3, up to 78° on portrait
// ones), widening by up to 24% toward top speed; a subtle shake at speed and in cloud.
// startYaw: the start's heading by the screen's shape, the sun in frame.
// updateCamera(dt, snap, time, aspect, inCloud) follows bird_ (aspect: the canvas's width over
// height; inCloud: 0..1, how deep the camera is in cloud, render/probe.js). ?closeup: a test camera
// fixed to the bird instead.

import { params } from '../core/params.js';
import { add, clamp, cross, damp, DEG, dot, mix3, norm, sat, scl, spring, sub } from '../math.js';
import { bird_, FLIGHT } from './flight.js';

export const cam = {
  pos: [0, 0, 0], prevPos: [0, 0, 0], offset: null, fwdSmooth: null, roll: 0, fov: 50 * DEG,
  right: [1, 0, 0], up: [0, 1, 0], fwd: [0, 0, -1],
};
export const CLOSEUP = params.closeup;   // (?closeup: a test camera)
// the vertical field of view at rest (it only widens with speed): 74° across, within 47–78°
export const baseFovY = aspect => clamp(2 * Math.atan(Math.tan(37 * DEG) / aspect), 47 * DEG, 78 * DEG);
// the start's heading (0: toward the sun): the sun three quarters of the way to the frame's left
// edge, 26° off it on wide screens; on a phone held upright (41° across) 15°, or it is out of frame
export const startYaw = aspect => Math.min(0.45, 0.75 * Math.atan(Math.tan(baseFovY(aspect) / 2) * aspect));
// Where the camera sits: CAM_DIST from the bird at cruise, CAM_ELEV over its back (the wings' upper
// faces and the folds in them show; at 18° with flat wings it was a dart) and CAM_SIDE to its left,
// looking at it: seen a little from the side, the neck and tail cross the wings. (Not farther: 140 px
// across on 16:9, a fold is a few pixels.)
const CAM_DIST = 4.3, CAM_ELEV = 20 * DEG, CAM_SIDE = -6 * DEG;
// how near the chase camera can come to the bird: 4.3 m from it, less up to 0.6 m as it slows hard
// (dist below), with room for its spring (render/bird.js sizes the bird's targets by it)
export const CAM_NEAREST = 3.0;
// Where the bird sits in the frame in level flight at rest: in the middle, BIRD_LOW of the way from
// there to the bottom edge (80% down the frame), whatever the screen's shape. The camera looks at a
// point LOOK_AHEAD m ahead of the bird (beyond it as seen from the side, lookSide) and lookUp(aspect)
// m above it: on tall screens, whose field of view is taller, it looks up (more sky, the towers'
// heads; 6° on a phone held upright), on 16:9 down (5°). (Lower, the bird crowded the bottom edge,
// and a banked wing's tip touched it; a little off the middle, it looked accidental.)
const BIRD_LOW = 0.6, BIRD_MOST = 0.92, LOOK_AHEAD = 7;
const lookSide = LOOK_AHEAD * Math.tan(-CAM_SIDE);
// (the bird's ends: its wingtips, head and tail, in its own frame: right, up, forward)
const BIRD_ENDS = [[0.52, 0.13, 0], [-0.52, 0.13, 0], [0, 0.15, 0.5], [0, 0.09, -0.45]];
const lookUp = aspect => {
  const back = CAM_DIST * Math.cos(CAM_ELEV), up = CAM_DIST * Math.sin(CAM_ELEV);
  return up + (LOOK_AHEAD + back) * Math.tan(Math.atan(Math.tan(baseFovY(aspect) / 2) * BIRD_LOW) - CAM_ELEV);
};
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
  // (it breathes with the flight: falls back as the bird speeds up, comes nearer as it slows)
  const dist = CAM_DIST * (1 + 0.45 * sp) + clamp(b.accel, -6, 8) * 0.1;
  const back = dist * Math.cos(CAM_ELEV), side = norm(cross(cam.fwdSmooth, [0, 1, 0]));
  const desired = add(add(scl(cam.fwdSmooth, -back * Math.cos(CAM_SIDE)), scl(side, back * Math.sin(CAM_SIDE))), [0, dist * Math.sin(CAM_ELEV), 0]);
  if (!cam.offset || snap) { cam.offset = desired; cam.offV = [0, 0, 0]; }
  for (let i = 0; i < 3; i++) {
    const [x, v] = spring(cam.offset[i], cam.offV[i], desired[i], 3.2, dt);
    cam.offset[i] = x; cam.offV[i] = v;
  }
  cam.prevPos = cam.pos;
  cam.pos = add(b.pos, cam.offset);
  // look a little ahead of the bird (in a climb along CLIMB_SLOPE of its slope, as the camera
  // sits), as far to its side as the camera sits to the other, and as high above it as puts the bird
  // BIRD_LOW down the frame in level flight
  const ahead = [b.vel[0], b.vel[1] * (b.vel[1] > 0 ? CLIMB_SLOPE : 1), b.vel[2]];
  const target = add(add(b.pos, scl(ahead, LOOK_AHEAD)), add(scl(side, lookSide), [0, lookUp(aspect), 0]));
  let fwd = norm(sub(target, cam.pos));
  cam.roll = snap ? b.bank * 0.42 : damp(cam.roll, b.bank * 0.42, 3.0, dt);
  // the bird whole in the frame: where a pull-up swings the look up before the camera has followed
  // (its place lags), or a banked wing reaches down, the look comes down, softly, as far as keeps the
  // bird's lowest tip at most BIRD_MOST of the way from the middle to the bottom edge
  {
    const r = norm(cross(fwd, [0, 1, 0])), u = cross(r, fwd);
    const upR = add(scl(u, Math.cos(cam.roll)), scl(r, Math.sin(cam.roll)));
    let low = 0;
    for (const [x, y, z] of BIRD_ENDS) {
      const d = sub(add(b.pos, add(add(scl(b.right, x), scl(b.up, y)), scl(b.fwd, z))), cam.pos);
      low = Math.max(low, Math.atan(-dot(d, upR) / dot(d, fwd)));
    }
    const most = Math.atan(Math.tan(baseFovY(aspect) / 2) * BIRD_MOST), knee = 3 * DEG, over = low - most + knee;
    if (over > 0) {
      const p = Math.asin(fwd[1]) - over + knee * Math.tanh(over / knee), h = Math.hypot(fwd[0], fwd[2]);
      fwd = [fwd[0] / h * Math.cos(p), Math.sin(p), fwd[2] / h * Math.cos(p)];
    }
  }
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
