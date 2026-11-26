// The paper bird: its mesh and shadow map, and drawing it
//
// An origami crane: flat-shaded creases, each wing folded along its middle (toward the low sun one
// facet catches the light and the other falls in shade, and from behind with the sun the other way
// round: the fold reads, where a flat wing was a white dart), a procedural paper fibre texture,
// translucency (it glows when backlit), a shadow map of its own in which paper layers let some light
// through (shaders/bird.js), wings that flex with load, a slow breathing and a flutter at speed; lit
// by the probe (sun and sky at the bird, in cloud or not) and the sky's light by direction (bAmb).
//
// Drawn with 4x MSAA into targets only as big as the box the bird can take on screen (its bounding
// sphere seen from the chase camera at its nearest; all of the canvas for the close-up test
// camera): a crop of the view-projection maps its box on screen onto them. The resolved bird is
// then laid over the scene, texel for texel, in its box; the scene's alpha (how much sky shows,
// the sun rays' mask) loses what it covers.

import { add, clamp, cross, dot, mat4Mul, norm, ortho, sat, scl, viewFromBasis } from '../math.js';
import { SUN_DIR } from '../constants.js';
import { bindGroup, device, enc, hooks, pass, texture, uniforms } from './gpu.js';
import { P, T } from './setup.js';
import { R, sizedTargets } from './targets.js';
import { bird_, FLIGHT } from '../flight/flight.js';
import { baseFovY, cam, CAM_NEAREST, CLOSEUP } from '../flight/camera.js';

const BIRD_R = 0.75;   // m: a sphere around the bird and its flexing wings
// the bird's targets: the largest box its sphere can take (in pixels, with a pixel of rounding on
// each side)
sizedTargets(['birdTex', 'birdMS', 'birdDepth'], (w, h) => {
  const k = BIRD_R / (CAM_NEAREST - BIRD_R), tanY = Math.tan(baseFovY(w / h) / 2), tanX = tanY * w / h;
  const bw = CLOSEUP ? w : Math.min(w, Math.ceil(w * k / tanX) + 2), bh = CLOSEUP ? h : Math.min(h, Math.ceil(h * k / tanY) + 2);
  T.birdTex = texture(bw, bh, 'rgba16float');
  T.birdMS = texture(bw, bh, 'rgba16float', { samples: 4, usage: GPUTextureUsage.RENDER_ATTACHMENT });
  T.birdDepth = texture(bw, bh, 'depth24plus', { samples: 4, usage: GPUTextureUsage.RENDER_ATTACHMENT });
});

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
    // wings: broad triangles with a centre crease (a mountain fold, each facet 14–20° off the wing's
    // plane) and a flex line at 45% span
    Wa: [0.008, 0.06, -0.122], Wm: [0.008, 0.09, 0.0], Wb: [0.008, 0.06, 0.122],
    La: [0.23, 0.089, -0.052], Lm: [0.23, 0.115, 0.018], Lb: [0.23, 0.085, 0.084],
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
  const buffer = data => {
    const b = device.createBuffer({ size: data.length * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(b, 0, new Float32Array(data));
    return b;
  };
  return { pos: buffer(pos), attr: buffer(attr), count: pos.length / 3 };
})();

// bird shadow map
const SHADOW_N = 1024;
T.shadow = texture(SHADOW_N, SHADOW_N, 'depth24plus');

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
  const vals = { model: M, viewProj: shadowVP, shadowVP, flex, sunDir: SUN_DIR, shadowTexel: 1 / SHADOW_N, bProbe: T.probe, bAmb: T.amb, tShadowMap: T.shadow };
  let offsets = uniforms(P.shadow, vals);
  let rp = enc().beginRenderPass({
    colorAttachments: [],
    depthStencilAttachment: { view: T.shadow.view, depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: 'store' },
    timestampWrites: hooks.timestamps ? hooks.timestamps() : undefined,
  });
  rp.setPipeline(P.shadow.pipe);
  rp.setBindGroup(0, bindGroup(P.shadow, vals), offsets);
  rp.setVertexBuffer(0, bird.pos);
  rp.setVertexBuffer(1, bird.attr);
  rp.draw(bird.count);
  rp.end();
  // the bird's box on screen, in pixels from the bottom left (a generous sphere projection)
  const c = [dot(birdRel, cam.right), dot(birdRel, cam.up), dot(birdRel, cam.fwd)];
  if (c[2] <= 0.2) return;
  const tanY = Math.tan(cam.fov / 2), tanX = tanY * R.w / R.h;
  const cx = 0.5 + 0.5 * c[0] / c[2] / tanX, cy = 0.5 + 0.5 * c[1] / c[2] / tanY;
  const ex = 0.5 * BIRD_R / Math.max(c[2] - BIRD_R, 0.05) / tanX, ey = 0.5 * BIRD_R / Math.max(c[2] - BIRD_R, 0.05) / tanY;
  const TW = T.birdTex.w, TH = T.birdTex.h;
  const x0 = Math.floor(clamp(cx - ex, 0, 1) * R.w), y0 = Math.floor(clamp(cy - ey, 0, 1) * R.h);
  const bw = Math.min(Math.ceil(clamp(cx + ex, 0, 1) * R.w) - x0, TW), bh = Math.min(Math.ceil(clamp(cy + ey, 0, 1) * R.h) - y0, TH);
  if (bw < 1 || bh < 1) return;
  // the bird (4x MSAA, resolved into T.birdTex): the view-projection cropped to its box, which
  // lands in the targets' first bw × bh texels
  const ax = R.w / TW, ay = R.h / TH;
  const crop = new Float32Array([ax, 0, 0, 0, 0, ay, 0, 0, 0, 0, 1, 0, ax - 2 * x0 / TW - 1, ay - 2 * y0 / TH - 1, 0, 1]);
  vals.viewProj = mat4Mul(crop, VP);
  offsets = uniforms(P.bird, vals);
  rp = enc().beginRenderPass({
    colorAttachments: [{ view: T.birdMS.view, resolveTarget: T.birdTex.view, loadOp: 'clear', clearValue: [0, 0, 0, 0], storeOp: 'discard' }],
    depthStencilAttachment: { view: T.birdDepth.view, depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: 'discard' },
    timestampWrites: hooks.timestamps ? hooks.timestamps() : undefined,
  });
  rp.setPipeline(P.bird.pipe);
  rp.setBindGroup(0, bindGroup(P.bird, vals), offsets);
  rp.setScissorRect(0, 0, bw, bh);
  rp.setVertexBuffer(0, bird.pos);
  rp.setVertexBuffer(1, bird.attr);
  rp.draw(bird.count);
  rp.end();
  // over the scene, in its box
  pass(P.birdOver, [T.scene], { tBird: T.birdTex, origin: [x0, y0] }, { viewport: [x0, y0, bw, bh] });
}
