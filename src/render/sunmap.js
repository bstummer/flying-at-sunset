// The sun map: the shadows the clouds cast toward the sun around the camera, the light march's
// reach past its first ~90 m (chunks/cloud.wgsl, lightPath). At a 5° sun a billow 50 m tall casts a
// shadow 575 m long, and the march's few long steps (and the shadow volume's 768 × 360 m texels)
// can't hold it: a heap hundreds of metres off shaded a copy of itself where a step's point hit it.
//
// Its texels lie along the sun's rays: SM_DA m across the sun's way, SM_DV m apart in height and
// SM_DW m along it (constants.js), over a window of SM_NA × SM_NW of them around the camera (16 km
// across, 20 km along: 8 km on the side away from the sun, 12 km toward it), all the way up (its
// grid: render/sungrid.js). Each holds the light toward the sun that the clouds past the one it
// sits in let through (where it is clear, all of them; past the window, through L1 and L2): the
// light diffuses through a point's own cloud (lightPath follows it), and its shadow is what other
// clouds cast. The bake (shaders/volumes.js) walks each ray from the sun once, so a texel costs a
// step or a few near a surface, not a march of its own; the map holds the billows a texel can (the
// turrets and the larger domes). The clouds hold still, so it is baked once where it lies: when
// its window moves (the camera wandered ~2 km off), a slab of SLAB columns a frame, all of it while
// none of it is valid (the first frame, a jump). Past its valid window (fading over its last 1.5 km)
// the light takes the march's own steps and the shadow volume. Memory: 14 MB (r16float), and
// under 1 MB of buffers. The cost (NVIDIA laptop): 0.11–0.15 ms a frame while it bakes (128 frames
// after the window moved), the first frame's whole map 18–30 ms.

import { SM_NA, SM_NV, SM_NW, SM_PIECES } from '../constants.js';
import { buffer, dispatch, enc, texture } from './gpu.js';
import { SM_ROW } from '../shaders/volumes.js';
import { P, T } from './setup.js';
import { LEVELS } from './stream.js';
import { lookupUniforms, newWindow, place, rays, SLAB, slabUniforms } from './sungrid.js';

const TU = GPUTextureUsage;
export const SUNMAP = newWindow();
T.sunMap = texture(SM_NW, SM_NA, 'r16float', { depth: SM_NV, dim: '3d', usage: TU.TEXTURE_BINDING | TU.COPY_DST | TU.COPY_SRC });
// the scan writes a slab here, then it is copied into the map; the march past the window and the
// stretches between texels, a slab's
const stage = buffer(SM_ROW * 4 * SLAB * SM_NV);
const tails = buffer(SLAB * rays() * SM_PIECES * 8), segs = buffer(SLAB * rays() * SM_NW * 8);

// one slab: the march past the window in pieces, the stretches, the scan along each ray
function bakeSlab(O, common) {
  const W = SUNMAP;
  const { U, S } = slabUniforms(W, O), groups = Math.ceil(U.nRays / 64);
  const vals = Object.assign({}, common, U, { bSmTail: tails, bSmSeg: segs });
  dispatch(P.sunTail, vals, [groups, SLAB, SM_PIECES]);
  dispatch(P.sunSeg, vals, [groups, SLAB, SM_NW]);
  dispatch(P.sunScan, Object.assign({ bSmTail: tails, bSmSeg: segs, bSunMap: stage, row: SM_ROW }, S), [groups, SLAB, 1]);
  enc().copyBufferToTexture({ buffer: stage.buf, bytesPerRow: SM_ROW * 4, rowsPerImage: SLAB }, { texture: T.sunMap.tex, origin: [0, U.ys, 0] }, [SM_NW, SLAB, SM_NV]);
  W.cursor += SLAB;
  if (W.cursor >= SM_NA) { W.cursor = 0; W.valid = [W.K0, W.K0 + SM_NW, W.A0, W.A0 + SM_NA]; W.cycles++; }
}
// Once a frame (render/frame.js), once the clipmaps it reads have settled: a slab while the window is
// being baked; between bakes, whether the camera wandered off. common: the frame's cloud uniforms.
export function refreshSunMap(camPos, O, common) {
  if (LEVELS.some(L => L.pending || !L.valid)) return;
  const W = SUNMAP;
  if (W.cursor === 0 && !place(W, camPos) && W.valid) return;
  const n = W.valid ? 1 : (SM_NA - W.cursor) / SLAB;
  for (let k = 0; k < n; k++) bakeSlab(O, common);
}
// render-space uniforms of the lookups (chunks/cloud.wgsl, sunMapAt)
export const sunMapUniforms = O => Object.assign({ tSunMap: T.sunMap }, lookupUniforms(SUNMAP, O));
