// WebGPU: the device and the canvas; textures, buffers, samplers, uniforms, pipelines, passes
//
// pipeline() (render) and compute() put a header in front of each shader (a .wgsl file with its
// chunks, tools/wgsl.js): the constants JS and WGSL share (SHARED: CLOUD_TOP and the noise tiles,
// from constants.js), its uniform struct U (bound as u, laid out by WGSL's rules from the shader
// module's U_... fields), the samplers (sLin, sNear, sRep, sVol, sMip, sShadow) and every resource
// its code names outside comments, all registered here: textures tX, storage textures oX (a compute
// shader's output) and storage buffers bX (a struct one holds is declared in a chunk its shaders
// include). A compute pipeline writes the buffers named in its `writes`; everything else only
// reads. `constants` sets the overrides (the trace's DBG). A pass hands over uniform values and
// resources by those names (pass(P.sky, [T.sky], { tTrans: T.trans, ... }), dispatch(P.probe,
// { bProbe: T.probe, ... }, [6])); a missing one throws. (So a chunk's function that reads a lookup
// table takes it as a parameter: the pass that renders the table can't bind it.) The uniforms of
// every pass until a submit go into one buffer at 256-byte steps (dynamic offsets); flush() writes
// it and submits. Pipelines compile in parallel (pipelinesReady). The device is awaited at the top
// level: without WebGPU the page shows its note and this module throws, which stops the page.

import { TEST } from '../core/params.js';
import { canvas, fail } from '../core/page.js';
import { CLOUD_TOP, DETAIL_TILE, SHAPE_TILE } from '../constants.js';

// (without WebGPU the piece cannot run: say why, and stop)
const NEEDS = 'This piece needs WebGPU. Please open it in a recent version of Chrome, Edge, Safari or Firefox.';
const adapter = navigator.gpu ? await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }).catch(() => null) : null;
if (!adapter) { fail(NEEDS); throw new Error('no WebGPU'); }
// what the browser says the GPU is (the benchmark's summary)
export const GPU_NAME = (({ vendor, architecture, device, description } = {}) => [vendor, architecture, device, description].filter(Boolean).join(' ') || 'unknown')(adapter.info);
export const device = await adapter.requestDevice({
  requiredFeatures: adapter.features.has('timestamp-query') ? ['timestamp-query'] : [],
}).catch(() => null);
if (!device) { fail(NEEDS); throw new Error('no WebGPU device'); }
export const TIMESTAMPS = device.features.has('timestamp-query');
// (a lost device, e.g. after a GPU reset: main.js reloads the page)
export const gpuState = { lost: null };
device.lost.then(info => { gpuState.lost = info; });

// the canvas (tests copy its texture to read the image back)
export const context = canvas.getContext('webgpu');
export const CANVAS_FORMAT = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format: CANVAS_FORMAT, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | (TEST ? GPUTextureUsage.COPY_SRC : 0) });

// ---- textures
const TU = GPUTextureUsage;
export const RENDER = TU.TEXTURE_BINDING | TU.RENDER_ATTACHMENT;   // the usual: drawn into, then read
let nextId = 0;
// a texture and its view; `id` keys the cached bind groups
export function texture(w, h, format, { depth = 1, dim = '2d', mips = 1, samples = 1, usage = RENDER } = {}) {
  const tex = device.createTexture({ size: [w, h, depth], format, dimension: dim, mipLevelCount: mips, sampleCount: samples, usage });
  return { tex, view: tex.createView(), w, h, d: depth, format, id: ++nextId };
}
// one mip level of a texture: to draw into, or to read while drawing the next
export function mipLevel(t, k) {
  return { tex: t.tex, view: t.tex.createView({ baseMipLevel: k, mipLevelCount: 1 }), w: Math.max(1, t.w >> k), h: Math.max(1, t.h >> k), format: t.format, id: ++nextId };
}
// colour attachments of n slices of a 3D texture, from slice z
export const slices = (t, z, n = 1) => Array.from({ length: n }, (_, k) => ({ view: t.view, w: t.w, h: t.h, slice: z + k }));
// a storage buffer (also copied from and written by the queue); `id` keys the cached bind groups
export function buffer(size, usage = 0) {
  const buf = device.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | usage });
  return { buf, size, id: ++nextId };
}

function fromHalf(h) {
  const e = (h >> 10) & 31, m = h & 1023, s = h & 0x8000 ? -1 : 1;
  return e === 31 ? (m ? NaN : s * Infinity) : s * (e ? 2 ** (e - 15) * (1 + m / 1024) : 2 ** -14 * (m / 1024));
}

