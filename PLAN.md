# Plan

What a session needs beyond [CLAUDE.md](CLAUDE.md) (the vision, the rules, how to work a request):
what was tried and failed, and why, and what is still open. Keep it short and current: an approach
that fails goes in the decisions with why; a fixed issue comes out. How things work belongs in the
module headers.

## Next: the cloud review of 2026-11-20, in legs

A review against the state of the art (Guerrilla's Nubis³, Hillaire 2016 and 2020, Wrenninge's
octaves) found the architecture right: a CPU world, distance-field clipmaps and procedural detail are
Nubis³'s design, generated rather than authored. Don't rebuild it. The recurring complaints trace to
three things inside it (the light's inputs, a skin a trace pixel wide, balls on lattices) and to ten
defects. Checked on HEAD (4624d58) the same day; the review had read 9d49653's cloud.wgsl:

- **Holds** (by hand and in Node): 10 m under a flat top the light march finds τ ≈ 2.1 where the
  sun's path out is τ 8.0 (each step's ramp widens with its length). `facing` gives a flat top at 5°
  0.19 where the cosine is 0.087, and faces turned from the sun 0, so no light diffuses through a tower
  to its shade (hence the navy, then AMB_K 1.4, the blue tints, CLOUD_SAT). A heap 500 m toward the
  sun shades by diffusion (1/(1+0.11τ), ~30% left), the same heap 2 km off by e^−τ (black). All the
  defects in the legs below hold on HEAD.
- **Smaller than claimed**: the skin follows the trace's pixel (`edgeW`), so the light does too, but
  the clouds' raw light (`view=2`) moves 0.4–3% between scale 0.5 and 0.75 (`start`, `high2`, `away`;
  brighter at the finer), not 8–13%.
- **Larger than claimed**: the far level (L2, from 40–55 km) takes only the domes that grew from the
  sea, and no small cells. In a heap field 30 km east of the start it sees 37 of 420 domes: its sea's
  p50 is 1.7 km where L1's is 3.9 km. 221 of the 359 towers rising over 3 km within 150 km come from
  small cells (P < 1000) and vanish there, some 6.3 km tall. They are ~2.6 km wide and only 13% of
  their bubbles reach L2's minBR (900 m): putting the small tier back alone would leave shards.
- **Partly stale**: billows of one size on every bubble went in 4624d58. The lattices remain (one
  sphere a cell, 90% of the lobes' cells and 70% of the turrets' filled: noise-shape.wgsl). Tower tops
  flatter than 0.45 (the top bubble's ryU/rh): 38% (40% before 4624d58). Mushrooms from ice
  outliving its column (thermals.js `settle`): unmeasured; a count by bubble extents found no top
  1.4× wider than the 2–4 km below it, so look in `catalog.js` before acting.

Each step: a before/after capture of the views named (CLAUDE.md §4), `--profile` where the trace or a
bake changes, flights compared where the world changes, then a line here on what held (and in the
decisions on what failed). The author judges after each leg; legs 2 and 5 are mostly taste.

**Leg 1, done (2026-11-20)**, each step its own capture (`screenshots/before`, `l1-rel`, `l1-detail`,
`l1-tsv`, `l1-sea`); the trace's cost over all views within the noise:
1. The light march at the view sample's own lod (it ran at `lod + 0.05`, and `rel` compared the
   two): real but small, the changed pixels 0.2–0.7 levels darker with 1–2% less fine contrast. It
   wasn't what makes the "pile of even balls" (`close` hardly changed).
2. The detail volume looked up turned in 3D (`DETAIL_ROT`, constants.js; `detailAt`), its drift and
   the render origin turned with it in frame.js. A warp can't do this: it moves copies of the tile
   around without changing them. A turned 3D tile cuts every surface obliquely: on a level stretch a
   copy lies ≥ 26 m above or below within 1.5 km (tests/constants.test.js). No repeat was visible
   before (a 4 km look-down: the sea's relief already cuts the tile at varying heights); the look is
   unchanged, the fine domes elsewhere. Flights: `skim` differs by up to 5.7 m in height (the probe
   feels the domes), the rest identical. `inside`'s trace +11% (0.2 ms a frame: every sample near
   the camera reads the volume, through the turn).
