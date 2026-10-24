// WebGL 2: the context and its extensions; helpers for textures, framebuffers, programs, uniforms, passes

import { TEST } from '../params.js';
import { canvas, fail } from '../page.js';

export const gl = canvas.getContext('webgl2', {
  antialias: false, alpha: false, depth: false, stencil: false,
  premultipliedAlpha: false, preserveDrawingBuffer: TEST, powerPreference: 'high-performance',
});
// (without these the piece cannot run: say why, and stop)
if (!gl) { fail('This piece needs WebGL 2. Please open it in a recent version of Chrome, Edge, Firefox or Safari.'); throw new Error('no WebGL 2'); }
export const extCBF = gl.getExtension('EXT_color_buffer_float');
const extCBHF = gl.getExtension('EXT_color_buffer_half_float');
gl.getExtension('OES_texture_float_linear');
export const extParallel = gl.getExtension('KHR_parallel_shader_compile');
export const extTimer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
if (!extCBF && !extCBHF) { fail('Your browser cannot render to floating point textures, which this piece needs.'); throw new Error('no float render targets'); }

// ---- GL helpers
export const RGBA16F = gl.RGBA16F, HALF = gl.HALF_FLOAT;
export const FLOAT_RT = extCBF ? gl.RGBA32F : gl.RGBA16F;
export function texture2D(w, h, ifmt, fmt, type, { filter = gl.LINEAR, wrap = gl.CLAMP_TO_EDGE, data = null } = {}) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data);
  return { tex, w, h, target: gl.TEXTURE_2D };
}
export function texture3D(w, h, d, ifmt, fmt, type, { filter = gl.LINEAR, wrapR = gl.REPEAT } = {}) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, wrapR);
  gl.texImage3D(gl.TEXTURE_3D, 0, ifmt, w, h, d, 0, fmt, type, null);
  return { tex, w, h, d, target: gl.TEXTURE_3D };
}
export function framebuffer(colors, depth = null) {
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  colors.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t.tex, 0));
  if (depth) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth.tex, 0);
  gl.drawBuffers(colors.length ? colors.map((_, i) => gl.COLOR_ATTACHMENT0 + i) : [gl.NONE]);
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incomplete 0x' + st.toString(16));
  return fb;
}

// the vertex shader of the fullscreen passes: one triangle that covers the viewport
const VS_FULLSCREEN = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const programs = [];
function compileShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}
export function makeProgram(name, fs, vs = VS_FULLSCREEN) {
  const p = gl.createProgram();
  const v = compileShader(gl.VERTEX_SHADER, vs), f = compileShader(gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
  const prog = { name, p, v, f, loc: {}, fsSrc: fs, vsSrc: vs };
  programs.push(prog);
  return prog;
}
export function checkPrograms() {
  for (const prog of programs) {
    if (!gl.getProgramParameter(prog.p, gl.LINK_STATUS)) {
      const logF = gl.getShaderInfoLog(prog.f), logV = gl.getShaderInfoLog(prog.v), logP = gl.getProgramInfoLog(prog.p);
      const log = (logF || '') + (logV || '') + (logP || '');
      const m = /ERROR: \d+:(\d+)/.exec(log);
      let ctx = '';
      if (m) {
        const src = (logF ? prog.fsSrc : prog.vsSrc).split('\n'), ln = +m[1];
        ctx = '\n' + src.slice(Math.max(0, ln - 4), ln + 2).map((l, k) => (ln - 3 + k) + ': ' + l).join('\n');
      }
      throw new Error('Shader "' + prog.name + '" failed:\n' + log + ctx);
    }
  }
}
export function uloc(prog, name) {
  let l = prog.loc[name];
  if (l === undefined) { l = gl.getUniformLocation(prog.p, name); prog.loc[name] = l; }
  return l;
}
// Typed uniform helpers: plain numbers -> float, arrays by length, {tex} -> sampler, {i} -> int,
// {iv2} -> ivec2, {v3: arr} -> vec3[], {v4: arr} -> vec4[]
export function setUniforms(prog, u) {
  let unit = 0;
  for (const k in u) {
    const v = u[k], l = uloc(prog, k);
    if (v && v.tex !== undefined) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(v.target || gl.TEXTURE_2D, v.tex);
      if (l) gl.uniform1i(l, unit);
      unit++;
      continue;
    }
    if (!l) continue;
    if (typeof v === 'number') gl.uniform1f(l, v);
    else if (v.i !== undefined) gl.uniform1i(l, v.i);
    else if (v.iv2) gl.uniform2i(l, v.iv2[0], v.iv2[1]);
    else if (v.v3) gl.uniform3fv(l, v.v3);
    else if (v.v4) gl.uniform4fv(l, v.v4);
    else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
    else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
    else if (v.length === 4) gl.uniform4f(l, v[0], v[1], v[2], v[3]);
    else if (v.length === 16) gl.uniformMatrix4fv(l, false, v);
  }
}
export const emptyVAO = gl.createVertexArray();
export function pass(prog, fb, w, h, uniforms, x = 0, y = 0) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.viewport(x, y, w, h);
  gl.useProgram(prog.p);
  setUniforms(prog, uniforms);
  gl.bindVertexArray(emptyVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

// world volumes are baked several slices at a time (multiple render targets)
export const NOUT = Math.min(gl.getParameter(gl.MAX_DRAW_BUFFERS), gl.getParameter(gl.MAX_COLOR_ATTACHMENTS)) >= 8 ? 8 : 4;
export const MRT_OUT = '#define NOUT ' + NOUT + '\n' + Array.from({ length: NOUT }, (_, k) => `layout(location = ${k}) out vec4 o${k};`).join('\n');
export const MRT_WRITE = e => Array.from({ length: NOUT }, (_, k) => `  o${k} = vec4(${e.replace(/K/g, k)});`).join('\n');
