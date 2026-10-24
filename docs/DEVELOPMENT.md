# Development notes

How the piece works, why it is the way it is, how to test it, and what to watch out for. Written
when the project was still one file (`index.html`, ~3,700 lines) and about to be split into
source files with a build that outputs one file. Line numbers refer to that version (commit
`9453631` and later in October 2026).

- What the piece should be: `docs/BRIEF.md` (every request verbatim, the photos, the feedback themes).
- How it got here: `docs/HISTORY.md` (round by round: what was built, tried and dropped).
- Tools and checks: `tools/README.md`.

## Contents

1. Ground rules
2. The file today: sections and their seams
3. One frame
4. The sky
5. The world generator (CPU)
6. Streaming the world to the GPU
7. The cloud renderer
8. The bird, flight, input, camera
9. Image: TAAU, bloom, sun rays, tone mapping
10. Speed: dynamic resolution and budgets
11. Test mode, hooks and URL parameters
12. Performance baselines
13. Known issues and ideas
14. Tuning lessons (what failed, and why)
15. Restructuring guide

## 1. Ground rules

These come from the brief and the feedback; keep them when changing anything.

- **One self-contained HTML file** as the output: no network, no libraries, no assets; works from
  `file://` and any static server; WebGL 2 (needs float render targets: `EXT_color_buffer_float`
  or `..._half_float`). It is published with GitHub Pages from this repository.
- **Calm and clean**: no UI except a steering hint that fades in at ~1.8 s and out at ~10 s (or
  after 3 s of steering); a note only when WebGL 2 is missing or something fails.
- **Smooth before sharp**: the frame rate is protected by dynamic resolution; detail gives way.
- **Everything procedural and random**, generated from a hash of position and seed. Nothing is
  placed by hand, there is no kit of set shapes, nothing repeats visibly, and the world is endless.
- **Clouds grow from natural causes**: if something appears too often or too rarely, change a
  cause (the air, the thermals, time), never add a special-case feature.
- **Keep the lighting, colours and sky**: the author repeatedly asked for them to stay as they are.
- The author's dislikes and wishes are listed at the end of `docs/BRIEF.md`.

## 2. The file today: sections and their seams

`index.html` = HTML + CSS (lines 1–53) and one IIFE script. In order:

| lines | section | contents |
|---|---|---|
| 54–93 | header, URL flags, GL context | `Q`, `TEST`, `DEBUG`, `VIEW`, `DBG_MODE`, `TONEMAP`, `CONTRAST`, `HAZE_K`; `fail()`; context + extensions |
| 94–140 | small math kit | `clamp lerp sat smoothstep damp fmod add sub scl dot cross len norm mix3 mulberry32 halton spring mat4Mul perspective ortho viewFromBasis` |
| 141–150 | world constants | `SUN_ELEV` (5°), `SUN_AZIM` (0: the sun is toward −Z), `SUN_DIR`, `WIND`, `SHAPE_N`, `DETAIL_N`, `ORIGIN_Q`, `CLOUD_TOP` |
| 151–839 | **CPU world generator** (`// ==== WORLD BEGIN` … `// ==== WORLD END`) | hashing and noise, the air, domes, thermals, cells, caches, column fill, bubble gather (section 5) |
| 841–869 | CPU atmosphere | transmittance for sun colours (`sunColorAt`, `sunColTable`) |
| 870–979 | GL helpers | textures, framebuffers, program compile/link with async check, uniforms, `pass()` |
| 980–2478 | **shaders** (template strings) | `VS_FULLSCREEN`, `GLSL_COMMON`, `GLSL_ATMO` + sky LUT passes, noise volume generation, cirrus, high layers, `GLSL_CLOUD` (shared cloud functions), `FS_TSV`, `FS_BAKE`, `FS_TRACE`, `FS_TAAU` (+ high layer sheets), `FS_PROBE`, mist (`VS_MIST`/`FS_MIST`), bird (`VS_BIRD`, `FS_BIRD`, `FS_SHADOW`), post (`FS_DOWN`, `FS_UP`, `FS_RAYMASK`, `FS_RAYBLUR`, `FS_FINAL`) |
| 2479–2559 | initialisation | programs, static textures (`T`), framebuffers (`FB`), `generateStatic()` |
| 2560–2714 | streamed world volumes | clipmap levels, bake queue, `shiftLevel`, `runJob`, `streamWorld`, `worldUniforms` |
| 2715–2785 | paper bird mesh | crane geometry, shadow map |
| 2786–2877 | size-dependent resources | `allocate`/`freeRes`/`resize` (with out-of-memory retry) |
| 2878–3201 | flight, input, camera | `FLIGHT`, `bird_`, `readPreset` (test views), input (mouse, touch, keys, gamepad), `updateFlight`, `updateCamera` |
| 3202–3492 | rendering | GPU timers / `?cpuprof`, `render()` (the frame graph), `renderBird`, async probe readback |
| 3493–3676 | hint, main loop, boot | dynamic resolution, `loop`/`frameStep`, context loss, fullscreen, `boot`, `window.__debug` |