3. The shadow volume's sun rays rise with the planet's curvature: far clouds' shadows shorten, and
   much of the near sea in `seed3`, `side`, `down`, `high2` comes out of shadow (changed pixels 6–27
   levels brighter, `seed3`'s fine contrast doubled: golden tops toward the sun where all was blue).
4. One sea bounce (`ambSea`, frame.js: albedo 0.89 · sin 5° / π, the clouds' value): the bird's got
   2.6× less. In sun it hardly shows (the keel a touch less warm); in shade (`giant`) the bird is now
   a faint blue sliver, where its keel glowed orange. Judge the bird with the shade in leg 2.

**Leg 2: the light's inputs** (known issues: colour and range, the sea into the sun; the navy shade,
milky flat tops, grazing tops lit like faces):
1. A reference first: `tools/light/` (Node), a Monte Carlo of the trace's medium (σ 0.07, the octaves'
   phase or HG 0.85) for a slab lit at 5°, a sphere and a tower-sized body: the light leaving a flat
   top, a face turned to the sun, the far side of 1.5 km of cloud, at the bird's view angles. These
   are the numbers to fit `sunScatter` to, instead of the eye, review after review. A GPU path tracer
   of a real view (`?pt` in the test mode) only if they leave doubt.
2. The sky's inputs: the aerosol absorption is 4.4e-3/km (×2.2) where Hillaire's extinction is
   4.44e-3 (absorption 0.44e-3: Bruneton's single-scattering albedo 0.9). Fix it in atmo.wgsl and
   sun.js together (better: once, in constants.js), then retune the ×2.2 to the look. The haze
   (`HAZE_K`, HAZE_H) veils the clouds but not the sun's colour (sun.js) or the sky: put it in both.
   Every colour downstream moves, so this gets its own capture of all views before the rest of the leg.
3. The light march's depth near a surface: estimate each step's length inside from the distance at
   its middle and its slope along the ray (from the steps beside it), not from a ramp that widens with
   the step. Averaging occupancy with half at the surface darkened lit tops because the air above them
   counted (decisions); the slope tells the two apart. Single scattering on grazed tops drops.
4. Diffusion by where the light entered. The cosine there is the distance's slope along the sun ray
   where the march leaves the cloud toward the sun: sin 5° on a flat top; for a tower's shade, its
   far, sunlit side. No 0.1 floor. The depth for 1/(1 + 0.11τ) is the path's τ times that cosine (the
   depth below the entry, as in a slab). Shade then gets what diffuses through (~8% through 1.5 km).
   Facing over 15 m made pumice and a 0.35 floor made the far side brown (decisions); this is neither
   (large-scale, falling with depth), but judge `side`, `tower`, `close` for both.
5. One rule for shadows: once the march leaves its cloud, whatever it meets after is another cloud's
   shadow (e^−τ, as the shadow volume's second channel), at 500 m as at 2 km. Watch for speckle (long
   steps hit or miss a heap) and the sea's billows shading each other.
6. The column data along the light march: each step reads its own (colAt, billowAt), not the start's
   from up to 1.36 km back.
