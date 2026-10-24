// The paper bird: its mesh and shadow map, and drawing it

import { add, clamp, cross, dot, mat4Mul, norm, ortho, sat, scl, viewFromBasis } from '../math.js';
import { SUN_DIR } from '../constants.js';
import { framebuffer, gl, setUniforms } from './gl.js';
import { FB, P, T } from './setup.js';
import { R } from './targets.js';
import { bird_, FLIGHT } from '../flight.js';
import { cam } from '../camera.js';

const bird = (() => {
  // An origami crane in flight. Local frame: +X right, +Y up, -Z forward (head). ~1 m wingspan.
  const P3 = {
    // body: diamond "pyramid" under the wings
    A: [0, 0.055, -0.13], B: [0, 0.055, 0.13], K: [0, -0.068, 0.0], S: [0.034, -0.002, 0.0],
    Nb: [0, -0.022, -0.105], Tb: [0, -0.022, 0.105],
    // neck spike rising forward, head folded down into a beak
    Nm: [0.017, 0.016, -0.215], Nt: [0, 0.128, -0.415],
    Hc: [0, 0.148, -0.43], Hs: [0.007, 0.118, -0.446], Hb: [0, 0.08, -0.5],
    // tail spike rising behind
    Tm: [0.018, 0.012, 0.215], Tt: [0, 0.085, 0.45],
    // wings: broad triangles with a centre crease and a flex line at 45% span
    Wa: [0.008, 0.06, -0.122], Wm: [0.008, 0.071, 0.0], Wb: [0.008, 0.06, 0.122],
    La: [0.23, 0.089, -0.052], Lm: [0.23, 0.101, 0.018], Lb: [0.23, 0.085, 0.084],
    Wt: [0.505, 0.126, 0.036],
  };
  const flex = { La: 0.42, Lm: 0.42, Lb: 0.42, Wt: 1.0 };
  const pos = [], attr = [];
  const mirror = p => [-p[0], p[1], p[2]];
  function tri(a, b, c, side, shade, isWing) {
    for (const k of [a, b, c]) {
      let p = P3[k];
      if (side < 0) p = mirror(p);
      pos.push(...p);
      attr.push(isWing ? (flex[k] || 0) : 0, side, shade);
    }
  }
  for (const side of [1, -1]) {
    // body
    tri('A', 'S', 'Nb', side, 0.15); tri('Nb', 'S', 'K', side, 0.35); tri('K', 'S', 'Tb', side, 0.3);
    tri('Tb', 'S', 'B', side, 0.15); tri('B', 'S', 'A', side, 0.05);
    // neck & head
    tri('A', 'Nm', 'Nt', side, 0.0); tri('Nb', 'Nt', 'Nm', side, 0.25); tri('A', 'Nb', 'Nm', side, 0.2);
    tri('Nt', 'Hs', 'Hb', side, 0.1); tri('Hc', 'Hs', 'Nt', side, 0.0); tri('Hc', 'Hb', 'Hs', side, 0.05);
    // tail
    tri('B', 'Tt', 'Tm', side, 0.0); tri('Tb', 'Tm', 'Tt', side, 0.25); tri('B', 'Tm', 'Tb', side, 0.2);
    // wing
    tri('Wa', 'Wm', 'Lm', side, 0.0, true); tri('Wa', 'Lm', 'La', side, 0.04, true); tri('La', 'Lm', 'Wt', side, 0.0, true);
    tri('Wm', 'Wb', 'Lb', side, 0.12, true); tri('Wm', 'Lb', 'Lm', side, 0.1, true); tri('Lm', 'Lb', 'Wt', side, 0.12, true);
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const b0 = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b0); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  const b1 = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b1); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(attr), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return { vao, count: pos.length / 3 };
})();

// bird shadow map
const SHADOW_N = 1024;
T.shadow = (() => {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SHADOW_N, SHADOW_N, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  return { tex, w: SHADOW_N, h: SHADOW_N, target: gl.TEXTURE_2D };
})();
FB.shadow = framebuffer([], T.shadow);