Shaders are JavaScript template strings composed by concatenation (`GLSL_COMMON + GLSL_ATMO +
GLSL_CLOUD + ...`) and interpolation (`${MRT_OUT}`, `${MRT_WRITE(...)}`, `#define NOUT` from JS,
a `#define DBG` injected when `?dbg` is set). A build must keep that working (or move the
composition into the build).

## 3. One frame

`frameStep` (≈ line 3599): fixed `dt` in tests, otherwise the real one (capped at 0.1 s).

1. `resize()`: canvas size (device pixels, capped at 2.3 Mpx, 1.15 Mpx on touch devices); on
   change `allocate()` all size-dependent targets; if that fails (GPU memory) retry smaller.
2. `updateInput` → `updateFlight` → `updateCamera`.
3. `render()`:
   - **world**: `streamWorld` shifts the clipmap windows and runs bake jobs (all on the first frame
     and in tests, else within 4 ms).
   - **sky**: the sky-view LUT for the camera altitude (192×108) and the 4 ambient texels.
   - **probe** (8×1 texels): light at the bird, in-cloud density at camera and bird, distance to the
     real billowy surface below the bird (drives the flight floor), mist radiance. Read back
     asynchronously with a fence (`readProbeAsync`), used one or two frames later.
   - **trace**: the cloud raymarch at reduced resolution (`R.scale` × full, jittered per frame).
   - **taau**: temporal upsampling to full resolution + sky + sun disk + cirrus veil + the two thin
     high layers (sheets), then drifting mist puffs if inside cloud.
   - **bird**: shadow map, MSAA mesh, resolve.
   - **post**: bloom (7-level down/up chain), sun rays (quarter-res mask + 2 radial blurs), final
     (exposure, hue-preserving filmic curve, golden split tone, vignette, grain).
4. Hint timing (wall clock), dynamic resolution (`adaptResolution`), debug overlay, test hooks.

## 4. The sky

Hillaire 2020 style: transmittance LUT (256×64) and multiple-scattering LUT (32×32) once at start;
sky-view LUT (192×108) per frame for the camera height; Rayleigh, Mie and ozone. The same model
gives the sun colour at every altitude (`sunColorAt`, CPU copy used for cloud lighting uniforms) and
the haze (`hazeOD` in the trace, `HAZE_K` = 2.8e-5). Cirrus (512² tile over 32 km at 9.8 km) and
two thin high layers (1024² tile over 64 km at 6.3 and 7.7 km) are 2D textures; they repeat (see
known issues).

## 5. The world generator (CPU)

Everything between the markers `// ------------------------------------------------------------------ world constants`
and `// ==== WORLD END`. It is pure JavaScript (no DOM, no GL) and deterministic: every value is a
function of position, `WORLD_SEED` (`?seed=N`, default 7) and `TOWER_RATE` (`?towers=K`). The
Node tools load exactly this text (`tools/world/load.js`).

### 5.1 Hashing and noise

`hashU(i, j, s)` integer hash; `vnoise` value noise on an endless lattice; `fbm` (each octave ~2×
finer and turned 36°, so no lattice shows); `mulberry32` streams seeded per cell / per bubble, so
each thing draws from its own stream and changing one never shifts another. `poisson`, `gauss`.

### 5.2 The air

- `warpOf`: domain warp (±4.5 km) for the slow fields.
- `restOf`: **restlessness** I ∈ [0, 1], calm .. storms: broad patches (fbm at 2.4e-5 /m, 4 octaves)
  plus long winding bands (ridged fbm at 9e-6, ^6), through `smoothstep(0.4, 0.85, ...)`. About 30%
  of the world is calm (I < 0.1).
- `REST_O`: an offset of the restlessness field chosen at load time (the "spawn draw", end of 5.5).
- `columnFields(x, z, lod)`: the **sea of clouds** without heaps: `hb` = 1650 m + swells (±1.7 km over
  ~50 km) + hills (±1.1 km) + narrow deep valleys (−700 m) + rolling mounds (billow noise
  `|2·fbm−1|`, i.e. rounded tops with creases between; amplitude 220 m + 700 m × restlessness)
  + 250 m × restlessness; valleys below 1000 m level out softly toward 700 m. Also `amp` (billow
  strength for the shader, 0.65–1.4, mostly ~1: the sea always overturns) and `fine` (strength of
  the small billows, 0.4–1.3). `lod` drops mound octaves for coarse levels.
