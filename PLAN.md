# Plan

What a session needs beyond [CLAUDE.md](CLAUDE.md) (the vision, the rules, how to work a request):
what was tried and failed, and why, and what is still open. Keep it short and current: an approach
that fails goes in the decisions with why and when (evidence for later, not a rule); a fixed issue
comes out. How things work belongs in the module headers, how to work in CLAUDE.md.

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

**Leg 5, done (2026-11-21)** (`screenshots/l5-before` → `l5-after`, the variants `l5-p30w60`,
`l5-p50w20`, `l5-p65w30`; `node tools/light/reference.js`):
1. The medium in constants.js (σ, and its profile, shared by the shaders and the reference): a step
   at the surface to half the full density, rising to all of it 40 m in; the outline's ramp and
   the erosion's 6 m as before, nothing outside the surface. Every depth the light takes is a depth
   of full density (`profileDepth`): the light march's steps by the profile's mean over them, the
   diffusion's leak, the powder, the sky light's falloff, the smallest billows' faces, and the
   skin's mapping from the outline's ramp, now exact for a ramp of any width (it drifted 5% at
   16 m: tests/light.test.js holds 1–64 m). So a flat face or a slope looks as in a uniform medium
   (model.js within 0.4%); only shapes the size of the profile change. Tops lit at 5° come out
   +5–12% (the light march's fixed 10 m first step and 3 m blur meet the light point deeper). The
   trace's strides inside cloud grow with the depth of full density too: by the depth in metres,
   the thin edge took more steps, each lit afresh (the trace +7–15%).
2. The reference's Monte Carlo through the profile (delta tracking; the sun's optical depth in
   closed form, tests/light.test.js). Against the uniform medium: slabs the same (as theory says), a
   tower's edge +12%, a 150 m wall lit from behind +15%, a 100 m ball's lit side −13% and shaded
   side +15%. The trace follows it as before (rms 1.54× over the views, the isolated small ball
   aside): tops toward the sun 0.73–0.89 → 0.83–0.95, a tower's edge 0.77 → 0.85, a small ball's
   edge 1.53 → 1.75.
