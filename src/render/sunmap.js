// The sun map: the shadows the clouds cast toward the sun around the camera, the light march's
// reach past its first ~90 m (chunks/cloud.wgsl, lightPath). At a 5° sun a billow 50 m tall casts a
// shadow 575 m long, and the march's few long steps (and the shadow volume's 768 × 360 m texels)
// can't hold it: a heap hundreds of metres off shaded a copy of itself where a step's point hit it.
//
// Its texels lie along the sun's rays, over a window of SM_NA × SM_NW of them around the camera, all
// the way up (render/sungrid.js), in two levels (their grids: constants.js): the fine one 64 m across
// the sun's way, 32 m apart in height and 320 m along it (16 km across, 20 km along: 8 km on the side
// away from the sun, 12 km toward it), the coarse one four times as large each way (65 km across,
// 82 km along: 33 km away from the sun, 49 km toward it), for what lies past the fine one (the
// shadow volume's texels drew a tower's shadow there as blobs, and none of the billows'). Each texel
// holds the light toward the sun that the clouds past the one it sits in let through (where it is
// clear, all of them; past the window, through L1 and L2): the light diffuses through a point's own
// cloud (lightPath follows it), and its shadow is what other clouds cast. Beside that light (a
// byte) it holds its SM_ROOTth root (another), from which the shadow of the clouds near by is read
// (chunks/cloud.wgsl, sunMapAt: between texels the light itself drew that shadow's edge as the
// texels' outline). The bake (shaders/volumes.js) walks each ray from the sun once, so a texel
// costs a step or a few near a surface, not a march of its own; a level holds the billows its
// texels can (the fine one the turrets and the larger domes, the coarse one the lobes). The
// clouds hold still, so a level is baked once where it lies: when its window moves (the camera
// wandered ~2 km off, ~5 km for the coarse one), a slab of its columns a frame (two, the coarse
// one's one), all of it while none of it is valid (the first frame, a jump). Past a level's valid
// window (fading over its last 1.5 km, the coarse one's last 6 km) the light takes the coarse
// level, then the march's own steps and the shadow volume. Memory: 14 and 3.7 MB (rg8unorm; the
// coarse level's root is not read), and under 1 MB of buffers. The cost (NVIDIA
// laptop): the fine level 0.11–0.15 ms a frame while it bakes (128 frames after its window moved),
// its whole map 20–35 ms; the coarse one ~0.18 ms a frame (256 frames), its whole map ~45 ms (a
// quarter as many texels, but four times as many steps where a stretch passes near a surface).
//
// Once the fine level's bake is done, the lit map is drawn from it: how much of the sea of clouds
// lies in the sun, the light it sends up into the shade above it (chunks/sealit.wgsl).

import { SM_GRIDS, SM_NA, SM_NW, SM_PIECES } from '../constants.js';
import { buffer, dispatch, enc, mipLevel, pass, texture } from './gpu.js';
import { SM_ROW } from '../shaders/volumes.js';
import { P, T } from './setup.js';
import { LEVELS } from './stream.js';
import { HS, lookupUniforms, newWindow, PERP, place, rays, slabUniforms } from './sungrid.js';

