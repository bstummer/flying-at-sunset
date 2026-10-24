// One frame: sky, probe, clouds, temporal upsampling and composite, bird, bloom, sun rays, tone mapping

import { CONTRAST, DBG_MODE, HAZE_K, Q, TEST, TONEMAP, VIEW } from '../params.js';
import { dot, fmod, halton, mat4Mul, perspective, PI, scl, smoothstep, sub, viewFromBasis } from '../math.js';
import { SUN_DIR, WIND } from '../constants.js';
import { emptyVAO, gl, pass, setUniforms } from './gl.js';
import { sunColorAt } from './sun.js';
import { FB, layerColUniform, P, sunColUniform, T } from './setup.js';
import { originOf, streamWorld, worldUniforms } from './stream.js';
import { bloomLevels, R } from './targets.js';
import { inCloud, readProbeAsync } from './probe.js';
import { bird_ } from '../flight.js';
import { cam } from '../camera.js';
import { tBegin, tEnd } from './timing.js';
import { renderBird } from './bird.js';

export let frame = 0;
let prevVP = null;

function viewProjRot(camR, camU, camF, fovy, aspect) {
  const V = viewFromBasis(camR, camU, camF, [0, 0, 0]);
  return mat4Mul(perspective(fovy, aspect, 0.05, 1e8), V);
}