3. The look: the near sea's rims toward the sun glow broader and brighter (`sun`, `start`'s near
   sea), the folds lighter (`tower`'s lit face: darkest 1% 67 → 79, luminance SD 39 → 36; `close`
   42 → 40), side-lit heaps' domes a little softer (`start` right of the bird). A far backlit tower's
   rim a shade warmer (`seed3`), but at 20 km a trace pixel is 60–80 m: the profile can't widen its
   silver lining (`sun`'s right tower, `anvil` hardly change). `inside` unchanged: the camera sits
   hundreds of metres deep. Shimmer at rest down in every view but `skim` (0.019 → 0.052%, inside
   the billows' haze). Flights identical but `skim` (the bird's in-cloud test reads the density:
   0.2 m). Cost (leg 4 against leg 5, interleaved A B B A A B, 200 frames, NVIDIA laptop): the trace
   −5 to +2% (`start` −4, `sun` −2, `side` +2, `tower` −3, `high2` −5, `close` −2); the bakes
   unchanged. The canvas at 3.6–3.7 s (the player check).

**Leg 6, done (2026-11-21)** (`screenshots/l5-after` → `l6-s12`, `l6-s3`, `l6-after`; `node
tools/world/stats.js`, `catalog.js`):
1. Flat tops: stats.js counts them (the top bubble's ryU/rh under 0.45): 15% of the towers within
   150 km, but 86% of the heads that stopped over 1 km past `el` and 92% at the ceiling; within 1 km
   of `el` none (a tower's head there is pressed by `stabTall`, which hardly feels the jump). So a
   continuous buoyancy at `el` changed nothing (decisions). The overshooting heads were pressed by
   stable air normalised to 0.5 m/s² and spread with age whatever stopped them: now 1.0, and a head
   spreads as far as the air that stopped it is stable. Flat tops 15 → 8% (past `el` by over 1 km
   86 → 25%, the ceiling's anvils 77%); towers a little taller (tops over 9 km 65 → 68, over 6 km 181 → 177). `start`'s
   main tower has a domed top where it was a slab, `seed3`'s great lens broke into domed masses (one
   flat lens left at its right end, against the haze), `close` frames a whole cauliflower tower.
2. Mushrooms, measured by cross-sections (a tower's widest section in its upper third against its
   narrowest in the middle third): half the towers over 5 km had a top 1.6× their column's area, 15
   over 4× (one 52 km² on 4 km²). Not ice (most sit under 8 km): a head is the youngest and biggest
   piece of a pulse, the column under it a chain of older, smaller wake lumps that evaporate first.
   Each wake lump now knows its head, and a head evaporates at least as far as the middle of its
   column (the lumps above its lowest third; a crown as its parent): tops over 4× their column 15 →
   1, over 2× 95 → 78 (the ratio p90 3.1 → 2.7). Tying ice's life to the column alone changed nothing.
3. Envelopes without a new primitive: the bake already blends each bubble by its own radius, so a
   tower's wake lumps now blend by 0.9 of their size (0.35), into one widening trunk, and crowns into
   the heads they burst from by 0.7 (0.3–0.45): the side views (catalog.js) lose most of the
   clusters of small balls, the levels agree a little better (L0 against L1 |Δ| p99 276 → 209 m),
   the cloud +3%. What still reads as balls: the biggest heads, and small crowns on them. Flights
   identical (the fillets touch only towers' bubbles).
4. Billows without a lattice: not kept (decisions).
   Flights (all four steps): `dive` and `skim` up to 1.4 m (the sea's heaps spread less), the rest
   within 0.1 m. Cost (leg 5 against leg 6, interleaved A B B A A B, 200 frames, NVIDIA
   laptop): the trace −7 to +8% (`start` −1, `sun` +1, `side` +8, `tower` −3, `high2` −7, `close` +8:
   a whole tower in view now, `giant` −5), as the scenes changed; the bakes within their noise (the
   same bubbles, 6,030 → 6,027 in the 120 km box).

**Leg 7, done (2026-11-22)** (`screenshots/l7-before` → `l7-after`; the light checked against a fine
march of the same cloud, in place of `?dbg=2` and not kept: from the point toward the sun, cloudSDF
at lod 1.2, 25 m steps to 5 km, 50 m to 20 km, 200 m to 150 km, the profile's density where d < 0
once the march has left the point's own cloud):
1. The sun map (render/sunmap.js): texels along the sun's rays, 64 m across, 32 m apart in height,
   320 m along, over a window of 16 × 20 km around the camera and all heights, each the light that
   the clouds past the one it sits in let through toward the sun (their shadow; the light diffusing
   through its own cloud stays the light march's). The light march keeps its first three steps
   (~90 m, the view's detail); other clouds from there to ~1.4 km come from the map (as the
   march's soft shadow: the octaves and the diffusion's otherD), those past it too (e^−τ on all,
   the shadow volume's part before); past the window, the march and the shadow volume as before.
   The map holds the billows a texel can (the turrets and the 320 m domes). Those drifted with the
   wind (3.5 m/s, rising 0.9 m/s; the detail volume's 5.6 and 2.2 m/s), which made the map bake
   again all the time; the author: nothing has to drift, for now. So the clouds hold still (the
   shape volume's lookup kept half a tile up, where it lay in every capture: its vertical wrap was
   13.5 periods, so the drift's first frame put it there), and the map is baked once where it
   lies: anew when its window moves to the camera (~2 km of flight), two columns a frame over
   128 frames, keeping what both windows share. Memory 14 MB, and under 1 MB of buffers.
2. Against the fine march: in `start`, `side`, `down`, `away`, `giant` and `tower` the same tops lit
   and shaded, the map's edges softer (its texels, and four taps: a penumbra of ~3 km). What the old
   light got wrong: a heap hundreds of metres off shaded a copy of itself where one of the march's
   far points hit it; the shadow volume's 768 m texels put `tower`'s cast shadow a few hundred metres
   off, soft; and nothing held the billows 1.4–40 km toward the sun, which at 5° shade much of the
   near sea (`start`'s heaps right of the bird, `side`, `down`: in shadow now, as the march has
   them). Past the window's sunward end the map's own march sees the billows too (through the large
   shapes alone it left those heaps lit). The shadow volume (far receivers, the own cloud past
   6.3 km) is unchanged.
3. The look: cast shadows sharper and where they belong (`tower`'s lower face, a clean diagonal);
   long shadows across the sea (`away`, `giant`); fewer golden heaps in `start`, `side`, `down`
   (they lie in shadow); `skim`'s fog sunlit, warm brown where it was mauve grey (it lay in a shadow
   that isn't there). The blotches on `close`'s tower face hardly change: they are its lumps'
   own shade, the march's first steps. Distant towers (`seed3`, past the window) unchanged.
   Shimmer at rest `tower` 0.070 → 0.089%, `away` 0.031 → 0.037%, `skim` 0.052 → 0.007%, the rest
   within ±0.01. The clouds holding still, the shimmer at rest is measured on the clouds the stills
   show (its frozen clock had left the lobes half a tile lower): `tower` 0.111%, `geometry` 0.35%,
   `down` 0.031%, the rest 0–0.07%; a new baseline, not more flicker. Flights: the map alone left them identical; the clouds holding still, `skim`
   differs by up to 2.3 m in height, `dive` and `weave` by millimetres. Cost
   (leg 6 against leg 7, interleaved A B B A A B, 200 frames, NVIDIA laptop): the trace −4 to +6%
   (`start` −1, `sun` +4, `side` −2, `tower` +6, `high2` −4, `close` +4, `away` +4, `down` −3: two
   lookups of four taps a light march, and the scenes' light changed); the map 0.11–0.15 ms a frame
   while it bakes (a slab; by the difference to a page that bakes none), else nothing; its first
   whole bake 18–30 ms, once. The
   canvas at 3.9 s (the player check; 3.6–3.7 s in legs 5–6, not timed interleaved: three more
   pipelines to compile, the first map).
4. Failed on the way (decisions): the optical depth interpolated, a soft edge, the lookup snapped
   to a texel, one walk a ray.

## Decisions: what failed, and why

What was tried and didn't work, why, and when. **A decision is evidence, not a rule**: when its
cause no longer holds (the code it was tried on has changed since), try again; that is what the
cause and the time are for. *Before the legs* means before the review's legs (2026-11-20 on): the
light and the medium then were the ones legs 2–5 rebuilt (the light march, the diffusion fitted to
a Monte Carlo, the medium's profile), and the world the one legs 4 and 6 changed, so a verdict on
light or colour from then is the likeliest to have gone stale. The author's own words are taste:
they hold until the author says otherwise.

### The world

- **A smooth "sand dune" sea** (before the legs, the author): billow strength tied to restlessness
  (≈ 0 over most of the sea) and ridged noise (`1 − |n|`) made smooth hills with sharp crests. The
  sea always overturns: strength ~1 everywhere, `|n|` (rounded tops, creases).
- **The air's levers on towers** (before the legs): an inversion too strong in moderately restless
  air left towers only at I ≈ 1 (too few, too small), too weak "foam walls" of medium heaps; an
  equilibrium level by I^1.5 kept almost every tower mid-level (I^0.5 with `deep` lets giants reach
  the ceiling); subsidence weaker than now (SUB_R 2.0, half the effects) made walls of medium towers.
- **A continuous buoyancy at the equilibrium level** (leg 6): tops flatter than 0.45 15 → 13–14%
  however it was shaped (no head near `el` was flat), and the big pulses overshot into heads of
  4 km radius (a 13–15 km slab over `start`), or with less energy below `el`, 10% fewer towers over
  6 km. **Ice tied to the column's life**: no change, the wide tops sit under 8 km.
- **Rounder heads** (before the legs): rounder everywhere, the sea's heaps grew taller and steeper,
  into the slope limit's boxes (`geometry`'s pointed cube); crowns rooted into the head they burst
  from became narrow columns (battlements in `high2`, polyhedra in the coarse volume); pressed very
  round (stable air at a fifth), a head under the ceiling turned a pill with sky beneath it (`seed3`).
- **Heaps at the slope limit** (before the legs): 2D domes steeper than the volumes' slope limit
  came out cones; a heap grown on another came down to the sea past its parent (h/r up to 2), its
  profile dropping most of its height in its outer third, and 40% of heaps met the limit, cut into
  flat faces with straight corners (a box in `side`). Rounding the narrow valleys' floor, or a
  limiter over 16 directions, changed nothing: the limiter wasn't what showed.
- **Shards and floating heads** (before the legs): small bubbles in 512 m cells became polyhedral
  fragments; dropping small pieces one by one left heads floating without their wakes.
- **The start's clearance as a radius** (2·P·1.7 + 2.5 km, before the legs) emptied 10–20 km. A
  huge tower right ahead of the start blocks the sunset and is dull, backlit.
- **The bubble budget** (before the legs): the bake loops over every gathered bubble per texel; a
  first try with 14 times as many bubbles would have swamped it (stats.js prints the load).

### The billows and the edge

- **Billows of spheres** (before the legs, the author: "a 3D render of foam and clay"): four sphere
  lattices made every bulge a ball with its own highlight (bubble wrap on tower walls, balls under
  overhangs), and detail only on the 640 m lobes' caps left the near sea smooth dough. Near the
  camera (80 and 40 m) a sphere clipped to its shell, with crisp rims, is a flat disc glowing evenly
  (bokeh).
- **Billows without a lattice** (leg 6): spheres of power-law sizes, sparse and clustered, as much
  surface covered: the near sea smooth swells with lone small balls (`start`, `down`); milder, still
  smoother, with compact puffs floating over heaps (`giant`), the far grape texture unchanged.
- **Billows of one size on every bubble** (before the legs, the author: "puffs all one size"): a
  400 m crown carried lobes as big as a 4 km head's, one stamped texture. Without the 640 m turrets
  a surface reads as smooth dough (`start`'s near sea, `side`); a billow scale for heaps by their
  height took the heaps' turrets: dough again.
- **Shells and density** (before the legs): bulges far flatter than wide (shell ≈ 1/6 of the radius)
  read as smooth swells, 1/3–1/2 as cauliflower; a sparse field leaves bare pits, dense everywhere
  sponge; dense large and looser small, the small lower and fading with distance, cauliflower.
- **Paraboloid domes** (before the legs) read as gentle hills, no outline against the dome behind.
- **Taller 320 and 160 m domes** (×2, before the legs): bubble wrap on towers a few km off
  (`close`); without `dome`'s fade, lit balls floating over the sea.
- **The finest domes clustered on the turrets' caps near the camera** (before the legs): the near
  sea went doughy (`away`, `side`); unclustered past ~1.5–5 km they read as a carpet (frogspawn).
- **Fewer billows under bellies and overhangs** (by the large shapes' slope, before the legs): flat
  shelves where the slope steps between the volume's layers, and big lobes turned smooth boulders.
- **The largest lobes in cloudSDF** (2560 m cells, before the legs): their 500 m in the skip bound
  cost the trace 40–80% near towers; on the sea they raised new towers before the camera, on
  fragments balls floating in the sky.
- **Erosion as form** (before the legs): 30 m of noise eaten into the edge read as out of focus,
  frozen and at full resolution alike, because the light never sees it; form belongs in the
  distance field, where the light march and the sky taps see it.
- **Soft rims** (before the legs, σ 0.035/m): a 30–80 m ramp, erosion as a share of it: near clouds
  out of focus (a full-resolution trace looked the same). An outline of 2 pixels instead of 1.25
  hardly calms the shimmer and gives the softness back.
- **A thinner edge** (leg 5): 30% of the density at the surface, full 60 m in: the near rims glowed,
  but side-lit heaps turned soft pillows and `close`'s domes washed out (a 20–60 m dome lets the
  light through); 65% over 30 m kept the domes and hardly lit the rims. The edge's thinness and the
  domes' crispness are one lever, the author's (CLOUD_EDGE0, CLOUD_EDGE_W).

### The light

- **The light balance** (before leg 2's light): sky ×1.95 and a warm sea fill in every direction made
  shade nearly as bright as sunlit faces (milky, flat; the darkest 1% at sRGB 80–105). At 5° the
  sky gives a lit face's light /20–40. Light not scaled by how squarely the sun enters lit grazed
  tops as brightly as faces turned to it. The sea's warm bounce at full weight on downward facets:
  dirty brown blotches.
- **The scale of a surface's facing** (before leg 2's light; its rebuild kept the principle): over
  15 m every small crease went dark (pumice); the diffusion by the facing over 60 m darkened every
  crease (dough) and lit a tower's far side orange (brown shade); a diffusion floor of 0.35 on faces
  turned from the sun made shade brown.
- **The light march's jitter** (before the legs): each step at a random point per pixel flipped in
  and out of a bulge beside the path: the screen-door on near clouds. Averaging each step's
  occupancy instead darkened the sea's lit tops (the path skims them; the air above counted).
- **One channel for all the cloud toward the sun** (before the legs, the shadow volume): e^−τ
  through the cloud a point is in blacks out the inside of clouds, as light diffuses through one
  body (~1/(1+0.11τ)): its own cloud and the others are two channels since. Its own channel in
  768 × 360 m texels banded shaded tower faces; march steps hundreds of metres long hit or miss
  other clouds by the jitter (speckled, weak cast shadows).
- **Other clouds' shadow on the diffusion as e^−τ** (leg 2): one rule for a heap 500 m off and
  2 km off made every heap's shadow a hard blot of paint (`side`, `start`): light diffusing under
  a surface fills a small shadow.
- **An all-or-nothing choice in the diffusion** (leg 2: which step the path leaves its cloud in,
  the slope there, own cloud or other): flat blots with hard edges across the heap tops (`down`,
  "decals"); a constant slant for light from far off: milky, the relief gone.
- **Column data per light-march step** (leg 2): +10–13% of the trace, the change hard to see.
- **The light from the finer level across a handover** (leg 4): the grain at 7–10 km as strong or
  stronger: the light point lies on the coarser level's surface, inside or outside the finer one.
- **The sun map, first tries** (leg 7): the optical depth interpolated between texels put a
  shadow's edge where a tenth of the way to the deep one was, a staircase (store the light that gets
  through); the cloud's edge blurred over 64 m, at 5° a ray passing over a heap's top runs within
  the blur for hundreds of metres: shadows as if from clouds 30 m taller, the near sea dark; the
  lookup snapped to a texel: blocks near the camera; a step's share inside from a distance and its
  slope took a bound beside a distance for a steep slope (cap the slope at 1).
- **Fold occlusion** (before leg 2's light): a tap up and back toward the camera; a 0.2 floor turned
  shade into gravel; a tap straight up can't tell a fold from a wall.
- **A fringe outside the surface for silver linings** (before the legs, thin cloud 40 m out, lit
  forward): rays toward the sun skim the sea's tops through it for kilometres (glowing veils; capped
  per ray, sheets with hard edges, like film).
- **The in-cloud mist's variations near every cloud** (within 900 m of the camera, before the legs):
  near surfaces fogged.

### Colour, haze and tone

- **The shade's colour and the film's saturation** (before leg 2's light, and leg 2): saturation in
  the final pass turned the golden haze toward the sun into an orange dust band; shade ×1.45 blue at
  ×1.3 saturation was navy at a fifth of the lit side (reviews: luminous lavender grey, 40–50%);
  lifted further (×1.28, AMB_K 1.55) periwinkle, and the lit towers lost their folds (`tower`'s
  luminance SD 36 → 18). Leg 2: CLOUD_SAT 1 made lit faces tan (saturation 0.40 → 0.31); the sky
  light's tints off, the shade neutral grey, on the way to brown.
- **Aerial perspective per channel** (before the legs): toward the sun all sank into blue, though
  that sky is golden because its blue was lost on the long path.
- **The haze in the sun's path and the sky** (leg 2, as aerosol in the atmosphere's tables): the sun
  at the sea's height ×0.27, a white veil over half the frame toward the sun, milky even at ×2–2.5
  exposure.
- **Exposure and the tone curve** (before the legs): exposure 17 (16.5 too), or ACES alone, washed
  the glow toward the sun into a milky veil; a curve per channel from the mid-tones up made sunlit
  orange tan, sandstone (sRGB 200,165,127).

### The trace and its cost

- **The approach's floor at two trace pixels everywhere** (leg 3): shimmer at rest halved, the trace
  +27–46% (grazing rays over the sea take every step that small); near a surface only, nearly as
  much for +8–10%. Six refinement steps at the entry, not three: shimmer 10–20% down for +5%. The
  detail and the strides following a finer trace (1920×1080): finer cauliflower and less shimmer
  for +30%; capped at a 270-row trace's pixel, +11%. The lever, if the author would trade
  resolution for it: `pixC`.
- **A generous billow bound** (before the legs): `shellOf` 460a + 150 cost ~10% more than 400a + 120,
  no visible difference. Crisp rims cost nothing.
- **TAAU at rest** (before the legs): a wider clamp box alone barely calms crisp rims; the blend rate
  is what flickers (a rim pixel swinging ~150 levels × α 0.05).
- **Blending the clipmap levels over a handover** instead of the dither (before the legs): no
  lattice, but the trace 12–18% slower in every view, also blending over 7–10 km alone, also
  reading the second level only near a surface.
- **The clipmap levels in one stacked 3D texture** and a 2D array of column maps (before the legs):
  the trace 5–7% slower, the stacked z shifting the filtering (up to 10 levels).
- **The billow scale in the distance volume** (rg16float, before the legs): the trace 2–12% slower
  from the format alone (the empty-space skip reads it everywhere); blended over a distance growing
  with the cell size, the levels disagreed and the handover lattice grew (`side`).
- **Stand-ins for a tower's small bubbles in the coarsest level** (leg 4): their towers in L2 at
  0.69–0.79 of their height in L1 (0.68–0.73 without), L2's bubbles a block +12–30%.
- **Small domes widened to 0.6 of a cell in the coarse levels** (leg 4): L0 against L1 |Δ| p90
  66 → 48 m, the render across a hard switch barely changed; coarser cells hold narrower domes as
  facets.
- **Tried, no visible gain** (before the legs): the HG + Draine droplet phase (deep scattering and
  the glare dominate); jitter animated by position (Jimenez; shimmer rose a little); sharper TAAU by
  the nearest sample (motion smear can't be judged in stills).

### The GPU

- **The distance-volume bakes as compute shaders** (before the legs): no faster than the fragment
  pass writing 8 slices at once, often slower: it looks at each bubble once for all 8. The shadow
  volume (one long march a texel) is ~2.5× faster as compute.
- **Long serial work in few invocations** (leg 7, the sun map's walk a ray): two columns took as long
  as eight (0.3 ms), the GPU waiting on one texture read after another; spread over many
  invocations, it costs by the work.
- **The ambient light as a read-only storage buffer in the trace** (before the legs): ~4% slower than
  a uniform buffer (Chrome on Windows, FXC).

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
- **Mushroom tops**: fewer since leg 6 (a head evaporates as far as its column), but a live cell's
  top still spreads to twice its column's width in places (a tower 140 km from the start:
  30 km² over 7–10 km²): its pulses' heads drift apart with the wind's shear while their columns
  stay narrow (wake lumps 0.43–0.6 of the bubble's radius). Leg 6 measured it with a scratch
  script (each tower's widest section in its upper third against its narrowest in the middle
  third): worth a place in stats.js if this is worked on again.
- **Close-up surfaces** of towers can look blotchy in low sun (`close`): since leg 7 not from other
  clouds (the sun map casts their shadows as streaks, where they belong) but from the lumps' own
  shade, the light march's first ~90 m. **Past the sun map's window** (8 km across the sun's way,
  8 km away from it, 12 km toward it) the shadow volume's 768 × 360 m texels still decide: distant
  towers (`seed3`, ~40 km) show stair-stepped tops and blob-shaped patches, and the far sea misses
  the billows' shadows the near sea has (a fade over 1.5 km at the window's edge). A coarser level
  of the map would reach them: the memory (14 MB a level) and the bake are what it costs.
- **The clouds hold still** (2026-11-22, the author: nothing has to drift, for now): the billows and
  the detail drifted with the wind and rose (frame.js until leg 7), and the sun map holds the
  billows. Drift brought back, the map has to be baked all the time (0.11–0.15 ms a frame, and it
  lags the billows by its cycle: 2 s, 7 m at 60 fps); or it could hold the large shapes alone, and
  the light march the billows' shadows near by.
- **Popcorn far away**: towers 20–60 km off still read as one grape texture (`start`'s right
  tower, `high2`, `giant`, `away`'s horizon): their bubbles are big (billow scale over ~800 m), so
  all carry lobes and turrets alike (since leg 3 the turrets fade from ~40 km, sooner on a coarser
  trace). A real tower shows 2–4 dominant turrets, smaller domes on
  their upper, sunward shoulders, older parts smoother. Ideas: more spread in the billow scale per
  bubble, the liveliness stronger (the lattice's spheres at power-law sizes failed, decisions).
  **Crowns perched on heads** read as knobs (`start`'s middle tower, a "teddy-bear head" in a
  review; `catalog.js`): small bubbles sitting on big ones; since leg 6 joined by a fillet their
  own size, the smallest still knobs. **Sunlit turret tops in shade** read as floating puffs (`start` beside the bird,
  `sun`, `tower`, `away` right of the bird, bigger since the detail volume turned in leg 1):
  attached (`?dbg=1`), their base melts into the shade.
- **Tops**: tower heads keep their domes unless they hit the ceiling (since leg 6 also those that
  overshot far: tops flatter than 0.45 on 8% of the towers, most of them anvils); `seed3`'s great
  cap broke into domed masses, one flat lens left against the haze at its right end. Deep folds between lobes go near black
  (`tower`, `close`: a navy pit).
- **Silver linings** of far towers are a pixel wide: a backlit tower's edge 10–20 km off doesn't
  blaze (`sun`'s right tower, `anvil`). Since leg 5 the near sea's rims toward the sun glow; a far
  tower's lie within a trace pixel (60–80 m), where a real edge's wisps and the profile both are: a
  fringe outside the surface failed (decisions). What might: thin cloud by the pixel's footprint
  (the sub-pixel wisps' average) where the outline ramps up.
- **Inside cloud** is a uniform wall (mauve grey, `inside`; the medium's profile reaches 40 m in,
  and the camera sits hundreds of metres deep), even with the exposure adapting to the
  mist (the probe's estimate runs brighter than what the trace draws there, so the gain stays low);
  the mist streams past only as the bird flies. `under` (an anvil's underside) is dark navy now: right
  for shade at sunset, but judge it against its brief.
- **`close` nearly repeats `tower`**: since the tower heads are rounder (2026-11) the first spot
  clear of the tower's bubbles (presets.js, clearOf) is near `tower`'s pose, so both frame the same
  flank; neither looks up a flank from below. A view of its own would need another spot or tower.
- **Near the camera** the sea into the sun is still soft, glowing mush (`start` lower left, `seed3`),
  and the shaded sea seen from above blotchy (`giant`'s foreground): the light there is diffusion
  and sky light, smooth over tens of metres. **Into the sun** the sea's tops were pale cream, lit by
  the sky; since leg 2 they have form, with a soft bluish patch beside the bird in `start`.
- **The light against its reference** (`node tools/light/reference.js`): an isolated small ball's lit
  side 5.7× (the trace can't see how little cloud lies behind a billow; on a real cloud, a whole
  body), its edge 1.75×, a tower's shade 3.4–3.7× a ball's, 0.6× a wall's (real towers lie
  between), tops seen with the sun behind 1.2–1.9×, faces 0.83×, the glare off tops toward the sun
  0.83–0.95× (leg 5's medium).
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