- `airAt(x, z)`: what a rising bubble meets above a place:
  - `zs` sea level; `ceil` the ceiling (tropopause) 11.6–13.4 km;
  - wind shear 0.3–2.4 (m/s)/km, its direction turning ±1 rad around `WIND` (`ux`, `uz`);
  - `cap` the inversion over the sea: 0.2·e^(−2.6·I) m/s² × 0.7–1.3, over `dInv` = 380 m;
  - `dry` chill of mixed-in dry air: 0.09–0.05 m/s² (by moisture) × (1 − 0.4·I);
  - `bmax` buoyancy 0.015 + 0.12·I^1.3 m/s²;
  - `el` equilibrium level: zs + 600 m + (ceil − 1500 − zs − 600)·I^0.5·deep, where `deep` (0.65–1,
    its own slow field) says how high the unstable air reaches.
- `buoyAt(A, y)`: buoyancy profile: 0 inside the sea (it coasts), −cap through the inversion,
  bmax·(0.3 + 2.8u(1−u)) up to the EL, −0.03 − 0.12/km above it, −1.2 above the ceiling.

### 5.3 Thermals (`lift`, ≈ line 306)

One bubble rising from the sea: an entraining-parcel ODE stepped in height (60 m through the
inversion so a big bubble can't hop over it, else 0.3·r clamped to 40–450 m).

- Mixing: the kept share of buoyancy `f *= exp(−MIX·dz/r)` (`MIX` 0.6; ×0.7 inside cloud left by
  earlier bubbles of the same cell; none inside the sea). Smaller bubbles lose strength faster.
- `w² += 2·dz·(buoyancy·f − (1 − f)·dry − DRAG·w²/r)` (`DRAG` 0.35). Stops when w² ≤ 0 (it
  settles) or when the moment shown comes first (it is "still rising").
- It swells (`SWELL` 0.04 m per m, plus r·dz/60 km), drifts with the wind of its height
  (`U = shear·(y − zs)`) and outward if shed, and is pushed aside by earlier heads in its way
  (crowding).
- Its wake: turbulent lumps (2 per step for r > 700 m, else 1) every 0.55·r of rise.
- Shedding: with probability dz/(`SHED`·r) per step a smaller bubble (0.3–0.62 r) breaks away and
  rises on its own stream (only at depth > 1).
- At the top it boils into 2–7 crowns (0.18–0.5 r), which boil in turn (to `C.depth` levels: 2 for
  small cells, 3 for big). Sub-bubbles smaller than `C.minR` are not grown (150 m for low pulses,
  250 m for tall ones, 600 m for the coarsest level).
- `roofOf`: how far a piece may bulge above its centre: the inversion while below it, the ceiling
  always, never above `CLOUD_TOP − 300`.

### 5.4 Ageing (`settle`, ≈ line 374) and domes (`placeDome`)

What became of each piece by the moment the world shows:

- Life: `col` = 450–1600 s (by moisture) × √(r/1 km); ×(1 + 2.5) near the sea (moist); ice above
  8 km lives 1700·√r s; wake pieces live 1.5× while their cell is still active, 0.8× after; heads
  above 2.5 km no longer than 0.75·col (dying towers crumble from the top). Pieces shrink as
  √(1 − (age/life)²) and vanish at the end.
- Drift with the wind of their height × age; wakes widen with age (detrainment).
- A stopped head settles: pressed flat by the stability of the air that stopped it (`stabOf`,
  `headUp`), sags (underside) and softens; where it was stopped hard it spreads out beneath that
  air in 1–7 lobes, `S = sat(−bu/0.6)·(0.5 + 3·sat((w − 4)/22)^1.5)` (a little under the inversion,
  far under the ceiling: anvils).
- Low pulses (head top below `zs + H_FLAT`, 2200 m) become **2D domes** that raise the sea surface
  (`placeDome`): standing on what they grew from, never steeper than h/r ≈ 0.65 (r ≥ height/0.5),
  profile from a table: rounder when young (prof 0.8) to sagging bell (1.4), lobes 1.1.

### 5.5 Convective cells (≈ lines 442–690)

- **Potential P** (m): the size of a cell's strongest bubbles. Power law: density
  0.36e-6/m² × (0.12 + 0.88·I) × `TOWER_RATE` for P > `P_MIN` (600 m), slope `ALPHA` 2, cut
  exp(−(P − 600)/`P_CUT` 2800). Kept in three grids ("tiers") by size: 8 km (P 600–1000), 16 km
  (1000–3000), 32 km (3000–8000). `tierSites` places them cheaply (drawn as dense as the most
  restless air, each kept as likely as the air where it lies allows).
- **Life**: 1400 s·√(P/1 km)·(0.7–1.3); a cell is shown at a random age up to 1.25·life.
- **Pulses** (`growCell`): up to 24, every `gap` = 240·(min(P, R_TH)/1 km)^0.3 s (shorter for cells
  bigger than `R_TH` 3500 m: they send more bubbles, not bigger ones); strength s = √sin(π·age/life)
  × lognormal; r0 = min(P, R_TH)·lerp(0.35, 1, s), launch speed 1.5 + 4.5·√(r0/1 km) m/s, spread
  0.6·P around the (drifting) cell centre. Each pulse is lifted roots-only first; if its top passes
  `zs + H_FLAT` it is **tall** and grown in full as **3D bubbles** (only bubbles with r > 420 m, and
  pieces ≥ 200 m), else its heads become 2D domes.
- **Subsidence** (`subsidenceAt`, `SUB_R` 2.6): air sinking around a stronger cell nearby (within
  ~1.8·2.6·P) strengthens the inversion (+0.12·sub), cuts buoyancy (×(1 − 0.7·sub)) and lowers the
  EL (×(1 − 0.6·sub)) of weaker cells (P ≥ 1000; half for daughters). This spaces towers.
- **Daughters**: outflows set off Poisson(1.2·I·age/life) younger cells 1.8–3.5 P away (60% within
  ±1.2 rad of downwind), P × 0.4–1, two generations deep.
- `tierCell` grows all cells of one grid cell, then per cell: start clearance (if any bubble comes
  within 2.5 km of the start column at the bird's height, the cell's 3D bubbles are dropped),
  `pruneBubbles` (drop bubbles mostly inside a clearly bigger one), `dropAdrift` (keep only pieces
  that hang together, piece by piece, with the sea: fragments cut off evaporate first), and a
  tower summary `{x, z, P, y0, top, wide, R0, ceil, gen, cell}` for the presets and tools.
- **Caches**: per tier a full cache, a coarse cache (for the coarsest level: low pulses roots-only,
  tall ones without sub-bubbles under 600 m; the smallest tier is skipped there) and a site cache;
  `worldGC` forgets far ones (every 900 frames when a cache holds ≥ 2500 entries).
- **The spawn draw** (block after `subsidenceAt`): the restlessness field is drawn again and again
  (`REST_O`, up to 64 draws, each as random as any other) until one leaves the start calm
  (rest < 0.3 within 3–9 km and toward the sun, bearings −0.35..0.15 out to 35 km) with ≥ 3 strong,
  unsuppressed cell sites (P > 2200, I > 0.5, subsidence < 0.4) at bearings 0.3–0.95 rad right of
  the sun, 12–40 km out: towers lit from the side, in view of the start yaw 0.45, their tops drifting
  away downwind. Failing that the best draw. ~30 ms. If the sun azimuth, the start yaw or the
  wind change, revisit these bearings.

### 5.6 Columns and bubbles for the GPU

- `fillColumns(cell, lod, gi0, gj0, ni, nj, out)`: RGBA per column: R sea surface with domes
  (smooth max of every dome, small domes widened and lowered on coarse levels so their volume stays,
  then slope-limited to 2.2 cells of rise per cell so the volumes can hold it), G billow strength
  (raised to 1.45 under and around big bubbles: air rising vigorously), B fine billows, A sea level
  without heaps. Min 650 m.
- `gatherBubbles(...)` writes bubbles into the bake shader's texture: 1024 wide; per 1024 bubbles
  three rows: (x, y, z, rh), (ryU, ryD, stretch, angle), (union smoothness k, bounding radius, 0, 0).
  Ellipsoids with separate up/down vertical radii and a horizontal stretch/angle. `minBR` per level.
- Queries: `seaSurfaceAt` (hb, hs with domes, `floor` = min(hs, hb + 330): heaps piled higher may be
  flown into), `seaTopAt`, `cloudTopAt`, `ellDist` (approximate ellipsoid distance), `towerDistAt`,
  `towersNear`.

## 6. Streaming the world to the GPU (≈ lines 2560–2714)

- Three **clipmap levels**, each a 256×256×nz R16F 3D distance volume plus a 256×256 RGBA16F column
  map, centred on the camera, addressed toroidally (only strips that enter are rebuilt):

  | level | cell (h × v) | nz | reach | maxD | minBR | shift step | block |
  |---|---|---|---|---|---|---|---|
  | L0 | 128 × 128 m | 112 | ±16 km | 1200 m | 0 | 16 cells | 32 |
  | L1 | 512 × 256 m | 56 | ±65 km | 4000 m | 200 m | 8 | 32 |
  | L2 | 2048 × 512 m | 32 | ±262 km | 12000 m | 900 m (coarse cells) | 4 | 16 |

- A **shadow volume** (TSV: 768 × 360 m cells, 40 slices) holds optical depth toward the sun,
  marched through the coarser levels; it shifts once L1/L2 are settled.
- Jobs: per block first the column fill (CPU, `texSubImage2D`), then the volume bake (GPU, `NOUT`
  slices per draw). Until a shift is baked a level is valid only in the overlap of old and new
  windows (`valid`), and the shaders fall back to a coarser level.
- Bake (`FS_BAKE`): per texel the sea (`above·cs`, slope-corrected distance) united with the union
  of bubble ellipsoids (smooth min with each bubble's k), with a broad fillet where they swell out
  of the sea: `smin(sea, bubbles, mix(700, 60, smoothstep(0, 1800, above)))`; clamped to ±maxD.
  The loop runs over all bubbles gathered for the block (cap `BUB_MAX` 4096): keep counts down.
- **Origin**: rendering is relative to an origin snapped to `ORIGIN_Q` (81.92 km, a multiple of every
  noise tile), so float precision holds on endless flights.

## 7. The cloud renderer

Shared functions in `GLSL_CLOUD` (≈ line 1398), used by trace, TSV, probe and mist.

- `levelAt`: L0 below ~7–10 km (dithered handover), L1 below ~40–55 km, else L2; a level is used
  only inside its valid window. `LV_MARGIN` (80, 260, 750 m) = interpolation error per level.
- **Billows** (`cloudSDF`): the large shapes `dm` from the volume, then octaves of an *fbm of
  spheres*: a 128³ RGBA16F texture tiled over 5120 m holds signed distances to random spheres on
  lattices of 4, 8, 16, 32 cells per tile (1280, 640, 320, 160 m; the two large channels packed
  close, radius 0.4–0.78 cell, the small ones a little looser), looked up through a slow
  never-repeating warp and squashed 1.35× vertically. `octave(d, n, shell, k)` clips the spheres to
  `shell` above the current surface (soft max) and unites them with it (tight smooth min: crisp
  creases). Shells: 300·A, 160·A, 56·w3·fine, 26·w4·fine (A = billow strength from the column map);
  the two fine octaves only above the sea's troughs, fading with distance (w4 over 5–15 km, w3 over
  12–30 km); within ~2.2 km two more octaves (80 and 40 m cells, shells 20 and 10 m).
  `shellOf(a) = 400a + 120` bounds how far billows rise above `dm` (empty-space skipping).
- **Density** (`densityEx`): from the signed distance with a soft rim: 14 m wide near the camera,
  80 m at 4 km; crisp (≤ max(30 m, 0.3% of distance)) on the billowy tops of the sea and on
  everything heaped on it, soft in the sea's deep troughs; wispy erosion by the detail texture
  (64³ Worley/Perlin over 512 m); far silhouettes of heaps fray; near the camera extra fine wisps.
- **Trace** (`FS_TRACE`, ≈ line 1679): up to 360 steps to 250 km or `CLOUD_TOP` (14 km) on a
  curved planet. Empty-space skipping by `dm − shellOf − margin`; sphere tracing near surfaces with
  jittered strides; on entry the boundary is found by a few Illinois regula-falsi steps (else far
  clouds look dark and speckled); inside, steps aim at a fixed optical depth (σ = 0.035/m) but stay
  fine in the rim; early termination at T < 0.02.
- **Light**: `lightTauN` marches 5 growing steps toward the sun with the view sample's detail
  (bulges shade themselves; the first step's density ramp is sharp); multiple scattering by
  octaves (Wrenninge) with a two-lobe HG phase (silver linings); diffusion (light soaking through
  the cloud, golden where thin, cooler blue-violet where it travelled far); sky light by which way
  the surface faces (one SDF tap above + the light march: blue zenith on tops, warm bounce from the
  sunlit sea under bellies at half weight, golden or violet sky on the sides), short-range
  occlusion; far occluders (towers) via the TSV as a plain multiplier; haze by optical depth.
- **Mist**: 64 instanced puffs in wrapped 180 m cells around the camera, lit like the volume, only
  where the real cloud density is, while inside cloud. The near-camera density is thinned inside
  cloud (drifting mist, not a white wall).

## 8. The bird, flight, input, camera

- **Bird**: an origami crane mesh, flat-shaded creases, procedural paper fibre texture, translucency
  (glows when backlit), its own shadow map in which paper layers let light through, wing flex with
  load, a slow breathing and flutter at speed; lit by the probe (sun and sky at the bird, in-cloud).
- **Flight** (`updateFlight`, `FLIGHT`: cruise 64 m/s, stall 31, max 185, g 11.5, turn 16.5,
  bank ±56°, climb 30°, dive 42°): energy-based glider (dives gain speed, climbs trade it, drag above
  cruise, a gentle lift below), springs on bank and flight-path angle, coordinated turns, gentle
  turbulence (livelier in cloud). The floor: a soft lift when sinking into the sea (from the probe's
  distance to the real billows, with `seaTopAt` as fallback) and a hard floor 170 m below it; heaps
  piled above the sea's floor and the towers can be flown through. Ceiling 11.5 km.
- **Input**: mouse (pointer offset from centre, dead zone, shaping), touch (drag from where you
  touched, with a ring indicator), keys (arrows/WASD; Cmd/Ctrl/Alt combos ignored; Meta release
  clears keys), gamepad (left stick); leaving the window levels out.
- **Camera** (`updateCamera`): chase camera with lag, swings wide and leans into turns (roll 0.42 ×
  bank); vertical field of view 47° on landscape screens (wider on portrait ones, up to 78°),
  widening by up to 24% toward top speed; a subtle shake at speed and in cloud.

## 9. Image

- **TAAU** (`FS_TAAU`): reprojects the history with the clouds' depth, Catmull-Rom history sampling,
  smooth 3×3 neighbourhood clamp (bilinear taps per output pixel; no low-res grid), Halton(2,3)
  jitter over 16 frames.
- **Bloom**: 7 levels, Karis-free normalised chain, clamp 3000 (`?bloom`, `?bloomw`, `?bclamp`).
- **Sun rays**: occlusion mask from the history + bird, two radial blurs at quarter resolution,
  only when the sun is near the view (`?rays`).
- **Final**: exposure 14 (×1.45 inside cloud), hue-preserving filmic tone curve with contrast
  (`?con`, `?tm`), golden-hour split tone, vignette, grain; `?view=1..5` debug views.

## 10. Speed: dynamic resolution and budgets

- Clouds are traced at `R.scale` × full resolution (0.22–0.75, start 0.5; 0.36 on touch devices);
  full resolution itself is capped (2.3 Mpx; 1.15 Mpx on touch devices; lowered further if even the
  cheapest clouds are too slow).
- With GPU timer queries (`EXT_disjoint_timer_query_webgl2`): keep the GPU under 12.5 ms per frame
  by scaling the trace. Without them (Safari, Firefox): from frame times, recognising displays and
  browsers that cap the frame rate (50 Hz, 30 fps power saving) by checking whether much cheaper
  frames come any faster; the quality ceiling recovers after hitches.
- World streaming: bake jobs within 4 ms per frame; but the CPU generation of a new grid cell runs
  synchronously when first needed (spikes, see known issues).

## 11. Test mode, hooks and URL parameters

The tools rely on these; keep them through the restructure.

- `?test`: fixed time step (`dt`, default 1/60), canvas `w`×`h` (default 960×540), cloud `scale`
  (0.5), stops after `frames` (`window.__done = true`), keeps the drawing buffer, no hint, no
  dynamic resolution, all bake jobs every frame, the probe (light and cloud at the bird and camera)
  read back at once and used the next frame, as on a GPU that keeps up: deterministic,
  bit-identical renders on the same Chromium build. `&live`: input is read as normally (for input tests). `&log`: per-frame flight
  log in `window.__log` (t, x, alt, z, speed, bank, gamma, yaw, sea top, sdf at the bird, camera
  roll, fov). `&script=dive|climb|turn|weave`: scripted input. `&freeze`: no flight.
  `&preset=...` / `&pose=x,y,z,yaw,pitch,bank` / `&closeup=right,up,forward`: camera.
- `?cpuprof`: a fence after every pass; per-pass milliseconds in `window.__gpu`.
- `?debug`: overlay (`#stats`) with fps, resolutions, GPU times, altitude, speed, world jobs.
- `?dbg=1..7`: cloud debug views (1 normals of the billowy surface, 2 sun visibility, 3 shadow
  volume, 4 march cost, 5–7 lighting terms). `?view=1..5`: transmittance, raw cloud light, depth,
  sun rays, bloom. `?exp ?con ?haze ?bloom ?bloomw ?bclamp ?rays ?tm`: image controls.
- `?seed=N` another world; `?towers=K` density of convective cells.
- Globals: `window.__done`, `__error` (also shown in `#note`), `__frame`, `__gpu`, `__log`,
  `__debug` = { bird, cam, R, seaTopAt, cloudTopAt, towersNear, input, DR, LEVELS, TSVL, worldStats,
  probe() }. Elements: `#view` (canvas, class `on` once shown), `#hint` (class `on`), `#touch`,
  `#note`, `#stats`.
- Presets (`readPreset`, only computed when `?preset` is given): `start sun away side skim high
  bank fastdive humps high2 upward` (around the start) and `tower giant anvil close approach inside
  under` (found among the generated towers within 200 km: sunlit, with a clear line of sight;
  `anvil` = a tower that reached its ceiling and spread wide).

## 12. Performance baselines

Measured on this project's cloud machine with **software GL (SwiftShader)** — only ratios mean
anything; no real GPU or phone has been measured in these sessions.

- Startup (page main thread, 480×270, three frames, no preset): **≈ 4.7 s** after the two fixes of
  24 Oct (was ≈ 11.8 s: the coarsest level gathered bubbles from fully grown cells, and the test
  views searched 200 km for towers on every load). With `?preset=start` ≈ 8.3 s (the search runs).
  World generation in Node for all three levels (`tools/world/startup.js`): ≈ 3.2 s, ≈ 115 MB heap.
- Cloud trace per view, 640×360, 12 frames, `?cpuprof` (ms summed): start ≈ 10.6 s, side ≈ 10.5 s,
  high2 ≈ 7.4 s, tower ≈ 10.5 s. Round 6 made sea-level views ≈ 40–50% and high/tower views ≈ 20%
  more expensive than round 5 (more cloud on screen, taller billows); the billow bound is the main
  lever (`shellOf`: 460a + 150 cost ≈ 10% more than 400a + 120 with no visible difference).
- Bubbles: ≈ 5,600 in a 120 km box around the start (round 5: ≈ 1,100); per bake block at most
  ≈ 1,700 (L2) and ≈ 1,500 (L1) of the 4096 cap.
- World statistics (`tools/world/stats.js`, seed 7): within 150 km 572 cells with 3D towers, tops
  above 9 km 53, above 11 km 17; within 40 km of the start 12 tops above 6 km, 5 above 9 km.

## 13. Known issues and ideas

- **Never measured on real hardware** in these sessions: frame rate, dynamic resolution behaviour,
  memory on phones. First thing to check after the restructure.
- **CPU world generation runs on the main thread** and synchronously when a new grid cell is first
  needed (startup ≈ 4.7 s on software GL; in round 5 streaming spikes of ≈ 200–250 ms were measured
  when entering new areas). The generator is DOM-free and deterministic: moving it into a Web
  Worker (posting column blocks and bubble arrays back) would remove the stalls. It also allocates
  many small objects (domes, pieces): GC pressure (`makeDome`, `lift` dominate profiles).
- Framebuffers created once at start (`FB.trans` … `FB.shadow`) have no out-of-memory fallback: if
  one fails, the script stops before the hint or the error note (only the size-dependent targets in
  `allocate` retry smaller). Unlikely (they are small), but a black page if it happens.
- **Mushroom tops**: some towers have a wide spreading top over a narrower body (visible in
  `tools/world/preview.js` and `catalog.js`); the author dislikes thin stems under spreading tops.
  Causes to look at: spreading lobes vs column width, shear drift of tops, column pieces
  evaporating before heads, pulse spread (0.6·P).
- **Close-up surfaces** of towers can look blotchy in low sun (cast shadows between many lumps), and
  shadowed towers show bright **sun patches** where light comes through gaps between towers (the
  768 m shadow volume makes them blob-shaped).
- **Distant flat tops can look like floating lenses** (their bodies sink into haze and behind the
  curvature); photo 1 shows the same, but watch it.
- **The cirrus and the two high layers tile** every 32 and 64 km (the sky was to be kept as is).
- `dropAdrift` also removes the tops of some dying towers whose columns evaporated (by design: no
  floating fragments), which lowers the count of towers reaching the ceiling by ~30%.
- The world is drawn so the start looks good (the spawn draw); other places can be emptier: about 30%
  of the world is calm air with only the billowy sea and its heaps.
- Inside thick cloud near the camera surfaces read soft (mist thinning, 14 m rims).

## 14. Tuning lessons (what failed, and why)

From the rounds in `docs/HISTORY.md`; worth knowing before tuning again.

- **Smooth "sand dune" sea**: billow strength tied to restlessness (≈ 0 over most of the sea) and
  ridged noise (`1 − |n|`) for the rolling mounds made smooth hills with sharp crest lines. The sea
  always overturns: billow strength ~1 everywhere; billow noise `|n|` (rounded tops, creases).
- **Billow shells**: bulges far flatter than wide (shell ≈ 1/6 of sphere radius) read as smooth
  swells; ~1/3–1/2 of the radius for the large octaves reads as cauliflower. A sparse sphere field
  leaves bare pits between bulges; dense everywhere looks like sponge; dense large + looser small,
  with the small octaves lower and fading with distance, looks like cauliflower.
- **Crisp rims cost nothing**; a generous billow bound (`shellOf`) costs ~10–20% of the trace.
- **Dirty brown blotches** under bulges: the warm sea bounce at full weight on downward facets;
  halved.
- **Inversion strength vs restlessness** decides everything about towers: too strong in moderately
  restless air → towers only at I ≈ 1 (too few, too small); too weak overall → "foam walls" of
  medium heaps. Current: cap = 0.2·e^(−2.6·I).
- **Equilibrium level** with I^1.5 kept almost all towers mid-level; I^0.5 with `deep` 0.65–1 lets
  giants reach the ceiling often.
- **Subsidence** weaker than now (SUB_R 2.0, half effects) → walls of medium towers; the current
  strength spaces them.
- **Start clearance** as a radius around the start (2·P·1.7 + 2.5 km) emptied 10–20 km; now only
  bubbles near the start column are dropped. A huge tower right ahead of the start blocks the
  sunset and looks dull (backlit), hence the spawn draw puts strong cells to the right of the sun.
- **Shards and teardrops**: small bubbles in coarse volumes (512 m cells) become polyhedral
  fragments → `minBR` 200/900 m and small bubbles dropped whole (a per-piece size filter left
  heads floating without their wakes).
- **Pyramids/spires on heaps**: 2D domes steeper than the slope limit get raised into cones;
  domes are at most h/r ≈ 0.65.
- **Bubble budget**: the bake loops over every gathered bubble per texel; ×14 bubbles (round 6's
  first try) would have been a disaster; prune, minimum sizes, one wake lump for small bubbles.
- **Coarse level**: must take bubbles from coarse cells (`gatherBubbles(..., coarse)`), or the first
  frame grows everything in full across 524 km.

## 15. Restructuring guide

The author plans to split the code into several files and build one HTML file. Suggestions:

- Natural modules (see section 2): `math`, `world/` (noise, air, thermals, cells, columns —
  DOM-free, also used by the Node tools), `atmosphere` (CPU sun colours), `gl` (helpers),
  `shaders/` (`.glsl` files or JS strings; mind the JS interpolations `${MRT_OUT}`, `NOUT`, the
  `DBG` define), `streaming` (clipmaps, bake queue), `bird`, `resources` (allocate/resize),
  `flight`/`input`/`camera`, `render` (frame graph), `resolution` (dynamic resolution, timers),
  `presets` (test views), `main` (boot, loop, hint, hooks), `page.html` + `style.css`.
- The output must stay a single file that works from `file://`: inline the script (a classic
  script or one inlined module), the CSS and the shader sources; no runtime fetches.
- Keep the world generator loadable by the tools: either keep the two marker comments around it in
  the built page (then `tools/world/load.js` works unchanged), or point `WSRC` at its source files,
  joined with `:` in order (ES modules are fine: `import` lines are dropped and `export` keywords
  removed). `load.js` evaluates them after a prelude that provides `Q` and the math kit (`PI DEG
  clamp lerp sat smoothstep len norm mulberry32`) and returns the names listed in `NAMES` (adjust if
  names change). Tested with the world as one module and split over two.
- Keep the test hooks, element ids and URL parameters (section 11); the checks use them.
- **Verify the restructure** (nothing should change):
  1. `node tools/world/fingerprint.js` (or `WSRC=<the world's source files> node ...`) → "same as
     fingerprint.json" (pure JS; any generator change shows).
  2. `PAGE=dist/index.html node tools/regress.mjs` → all views match the baselines (bit-identical on
     the same Chromium build).
  3. `PAGE=dist/index.html node tools/checks/presets.mjs` and the other checks in `tools/README.md`.
