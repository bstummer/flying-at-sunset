// Pipelines, static textures, and the one-off generation of the static data

import { DBG_MODE } from '../params.js';
import { DETAIL_N, SHAPE_N } from '../constants.js';
import { CANVAS_FORMAT, flush, mipLevel, pass, pipeline, slices, texture, RENDER } from './gpu.js';
import { sunColorAt, sunColTable } from './sun.js';
import { FS_AMBIENT, FS_MULTISCAT, FS_SKYVIEW, FS_TRANSMITTANCE, U_AMBIENT, U_SKYVIEW } from '../shaders/sky.js';
import { FS_CIRRUS, FS_LAYERS, FS_MIP, FS_NOISE3D, U_NOISE3D, U_SIZE } from '../shaders/textures.js';
import { FS_BAKE, FS_TSV, NOUT, U_BAKE, U_TSV } from '../shaders/volumes.js';
import { FS_TRACE, U_TRACE } from '../shaders/trace.js';
import { FS_TAAU, U_TAAU } from '../shaders/taau.js';
import { FS_PROBE, U_PROBE } from '../shaders/probe.js';
import { FS_MIST, U_MIST, VS_MIST } from '../shaders/mist.js';
import { FS_BIRD, U_BIRD, VS_BIRD } from '../shaders/bird.js';
import { FS_DOWN, FS_FINAL, FS_RAYBLUR, FS_RAYMASK, FS_UP, U_DOWN, U_FINAL, U_RAYBLUR, U_RAYMASK, U_UP } from '../shaders/post.js';

const F16 = 'rgba16float';
const ADD = { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } };
const OVER = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } };
// the bird: position and attributes (flex weight, side, panel shade), one buffer each
const BIRD_BUFFERS = [0, 1].map(k => ({ arrayStride: 12, attributes: [{ shaderLocation: k, offset: 0, format: 'float32x3' }] }));
export const P = {
  trans: pipeline('transmittance', { fs: FS_TRANSMITTANCE, targets: [F16] }),
  ms: pipeline('multiscatter', { fs: FS_MULTISCAT, targets: [F16] }),
  sky: pipeline('skyview', { fs: FS_SKYVIEW, uniforms: U_SKYVIEW, targets: [F16] }),
  amb: pipeline('ambient', { fs: FS_AMBIENT, uniforms: U_AMBIENT, targets: [F16] }),
  shape: pipeline('noise3d', { fs: FS_NOISE3D, uniforms: U_NOISE3D, targets: [F16] }),
  detail: pipeline('noise3d', { fs: FS_NOISE3D, uniforms: U_NOISE3D, targets: ['rgba8unorm'] }),
  cirrus: pipeline('cirrus', { fs: FS_CIRRUS, uniforms: U_SIZE, targets: ['rgba8unorm'] }),
  layers: pipeline('layers', { fs: FS_LAYERS, uniforms: U_SIZE, targets: ['rgba8unorm'] }),
  mip: pipeline('mip', { fs: FS_MIP, uniforms: U_SIZE, targets: ['rgba8unorm'] }),
  tsv: pipeline('tsv', { fs: FS_TSV, uniforms: U_TSV, targets: Array(NOUT).fill('r16float') }),
  bake: pipeline('bake', { fs: FS_BAKE, uniforms: U_BAKE, targets: Array(NOUT).fill('r16float') }),
  trace: pipeline('trace', { fs: DBG_MODE ? FS_TRACE.replace('const DBG = false;', 'const DBG = true;') : FS_TRACE, uniforms: U_TRACE, targets: [F16, 'r16float'] }),
  taau: pipeline('taau', { fs: FS_TAAU, uniforms: U_TAAU, targets: [F16, F16] }),
  probe: pipeline('probe', { fs: FS_PROBE, uniforms: U_PROBE, targets: ['rgba32float'] }),
  bird: pipeline('bird', {
    vs: VS_BIRD, fs: FS_BIRD, uniforms: U_BIRD, targets: [F16], buffers: BIRD_BUFFERS, samples: 4,
    depth: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less-equal' },
  }),
  shadow: pipeline('shadow', {
    vs: VS_BIRD, uniforms: U_BIRD, buffers: BIRD_BUFFERS,
    depth: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less-equal', depthBias: 2, depthBiasSlopeScale: 1.5 },
  }),
  down: pipeline('down', { fs: FS_DOWN, uniforms: U_DOWN, targets: [F16] }),
  up: pipeline('up', { fs: FS_UP, uniforms: U_UP, targets: [F16], blend: ADD }),
  raymask: pipeline('raymask', { fs: FS_RAYMASK, uniforms: U_RAYMASK, targets: [F16] }),
  rayblur: pipeline('rayblur', { fs: FS_RAYBLUR, uniforms: U_RAYBLUR, targets: [F16] }),
  final: pipeline('final', { fs: FS_FINAL, uniforms: U_FINAL, targets: [CANVAS_FORMAT] }),
  mist: pipeline('mist', { vs: VS_MIST, fs: FS_MIST, uniforms: U_MIST, targets: [F16], blend: OVER, topology: 'triangle-strip' }),
};

// --- static textures
export const T = {};
T.trans = texture(256, 64, F16);
T.ms = texture(32, 32, F16);
T.sky = texture(192, 108, F16);
T.amb = texture(4, 1, F16, { usage: RENDER | GPUTextureUsage.COPY_SRC });
T.shape = texture(SHAPE_N, SHAPE_N, F16, { depth: SHAPE_N, dim: '3d' });
T.detail = texture(DETAIL_N, DETAIL_N, 'rgba8unorm', { depth: DETAIL_N, dim: '3d' });
T.cirrus = texture(512, 512, 'rgba8unorm');
T.layers = texture(1024, 1024, 'rgba8unorm', { mips: 11 });   // seen at grazing angles far away: mipmaps
T.probe = texture(8, 1, 'rgba32float', { usage: RENDER | GPUTextureUsage.COPY_SRC });

export const sunColUniform = sunColTable;
export const layerColUniform = new Float32Array([...sunColorAt(6300), ...sunColorAt(7700)]);

// one-off generation of all static GPU data (once the pipelines are compiled)
export function generateStatic() {
  // noise volumes
  for (let z = 0; z < SHAPE_N; z++) pass(P.shape, slices(T.shape, z), { z: (z + 0.5) / SHAPE_N, size: SHAPE_N, cells: [4, 8, 16, 32], mode: 0 });
  for (let z = 0; z < DETAIL_N; z++) pass(P.detail, slices(T.detail, z), { z: (z + 0.5) / DETAIL_N, size: DETAIL_N, cells: [4, 8, 16, 24], mode: 1 });
  pass(P.cirrus, [T.cirrus], { size: 512 });
  // the high layers and their mip levels
  const lv = Array.from({ length: 11 }, (_, k) => mipLevel(T.layers, k));
  pass(P.layers, [lv[0]], { size: 1024 });
  for (let k = 1; k < lv.length; k++) pass(P.mip, [lv[k]], { tSrc: lv[k - 1], size: lv[k].w });
  // atmosphere LUTs
  pass(P.trans, [T.trans], {});
  pass(P.ms, [T.ms], { tTrans: T.trans });
  flush();
}
