// The glider: how the paper bird flies (FLIGHT: its speeds, turns and limits)
//
// Energy-based: dives gain speed, climbs trade it for height; drag above cruise speed, a gentle lift
// below it; springs on bank and flight-path angle, coordinated turns, gentle turbulence (livelier in
// cloud). A climb never ends for want of speed: as the bird slows from cruise to its climb speed,
// rising air takes over its weight, so out of a dive it soars up on its speed at 30°, then lowers
// its nose a little and climbs on for as long as it is held (~26° at 51 m/s: 22 m/s up, from the
// cloud tops to the start's height in half a minute). Near a living tower the air rises
// (world/queries.js, liftAt): along its flank the bird is carried up past its head in a few
// minutes. It can't crash: a soft lift as it sinks into the sea of clouds (by the probe's distance
// to the real billows or by the sea's top, world/queries.js: whichever says it is deeper) and a hard
// floor 170 m under the sea's top; heaps piled high and the towers can be flown through. Ceiling
// 11.5 km.
//
// updateFlight(b, dt, time, steer, probe) moves bird b on by dt seconds: steer { sx, sy } in -1..1
// (core/input.js), probe the GPU's last readback (render/probe.js) or null. It needs only the world
// (seaTopAt, liftAt): tests/flight.test.js flies it in Node.

import { add, clamp, cross, damp, DEG, lerp, norm, sat, scl, smoothstep, spring, sub } from '../math.js';
import { liftAt, seaTopAt } from '../world/queries.js';

export const FLIGHT = { vCruise: 64, vClimb: 48, vStall: 31, vMax: 185, g: 11.5, gTurn: 16.5, maxBank: 56 * DEG, maxClimb: 30 * DEG, maxDive: 42 * DEG };
// a bird at the start, 750 m over the sea's top there (sea0), heading yaw (camera.js's startYaw:
// by the screen; presets.js and ?pose move it)
export const newBird = (sea0 = seaTopAt(0, 0), yaw = 0.45) => ({
  pos: [0, sea0 + 750, 0], yaw, gamma: 0, gammaV: 0, bank: 0, bankV: 0, speed: 66, aoa: 0.05,
  fwd: [0, 0, -1], up: [0, 1, 0], right: [1, 0, 0], load: 1, turnRate: 0, accel: 0, lift: 0,
});
// the bird of the page: made once the world has started (main.js; it waits for the worker)
export const bird_ = {};

export function updateFlight(b, dt, time, steer, probe) {
  const F = FLIGHT;
  const v = b.speed;
  let bankT = steer.sx * F.maxBank;
  const climbAuth = smoothstep(F.vStall, F.vStall + 24, v);
  let gammaT = steer.sy >= 0 ? steer.sy * F.maxClimb * climbAuth : steer.sy * F.maxDive;
  if (climbAuth < 1) gammaT = Math.min(gammaT, lerp(-0.16, gammaT, climbAuth));
  // keep the bird skimming the cloud tops: a gentle lift as it sinks into the sea of clouds.
  // The GPU probe reports the distance to the real billowy surface (heaps piled high excluded,
  // those you may fly through); the floor height map is the fallback and the hard limit.
  const seaTop = seaTopAt(b.pos[0], b.pos[2]);
  let depth = seaTop - 60 - b.pos[1];
  if (probe && isFinite(probe[4])) depth = Math.max(depth, 40 - probe[4]);
  if (depth > -140) {
    const k = smoothstep(-140, 140, depth);
    gammaT = Math.max(gammaT, lerp(-0.32, 0.3, k));
    if (depth > 60) bankT *= 1 - 0.3 * sat((depth - 60) / 150);
  }
  if (b.pos[1] > 11500) gammaT = Math.min(gammaT, -(b.pos[1] - 11500) * 0.0015);
  // turbulence: gentle, livelier in and near cloud
  const birdInCloud = probe ? sat(probe[1] / 0.02) : 0;
  const turb = 0.012 + 0.03 * birdInCloud;
  const nT = time * 0.9;
  bankT += turb * (Math.sin(nT * 1.7) * 0.6 + Math.sin(nT * 2.9 + 1.3) * 0.4) * 1.4;
  gammaT += turb * (Math.sin(nT * 1.3 + 0.4) * 0.6 + Math.sin(nT * 3.1 + 2.1) * 0.4) * 0.5;

  [b.bank, b.bankV] = spring(b.bank, b.bankV, bankT, 2.5, dt);
  [b.gamma, b.gammaV] = spring(b.gamma, b.gammaV, gammaT, 2.0, dt);
  b.turnRate = F.gTurn * Math.tan(b.bank) / Math.max(v, 38);
  b.yaw += b.turnRate * dt;
  const dv = v - F.vCruise;
  // above cruise: air drag bleeds speed; below it a gentle lift of rising air brings the glide back
  const drag = dv > 0 ? 0.012 * dv + 0.00042 * dv * dv : 0.045 * dv;
  // a climb costs speed in full above cruise, and nothing at the climb speed: rising air carries
  // the bird there, and a held climb goes on (a higher vClimb climbs faster and steeper)
  const carried = b.gamma > 0 ? 1 - smoothstep(F.vClimb, F.vCruise, v) : 0;
  b.accel = -F.g * Math.sin(b.gamma) * (1 - carried) - drag;
  b.speed = clamp(v + b.accel * dt, F.vStall * 0.8, F.vMax);
  b.load = 1 / Math.max(Math.cos(b.bank), 0.3) + b.gammaV * v / 9.81 * 0.5;
  // angle of attack (visual): more when slow or pulling
  b.aoa = damp(b.aoa, 0.035 + 0.08 * (1 - sat((v - F.vStall) / (F.vCruise - F.vStall))) + 0.03 * (b.load - 1), 3, dt);
  const cg = Math.cos(b.gamma);
  const vel = [Math.sin(b.yaw) * cg, Math.sin(b.gamma), -Math.cos(b.yaw) * cg];
  b.pos = add(b.pos, scl(vel, b.speed * dt));
  // the air rising around a living tower carries the bird up with it, whatever its heading
  b.lift = liftAt(b.pos[0], b.pos[1], b.pos[2]);
  b.pos[1] += b.lift * dt;
  // hard floor, never deep into the sea
  const hardFloor = seaTop - 170;
  if (b.pos[1] < hardFloor) { b.pos[1] = lerp(b.pos[1], hardFloor, 1 - Math.exp(-6 * dt)); b.gamma = Math.max(b.gamma, 0); }
  // orientation
  const pitch = b.gamma + b.aoa;
  const cp = Math.cos(pitch);
  const fwd = [Math.sin(b.yaw) * cp, Math.sin(pitch), -Math.cos(b.yaw) * cp];
  const right0 = norm(cross(fwd, [0, 1, 0]));
  const up0 = cross(right0, fwd);
  const cb = Math.cos(b.bank), sb = Math.sin(b.bank);
  b.fwd = fwd;
  b.right = norm(sub(scl(right0, cb), scl(up0, sb)));
  b.up = norm(add(scl(up0, cb), scl(right0, sb)));
  b.vel = vel;
}
