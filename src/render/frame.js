// One frame, render(time): its passes in order, each group timed (render/timing.js)
//
// - world: apply what the world's worker sent for the clipmaps (render/stream.js); sunmap: bake a slab
//   of the sun map (render/sunmap.js), with the billows as they are now;
// - sky: the sky view (192×108) and the ambient light, again whenever the camera has moved 10 m up
//   or down; probe: light and cloud at the bird and the camera, read back later (render/probe.js);
// - trace: the clouds at R.scale of the canvas, jittered each frame (shaders/trace.js);
// - taau: upsampled to full resolution over the sky, the sun's disk, the cirrus and the two high
//   layers (shaders/taau.js); drifting mist puffs while the camera is in cloud (shaders/mist.js);
// - bird: its shadow map and mesh, laid over the scene (render/bird.js);
// - post: bloom (a 7-level chain), sun rays (while the sun is near the view) and the final pass
//   onto the canvas (shaders/post.js);
// then the commands are submitted (flush) and the probe and the timestamps read back. The look's
// tunables, each with its URL parameter, are at the end.

import { params, TEST } from '../core/params.js';
import { add, dot, fmod, halton, mat3Apply, mat4Mul, perspective, PI, scl, smoothstep, sub, viewFromBasis } from '../math.js';
import { DETAIL_ROT, DETAIL_TILE, SHAPE_TILE, SUN_DIR, WIND } from '../constants.js';
import { clearPass, context, dispatch, flush, pass } from './gpu.js';
import { sunColorAt, sunColTable } from './sun.js';
import { layerColUniform, P, T } from './setup.js';
import { originOf, streamWorld, worldUniforms } from './stream.js';
import { refreshSunMap, sunMapUniforms } from './sunmap.js';
import { bloomLevels, R } from './targets.js';
import { inCloud, mapProbe, mistLum, readProbeAsync } from './probe.js';
import { bird_ } from '../flight/flight.js';
import { cam } from '../flight/camera.js';
import { gpuTimer, tBegin, tEnd } from './timing.js';
import { renderBird } from './bird.js';
import { PROBE_FIELDS } from '../shaders/probe.js';