// ---- samplers (every shader may use any of them)
const smp = (filter, wrap, wrapW = wrap, mip = 'nearest') => device.createSampler({
  magFilter: filter, minFilter: filter, mipmapFilter: mip, addressModeU: wrap, addressModeV: wrap, addressModeW: wrapW,
});
const SAMPLERS = {
  sLin: smp('linear', 'clamp-to-edge'),
  sNear: smp('nearest', 'clamp-to-edge'),
  sRep: smp('linear', 'repeat'),
  sVol: smp('linear', 'repeat', 'clamp-to-edge'),      // the clipmap volumes: toroidal across, clamped in height
  sMip: smp('linear', 'repeat', 'repeat', 'linear'),
  sShadow: device.createSampler({ compare: 'less-equal', magFilter: 'linear', minFilter: 'linear' }),
};
const SAMPLER_NAMES = Object.keys(SAMPLERS);

// every texture a shader may read, by its WGSL name: '2d', '3d', 'raw' (only loaded, never
// filtered) or 'depth'; and every storage texture a compute shader writes (oX: its format). A
// pipeline binds those its shaders mention.
const TEXTURES = {
  tTrans: '2d', tMS: '2d', tSky: '2d', tShape: '3d', tDetail: '3d', tTsv: '3d',
  tVol0: '3d', tVol1: '3d', tVol2: '3d', tCol0: '2d', tCol1: '2d', tCol2: '2d', tCol: '2d',
  tCirrus: '2d', tLayers: '2d', tCur: '2d', tCurDepth: '2d', tHist: '2d', tSrc: '2d', tBird: 'raw', tScene: '2d',
  tBloom: '2d', tRays: '2d', tDbg: '2d', tDbg2: '2d', tShadowMap: 'depth',
  oShape: 'rgba16float', oDetail: 'rgba8unorm',
};
const TEX_KINDS = {
  '2d': ['texture_2d<f32>', { sampleType: 'float' }],
  '3d': ['texture_3d<f32>', { sampleType: 'float', viewDimension: '3d' }],
  raw: ['texture_2d<f32>', { sampleType: 'unfilterable-float' }],
  depth: ['texture_depth_2d', { sampleType: 'depth' }],
};
// (storage textures: written by compute shaders, 3D)
const texKind = kind => TEX_KINDS[kind] ? ['texture', ...TEX_KINDS[kind]]
  : ['storageTexture', `texture_storage_3d<${kind}, write>`, { access: 'write-only', format: kind, viewDimension: '3d' }];
// every storage buffer, by its WGSL name: its WGSL type (structs are declared by the shaders that
// use them); `uniform`: a shader that only reads it binds it as a uniform buffer (the trace reads
// the ambient light in its hottest loop)
const BUFFERS = { bAmb: { type: 'Ambient', uniform: true }, bProbe: { type: 'Probe' }, bBub: { type: 'array<vec4f>' }, bTsv: { type: 'array<u32>' } };
const BINDING = {};
[...Object.keys(TEXTURES), ...Object.keys(BUFFERS)].forEach((n, k) => { BINDING[n] = 16 + k; });