export function render(time, dt) {
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
    uShape: T.shape, uDetail: T.detail, uTSV: T.tsv,
    uShapeOff: shapeOff, uDetailOff: detailOff, uTime: time % 1e5, uSunDir: SUN_DIR, uSunCol: sunColUniform,
  });

  // --- sky view LUT for the current altitude + ambient
  tBegin('sky');
  pass(P.sky, FB.sky, 192, 108, { uTrans: T.trans, uMS: T.ms, uCamH: cam.pos[1] * 0.001, uSunDir: SUN_DIR });
  pass(P.amb, FB.amb, 4, 1, { uSky: T.sky, uSunDir: SUN_DIR, uCamH: cam.pos[1] * 0.001 });

  // --- probe (bird lighting, mist)
  const birdRel = sub(bird_.pos, cam.pos);
  pass(P.probe, FB.probe, 8, 1, Object.assign({}, common, {
    uAmb: T.amb, uSky: T.sky, uCamPos: camR, uBirdRel: birdRel, uAmbSea: ambSea, uFrame: frame,
  }));
  tEnd();
  readProbeAsync();

  // --- clouds (low res)
  tBegin('trace');
  pass(P.trace, FB.trace, R.lowW, R.lowH, Object.assign({}, common, {
    uSky: T.sky, uAmb: T.amb, uRes: [R.lowW, R.lowH], uJitter: jitter, uCamPos: camR,
    uCamRight: cam.right, uCamUp: cam.up, uCamFwd: cam.fwd, uTanHalf: [tanX, tanY], uFrame: frame,
    uAmbSea: ambSea, uHazeK: HAZE_K, uDbgMode: { i: DBG_MODE }, uInCloud: inCloud,
  }));

  tEnd();
  // --- temporal upsample + sky composite
  tBegin('taau');
  const curVP = viewProjRot(cam.right, cam.up, cam.fwd, cam.fov, aspect);
  const readA = frame % 2 === 0;
  const sunDisk = scl(sunColorAt(cam.pos[1]), 1 / (PI * 0.0052 * 0.0052) * 0.9);
  pass(P.taau, readA ? FB.taauB : FB.taauA, w, h, {
    uCur: T.cloudCol, uCurDepth: T.cloudDepth, uHist: readA ? T.histA : T.histB, uSky: T.sky, uCirrus: T.cirrus,
    uLowRes: [R.lowW, R.lowH], uLowTex: [R.lowMaxW, R.lowMaxH], uRes: [w, h], uJitter: jitter,
    uCamRight: cam.right, uCamUp: cam.up, uCamFwd: cam.fwd, uTanHalf: [tanX, tanY],
    uPrevVP: prevVP || curVP, uCamDelta: camDelta, uHistValid: R.histValid, uSunDir: SUN_DIR, uCamPos: camR,
    uSunDisk: sunDisk, uCirrusCol: scl(sunColorAt(9800), 1.0), uCirrusOff: [fmod(O[0] + time * 6, 32000), fmod(O[2] + time * 2, 32000)],
    uLayers: T.layers, uLayerOff: [fmod(O[0] + time * WIND[0] * 1.5, 64000), fmod(O[2] + time * WIND[2] * 1.5, 64000)], uLayerCol: layerColUniform,
  });
  // drifting mist puffs: only while the camera is inside cloud (they float in the fog around us)
  if (inCloud > 0.02) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.scene);
    gl.viewport(0, 0, w, h);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(P.mist.p);
    setUniforms(P.mist, Object.assign({}, common, {
      uAmb: T.amb, uCamPos: camR, uCamOffset: [fmod(cam.pos[0], 180), fmod(cam.pos[1], 180), fmod(cam.pos[2], 180)],
      uCamRight: cam.right, uCamUp: cam.up, uViewProj: curVP, uStrength: 0.42 * inCloud,
    }));
    gl.bindVertexArray(emptyVAO);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 64);
    gl.disable(gl.BLEND);
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
  let src = T.scene, sw = w, sh = h;
  for (let i = 0; i < bloomLevels.length; i++) {
    const L = bloomLevels[i];
    pass(P.down, L.fb, L.w, L.h, { uSrc: src, uBird: T.birdTex, uBirdBox: birdBox, uSrcTexel: [1 / sw, 1 / sh], uFirst: { i: i === 0 ? 1 : 0 }, uClampHi: BLOOM_CLAMP });
    src = L.tex; sw = L.w; sh = L.h;
  }
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  for (let i = bloomLevels.length - 1; i > 0; i--) {
    const S = bloomLevels[i], D = bloomLevels[i - 1];
    pass(P.up, D.fb, D.w, D.h, { uSrc: S.tex, uSrcTexel: [1 / S.w, 1 / S.h], uDstTexel: [1 / D.w, 1 / D.h], uWeight: BLOOM_UP_W });
  }
  gl.disable(gl.BLEND);

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
    pass(P.raymask, FB.rayA, R.rayW, R.rayH, { uHist: histTex, uBird: T.birdTex, uBirdBox: birdBox, uCamRight: cam.right, uCamUp: cam.up, uCamFwd: cam.fwd, uTanHalf: [tanX, tanY], uSunDir: SUN_DIR, uDstTexel: [1 / R.rayW, 1 / R.rayH] });
    pass(P.rayblur, FB.rayB, R.rayW, R.rayH, { uSrc: T.rayA, uSunUv: sunUv, uDstTexel: [1 / R.rayW, 1 / R.rayH], uStepScale: 1 / 24 / 24 * 0.95, uDecay: 1.0 });
    pass(P.rayblur, FB.rayA, R.rayW, R.rayH, { uSrc: T.rayB, uSunUv: sunUv, uDstTexel: [1 / R.rayW, 1 / R.rayH], uStepScale: 1 / 24 * 0.95, uDecay: 0.93 });
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.rayA);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  }

  // --- final
  const sunC = sunColorAt(cam.pos[1]);
  pass(P.final, null, w, h, {
    uScene: T.scene, uBird: T.birdTex, uBloom: bloomLevels[0].tex, uRays: T.rayA, uBirdBox: birdBox,
    uExposure: exposure * (1.0 + 0.45 * inCloud), uBloomMix: BLOOM_MIX, uBloomScale: BLOOM_MIX / BLOOM_NORM, uRayCol: scl(sunC, RAYS_K * rayStrength), uTime: time % 1000, uRes: [w, h], uView: { i: VIEW }, uTM: { i: TONEMAP }, uContrast: CONTRAST, uDbg: histTex, uDbg2: T.cloudDepth, uDbgScale: [R.lowW / R.lowMaxW, R.lowH / R.lowMaxH],
  });
  tEnd();
  frame++;
}

let exposure = Q.has('exp') ? parseFloat(Q.get('exp')) : 14.0;
const RAYS_K = Q.has('rays') ? parseFloat(Q.get('rays')) : 0.18;
const BLOOM_UP_W = Q.has('bloomw') ? parseFloat(Q.get('bloomw')) : 0.6;                                         // weight of each coarser bloom level
const BLOOM_NORM = (1 - Math.pow(BLOOM_UP_W, 7)) / (1 - BLOOM_UP_W); // total weight of the 7-level chain
const BLOOM_MIX = Q.has('bloom') ? parseFloat(Q.get('bloom')) : 0.09;
const BLOOM_CLAMP = Q.has('bclamp') ? parseFloat(Q.get('bclamp')) : 3000;
