// One frame: sky, probe, clouds, temporal upsampling and composite, bird, bloom, sun rays, tone mapping

import { CONTRAST, DBG_MODE, HAZE_K, Q, TEST, TONEMAP, VIEW } from '../params.js';
import { dot, fmod, halton, mat4Mul, perspective, PI, scl, smoothstep, sub, viewFromBasis } from '../math.js';
import { SUN_DIR, WIND } from '../constants.js';
import { clearPass, context, flush, pass } from './gpu.js';
import { sunColorAt } from './sun.js';
import { layerColUniform, P, sunColUniform, T } from './setup.js';
import { originOf, streamWorld, worldUniforms } from './stream.js';
import { bloomLevels, R } from './targets.js';
import { inCloud, mapProbe, readProbeAsync } from './probe.js';
import { bird_ } from '../flight.js';
import { cam } from '../camera.js';
import { gpuTimer, tBegin, tEnd } from './timing.js';
import { renderBird } from './bird.js';

export let frame = 0;
let prevVP = null;

function viewProjRot(camR, camU, camF, fovy, aspect) {
  const V = viewFromBasis(camR, camU, camF, [0, 0, 0]);
  return mat4Mul(perspective(fovy, aspect, 0.05, 1e8), V);
}

export function render(time) {
  const w = R.w, h = R.h, aspect = w / h;
  // --- dynamic cloud resolution
  R.lowW = Math.max(16, Math.round(w * R.scale)); R.lowH = Math.max(16, Math.round(h * R.scale));
  R.lowW = Math.min(R.lowW, R.lowMaxW); R.lowH = Math.min(R.lowH, R.lowMaxH);
  // render space: the world around an origin snapped near the camera; stream the world volumes
  const O = originOf(cam.pos);
  const camR = [cam.pos[0] - O[0], cam.pos[1], cam.pos[2] - O[2]];
  tBegin('world');
  streamWorld(cam.pos, O, TEST || frame === 0 ? -1 : 4, frame);
  tEnd();
  const camDelta = sub(cam.pos, cam.prevPos);
  const tanY = Math.tan(cam.fov / 2), tanX = tanY * aspect;
  const jitter = [halton((frame % 16) + 1, 2) - 0.5, halton((frame % 16) + 1, 3) - 0.5];
  // noise offsets wrap at multiples of their lookup periods (the vertical one is squashed 1.7x)
  const shapeOff = [fmod(WIND[0] * time, 5120), fmod(-time * 0.9, 51200), fmod(WIND[2] * time, 5120)];
  const detailOff = [fmod(WIND[0] * time * 1.6, 512), fmod(-time * 2.2, 512), fmod(WIND[2] * time * 1.6, 512)];
  const ambSea = scl(sunColorAt(1500), 0.065);
  const common = Object.assign(worldUniforms(O), {
    tShape: T.shape, tDetail: T.detail, tTsv: T.tsv,
    shapeOff, detailOff, sunDir: SUN_DIR, sunCol: sunColUniform,
  });

  // --- sky view LUT for the current altitude + ambient
  tBegin('sky');
  pass(P.sky, [T.sky], { tTrans: T.trans, tMS: T.ms, camH: cam.pos[1] * 0.001, sunDir: SUN_DIR });
  pass(P.amb, [T.amb], { tSky: T.sky, sunDir: SUN_DIR, camH: cam.pos[1] * 0.001 });

  // --- probe (bird lighting, mist)
  const birdRel = sub(bird_.pos, cam.pos);
  pass(P.probe, [T.probe], Object.assign({}, common, {
    tAmb: T.amb, camPos: camR, birdRel, ambSea,
  }));
  tEnd();
  readProbeAsync();

  // --- clouds (low res)
  tBegin('trace');
  pass(P.trace, [T.cloudCol, T.cloudDepth], Object.assign({}, common, {
    tSky: T.sky, tAmb: T.amb, res: [R.lowW, R.lowH], jitter, camPos: camR,
    camRight: cam.right, camUp: cam.up, camFwd: cam.fwd, tanHalf: [tanX, tanY], frame,
    ambSea, hazeK: HAZE_K, dbgMode: DBG_MODE, inCloud,
  }), { viewport: [0, 0, R.lowW, R.lowH] });

  tEnd();
  // --- temporal upsample + sky composite
  tBegin('taau');
  const curVP = viewProjRot(cam.right, cam.up, cam.fwd, cam.fov, aspect);
  const readA = frame % 2 === 0;
  const sunDisk = scl(sunColorAt(cam.pos[1]), 1 / (PI * 0.0052 * 0.0052) * 0.9);
  pass(P.taau, [readA ? T.histB : T.histA, T.scene], {
    tCur: T.cloudCol, tCurDepth: T.cloudDepth, tHist: readA ? T.histA : T.histB, tSky: T.sky, tCirrus: T.cirrus,
    lowRes: [R.lowW, R.lowH], lowTex: [R.lowMaxW, R.lowMaxH], res: [w, h], jitter,
    camRight: cam.right, camUp: cam.up, camFwd: cam.fwd, tanHalf: [tanX, tanY],
    prevVP: prevVP || curVP, camDelta, histValid: R.histValid, sunDir: SUN_DIR, camPos: camR,
    sunDisk, cirrusCol: scl(sunColorAt(9800), 1.0), cirrusOff: [fmod(O[0] + time * 6, 32000), fmod(O[2] + time * 2, 32000)],
    tLayers: T.layers, layerOff: [fmod(O[0] + time * WIND[0] * 1.5, 64000), fmod(O[2] + time * WIND[2] * 1.5, 64000)], layerCol: layerColUniform,
  });
  // drifting mist puffs: only while the camera is inside cloud (they float in the fog around us)
  if (inCloud > 0.02) {
    pass(P.mist, [T.scene], Object.assign({}, common, {
      tAmb: T.amb, camPos: camR, camOffset: [fmod(cam.pos[0], 180), fmod(cam.pos[1], 180), fmod(cam.pos[2], 180)],
      camRight: cam.right, camUp: cam.up, viewProj: curVP, strength: 0.42 * inCloud,
    }), { load: true, count: 4, instances: 64 });
  }
  tEnd();
  const histTex = readA ? T.histB : T.histA;
  prevVP = curVP;
  R.histValid = 1;

  // --- bird
  tBegin('bird');
  const birdBox = renderBird(time, curVP, birdRel);
  tEnd();

  // --- bloom
  tBegin('post');
  let src = T.scene;
  for (let i = 0; i < bloomLevels.length; i++) {
    const L = bloomLevels[i];
    pass(P.down, [L], { tSrc: src, tBird: T.birdTex, birdBox, srcTexel: [1 / src.w, 1 / src.h], first: i === 0 ? 1 : 0, clampHi: BLOOM_CLAMP });
    src = L;
  }
  // (added onto each finer level)
  for (let i = bloomLevels.length - 1; i > 0; i--) {
    const S = bloomLevels[i], D = bloomLevels[i - 1];
    pass(P.up, [D], { tSrc: S, srcTexel: [1 / S.w, 1 / S.h], dstTexel: [1 / D.w, 1 / D.h], weight: BLOOM_UP_W }, { load: true });
  }

  // --- sun rays
  const sunView = [dot(SUN_DIR, cam.right), dot(SUN_DIR, cam.up), dot(SUN_DIR, cam.fwd)];
  let rayStrength = 0;
  let sunUv = [0.5, 0.5];
  if (sunView[2] > 0.05) {
    sunUv = [0.5 + 0.5 * sunView[0] / sunView[2] / tanX, 0.5 + 0.5 * sunView[1] / sunView[2] / tanY];
    const off = Math.max(Math.abs(sunUv[0] - 0.5), Math.abs(sunUv[1] - 0.5));
    rayStrength = 1 - smoothstep(0.6, 1.3, off);
  }
  if (rayStrength > 0.001) {
    pass(P.raymask, [T.rayA], { tHist: histTex, tBird: T.birdTex, birdBox, camRight: cam.right, camUp: cam.up, camFwd: cam.fwd, tanHalf: [tanX, tanY], sunDir: SUN_DIR, dstTexel: [1 / R.rayW, 1 / R.rayH] });
    pass(P.rayblur, [T.rayB], { tSrc: T.rayA, sunUv, dstTexel: [1 / R.rayW, 1 / R.rayH], stepScale: 1 / 24 / 24 * 0.95, decay: 1.0 });
    pass(P.rayblur, [T.rayA], { tSrc: T.rayB, sunUv, dstTexel: [1 / R.rayW, 1 / R.rayH], stepScale: 1 / 24 * 0.95, decay: 0.93 });
  } else {
    clearPass(T.rayA, [0, 0, 0, 1]);
  }

  // --- final
  const sunC = sunColorAt(cam.pos[1]);
  const out = { view: context.getCurrentTexture().createView(), w, h };
  pass(P.final, [out], {
    tScene: T.scene, tBird: T.birdTex, tBloom: bloomLevels[0], tRays: T.rayA, birdBox,
    exposure: exposure * (1.0 + 0.45 * inCloud), bloomMix: BLOOM_MIX, bloomScale: BLOOM_MIX / BLOOM_NORM, rayCol: scl(sunC, RAYS_K * rayStrength), time: time % 1000, res: [w, h], view: VIEW, tm: TONEMAP, contrast: CONTRAST, tDbg: histTex, tDbg2: T.cloudDepth, dbgScale: [R.lowW / R.lowMaxW, R.lowH / R.lowMaxH],
  });
  tEnd();
  if (gpuTimer) gpuTimer.resolve();
  const captured = capture ? capture(context.getCurrentTexture()) : null;
  flush();
  if (captured) captured();
  mapProbe();
  if (gpuTimer) gpuTimer.map();
  frame++;
}
// tests: a hook that copies the image out of the canvas texture before it is presented
let capture = null;
export function captureNext(fn) { capture = fn; }

let exposure = Q.has('exp') ? parseFloat(Q.get('exp')) : 14.0;
const RAYS_K = Q.has('rays') ? parseFloat(Q.get('rays')) : 0.18;
const BLOOM_UP_W = Q.has('bloomw') ? parseFloat(Q.get('bloomw')) : 0.6;                                         // weight of each coarser bloom level
const BLOOM_NORM = (1 - Math.pow(BLOOM_UP_W, 7)) / (1 - BLOOM_UP_W); // total weight of the 7-level chain
const BLOOM_MIX = Q.has('bloom') ? parseFloat(Q.get('bloom')) : 0.09;
const BLOOM_CLAMP = Q.has('bclamp') ? parseFloat(Q.get('bclamp')) : 3000;
