// Programs, static textures and their framebuffers, and the one-off generation of the static data

import { DBG_MODE } from '../params.js';
import { DETAIL_N, SHAPE_N } from '../constants.js';
import {
  emptyVAO, extCBF, FLOAT_RT, framebuffer, gl, HALF, makeProgram, pass, RGBA16F, setUniforms,
  texture2D, texture3D,
} from './gl.js';
import { sunColorAt, sunColTable } from './sun.js';
import { FS_AMBIENT, FS_MULTISCAT, FS_SKYVIEW, FS_TRANSMITTANCE } from '../shaders/sky.js';
import { FS_CIRRUS, FS_LAYERS, FS_NOISE3D } from '../shaders/textures.js';
import { FS_BAKE, FS_TSV } from '../shaders/volumes.js';
import { FS_TRACE } from '../shaders/trace.js';
import { FS_TAAU } from '../shaders/taau.js';
import { FS_PROBE } from '../shaders/probe.js';
import { FS_MIST, VS_MIST } from '../shaders/mist.js';
import { FS_BIRD, FS_SHADOW, VS_BIRD } from '../shaders/bird.js';
import { FS_DOWN, FS_FINAL, FS_RAYBLUR, FS_RAYMASK, FS_UP } from '../shaders/post.js';

export const P = {
  trans: makeProgram('transmittance', FS_TRANSMITTANCE),
  ms: makeProgram('multiscatter', FS_MULTISCAT),
  sky: makeProgram('skyview', FS_SKYVIEW),
  amb: makeProgram('ambient', FS_AMBIENT),
  noise: makeProgram('noise3d', FS_NOISE3D),
  cirrus: makeProgram('cirrus', FS_CIRRUS),
  layers: makeProgram('layers', FS_LAYERS),
  tsv: makeProgram('tsv', FS_TSV),
  bake: makeProgram('bake', FS_BAKE),
  trace: makeProgram('trace', DBG_MODE ? FS_TRACE.replace('#version 300 es', '#version 300 es\n#define DBG') : FS_TRACE),
  taau: makeProgram('taau', FS_TAAU),
  probe: makeProgram('probe', FS_PROBE),
  bird: makeProgram('bird', FS_BIRD, VS_BIRD),
  shadow: makeProgram('shadow', FS_SHADOW, VS_BIRD),
  down: makeProgram('down', FS_DOWN),
  up: makeProgram('up', FS_UP),
  raymask: makeProgram('raymask', FS_RAYMASK),
  rayblur: makeProgram('rayblur', FS_RAYBLUR),
  final: makeProgram('final', FS_FINAL),
  mist: makeProgram('mist', FS_MIST, VS_MIST),
};

// --- static textures
export const T = {};
T.trans = texture2D(256, 64, RGBA16F, gl.RGBA, HALF);
T.ms = texture2D(32, 32, RGBA16F, gl.RGBA, HALF);
T.sky = texture2D(192, 108, RGBA16F, gl.RGBA, HALF);
T.amb = texture2D(4, 1, RGBA16F, gl.RGBA, HALF, { filter: gl.NEAREST });
T.shape = texture3D(SHAPE_N, SHAPE_N, SHAPE_N, gl.RGBA16F, gl.RGBA, HALF);
T.detail = texture3D(DETAIL_N, DETAIL_N, DETAIL_N, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
T.cirrus = texture2D(512, 512, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, { wrap: gl.REPEAT });
T.layers = texture2D(1024, 1024, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, { wrap: gl.REPEAT });
T.probe = texture2D(8, 1, FLOAT_RT, gl.RGBA, extCBF ? gl.FLOAT : HALF, { filter: gl.NEAREST });

export const FB = {};
FB.trans = framebuffer([T.trans]);
FB.ms = framebuffer([T.ms]);
FB.sky = framebuffer([T.sky]);
FB.amb = framebuffer([T.amb]);
FB.cirrus = framebuffer([T.cirrus]);
FB.layers = framebuffer([T.layers]);
FB.probe = framebuffer([T.probe]);
const fbLayer = gl.createFramebuffer();

function renderVolume(tex, n, depth, uniformsFor) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbLayer);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  for (let z = 0; z < depth; z++) {
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, tex.tex, 0, z);
    const u = uniformsFor(z);
    gl.viewport(0, 0, tex.w, tex.h);
    gl.useProgram(u.prog.p);
    setUniforms(u.prog, u.uniforms);
    gl.bindVertexArray(emptyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

export const sunColUniform = { v3: sunColTable };
export const layerColUniform = { v3: new Float32Array([...sunColorAt(6300), ...sunColorAt(7700)]) };

// one-off generation of all static GPU data (runs once the shaders are compiled)
export function generateStatic() {
// noise volumes
renderVolume(T.shape, SHAPE_N, SHAPE_N, z => ({ prog: P.noise, uniforms: { uZ: (z + 0.5) / SHAPE_N, uSize: SHAPE_N, uCells: [4, 8, 16, 32], uMode: { i: 0 } } }));
renderVolume(T.detail, DETAIL_N, DETAIL_N, z => ({ prog: P.noise, uniforms: { uZ: (z + 0.5) / DETAIL_N, uSize: DETAIL_N, uCells: [4, 8, 16, 24], uMode: { i: 1 } } }));
pass(P.cirrus, FB.cirrus, 512, 512, { uSize: 512 });
pass(P.layers, FB.layers, 1024, 1024, { uSize: 1024 });
gl.bindTexture(gl.TEXTURE_2D, T.layers.tex);           // seen at grazing angles far away: mipmaps
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
gl.generateMipmap(gl.TEXTURE_2D);

// atmosphere LUTs
pass(P.trans, FB.trans, 256, 64, {});
pass(P.ms, FB.ms, 32, 32, { uTrans: T.trans });
}