7. Then retire the compensations one at a time, each kept only if the look holds: CLOUD_SAT → 1,
   AMB_K → 1, the blue and violet tints on the sky light (trace.wgsl), the exposure last. Judge against
   the reviews: lit faces orange to salmon (not apricot), shade a luminous lavender grey at 40–50% of
   the lit side, folds dark but not navy (`tower`'s lit-face luminance SD, the darkest 1%).
8. The bird in shade against the clouds' shade (`giant`: a faint sliver since leg 1). The shade's
   light on the clouds carries the compensations above, the bird's doesn't; and the sea bounce
   assumes a sunlit sea under it (the probe could see whether it is).

**Leg 3: the trace and the pixel** (known issue: sunlit rims):
1. Light the edge as the surface: the skin stays a pixel wide for the opacity (no aliasing), but the
   light is taken as at a fixed depth past the entry (the depth past the refined entry scaled by
   W/edgeW, for depthIn and the light march's start). Check: `view=2` at scale 0.5 against 0.75 goes
   from 0.4–3% to ~0.
2. The approach's minimum step (6 m + 2% of t: ~7 trace pixels at 1 km) hops over billow crests a
   grazing ray passes within one step, by the jitter: rims and silhouettes flicker. Tie it to the
   pixel footprint (1–2 pixels) near surfaces. `--profile` on grazing views (`skim`, `start`, `sun`),
   `shimmer.png`.
3. Fade by pixel footprint: the 1280 m lobes and 640 m turrets never fade (the broccoli on the
   horizon), and the domes fade by `lod = t/15000` whatever the resolution. Fade each octave as its
   relief falls under ~2 pixels.

**Leg 4: the clipmap levels agree** (known issue: the lattice at the handovers; towers popping in at
40–55 km):
1. A tool first: `tools/world/levels.js`, how far the levels' surfaces and towers disagree over
   boxes (the numbers above), to steer the rest.
2. Every level from the same inputs: coarse levels keep every dome, widened and lowered to their cell
   with the volume kept (as small domes already are), not only the roots ×1.25.
3. The small cells back in L2 as coarse stand-ins: each tower's bubbles merged into a few of ≥ 900 m
   with the same volume (leg 6's envelope at its coarsest). Watch the bubble cap and the L2 bake
   (`bakeCost`). World change: fingerprint, flights.
4. Then judge the dither at 7–10 and 40–55 km (`away`, `anvil`, 12 frames): once the levels agree it
   may no longer show; blending stays rejected on cost (decisions).

**Leg 5: a density profile like Nubis³**, after legs 2 and 3 (known issues: silver linings a pixel
wide, inside cloud a uniform wall). The edge stays crisp (a step to part of the full density, frayed
by the erosion); the density rises inward over tens of metres (erosion scaled by depth); nothing
outside the surface. It differs from both failures in the decisions: soft rims were a linear ramp
from zero (out of focus), the fringe was outside the surface (veils over the sea for kilometres).
`sun`, `anvil`, `inside`, `close`, `start`'s near sea.

**Leg 6: the shapes** (known issues: popcorn far away, mushroom tops, tops; world changes, so the
fingerprint and the flights each step):
1. Buoyancy continuous at the equilibrium level: air.js `buoyAt` jumps from +0.3·bmax to −0.03
   there, and `stabOf` reads 0.82 just above it. Fewer flat discs (38% of tops under 0.45 now; add
   that share to stats.js).
2. Mushrooms: measure first (catalog.js). If ice outlives its column (`settle`: 1700·√(r/1000) s
   above 8 km against 450–1600·√(r/1000) for the column), tie a top's life to the column under it.
3. Towers as continuous envelopes along the thermals' paths (widening with height), the bubbles
   shaping them rather than piled as balls: prototype in preview.js and catalog.js, then the bake.
4. Billows without a lattice: noise-shape.wgsl's sphereField puts one sphere in most cells, radius
   0.4–0.78 of it. Sizes from a power law, irregular spacing (sparse, clustered), several sizes per
   octave: real cumulus edges are fractal (dimension ~1.35), with no one size.

**Leg 7: a sun-space shadow map over ~20 km** (known issue: blotchy close-ups, stair-stepped
distant tops). At 5° a billow 50 m tall casts a ~575 m shadow; the march has two samples between
230 m and 1.36 km, and the shadow volume's texels are 768 × 360 m. Neither the sun nor the world
moves, so bake it per area and stream it like a clipmap. Watch memory and bake time.

## Decisions: what failed, and why

Worth knowing before tuning again.

- **A smooth "sand dune" sea**: billow strength tied to restlessness (≈ 0 over most of the sea) and
  ridged noise (`1 − |n|`) for the rolling mounds made smooth hills with sharp crest lines. The sea
  always overturns: billow strength ~1 everywhere; billow noise `|n|` (rounded tops, creases).
- **Billow shells**: bulges far flatter than wide (shell ≈ 1/6 of the sphere radius) read as smooth
  swells; ~1/3–1/2 of the radius for the large octaves reads as cauliflower. A sparse sphere field leaves
  bare pits between bulges; dense everywhere looks like sponge; dense large and looser small, with the
  small octaves lower and fading with distance, looks like cauliflower.
- **Crisp rims cost nothing**; a generous billow bound (`shellOf`) costs ~10–20% of the trace
  (460a + 150 cost ≈ 10% more than 400a + 120, with no visible difference).
- **Dirty brown blotches** under bulges: the warm sea bounce at full weight on downward facets; halved.
- **Inversion strength against restlessness** decides everything about towers: too strong in moderately
  restless air → towers only at I ≈ 1 (too few, too small); too weak overall → "foam walls" of medium
  heaps. Current: cap = 0.2·e^(−2.6·I).
- **Equilibrium level** with I^1.5 kept almost all towers mid-level; I^0.5 with `deep` 0.65–1 lets
  giants reach the ceiling often.
- **Subsidence** weaker than now (SUB_R 2.0, half the effects) → walls of medium towers; the current
  strength spaces them.
- **The start's clearance** as a radius (2·P·1.7 + 2.5 km) emptied 10–20 km; now only bubbles near the
  start column are dropped. A huge tower right ahead of the start blocks the sunset and looks dull
  (backlit): the spawn draw puts strong cells to the right of the sun.
- **Shards and teardrops**: small bubbles in coarse volumes (512 m cells) become polyhedral fragments →
  `minBR` 200/900 m, and small bubbles dropped whole (a per-piece size filter left heads floating
  without their wakes).
- **Pyramids and spires on heaps**: 2D domes steeper than the slope limit get raised into cones; domes
  are at most h/r ≈ 0.65.
- **Heaps at the slope limit** (2026-11): a heap grown on another came down to the sea wherever it
  reached past its parent (h/r up to 2), and the profile drops most of its height in its outer third
  (the steepest flank 2.3–3.1 × h/r): 40% of heaps met the volumes' slope limit, which cut them into
  flat faces with straight corners (a box in `side`). Now a heap is widened, not lowered, until its
  steepest flank is under 1.8 (none reaches the limit), and heaps blend over 0.25h + 40 m (a saddle,
  not a V a cell wide). Rounding the narrow valleys' floor changed nothing there; a slope limit over
  16 directions neither (the limiter wasn't what showed).
- **The bubble budget**: the bake loops over every gathered bubble per texel; 14 times as many bubbles
  (a first try) would have been a disaster: prune, minimum sizes, one wake lump for small bubbles. Now
  ≈ 5,600 bubbles in a 120 km box around the start, per bake block at most ≈ 1,700 of the 4096 cap.
- **The coarse level** must take bubbles from coarse cells (`gatherBubbles(..., coarse)`), or the first
  frame grows everything in full across 524 km.
- **The distance-volume bakes as compute shaders** (a slice an invocation, also with each workgroup
  loading the bubbles into shared memory once): no faster than the fragment pass that writes 8
  slices at once, often slower (L1 1.3–5×, L2 from 2× slower to 2× faster as the clocks drifted): it
  looks at each bubble once for all 8. The shadow volume (one long march a texel, no bubbles) is
  ~2.5× faster as compute, and is one now.
- **The clipmap levels in one stacked 3D texture and a 2D array of column maps** (a level picked by
  index, no branches in the trace): the trace 5–7% slower, and the stacked z coordinate shifts the
  filtering (up to 10 levels on some pixels). The branches cost nothing measurable.
- **The ambient light as a read-only storage buffer in the trace**: ~4% slower than the same buffer
  bound as a uniform buffer (Chrome on Windows, FXC): `uniform` in `render/gpu.js`'s BUFFERS.
- **Timing on this laptop GPU**: its clocks drift between runs (the same bake 2× apart), and a
  page that waited idle before its frames runs them slower. Compare builds interleaved, A B B A, over
  a few hundred frames, never two separate captures.
- **Tests compare the world's sums, not a hash**: Math.sin, exp and pow round their last bit
  differently between Node versions (the recorded hash was off on Node 24 while every part agreed to
  12 digits).
- **The light balance** (sun against sky, 2026-11): sky light ×1.95 plus a warm sea fill in every
  direction made shade nearly as bright as sunlit faces (a milky, flat look; the darkest 1% at sRGB
  80–105). At a 5° sun the sky gives a sunlit face's light /20–40; the sky now enters at ×1. Deep
  scattering must scale with how squarely the sun enters the surface (`facing`), or grazing-lit tops
  glow as brightly as faces turned to the sun (flat lit areas).
- **The shadow volume as one channel through everything**: counted from the light march's end, the
  cloud a texel sits in included, it gave backlit towers dark faces, but as a plain e^−τ it blacked
  out the inside of clouds (light diffuses through one body of cloud, ~1/(1+0.11τ)). Two channels:
  that cloud, and the clouds beyond. Its own-cloud channel in 768 × 360 m texels banded shaded tower
  faces: the trace's march now follows its own cloud to 6.3 km through the large shapes. Long point
  steps can't carry other clouds' shadows (they hit or miss a tower by the jitter: speckled, weak
  cast shadows); those stay the volume's (200–320 m steps), from 1.4 km on.
- **Soft rims**: a 30–80 m linear density ramp, erosion as a share of it, σ = 0.035/m: near clouds
  out of focus (not the trace's resolution: a full-resolution trace looked the same). Now σ 0.07, a
  ramp about a trace pixel wide on the tops, erosion a fixed depth. A 2-pixel ramp instead of 1.25
  hardly calms the shimmer and gives the softness back.
- **Near-camera sphere octaves** (80 and 40 m): with crisp rims each bulge clipped to its shell is a
  flat round disc that glows evenly (bokeh); taller shells are still discs. The domes of the detail
  volume carry that scale now. Fine billows on their parents' caps (onCap) beat popcorn.
- **Fold occlusion** (one tap up and back toward the camera): a 0.2 floor turns shade into gravel;
  0.4. A tap straight up can't tell a fold from a wall (it lands on a vertical wall).
- **TAAU at rest**: a wider clamp box alone barely calms crisp rims; the blend rate is what flickers
  (a rim pixel swinging ~150 levels × α 0.05). Halving α at rest did it.
- **Tried, no visible gain, not kept**: the HG + Draine droplet phase (Jendersie & d'Eon 2023) for
  single scattering (deep scattering and the glare dominate); jitter animated by position (Jimenez;
  the screen-door is something else, see known issues, and shimmer rose a little); sharper TAAU by
  the nearest sample (resolution isn't what limits the look; motion smear can't be judged in stills).
- **Aerial perspective per channel** (the horizon sky × (1 − T) per colour): toward the sun all sank
  into blue, though that sky is golden because its blue was lost on the long path. The veil's amount
  is now the transmittance's luminance; the cloud's own light still loses blue first.
- **Exposure 17, or ACES alone**: washes the glow toward the sun into a milky veil (16.5 too); the
  tone curve is hue-preserving through the mid-tones (golden-hour peach), the brightest highlights
  per channel (cream).
- **Billows of spheres** (2026-11, the author: "a 3D render of foam and clay"): four sphere lattices
  made every bulge big enough to see a ball with its own highlight (bubble wrap on tower walls,
  balls hanging under overhangs), and detail only on the caps of the 640 m lobes left the near sea
  smooth dough. Now the two big lattices are bent out of round in the bake (the turrets sparse, of
  many sizes) and domes push the surface out below them, down to 8 m; every octave grows everywhere,
  more on the tops of the one before.
- **Paraboloid domes** read as gentle hills, without outlines against the dome behind (soft, out of
  focus); sphere caps give each an edge.
- **Erosion as form**: 30 m of noise eaten into the edge near the camera (and a 14–30 m ramp) read as
  out of focus, frozen and at full trace resolution alike, because the light never sees it. Form
  belongs in the distance field, where the light march (from 10 m now, the view's detail in its
  first three steps) and the sky-light taps (10 m) see it; erosion only frays the edge.
- **How squarely a face meets the sun, over 15 m**: every small crease went dark (pumice); over the
  first ~50 m of the light march (light spreads that far inside cloud). The diffusion floor on faces
  turned from the sun: 0.35 made shade brown; 0.1.
- **Fewer billows under bellies and overhangs** (by the large shapes' vertical slope, from the
  clipmap): the slope steps between the volume's texel layers (flat shelves stacked on tower faces)
  and big lobes turned smooth boulders; reverted. The balls under overhangs went with the spheres.
- **Tone curve per channel from the mid-tones up** (2026-11): sunlit orange came out tan, sandstone
  (lit faces at sRGB 200,165,127, saturation 0.35).
- **The light march's jitter** (2026-11): each step at a random point per pixel flipped in and out of
  a bulge beside the path from pixel to pixel: the screen-door on near clouds (the IGN pattern; at a
  5° sun the 60–800 m steps and the 1.2 km steps through the large shapes decide lit or shadowed).
  Every step now at its middle, the same for every pixel; no contour rings showed. Averaging each
  step's occupancy (half at the surface) instead darkened the sea's lit tops: the path skims them,
  and the air just above counted as cloud.
- **Diffusion by the small-scale facing** (over 60 m) darkened every crease (solid, like dough) and
  still lit a tower's far side orange (brown shade). Now mostly by the side of the large shape (over
  400 m); deep inside, neutral.
- **Saturation in the final pass** turned the golden haze toward the sun into an orange dust band:
  it is in the clouds' own light now (CLOUD_SAT). Shade tinted ×1.45 blue with ×1.3 saturation was
  navy at a fifth of the lit side (reviews: luminous lavender grey, 40–50%); now ×1.2 and more sky
  light (AMB_K 1.4). Lifted further (×1.28, AMB_K 1.55), the shade turned periwinkle and the lit
  towers lost their folds (`tower`'s lit face: luminance SD 36 → 18).
- **The in-cloud mist's density variations near every cloud** (its first 120 m, within 900 m of the
  camera) made near surfaces fog: now only while the camera is in cloud.
- **Taller 320 and 160 m domes** (×2): bubble wrap on towers a few km off (`close`); only the detail
  volume's domes are taller. Taller domes without `dome`'s fade grew lit balls floating over the sea.
- **The largest lobes in cloudSDF** (2560 m cells): their 500 m in the skip bound cost the trace
  40–80% near towers; grown on the sea they raised new towers before the camera, on fragments balls
  floating in the sky. Now baked into the clipmaps, well above the sea and near massive bubbles.
- **A fringe outside the surface for silver linings** (thin cloud 40 m out, lit forward, integrated
  along the approach strides): rays toward the sun skim the sea's tops through it for kilometres:
  glowing veils, and capped per ray, sheets with hard edges, like film.
- **Blending the clipmap levels over a handover** instead of the dither: no lattice, but the trace
  12–18% slower in every view (also over 7–10 km alone, also reading the second level only near a
  surface). The dither stays.
- **Billows of one size on every bubble** (2026-11, the author: "puffs all one size"): the 1280 and
  640 m octaves grew alike on a 4 km head and on a crown of 400 m, which became a ball of the
  lobes' size: one stamped texture. Now each tower bubble carries its billow scale and liveliness
  (world/cells.js), baked beside the distance; lobes and turrets only where they fit. Without the
  turrets (640 m) a surface reads as smooth dough (`start`'s near sea, `side`): a small bubble
  gets turrets of half the size instead, and the sea keeps all its octaves. A billow scale for
  heaps by their height took the heaps' turrets: dough again.
- **The billow scale in the distance volume** (rg16float): the trace 2–12% slower from the format
  alone (the empty-space skipping reads it everywhere); a volume of its own, read only where
  billows are built. Blended over a distance that grew with the level's cell size, the levels
  disagreed and the handover lattice grew stronger (`side`): the same 250 m in every level.
- **Rounder heads** (2026-11): weakly stable air pressed almost every stopped head to a flat disc
  (stacked hats, loaves). Rounder everywhere, the heaps on the sea grew taller and steeper and the
  slope limit cut them into boxes (`geometry`'s pointed cube): only tower heads are rounder, and
  the test that makes a pulse a tower is unchanged. Crowns rooted down into the head they burst
  from (to stop balls perching) became narrow columns: flat-topped battlements (`high2`) and
  polyhedra in the coarse volume. Pressed very round (stable air at a fifth of now) a head stopped
  under the ceiling turned a pill with sky beneath it (`seed3`).
- **The finest domes clustered on the turrets' caps near the camera**: the near sea went doughy
  (`away`, `side`); they cluster only from ~1.5–5 km on, where they read as a carpet (frogspawn).

## Known issues and ideas

- **Measured only on one desktop GPU**: NVIDIA, headless, at 640×360, where a short benchmark ran at 60
  fps (capped) with 5.9 ms of GPU time a frame, the clouds at the 0.75 ceiling and no hitches; never on
  phones, integrated GPUs or at full-screen sizes, so frame rate, dynamic resolution and memory there
  are unknown (`?bench` reports them). Only Chrome's WGSL compiler (Tint) has seen the shaders;
  Safari's and Firefox's haven't.
- **The world grows in a worker** (src/worker.js), so new areas no longer stall frames; the page
  applies what it sends within budgets (render/stream.js). The budget's GPU estimate (`bakeCost`) is
  calibrated on one NVIDIA laptop GPU: on a weaker one a shift's bakes still spread over frames, but
  each frame's share takes longer. Startup still waits for the whole first bake (canvas at ≈ 2.9 s
  on that machine), and the generator allocates many small objects (`makeDome` and `lift` dominate
  profiles). If the bird outran the worker's patch of domes (core/world.js: asked for ≥ 30 s ahead
  at top speed), the page would grow the cells under it itself: a stall. Only Chrome has run the
  worker; it carries its own copy of the world's code (the page ≈ 19 KB larger).
- Textures and buffers created once at start (`T.trans` … `T.shadow`, the world volumes, the bubble
  arena) have no out-of-memory fallback: if one fails, the frames draw nothing (only the
  size-dependent targets retry smaller; the bird's are now only as big as its box can get, about a
  third of the canvas, instead of three canvas-sized ones).
- **Mushroom tops**: some towers have a wide spreading top over a narrower body (`tools/world/preview.js`
  and `catalog.js` show them); the author dislikes thin stems under spreading tops. Causes to look at:
  spreading lobes against column width, the shear drift of tops, column pieces evaporating before heads,
  the pulse spread (0.6·P).
- **Close-up surfaces** of towers can look blotchy in low sun (cast shadows between many lumps).
  Distant towers (~40 km, `seed3`) show stair-stepped tops and blob-shaped patches where the shadow
  volume's 768 m texels decide.
- **Popcorn far away**: towers 20–60 km off still read as one grape texture (`start`'s right
  tower, `high2`, `giant`, `away`'s horizon): their bubbles are big (billow scale over ~800 m), so
  all carry lobes and turrets alike. A real tower shows 2–4 dominant turrets, smaller domes on
  their upper, sunward shoulders, older parts smoother. Ideas: more spread in the billow scale per
  bubble, the liveliness stronger. **Crowns perched on heads** read as knobs (`start`'s middle
  tower, a "teddy-bear head" in a review; `catalog.js`): small bubbles sitting on big ones with a
  narrow neck. **Sunlit turret tops in shade** read as floating puffs (`start` beside the bird,
  `sun`, `tower`, `away` right of the bird, bigger since the detail volume turned in leg 1):
  attached (`?dbg=1`), their base melts into the shade.
- **Tops**: tower heads now keep their domes unless they pushed far into stable air or hit the
  ceiling; flat crowns remain where they overshot far (`high2`'s left tower), and `seed3`'s cap
  under the ceiling shows sky beneath its right end. Deep folds between lobes go near black
  (`tower`, `close`: a navy pit).
- **Silver linings** are a pixel wide: a backlit tower's edge doesn't blaze (`sun`, `anvil`); a
  fringe outside the surface failed (decisions).
- **Inside cloud** is a uniform wall (mauve grey, `inside`), even with the exposure adapting to the
  mist (the probe's estimate runs brighter than what the trace draws there, so the gain stays low);
  drifting mist only shows in motion. `under` (an anvil's underside) is dark navy now: right
  for shade at sunset, but judge it against its brief.
- **`close` nearly repeats `tower`**: since the tower heads are rounder (2026-11) the first spot
  clear of the tower's bubbles (presets.js, clearOf) is near `tower`'s pose, so both frame the same
  flank; neither looks up a flank from below. A view of its own would need another spot or tower.
- **Near the camera** the sea into the sun is still soft, glowing mush (`start` lower left, `seed3`),
  and the shaded sea seen from above blotchy (`giant`'s foreground): the light there is diffusion
  and sky light, smooth over tens of metres. **Into the sun** the sea's tops are pale cream: the sky
  light on faces turned from the sun brightens them (`?dbg=7`).
- **Colour and range** (reviews, 2026-11): lit faces apricot (≈ 238,177,116) where a sunset photo
  shows orange to salmon; toward the sun the haze is a milky band over the low sea (`high2`,
  `seed3`). Lit tower faces sit high on the tone curve with their folds filled by the light inside
  (`tower`'s lit face: luminance SD 36 before, 20 now); one review wants deeper darks, another
  wanted the creases lit: the balance (`facing` in sunScatter, AMB_K) is the lever.
- **Cost of the billows sized to their bubble** (2026-11, A/B against the commit before, 3 × 200
  frames, NVIDIA laptop, 960×540 at 0.5): the trace +2–12% (`tower` +2, `away` +5, `sun` +11,
  `high2` +11, `start` +12, `side` +12), split between the billow volume's reads, the half-size
  turrets and rounder, taller towers in view; the world's bakes +25–35% (4 slices a pass instead
  of 8, the billows blended in), so a shift's bakes spread over more frames (`bakeCost`, scaled
  by that, not measured per pass). Memory +52 MB (the billow volumes, rg16float). Flights identical.
- **Cost of the 2026-11 rework** (A/B, 200 frames, NVIDIA laptop, 960×540 at 0.5): the trace +5–12%
  (`away` +8, `high2` +12, `sun` +12, `side` +7, `start` +5, `close` −3): the taller fine domes. The
  bake of the largest lobes is within the noise of the world's time. The dive (`flights.js`) levels
  off ~40 m higher, at 91–93 instead of 95–97 m/s: the fine domes on the cloud tops are taller.
- **Cost of the domes** (2026-11): the live page at 2145×1072 (headless, NVIDIA laptop) holds the
  clouds at 0.49–0.51 of the canvas, 11.2 ms of trace (before: 0.47–0.49): about neutral. The
  finest domes cost only near surfaces, within a few km.
- **Cost of the 2026-11 look** (A B B A, 120 frames): the trace −9…−13% in near views (denser
  cloud ends rays sooner, the near octaves are gone), +9…+19% looking over wide lit areas (`high2`,
  `down`: the fold tap, the march's long steps); ±0.5 ms at 480×270 on the NVIDIA laptop GPU.
- **Distant flat tops can look like floating lenses** (their bodies sink into haze and behind the
  curvature); real sunsets seen from an airliner show the same, but watch it.
- **The cirrus and the two high layers tile** every 32 and 64 km.
- `dropAdrift` also removes the tops of some dying towers whose columns evaporated (by design: no
  floating fragments), which lowers the count of towers reaching the ceiling by ~30%.
- The world is drawn so the start looks good (the spawn draw); other places can be emptier: about 30%
  of the world is calm air with only the billowy sea and its heaps. The draw doesn't promise towers in
  view for every seed: **seed 5 starts with none** within 50 km (the piece's seed 7 has two above 8 km;
  `tests/world.test.js` holds it to one).
- **A lattice at the level handovers** (~7–10 and ~40–55 km: `away`'s middle distance, `anvil`'s far
  towers): pixels dither between two levels' shapes and light; the history averages it at rest,
  12-frame captures show it (blending the levels costs too much, decisions).
- **Sunlit rims**: with nothing moving 0.03–0.17% of a frame flickers (`geometry` 0.39%): the finer domes flicker along tower silhouettes against the sky and backlit rims. The history blends at half the rate where the image holds still. The slower blend may
  lag or smear in slow motion: for the author's eyes. The cloud scale and the TAAU clamp and blend
  rate are the levers.
- The `skim` view (170 m over the sea's top) shows nothing but haze: the billows rise higher than that
  there, so the bird is inside them. Its brief wants billows up close; a pose a few hundred metres
  higher would show them.
- Values JS and WGSL both keep as literals of their own: the sun-colour table's 750 m steps, the planet
  radius, the high layers' heights, the offsets of struct Probe's fields read back (CLAUDE.md §8 wants them from `constants.js`).
- A WebGPU validation error shows no note (left out: a harmless one on a browser never tried would stop
  the piece); the tools hear every one.
- Nothing publishes until main's first verified build makes the "latest" release; until then every
  deploy stops before publishing and the old site stays up.
- `tools/linux.js` is untried (Docker wasn't running).
