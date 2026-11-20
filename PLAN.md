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

**Leg 2, done (2026-11-20)** (`screenshots/l1-sea` → `l2-end`; `node tools/light/reference.js`):
1. The reference, `tools/light/`: a Monte Carlo of the medium (slabs facing any way, balls) under the
   sun alone, the trace's light beside it (model.js, in step with the shaders; tests/light.test.js
   holds both). It found flat tops lit at 5° 4–9× too bright (the march's τ 2.1 for 8.0), faces
   square to the sun 0.73×, and no light in the shade, where a tower passes 3% of its lit side and a
   1.5 km wall 12% (a 100 m ball glows brighter at its back than its front).
2. The aerosols' absorption 0.444e-3/km (×2.2), the atmosphere's constants once, in constants.js
   (FOR_SHADERS, as the planet's radius): 1–2 levels; the ×2.2 stays. The haze in the sun's path
   and the sky failed (decisions).
3.–5. The light march and sunScatter rebuilt and fitted (37 views of 13 shapes within ~1.6× rms, the
   isolated small balls aside): each step's length inside from its slope; the octaves' forward
   lobe kept from order to order, the back lobe fading; single scattering 0.95 HG(0.85) + 0.05
   HG(−0.3); diffusion D μ^1.4 / (1 + 0.11 τμ), μ where the light came in (the surface's 60–400 m
   facing close by, the slope where the path leaves farther in), every choice a smooth weight;
   clouds past this one take the direct light and the low orders, the diffusion only those past
   ~100 m, blurred with distance. With τ right, the outline's pixel-wide ramp ate half the glare
   toward the sun: leg 3's step 1 came here, the light as at a 1 m skin (by equal optical depth along
   the view) whatever the ramp. The look: crisper, sculpted towers (`tower`, `close`), more relief
   (`away`, `side`), heap tops seen from above pastel lavender, not orange (`down`), the sea in a
   tower's shadow lavender, not navy (`tower`), the glare toward the sun about as before (`start`,
   `sun`). Against the trace's resolution (`view=2`, scale 0.5 against 0.75): `away` 1.5–3.1% →
   0.7–1.3%, `high2` halved, `start` as before (leg 3).