export let frame = 0;
let prevVP = null;
let skyH = null;     // the camera height the sky view and the ambient light were made for
const SKY_STEP = 10; // m: made again once the camera has moved this far up or down
const SEA_ALBEDO = 0.89;   // the sea of clouds below: a thick deck, with the sun low

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
  streamWorld(O, TEST || frame === 0);
  tEnd();
  const camDelta = sub(cam.pos, cam.prevPos);
  const tanY = Math.tan(cam.fov / 2), tanX = tanY * aspect;
  const jitter = [halton((frame % 16) + 1, 2) - 0.5, halton((frame % 16) + 1, 3) - 0.5];
  // noise offsets wrap at multiples of their lookup periods (the vertical one is squashed 1.7x)
  const shapeOff = [fmod(WIND[0] * time, SHAPE_TILE), fmod(-time * 0.9, 10 * SHAPE_TILE), fmod(WIND[2] * time, SHAPE_TILE)];
  // the detail volume is looked up turned (DETAIL_ROT): its drift, and the render origin with it, are
  // turned too and wrap in the turned frame (unturned, an origin snap or a wrap would make it jump)
  const drift = [WIND[0] * time * 1.6, -time * 2.2, WIND[2] * time * 1.6];
  const turnWrap = v => mat3Apply(DETAIL_ROT, v).map(c => fmod(c, DETAIL_TILE));
  const detailOff = turnWrap(add(O, drift)), detailDrift = turnWrap(drift);
  // the sunlit sea of clouds below as a Lambertian deck lit at 5°: its radiance per unit of sunlight
  // (albedo · sin 5° / π), the light from below on the clouds' bellies and the bird's alike
  const ambSea = scl(sunColorAt(1500), SEA_ALBEDO * SUN_DIR[1] / PI);
  const common = Object.assign(worldUniforms(O), sunMapUniforms(O), {
    tShape: T.shape, tDetail: T.detail, tTsv: T.tsv,
    shapeOff, detailOff, detailDrift, sunDir: SUN_DIR, sunCol: sunColTable,
  });
  // (the lookups take its window as it is after)
  tBegin('sunmap');
  refreshSunMap(cam.pos, O, common);
  Object.assign(common, sunMapUniforms(O));
  tEnd();

  // --- sky view LUT for the current altitude + ambient (they change slowly with it)
  tBegin('sky');
  if (skyH === null || Math.abs(cam.pos[1] - skyH) > SKY_STEP) {
    skyH = cam.pos[1];
    pass(P.sky, [T.sky], { tTrans: T.trans, tMS: T.ms, camH: skyH * 0.001, sunDir: SUN_DIR });
    dispatch(P.amb, { tSky: T.sky, bAmb: T.amb, sunDir: SUN_DIR, camH: skyH * 0.001 }, [3]);
  }

  // --- probe (bird lighting, mist)
  const birdRel = sub(bird_.pos, cam.pos);
  dispatch(P.probe, Object.assign({}, common, {
    bAmb: T.amb, bProbe: T.probe, camPos: camR, birdRel, ambSea,
  }), [PROBE_FIELDS]);
  tEnd();
  readProbeAsync();

  // --- clouds (low res)
  tBegin('trace');
  pass(P.trace, [T.cloudCol, T.cloudDepth], Object.assign({}, common, {
    tSky: T.sky, bAmb: T.amb, res: [R.lowW, R.lowH], jitter, camPos: camR,
    camRight: cam.right, camUp: cam.up, camFwd: cam.fwd, tanHalf: [tanX, tanY], frame,
    ambSea, hazeK: HAZE_K, dbgMode: DBG_MODE, inCloud,
  }), { viewport: [0, 0, R.lowW, R.lowH], load: false });   // (nothing reads past it)

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
      bAmb: T.amb, camPos: camR, camOffset: [fmod(cam.pos[0], 180), fmod(cam.pos[1], 180), fmod(cam.pos[2], 180)],
      camRight: cam.right, camUp: cam.up, viewProj: curVP, strength: 0.42 * inCloud,
    }), { load: true, count: 4, instances: 64 });
  }
  tEnd();
  const histTex = readA ? T.histB : T.histA;
  prevVP = curVP;
  R.histValid = 1;

  // --- bird
  tBegin('bird');
  renderBird(time, curVP, birdRel);
  tEnd();

  // --- bloom
  tBegin('post');
  let src = T.scene;
  for (let i = 0; i < bloomLevels.length; i++) {
    const L = bloomLevels[i];
    pass(P.down, [L], { tSrc: src, srcTexel: [1 / src.w, 1 / src.h], clampHi: BLOOM_CLAMP });
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
    pass(P.raymask, [T.rayA], { tScene: T.scene, camRight: cam.right, camUp: cam.up, camFwd: cam.fwd, tanHalf: [tanX, tanY], sunDir: SUN_DIR, dstTexel: [1 / R.rayW, 1 / R.rayH] });
    pass(P.rayblur, [T.rayB], { tSrc: T.rayA, sunUv, dstTexel: [1 / R.rayW, 1 / R.rayH], stepScale: 1 / 24 / 24 * 0.95, decay: 1.0 });
    pass(P.rayblur, [T.rayA], { tSrc: T.rayB, sunUv, dstTexel: [1 / R.rayW, 1 / R.rayH], stepScale: 1 / 24 * 0.95, decay: 0.93 });
  } else {
    clearPass(T.rayA, [0, 0, 0, 1]);
  }

  // --- final
  const sunC = sunColorAt(cam.pos[1]);
  const out = { view: context.getCurrentTexture().createView(), w, h };
  pass(P.final, [out], {
    tScene: T.scene, tBloom: bloomLevels[0], tRays: T.rayA,
    exposure: EXPOSURE * Math.pow(inCloudGain(), inCloud), bloomMix: BLOOM_MIX, bloomScale: BLOOM_MIX / BLOOM_NORM, rayCol: scl(sunC, RAYS_K * rayStrength), time: time % 1000, res: [w, h], view: VIEW, tm: TONEMAP, contrast: CONTRAST, tDbg: histTex, tDbg2: T.cloudDepth, dbgScale: [R.lowW / R.lowMaxW, R.lowH / R.lowMaxH],
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
// inside cloud the exposure adapts, as an eye or a camera would: the mist around the camera (the
// probe's estimate) toward mid-grey, between the normal exposure and eight times it (deep in a
// tower it is dim)
function inCloudGain() { return Math.min(Math.max(0.6 / (Math.max(mistLum, 1e-5) * EXPOSURE), 1), 8); }
// tests: a hook that copies the image out of the canvas texture before it is presented
let capture = null;
export function captureNext(fn) { capture = fn; }

// The look, each tunable with its URL parameter for trying values (core/params.js)
const EXPOSURE = params.exp ?? 14.0;
const TONEMAP = params.tm ?? 1, CONTRAST = params.con ?? 1.0;
const VIEW = params.view ?? 0, DBG_MODE = params.dbg ?? 0;   // what goes into the final image (1..5), the cloud debug views (1..7)
const HAZE_K = params.haze ?? 2.6e-5;
const RAYS_K = params.rays ?? 0.18;
const BLOOM_UP_W = params.bloomw ?? 0.6;                              // weight of each coarser bloom level
const BLOOM_NORM = (1 - Math.pow(BLOOM_UP_W, 7)) / (1 - BLOOM_UP_W); // total weight of the 7-level chain
const BLOOM_MIX = params.bloom ?? 0.09;
const BLOOM_CLAMP = params.bclamp ?? 3000;