// ---- uniforms: a struct U per pipeline, laid out by WGSL's rules (arrays of vec3f / vec4f only)
const TYPES = { f32: [1, 4], i32: [1, 4], vec2f: [2, 8], vec2i: [2, 8], vec3f: [3, 16], vec4f: [4, 16], mat4x4f: [16, 16] };
function struct(fields) {
  let off = 0;
  const lay = Object.entries(fields).map(([name, type]) => {
    const [, base, n] = /^(\w+)(?:\[(\d+)\])?$/.exec(type);
    const [comps, align] = TYPES[base];
    off = Math.ceil(off / (n ? 16 : align)) * (n ? 16 : align);
    const f = { name, comps, n: n ? +n : 0, off: off / 4, int: base === 'i32' || base === 'vec2i' };
    off += n ? 16 * n : comps * 4;
    return f;
  });
  const wgsl = 'struct U {\n' + Object.entries(fields).map(([name, type]) => {
    const [, base, n] = /^(\w+)(?:\[(\d+)\])?$/.exec(type);
    return `  ${name}: ${n ? `array<${base}, ${n}>` : base},`;
  }).join('\n') + '\n}\n';
  return { lay, size: Math.ceil(off / 16) * 16, wgsl };
}
// the uniforms of all draws until the next submit, in one buffer (each draw at its own offset)
const ARENA = 1 << 20;
const arena = device.createBuffer({ label: 'uniforms', size: ARENA, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
const arenaData = new ArrayBuffer(ARENA), arenaF = new Float32Array(arenaData), arenaI = new Int32Array(arenaData);
let arenaUsed = 0;

// ---- the commands of a frame: encoded here, submitted by flush() (at the end of a frame, and
// before a queue write that commands already encoded must not see)
let encoder = null;
export function enc() { return encoder || (encoder = device.createCommandEncoder()); }
export function flush() {
  if (!encoder) return;
  if (arenaUsed) device.queue.writeBuffer(arena, 0, arenaData, 0, arenaUsed);
  device.queue.submit([encoder.finish()]);
  encoder = null;
  arenaUsed = 0;
}
// write the uniforms of one draw: the dynamic offset to bind them with
export function uniforms(P, vals) {
  if (!P.S) return [];
  if (arenaUsed + P.S.size > ARENA) flush();
  const off = arenaUsed, base = off >> 2;
  for (const f of P.S.lay) {
    const v = vals[f.name], o = base + f.off;
    if (v === undefined) throw new Error(P.name + ': uniform ' + f.name + ' missing');
    if (f.n) { for (let e = 0; e < f.n; e++) for (let c = 0; c < f.comps; c++) arenaF[o + e * 4 + c] = v[e * f.comps + c]; }
    else if (f.comps === 1) (f.int ? arenaI : arenaF)[o] = v;
    else { const a = f.int ? arenaI : arenaF; for (let c = 0; c < f.comps; c++) a[o + c] = v[c]; }
  }
  arenaUsed = Math.ceil((off + P.S.size) / 256) * 256;
  return [off];
}
// the bind group of a pipeline with these textures and buffers (cached)
export function bindGroup(P, vals) {
  let key = '';
  for (const n of P.texNames) {
    const t = vals[n];
    if (!t || !t.view) throw new Error(P.name + ': texture ' + n + ' missing');
    key += t.id + ' ';
  }
  for (const n of P.bufNames) {
    const b = vals[n];
    if (!b || !b.buf) throw new Error(P.name + ': buffer ' + n + ' missing');
    key += b.id + ' ';
  }
  let bg = P.groups.get(key);
  if (!bg) {
    const entries = SAMPLER_NAMES.map((n, k) => ({ binding: 1 + k, resource: SAMPLERS[n] }));
    if (P.S) entries.push({ binding: 0, resource: { buffer: arena, size: P.S.size } });
    for (const n of P.texNames) entries.push({ binding: BINDING[n], resource: vals[n].view });
    for (const n of P.bufNames) entries.push({ binding: BINDING[n], resource: { buffer: vals[n].buf } });
    bg = device.createBindGroup({ label: P.name, layout: P.bgl, entries });
    P.groups.set(key, bg);
  }
  return bg;
}
// (textures were replaced: forget the bind groups made with the old ones)
export function forgetBindGroups() { for (const P of pipelines) P.groups.clear(); }

// ---- pipelines
// the vertex shader of the fullscreen passes: one triangle that covers the viewport
const FULLSCREEN = /* wgsl */ `
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const fullscreenModule = device.createShaderModule({ label: 'fullscreen', code: FULLSCREEN });
const pipelines = [], compiling = [];
// constants JS and WGSL share, declared in front of every shader (f32)
const SHARED = Object.entries({ CLOUD_TOP, SHAPE_TILE, DETAIL_TILE }).map(([k, v]) => `const ${k} = ${Number.isInteger(v) ? v.toFixed(1) : v};
`).join('');
// What a pipeline's shaders share: the header that declares its uniforms, samplers and the
// resources its code names, and the bind group layout to match. writes: the storage buffers a
// compute shader writes (the rest it only reads; render shaders only read).
function layoutOf(name, codes, uniforms, compute, writes = []) {
  const S = uniforms ? struct(uniforms) : null;
  // (a resource a comment names isn't bound)
  const names = code => { const c = code.replace(/\/\/[^\n]*/g, ''); return n => new RegExp('\\b' + n + '\\b').test(c); };
  const named = names(codes.join('\n'));
  const texNames = Object.keys(TEXTURES).filter(named), bufNames = Object.keys(BUFFERS).filter(named);
  const access = n => writes.includes(n) ? 'read_write' : BUFFERS[n].uniform ? 'uniform' : 'read';
  const decl = n => access(n) === 'uniform' ? 'var<uniform>' : `var<storage, ${access(n)}>`;
  // (each module declares only what its own code names: a struct a buffer holds is declared by
  // the shaders that use it)
  const header = code => {
    const has = names(code);
    return SHARED + (S ? S.wgsl + '@group(0) @binding(0) var<uniform> u: U;\n' : '')
      + SAMPLER_NAMES.map((n, k) => `@group(0) @binding(${1 + k}) var ${n}: ${n === 'sShadow' ? 'sampler_comparison' : 'sampler'};\n`).join('')
      + texNames.filter(has).map(n => `@group(0) @binding(${BINDING[n]}) var ${n}: ${texKind(TEXTURES[n])[1]};\n`).join('')
      + bufNames.filter(has).map(n => `@group(0) @binding(${BINDING[n]}) ${decl(n)} ${n}: ${BUFFERS[n].type};\n`).join('');
  };
  const vis = compute ? GPUShaderStage.COMPUTE : GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
  const entries = SAMPLER_NAMES.map((n, k) => ({ binding: 1 + k, visibility: vis, sampler: { type: n === 'sShadow' ? 'comparison' : 'filtering' } }));
  if (S) entries.push({ binding: 0, visibility: vis, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: S.size } });
  for (const n of texNames) { const [kind, , layout] = texKind(TEXTURES[n]); entries.push({ binding: BINDING[n], visibility: vis, [kind]: layout }); }
  for (const n of bufNames) entries.push({ binding: BINDING[n], visibility: vis, buffer: { type: { read: 'read-only-storage', read_write: 'storage', uniform: 'uniform' }[access(n)] } });
  const bgl = device.createBindGroupLayout({ label: name, entries });
  return { S, texNames, bufNames, header, bgl, layout: device.createPipelineLayout({ bindGroupLayouts: [bgl] }) };
}
// A render pipeline. vs / fs: WGSL with entry points vs / fs (no vs: the fullscreen triangle; no
// fs: depth only); uniforms: the fields of its struct U; targets: colour formats; constants: the
// fragment shader's overrides; the rest as in GPURenderPipelineDescriptor. Its shaders are
// compiled in parallel: wait with pipelinesReady().
export function pipeline(name, { vs = null, fs = null, uniforms = null, targets = [], blend, topology = 'triangle-list', depth, samples = 1, buffers = [], constants }) {
  const L = layoutOf(name, [vs || '', fs || ''], uniforms, false);
  const modules = [];
  const module = (stage, code) => {
    const full = L.header(code) + code;
    const m = device.createShaderModule({ label: name + ' ' + stage, code: full });
    modules.push({ m, code: full, stage });
    return m;
  };
  const desc = {
    label: name,
    layout: L.layout,
    vertex: { module: vs ? module('vs', vs) : fullscreenModule, entryPoint: 'vs', buffers },
    primitive: { topology },
    multisample: { count: samples },
  };
  if (fs) desc.fragment = { module: module('fs', fs), entryPoint: 'fs', targets: targets.map(format => ({ format, blend })), constants };
  if (depth) desc.depthStencil = depth;
  const P = { name, S: L.S, texNames: L.texNames, bufNames: L.bufNames, bgl: L.bgl, pipe: null, groups: new Map() };
  compiling.push(device.createRenderPipelineAsync(desc).then(p => { P.pipe = p; }, e => shaderError(name, modules, e)));
  pipelines.push(P);
  return P;
}
// A compute pipeline: cs, WGSL with the entry point cs; writes: the storage buffers it writes;
// the rest as for pipeline().
export function compute(name, { cs, uniforms = null, constants, writes = [] }) {
  const L = layoutOf(name, [cs], uniforms, true, writes);
  const code = L.header(cs) + cs;
  const m = device.createShaderModule({ label: name + ' cs', code });
  const P = { name, S: L.S, texNames: L.texNames, bufNames: L.bufNames, bgl: L.bgl, pipe: null, groups: new Map() };
  compiling.push(device.createComputePipelineAsync({ label: name, layout: L.layout, compute: { module: m, entryPoint: 'cs', constants } })
    .then(p => { P.pipe = p; }, e => shaderError(name, [{ m, code, stage: 'cs' }], e)));
  pipelines.push(P);
  return P;
}
async function shaderError(name, modules, e) {
  let msg = '';
  for (const { m, code, stage } of modules) {
    const info = await m.getCompilationInfo();
    const src = code.split('\n');
    for (const x of info.messages) {
      if (x.type !== 'error') continue;
      const ln = x.lineNum;
      msg += `${stage} line ${ln}: ${x.message}\n` + src.slice(Math.max(0, ln - 3), ln + 1).map((l, k) => (Math.max(0, ln - 3) + k + 1) + ': ' + l).join('\n') + '\n';
    }
  }
  throw new Error('Shader "' + name + '" failed:\n' + (msg || e.message));
}
export const pipelinesReady = () => Promise.all(compiling);

// ---- passes
export const hooks = { timestamps: null };    // timing.js: the timestamp writes of the next pass
const BLACK = [0, 0, 0, 0];
// One draw of P into colour attachments (textures, or slices of a 3D texture). vals: uniform
// values and resources by their WGSL names. o: viewport [x, y, w, h] (default: the whole target),
// load (keep what the target holds; by default only when drawing into part of it: false clears
// it, cheaper on tiled GPUs, where nothing reads outside the viewport), clear colour, vertex
// count and instances (default: one fullscreen triangle).
export function pass(P, colors, vals, o = {}) {
  const t0 = colors[0], vp = o.viewport;
  const load = o.load ?? (vp && (vp[0] || vp[1] || vp[2] !== t0.w || vp[3] !== t0.h));
  const offsets = uniforms(P, vals);
  const bg = bindGroup(P, vals);
  const rp = enc().beginRenderPass({
    colorAttachments: colors.map(c => ({ view: c.view, depthSlice: c.slice, loadOp: load ? 'load' : 'clear', storeOp: 'store', clearValue: o.clear || BLACK })),
    timestampWrites: hooks.timestamps ? hooks.timestamps() : undefined,
  });
  rp.setPipeline(P.pipe);
  rp.setBindGroup(0, bg, offsets);
  if (vp) rp.setViewport(vp[0], vp[1], vp[2], vp[3], 0, 1);
  rp.draw(o.count || 3, o.instances || 1);
  rp.end();
}
// One dispatch of compute pipeline P: groups, the workgroup counts [x, y, z]; vals as for pass().
export function dispatch(P, vals, groups) {
  const offsets = uniforms(P, vals);
  const bg = bindGroup(P, vals);
  const cp = enc().beginComputePass({ timestampWrites: hooks.timestamps ? hooks.timestamps() : undefined });
  cp.setPipeline(P.pipe);
  cp.setBindGroup(0, bg, offsets);
  cp.dispatchWorkgroups(groups[0], groups[1] || 1, groups[2] || 1);
  cp.end();
}
// fill a target with one colour
export function clearPass(t, color) {
  enc().beginRenderPass({ colorAttachments: [{ view: t.view, loadOp: 'clear', storeOp: 'store', clearValue: color }] }).end();
}

// ---- reading back (debugging and the tools): a storage buffer's first n floats
export async function readBuffer(b, n = b.size / 4) {
  const buf = device.createBuffer({ size: n * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  flush();
  const e = device.createCommandEncoder();
  e.copyBufferToBuffer(b.buf, 0, buf, 0, n * 4);
  device.queue.submit([e.finish()]);
  await buf.mapAsync(GPUMapMode.READ);
  const out = new Float32Array(buf.getMappedRange().slice(0));
  buf.unmap();
  buf.destroy();
  return out;
}
// the texels of slices [z, z + nz) of a texture as numbers, rows packed
const TEXEL = { rgba16float: [8, 4, true], r16float: [2, 1, true], rgba32float: [16, 4, false], r32float: [4, 1, false], rgba8unorm: [4, 4, false] };
export async function readTexture(t, z = 0, nz = 1) {
  const [bytes, comps, isHalf] = TEXEL[t.format];
  const row = Math.ceil(t.w * bytes / 256) * 256;
  const buf = device.createBuffer({ size: row * t.h * nz, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  flush();
  const e = device.createCommandEncoder();
  e.copyTextureToBuffer({ texture: t.tex, origin: [0, 0, z] }, { buffer: buf, bytesPerRow: row, rowsPerImage: t.h }, [t.w, t.h, nz]);
  device.queue.submit([e.finish()]);
  await buf.mapAsync(GPUMapMode.READ);
  const raw = buf.getMappedRange(), n = t.w * comps, out = new Float32Array(n * t.h * nz);
  for (let r = 0; r < t.h * nz; r++) {
    if (isHalf) { const h = new Uint16Array(raw, r * row, n); for (let k = 0; k < n; k++) out[r * n + k] = fromHalf(h[k]); }
    else if (t.format === 'rgba8unorm') { const b = new Uint8Array(raw, r * row, n); for (let k = 0; k < n; k++) out[r * n + k] = b[k] / 255; }
    else out.set(new Float32Array(raw, r * row, n), r * n);
  }
  buf.unmap();
  buf.destroy();
  return out;
}
