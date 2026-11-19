// Every pipeline (P), the static textures and buffers (T: the atmosphere's tables, the noise
// volumes, the cirrus, the high layers, the ambient light, the probe), and generateStatic(): the
// passes that fill the static textures once the pipelines are compiled (main.js). Other modules add
// their own to T (render/stream.js, render/targets.js, render/bird.js).

import { params } from '../core/params.js';
import { DETAIL_N, SHAPE_N } from '../constants.js';
import { buffer, CANVAS_FORMAT, compute, dispatch, flush, mipLevel, pass, pipeline, texture, RENDER } from './gpu.js';
import { sunColorAt } from './sun.js';
import { CS_AMBIENT, FS_MULTISCAT, FS_SKYVIEW, FS_TRANSMITTANCE, U_AMBIENT, U_SKYVIEW } from '../shaders/sky.js';
import { CS_DETAIL, CS_SHAPE, FS_CIRRUS, FS_LAYERS, FS_MIP, U_NOISE3D, U_SIZE } from '../shaders/textures.js';
import { CS_TSV, FS_BAKE, NOUT, U_BAKE, U_TSV } from '../shaders/volumes.js';
import { FS_TRACE, U_TRACE } from '../shaders/trace.js';
import { FS_TAAU, U_TAAU } from '../shaders/taau.js';
import { CS_PROBE, U_PROBE } from '../shaders/probe.js';
import { FS_MIST, U_MIST, VS_MIST } from '../shaders/mist.js';
import { FS_BIRD, FS_BIRDOVER, U_BIRD, U_BIRDOVER, VS_BIRD } from '../shaders/bird.js';
import { FS_DOWN, FS_FINAL, FS_RAYBLUR, FS_RAYMASK, FS_UP, U_DOWN, U_FINAL, U_RAYBLUR, U_RAYMASK, U_UP } from '../shaders/post.js';

const F16 = 'rgba16float';
const ADD = { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } };
// over the scene, premultiplied; the scene's alpha (how much sky shows: the sun rays' mask) is kept
// by the mist and loses what the bird covers
const MIST_OVER = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } };
const BIRD_OVER = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one-minus-src-alpha' } };
// the bird: position and attributes (flex weight, side, panel shade), one buffer each
const BIRD_BUFFERS = [0, 1].map(k => ({ arrayStride: 12, attributes: [{ shaderLocation: k, offset: 0, format: 'float32x3' }] }));
export const P = {
  trans: pipeline('transmittance', { fs: FS_TRANSMITTANCE, targets: [F16] }),
  ms: pipeline('multiscatter', { fs: FS_MULTISCAT, targets: [F16] }),
  sky: pipeline('skyview', { fs: FS_SKYVIEW, uniforms: U_SKYVIEW, targets: [F16] }),
  amb: compute('ambient', { cs: CS_AMBIENT, uniforms: U_AMBIENT, writes: ['bAmb'] }),
  shape: compute('noise shape', { cs: CS_SHAPE, uniforms: U_NOISE3D }),
  detail: compute('noise detail', { cs: CS_DETAIL, uniforms: U_NOISE3D }),
  cirrus: pipeline('cirrus', { fs: FS_CIRRUS, uniforms: U_SIZE, targets: ['rgba8unorm'] }),
  layers: pipeline('layers', { fs: FS_LAYERS, uniforms: U_SIZE, targets: ['rgba8unorm'] }),
  mip: pipeline('mip', { fs: FS_MIP, uniforms: U_SIZE, targets: ['rgba8unorm'] }),
  tsv: compute('tsv', { cs: CS_TSV, uniforms: U_TSV, writes: ['bTsv'] }),
  bake: pipeline('bake', { fs: FS_BAKE, uniforms: U_BAKE, targets: [...Array(NOUT).fill('r16float'), ...Array(NOUT).fill('rg16float')] }),
  trace: pipeline('trace', { fs: FS_TRACE, constants: { DBG: params.dbg ? 1 : 0 }, uniforms: U_TRACE, targets: [F16, 'r16float'] }),
  taau: pipeline('taau', { fs: FS_TAAU, uniforms: U_TAAU, targets: [F16, F16] }),
  probe: compute('probe', { cs: CS_PROBE, uniforms: U_PROBE, writes: ['bProbe'] }),
  bird: pipeline('bird', {
    vs: VS_BIRD, fs: FS_BIRD, uniforms: U_BIRD, targets: [F16], buffers: BIRD_BUFFERS, samples: 4,
    depth: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less-equal' },
  }),
  shadow: pipeline('shadow', {
    vs: VS_BIRD, uniforms: U_BIRD, buffers: BIRD_BUFFERS,
    depth: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less-equal', depthBias: 2, depthBiasSlopeScale: 1.5 },
  }),
  birdOver: pipeline('bird over', { fs: FS_BIRDOVER, uniforms: U_BIRDOVER, targets: [F16], blend: BIRD_OVER }),
  down: pipeline('down', { fs: FS_DOWN, uniforms: U_DOWN, targets: [F16] }),
  up: pipeline('up', { fs: FS_UP, uniforms: U_UP, targets: [F16], blend: ADD }),
  raymask: pipeline('raymask', { fs: FS_RAYMASK, uniforms: U_RAYMASK, targets: [F16] }),
  rayblur: pipeline('rayblur', { fs: FS_RAYBLUR, uniforms: U_RAYBLUR, targets: [F16] }),
  final: pipeline('final', { fs: FS_FINAL, uniforms: U_FINAL, targets: [CANVAS_FORMAT] }),
  mist: pipeline('mist', { vs: VS_MIST, fs: FS_MIST, uniforms: U_MIST, targets: [F16], blend: MIST_OVER, topology: 'triangle-strip' }),
};

// --- static textures and buffers
export const T = {};
const VOLUME = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING;
T.trans = texture(256, 64, F16);
T.ms = texture(32, 32, F16);
T.sky = texture(192, 108, F16);
T.shape = texture(SHAPE_N, SHAPE_N, F16, { depth: SHAPE_N, dim: '3d', usage: VOLUME });
T.detail = texture(DETAIL_N, DETAIL_N, 'rgba8unorm', { depth: DETAIL_N, dim: '3d', usage: VOLUME });
T.cirrus = texture(512, 512, 'rgba8unorm');
T.layers = texture(1024, 1024, 'rgba8unorm', { mips: 11 });   // seen at grazing angles far away: mipmaps
T.amb = buffer(3 * 16, GPUBufferUsage.UNIFORM);   // struct Ambient (chunks/ambient.wgsl)
T.probe = buffer(6 * 16);    // struct Probe (chunks/probe.wgsl)

export const layerColUniform = new Float32Array([...sunColorAt(6300), ...sunColorAt(7700)]);

// one-off generation of all static GPU data (once the pipelines are compiled)
export function generateStatic() {
  // noise volumes
  dispatch(P.shape, { oShape: T.shape, size: SHAPE_N, cells: [4, 8, 16, 32] }, [SHAPE_N / 4, SHAPE_N / 4, SHAPE_N / 4]);
  dispatch(P.detail, { oDetail: T.detail, size: DETAIL_N, cells: [4, 8, 16, 24] }, [DETAIL_N / 4, DETAIL_N / 4, DETAIL_N / 4]);
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