const TU = GPUTextureUsage;
// the levels' windows, fine and coarse, and their maps
export const SUNMAPS = SM_GRIDS.map(G => newWindow(G));
const maps = SM_GRIDS.map(G => texture(SM_NW, SM_NA, 'rg8unorm', { depth: G.nv, dim: '3d', usage: TU.TEXTURE_BINDING | TU.COPY_DST | TU.COPY_SRC }));
[T.sunMap, T.sunMapC] = maps;
// the scan writes a slab here, then it is copied into the map; the march past the window and the
// stretches between texels, a slab's (as large as the fine level's, which has the most rays)
const SLAB = SM_GRIDS[0].slab;
const stage = buffer(SM_ROW * 4 * SLAB * SM_GRIDS[0].nv);
const tails = buffer(SLAB * rays(SM_GRIDS[0]) * SM_PIECES * 8), segs = buffer(SLAB * rays(SM_GRIDS[0]) * SM_NW * 8);
// The lit map: over the fine level's window, how much sunlight reaches the sea of clouds
// (shaders/litmap.wgsl), a texel 80 m along the sun's way and 64 m across, and its mip levels (the
// share over wider stretches: the light the sea sends up, chunks/sealit.wgsl). Drawn once a window's
// bake is done (well under a millisecond), it stays where it was drawn until the next. 170 KB.
const LIT_N = 256, LIT_MIPS = 9;
T.lit = texture(LIT_N, LIT_N, 'r16float', { mips: LIT_MIPS });
const litLevels = Array.from({ length: LIT_MIPS }, (_, k) => mipLevel(T.lit, k));
const LIT = { K0: null, A0: null, due: false };
const { da: DA, dw: DW } = SM_GRIDS[0];
// render space along the sun's way and across it, of a point at world origin O
const along = O => O[0] * HS[0] + O[2] * HS[1], across = O => O[0] * PERP[0] + O[2] * PERP[1];
// Once a frame (render/frame.js), after refreshSunMap: the lit map, if a window's bake just ended
export function refreshLitMap(O, common) {
  if (!LIT.due) return;
  const W = SUNMAPS[0];
  LIT.due = false;
  const litR = [W.K0 * DW - along(O), W.A0 * DA - across(O), SM_NW * DW / LIT_N, SM_NA * DA / LIT_N];
  pass(P.litMap, [litLevels[0]], Object.assign({}, common, { litR }));
  for (let k = 1; k < LIT_MIPS; k++) pass(P.litMip, [litLevels[k]], { tSrc: litLevels[k - 1], size: litLevels[k].w });
  LIT.K0 = W.K0; LIT.A0 = W.A0;
}

// one slab of level k: the march past the window in pieces, the stretches, the scan along each ray
function bakeSlab(k, O, common) {
  const W = SUNMAPS[k];
  const { U, S } = slabUniforms(W, O), groups = Math.ceil(U.nRays / 64);
  const vals = Object.assign({}, common, U, { bSmTail: tails, bSmSeg: segs });
  dispatch(P.sunTail, vals, [groups, W.slab, SM_PIECES]);
  dispatch(P.sunSeg, vals, [groups, W.slab, SM_NW]);
  dispatch(P.sunScan, Object.assign({ bSmTail: tails, bSmSeg: segs, bSunMap: stage, row: SM_ROW }, S), [groups, W.slab, 1]);
  enc().copyBufferToTexture({ buffer: stage.buf, bytesPerRow: SM_ROW * 4, rowsPerImage: W.slab }, { texture: maps[k].tex, origin: [0, U.ys, 0] }, [SM_NW, W.slab, W.G.nv]);
  W.cursor += W.slab;
  if (W.cursor >= SM_NA) { W.cursor = 0; W.valid = [W.K0, W.K0 + SM_NW, W.A0, W.A0 + SM_NA]; W.cycles++; LIT.due ||= k === 0; }
}
// Once a frame (render/frame.js), once the clipmaps it reads have settled, for each level: a slab
// while its window is being baked; between bakes, whether the camera wandered off. common: the
// frame's cloud uniforms.
export function refreshSunMap(camPos, O, common) {
  if (LEVELS.some(L => L.pending || !L.valid)) return;
  SUNMAPS.forEach((W, k) => {
    if (W.cursor === 0 && !place(W, camPos) && W.valid) return;
    const n = W.valid ? 1 : (SM_NA - W.cursor) / W.slab;
    for (let s = 0; s < n; s++) bakeSlab(k, O, common);
  });
}
// render-space uniforms of the lookups (chunks/cloud.wgsl, smUVW; chunks/sealit.wgsl, seaLitAt:
// before the first lit map, every point lies past it)
export function sunMapUniforms(O) {
  const F = lookupUniforms(SUNMAPS[0], O), C = lookupUniforms(SUNMAPS[1], O);
  return {
    tSunMap: T.sunMap, tSunMapC: T.sunMapC, tLit: T.lit,
    smA: F.A, smB: F.B, smV: F.V, smCA: C.A, smCB: C.B, smCV: C.V,
    litA: LIT.K0 === null ? [1e9, 1e9, 1, 1] : [LIT.K0 * DW - along(O), LIT.A0 * DA - across(O), 1 / (SM_NW * DW), 1 / (SM_NA * DA)],
  };
}