export function renderBird(time, VP, birdRel) {
  const b = bird_;
  // model matrix (camera relative): columns right, up, back(-fwd), translation
  const back = scl(b.fwd, -1);
  const M = new Float32Array([b.right[0], b.right[1], b.right[2], 0, b.up[0], b.up[1], b.up[2], 0, back[0], back[1], back[2], 0, birdRel[0], birdRel[1], birdRel[2], 1]);
  // wing flex: dihedral rises with load, a slow breathing and a fine flutter at speed
  const sp = sat((b.speed - FLIGHT.vCruise) / (FLIGHT.vMax - FLIGHT.vCruise));
  const bend = 0.07 + 0.09 * clamp(b.load - 1, -0.5, 1.5) + 0.025 * Math.sin(time * 1.4) + 0.012 * Math.sin(time * 2.3 + 1.0);
  const flutter = (0.006 + 0.016 * sp) * Math.sin(time * 31.0) + 0.004 * Math.sin(time * 47.0);
  const twist = -0.05 - 0.04 * sp;
  const flex = [bend, twist, flutter, 0];
  // shadow map from the sun
  const sF = scl(SUN_DIR, -1);                 // shadow camera looks from the sun toward the bird
  const sR = norm(cross(sF, [0, 1, 0]));
  const sU = cross(sR, sF);
  const eye = add(birdRel, scl(SUN_DIR, 3));
  const SV = viewFromBasis(sR, sU, sF, eye);
  const SP = ortho(-0.62, 0.62, -0.62, 0.62, 0.5, 6);
  const shadowVP = mat4Mul(SP, SV);
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.shadow);
  gl.viewport(0, 0, SHADOW_N, SHADOW_N);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(1.5, 2.0);
  gl.useProgram(P.shadow.p);
  setUniforms(P.shadow, { uModel: M, uViewProj: shadowVP, uShadowVP: shadowVP, uFlex: flex });
  gl.bindVertexArray(bird.vao);
  gl.drawArrays(gl.TRIANGLES, 0, bird.count);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  // screen bounding box of the bird (generous sphere projection)
  const c = [dot(birdRel, cam.right), dot(birdRel, cam.up), dot(birdRel, cam.fwd)];
  let box = [0, 0, 0, 0];
  if (c[2] > 0.2) {
    const tanY = Math.tan(cam.fov / 2), tanX = tanY * R.w / R.h;
    const rad = 0.75;
    const cx = 0.5 + 0.5 * c[0] / c[2] / tanX, cy = 0.5 + 0.5 * c[1] / c[2] / tanY;
    const ex = 0.5 * rad / Math.max(c[2] - rad, 0.05) / tanX, ey = 0.5 * rad / Math.max(c[2] - rad, 0.05) / tanY;
    box = [clamp(cx - ex, 0, 1), clamp(cy - ey, 0, 1), clamp(cx + ex, 0, 1), clamp(cy + ey, 0, 1)];
  }
  const px = [Math.floor(box[0] * R.w), Math.floor(box[1] * R.h), Math.ceil(box[2] * R.w), Math.ceil(box[3] * R.h)];
  if (px[2] - px[0] < 1 || px[3] - px[1] < 1) { gl.disable(gl.DEPTH_TEST); return [2, 2, -1, -1]; }
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.birdMS);
  gl.viewport(0, 0, R.w, R.h);
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(px[0], px[1], px[2] - px[0], px[3] - px[1]);
  gl.clearColor(0, 0, 0, 0);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(P.bird.p);
  setUniforms(P.bird, { uModel: M, uViewProj: VP, uShadowVP: shadowVP, uFlex: flex, uProbe: T.probe, uShadowMap: T.shadow, uSunDir: SUN_DIR, uShadowTexel: 1 / SHADOW_N });
  gl.bindVertexArray(bird.vao);
  gl.drawArrays(gl.TRIANGLES, 0, bird.count);
  gl.disable(gl.DEPTH_TEST);
  // resolve
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, FB.birdMS);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, FB.birdResolve);
  gl.blitFramebuffer(px[0], px[1], px[2], px[3], px[0], px[1], px[2], px[3], gl.COLOR_BUFFER_BIT, gl.NEAREST);
  gl.disable(gl.SCISSOR_TEST);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  gl.bindVertexArray(null);
  // shrink by half a pixel to avoid sampling stale texels outside the scissor
  return [(px[0] + 0.5) / R.w, (px[1] + 0.5) / R.h, (px[2] - 0.5) / R.w, (px[3] - 0.5) / R.h];
}