6. Column data per light-march step: not kept (decisions).
7. AMB_K 1.4 → 1: lit faces more orange, the shade lavender grey at 45% of the lit side (39%,
   navy, before), deeper folds (`side`'s darkest 1% 51 → 42). CLOUD_SAT and the tints stay
   (decisions).
8. The bird in shade (`giant`) stays a pale blue-grey silhouette, like the shade around it: a sea
   bounce that knows whether the sea under it is sunlit would only darken it.
   Cost (leg 1 against leg 2, interleaved L1 L2 L2 L1 L1 L2, six views, 60 frames, NVIDIA laptop):
   the trace −2 to −4% (`start` −14%, `side`, `close` −4%, `tower` +2%). Shimmer toward the sun up (`start` 0.09 → 0.12%, `sun`, `high2`, `away`),
   elsewhere down. Flights identical.

**Leg 3, done (2026-11-20)** (`screenshots/l2-end` → `l3-sky`, `l3-P2`, `l3-end`; at 1920×1080
`bigS-H2` → `bigS-AM3`):
1. All of a sample's light at the skin's light point: the sky light's falloff with depth (it fell
   with the ramp's depth, so the coarser the trace, the less sky far clouds and the sea's soft
   troughs got), its two taps, the shadow volume's lookup. The raw light between scale 0.5 and 0.75
   (`view=2`, whole frame): `start` 0.89 → 0.48%, `high2` 0.53 → 0.02%, `away` 0.93 → 0.65%; what is
   left (blocks of a 4×4 grid within 1.3%) sits at the horizon and silhouettes, how much a grazing
   ray takes from a wider ramp (halving the view's steps changed nothing). The look: the shade 1–2
   levels lighter, most in the soft troughs (`down`) and far folds (`side`, `high2`).
2. The approach's floor near a surface: a stride s from distance d to d' can miss a crest up to
   (s − d − d') / 2 deep, so there it is 2d plus two outline widths (in the empty-space skip,
   2·bound plus 2.5 pixels): a crest it hops over is grazed at most about an outline deep. Shimmer
   at rest about halved (`start` 0.112 → 0.054%, `tower` 0.163 → 0.091%, `close` 0.163 → 0.083%,
   `geometry` 0.40 → 0.27%); the stills change only at rims. Two pixels everywhere, and more
   refinement at the entry, failed on cost (decisions).
3. Every octave fades by the pixel's footprint (`lod` = the trace's pixel over 52 m), the lobes,
   turrets and small turrets too, from 4 to 2 pixels a cell as the domes did: the far towers' grape
   texture softens past ~40 km (`away`'s horizon; the top edge of `start`'s right tower no longer a
   sawtooth). A coarser trace (phones, dynamic resolution) fades sooner; a finer one no later than a
   270-row trace (`pixC`, trace.wgsl), and the approach's floor (2) follows the same pixel: following
   the finer trace too cost +30% at 1920×1080 (decisions).
   Cost (leg 2 against leg 3, interleaved A B B A A B, 60 frames, NVIDIA laptop): the trace
   +12–15% at 960×540 (`start`, `sun`, `side`, `tower`, `high2`, `close`), +10–12% at 1920×1080
   (all six views). Shimmer at rest down in every view (`start` 0.118 → 0.051%, `close` 0.168 →
   0.086%, `seed3` 0.081 → 0.031%, `sun` least, 0.112 → 0.097%; at 1920×1080 0.4–0.5× leg 2's). Flights identical.

**Leg 4, done (2026-11-21)** (`screenshots/l3-end` → `l4-levels`; `node tools/world/levels.js`):
1. `tools/world/levels.js`: each level's large shapes over boxes, baked on the CPU as the GPU bakes
   them and read trilinear, compared column by column (the top, the heaps, the towers' peaks). L0
   and L1 agree (the top's |Δ| p90 44–66 m). L2 held a third less cloud than L1 over three 80 km
   boxes (its heaps 0.3×; the top −300 to −600 m on average, |Δ| p90 1–2 km), and half the small
   cells' towers standing alone came out under half their height.
2. The coarsest level from the same inputs: its cells grown as the others' but without the pieces
   under 600 m (it took the low pulses' roots alone, ×1.25, and no small cells), and every dome,
   widened and lowered to its cell with the volume kept. L2 against L1: the cloud −4 to −5%, the
   top −70 to −120 m on average (|Δ| p90 0.4–0.5 km), the small cells' towers at 0.7–0.9 of their
   height, none under half (tests/world.test.js holds the heaps). Growing them takes the worker
   about a second more, so it now grows the start's cells while the shaders compile, and a pulse's
   second lift is a replay of the first's log (the same world to the bit): the canvas at 3.5–3.9 s
   (leg 3: 4.1–4.3 s; the player check, interleaved). The fingerprint: L2's columns and bubbles
   alone. Flights identical.
3. Stand-ins for the small bubbles in L2: not kept (decisions). Since step 2 the small cells' towers
   stand there with their heads (≥ 900 m).
4. The dither: at 40–55 km fainter (`anvil`'s far sea between the towers), not gone: L2's 2 km
   columns can't hold a 1 km head or a 300 m dome. At 7–10 km unchanged (`away`'s middle
   distance): across a hard switch from L0 to L1 the depth differs on 1% of the pixels, the raw
   light on 5.6% (L1's light gives the domes less relief). Widening L1's domes less, and the light
   from the finer level, didn't help (decisions; known issues).
   The look: the far sea fuller and higher toward the horizon (`anvil`, `sun`), the backlit far
   towers a shade darker (`sun`, `away`: more cloud beyond them in the shadow volume), a faint
   shaft in the haze (`high2`). Cost (leg 3 against leg 4, interleaved A B B A A B, 200 frames,
   NVIDIA laptop): the trace +4% in `start` and `high2` (rays grazing the far sea meet its heaps),
   `away` −2%, `side` 0; the first bake within the noise; L2's bubbles a block at the start mean
   348 → 388, max 1661 → 1805 (its shifts spread over a few more frames: `bakeCost`). With 60
   frames the same builds came out −25% to +21%: time this laptop over a few hundred frames.

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
  ≈ 5,600 bubbles in a 120 km box around the start, per bake block at most ≈ 1,800 of the 4096 cap.
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
  navy at a fifth of the lit side (reviews: luminous lavender grey, 40–50%); now ×1.2 (AMB_K, 1.4 then,
  went back to 1 once diffusion lit the shade: leg 2). Lifted further (×1.28, AMB_K 1.55), the shade turned periwinkle and the lit
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
- **The haze in the sun's path and the sky** (2026-11: the trace's haze, 2.6e-5/m over 6 km, as
  aerosol in the atmosphere's tables and the sun's colour): the sun at the sea's height ×0.27,
  toward the sun a white veil over half the frame, milky everywhere even at ×2–2.5 exposure. The
  veil stays the trace's alone.
- **Other clouds' shadow on the diffusion as e^−τ** (one rule for a heap 500 m off and 2 km off):
  every heap's shadow a hard blot of paint (`side`, `start`); light diffusing under a surface fills a
  small shadow. Clouds nearby take the direct light; the diffusion only those past ~100 m thin.
- **An all-or-nothing choice in the diffusion** (which step the path leaves its cloud in, the slope
  it crosses there, own cloud or another): flat blots with hard edges across the heap tops (`down`,
  "decals"). A constant slant for light from far off instead: milky, the relief gone. Smooth weights.
- **Column data per light-march step** (the review's bug 8): +10–13% of the trace (A B B A, column
  data alone as much: the samples take the detail branches more often), the change hard to see.
- **The approach's floor at two trace pixels everywhere** (leg 3): shimmer at rest less than half,
  but the trace +27–46% (grazing rays over the sea take every step that small). Only near a surface,
  by how deep a stride can miss (2d plus two outline widths), nearly as much for +8–10%; with half
  an outline's margin instead, +17%. **More refinement at the entry** (6 Illinois steps, not 3):
  shimmer a further 10–20% down for +5% of the trace. **The detail and the strides following a finer
  trace** (lod and the approach's floor by its own pixel, at 1920×1080): `tower`'s lit face in finer
  cauliflower and shimmer 0.3× leg 2's rather than 0.45×, but the trace +30% against leg 2 (the
  domes reaching twice as far +8%, the strides +10%), where capped at a 270-row trace's pixel it
  costs +11%, as at 960×540. The lever, if the author would trade resolution for it: `pixC`.
- **Stand-ins for a tower's small bubbles in the coarsest level** (leg 4: those under its 900 m
  merged into a few ellipsoids over what they reach, as wide as the volume they fill allows): their
  towers in L2 at 0.69–0.79 of their height in L1 instead of 0.68–0.73, the cloud +0.3–0.6%, but
  L2's bubbles a block +12–30% (wider still, at least 1.1 km, about the same). Each tower's head
  (≥ 900 m) already stands there; what is left is L2's 2 km columns shaving a 1 km head.
- **Small domes widened to 0.6 of a cell in the coarse levels** (L0's share, not 0.9): L0 against L1
  |Δ| p90 66 → 48 m, but across a hard switch the render barely changed (`away` 5.6 → 5.4% of the
  pixels differ by more than 2 levels), and coarser cells hold narrower domes as facets.
- **The light from the finer level across a handover** (the light march and the sky taps in L0
  where the dither gave the sample L1): the grain at 7–10 km as strong or stronger: the light point
  lies on the coarser level's surface, a little inside or outside the finer one.
- **CLOUD_SAT 1** (2026-11): lit faces tan (saturation 0.40 → 0.31). **The sky light's tints off**: the
  shade neutral grey (saturation 0.08), on the way to brown. Both stay.

## Known issues and ideas

- **Measured only on one desktop GPU**: NVIDIA, headless, at 640×360, where a short benchmark ran at 60
  fps (capped) with 5.9 ms of GPU time a frame, the clouds at the 0.75 ceiling and no hitches; never on
  phones, integrated GPUs or at full-screen sizes, so frame rate, dynamic resolution and memory there
  are unknown (`?bench` reports them). Only Chrome's WGSL compiler (Tint) has seen the shaders;
  Safari's and Firefox's haven't.
- **The world grows in a worker** (src/worker.js), so new areas no longer stall frames; the page
  applies what it sends within budgets (render/stream.js). The budget's GPU estimate (`bakeCost`) is
  calibrated on one NVIDIA laptop GPU: on a weaker one a shift's bakes still spread over frames, but
  each frame's share takes longer. Startup still waits for the whole first bake; the worker grows
  the start's cells while the shaders compile (the coarsest level's across 524 km take ~2 s in
  Node), and the canvas comes at 3.5–3.9 s in the player check (headless, that machine). The
  generator allocates many small objects (`makeDome` and `lift` dominate profiles). If the bird outran the worker's patch of domes (core/world.js: asked for ≥ 30 s ahead
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
  all carry lobes and turrets alike (since leg 3 the turrets fade from ~40 km, sooner on a coarser
  trace). A real tower shows 2–4 dominant turrets, smaller domes on
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
  and sky light, smooth over tens of metres. **Into the sun** the sea's tops were pale cream, lit by
  the sky; since leg 2 they have form, with a soft bluish patch beside the bird in `start`.
- **The light against its reference** (`node tools/light/reference.js`): an isolated small ball's lit
  side 5× (the trace can't see how little cloud lies behind a billow; on a real cloud, a whole body),
  a tower's shade 3.7× a ball's, 0.6× a wall's (real towers lie between), tops seen with the sun
  behind 1.3–1.8×, faces 0.84×, the glare off tops toward the sun 0.75×.
- **Lit faces darker since leg 2**: `tower`'s 174 → 152, `away`'s lit sea 146 → 114 (luminance), the
  exposure kept at 14 (raised, the glare toward the sun goes milky, decisions): for the author.
- **The bird in shade** (`giant`): a pale blue-grey silhouette, like the shade around it (its keel
  glowed orange from a sea bounce 2.6× the clouds' until leg 1): for the author.
- **Colour and range** (reviews, 2026-11): lit faces apricot (≈ 238,177,116) where a sunset photo
  shows orange to salmon; toward the sun the haze is a milky band over the low sea (`high2`,
  `seed3`). Lit tower faces sit high on the tone curve with their folds filled by the light inside
  (`tower`'s lit face: luminance SD 36 before, 20 now); one review wants deeper darks, another
  wanted the creases lit. Since leg 2: lit faces (190,145,108), saturation 0.43, luminance SD 35; the
  shade (71,67,78) at 45% of them. The levers: sunScatter's DIFFUSE and μ power (fitted to the
  reference: change model.js with them), CLOUD_SAT, the exposure.
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
  sea): pixels dither between two levels; the history averages it at rest, 12-frame captures show
  it. At 40–55 km fainter since leg 4: the levels' shapes agree to ~0.1 km (p50), and what is left
  is L2's 2 km columns. At 7–10 km the shapes agree (across a hard switch the depth differs on 1% of
  the pixels) but the light doesn't (5.6%): L1's gives the domes less relief. Levers: blending
  (+12–18%, decisions), the handover farther out (L0's window reaches ~14 km), what in the light
  follows the level (the light march's first steps and the billows read the level's distance).
- **Sunlit rims**: with nothing moving 0.02–0.10% of a frame flickers (`geometry` 0.29%; leg 3 halved
  it: strides no longer hop over crests by the jitter), along tower silhouettes against the sky and
  backlit rims, most toward the sun (`sun`). The history blends at half the rate where the image
  holds still. The slower blend may lag or smear in slow motion: for the author's eyes. The cloud
  scale, the TAAU clamp and blend rate, and the approach's floor (trace.wgsl) are the levers.
- The `skim` view (170 m over the sea's top) shows nothing but haze: the billows rise higher than that
  there, so the bird is inside them. Its brief wants billows up close; a pose a few hundred metres
  higher would show them.
- Values JS and WGSL both keep as literals of their own: the sun-colour table's 750 m steps, the high layers' heights, the offsets of struct Probe's fields read back (CLAUDE.md §8 wants them from `constants.js`).
- A WebGPU validation error shows no note (left out: a harmless one on a browser never tried would stop
  the piece); the tools hear every one.
- Nothing publishes until main's first verified build makes the "latest" release; until then every
  deploy stops before publishing and the old site stays up.
- `tools/linux.js` is untried (Docker wasn't running).
