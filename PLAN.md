# Plan

What a session needs beyond [CLAUDE.md](CLAUDE.md) (the vision, the rules, how to work a request):
what was tried and failed, and why, and what is still open. Keep it short and current: an approach
that fails goes in the decisions with why and when (evidence for later, not a rule); a fixed issue
comes out; finished work gets a line or two under Done. How things work belongs in the module
headers, how to work in CLAUDE.md.

The next work is planned below: legs 13 to 22, from the review of 2026-11-25. A leg that is done
moves to Done in a line or two, and what it tried and dropped goes in the decisions.

## Next: legs 13 to 22

From a review of 2026-11-25 (every view at 960×540 with its flight strip and held-still frames,
ranked before this file was read, and a second reviewer who saw only the images) and the author's
answers to it. Its verdict: **no view passes as a photograph.** Four or five toward the sun pass as
paintings (`sun`, `gap`, `backlit`, `climb`); away from the sun, up close or inside, the piece
reads as popcorn, rock, navy fog or a blank card. What holds: the image is steady, and the world's
map is natural (clusters, open stretches). Not judged: motion past 1.75 s, steering, frame rates.

### What hurts, most first

1. **Up close a cloud is blank**: within about a kilometre a smooth gradient with a clean, soft
   edge (`skim`, `past`, `exit`, the near sea). The author: it may stay smooth, as it is in
   nature; what it lacks is unevenness, not detail. → 16
2. **Away from the sun the picture is underexposed and the shade navy**: under luma 96 (of 255)
   `side` 80% of the frame, `down` 73%, `belly` 86%, `under` 100%; nothing over 200 in `away`,
   `side`, `down`. → 13
3. **What the clouds are built from shows**: lit towers are bumps of one size (`giant`, `tower`,
   `start`), the sea from above discs (`high2`), hazy faces ring outlines; no edge is ragged, so
   surfaces read solid: popcorn lit, rock in shade (`belly`, `turn`). → 16, 17, 18
4. **Inside and under cloud**: `inside` an even tan card, `entry` a cobalt wash, `under` murk. A
   tower is 20 s to two minutes of card at cruise. And the way in (the author, in flight): the
   screen changes drastically as the camera goes into cloud, even at an edge or in a small one.
   → 19
5. **The towers are never reached, and at the start nothing moves**: those in `start`'s frame
   stand 28–50 km off (seven minutes and more), the nearest (9.8 km) out of frame; a 10 km head is
   6.4 minutes of held climb; the clouds drift 15 px a second. → 14
6. **Scale and distance don't read**: `giant`, 20 km off, looks like a mound 50 m away; toward the
   sun haze empties the middle of the frame and cuts towers off their bases (`high2`, `seed3`).
   → 17, 18, 20
7. **Framing**: the bird centre-low at one size; on a phone held upright the start has no sun in
   frame and its lower 40% is navy. → 13, 14, 15
8. **The bird reads as a white dart** (no fold showing), a ghost in shade and fog. → 15
9. **The sky**: its streaks all run one way; overhead mauve-grey; opposite the sun teal, where a
   photograph has rose; backlit rims don't blaze. → 16, 20
10. **The anvil is a mesa**: a lumpy plateau, no fibrous ice, no glow. → 21
11. **Artefacts**: a straight vertical edge (`past`, 1 s on), a blue outline around near lit cloud
    (`gap`), a checkerboard on thin far cloud in the first half second (`away`), a stair-stepped
    fog edge (`exit`), orphan puffs and knobs. → 14, 16, 22
12. **Loading** is an unlabelled gradient. → 22
13. **The giants on the horizon look like "chess pieces planted on a chess board"** (the author;
    `away`, `anvil`, `sun`). → 14, 17, 20

The author's rulings with it: the sun may stand higher than 5°; where "physically right" and
beautiful part ways, beautiful wins, and it stays realistic; no reference photographs (none is
perfect, and the piece would be fitted to the few that were chosen); sound and a sun that sets are
out for now.

### How the legs run

The legs are done in the order they stand in, by the session that takes them up: nobody picks
the next one. Their descriptions are a plan, not rules: a session changes a step or a leg, or
drops it, where it no longer makes sense, and says here what it did instead and why. If the order
itself should change, the legs are moved in this file, so it always reads in the order of the work.

Why this order: before anything, the edge's trial is measured, because two other legs lean on
it. Then the three that change every capture, so the cloud legs after them compare
against captures that hold: the light and the exposure (13), the world around the start (14), the
camera (15). Then the clouds, the heart: their edge (16: the top finding, and an experiment speaks
for it), their shapes (17), the light on both (18). Then in cloud (19), the air and the sky (20),
ice (21), loose ends and the review again (22).

- A leg's first step is its cheapest experiment.
- What a cloud leg costs the trace is measured (`node tools/cost.js`) and said; where it is too
  much, the finest detail gives way first (CLAUDE.md §9).
- **Devices with each cloud leg (16 to 20), not at the end.** The phone runs the clouds at their
  floor, blurry already, and a soft edge there may only be more blur. The views a leg touches are
  judged at the floor too (`--scale 0.22`) and at 1920×1080, and when the leg is handed over the
  author is asked for `?bench` on the phone from its preview.
- After 15 and after 18, the review's method again: every view, and a reviewer who sees only the
  images.
- Taste stays the author's (CLAUDE.md §11), shown with a recommendation when its leg comes; where
  the answer can wait, the leg goes on with the recommendation. The sun's height and warmth (13);
  how near the first tower, and how the bird gets up one (14); the bird's size in the frame (15);
  whether shreds are missed in flight (16); minutes in fog (19); layers at other heights (20); a
  title while loading (22).

### Before leg 13: the edge's trial, measured

Leg 16 answers the top finding, and its trial was only looked at: its cost and its motion are
unknown. Fine sampling near surfaces has cost the trace +16 to +58% there before (decisions), and
legs 14 (a lower start) and 19 (the fog near a surface) lean on it. So first, on a scratch branch
and not kept: the trial again (leg 16 has it in words), then `node tools/cost.js --against HEAD`
on `past`, `gap`, `skim`, `close` and `start`, its grain, shimmer and motion strips, and its look
at the clouds' floor (`--scale 0.22`) and at 1920×1080. What comes out is written into leg 16: its
budget; or a cheaper way to the same edge (coarser steps, a nearer limit); or that near cloud
stays as it is, and what that changes in legs 14 and 19.

### Leg 13: the photographer (the sun's height, the exposure, the film)

Every heading exposed as a photographer would. Cheap, and every later leg is judged under it.

1. **Instruments** (tools/measure.js): a view's *tone* (the share of the frame under luma 96 and
   over 200, the colour of its darkest third and its brightest tenth), a crop's *texture* (its
   contrast octave by octave: beads of one size are a bump in it, a blank gradient a steep slope),
   a strip's *motion* (the share of pixels that change over it). They guard and don't steer: their
   limits come from rows the author has approved.
2. **The sun's height**, behind `?sun=`. Everything follows `SUN_DIR` (tried with one line of
   constants.js): at 8° the sea is sunlit and `side` and `down` lose their navy, but the gold thins
   and the view into the sun whitens; at 10° it is afternoon. Rows between 5° and 8° for the
   author, as they come and with the warmth put back. After the choice the light's reference and
   its tests are made again (the Monte Carlo is one sun's), and `sunScatter` is fitted to it at
   the new height (`node tools/light/reference.js` says how far off it is): legs 16 and 17 are
   judged under this light. Leg 18 fits it again, once the edge and the shapes have changed.
3. **Metering**, in cloud and out: shaders/exposure.wgsl has the frame's log-mean, and follows it
   only in the camera's fog. Tried: at `?exp=22` (14 ships) `away`, `side`, `down` and `giant` turn
   luminous, but `tower`'s and `close`'s lit faces wash out and `under` is murk still. So by the
   frame, not by the heading, with the highlights held. The test mode stays deterministic.
4. **Dodging** (a region of shade lifted, as in a darkroom), if metering leaves one dull.
5. **The film**: the curve's toe, the split tone, the shade's tints (lavender needs red).

Judged by the sheets and by the author in flight (nothing pumps in a turn through the sun); `sun`,
`gap` and `backlit` stay as they are. Heed: exposure 17 and ACES alone were milky toward the sun,
saturation in the final pass an orange dust band, a curve per channel tan.

### Leg 14: within reach (the start, the way up)

A tower ahead that the bird reaches in a minute or two and climbs in a few more; something moving
past from the first second; no board of chess pieces.

1. **The spawn draw** (world/cells.js) asks for a strong cell's flank 5–9 km ahead, beside the sun
   and in frame on wide and tall screens, and for towers at every range in every quarter but the
   sun's. Today the start lies in a calm hole: behind it nothing over 6 km stands for 60 km, then
   38 towers in a band at 62–101 km, the chess pieces of `away` (the world itself is clustered,
   not even). Heed: a tower across the sun is backlit and dull; a radius of clearance emptied
   10–20 km. Every view changes with the world, and the poses caught with P land somewhere else:
   each keeps its world by the old draw's number as a URL parameter, or is found again by its
   brief.
2. **The first frames**: the checkerboard on thin far cloud is the levels' dither before the
   history holds it; the canvas could fade in later.
3. **The start by the screen**: on a phone held upright the frame is 41° across, and the start
   looks 26° off the sun. A view at another aspect needs a size of its own (tools/views.js,
   screenshot.js, tests/views.test.js). The lower start, for speed that shows from the first
   second, is leg 16's last step: it needs near clouds worth the look.
4. **The way up**: rising air along a living tower's flank (from the towers' summaries, sent with
   the patch of domes: the probe can't tell a tower from the sea), or a faster climb (`vClimb`).
   The feel is the author's.

Judged by the time to the tower's flank and to its head (a flight for tools/flights.js), `start`
at three aspects, and the author's flight. The fingerprint and the flight logs change: say how.

### Leg 15: the camera and the bird

The bird reads as folded paper, never a dart or a ghost; the frame is composed on tall screens too.

1. **The camera** sits 18° over the bird's back, the wings nearly edge-on; higher, their upper
   faces and creases show. Not farther: at 140 px a crease is a pixel or two. Its distance could
   breathe more with the flight (4.1–5.4 m now), and the bird sit off the middle.
2. **Tall screens**: more sky, less of the near sea. (A tall cloud ahead takes the horizon
   whatever the camera does.)
3. **The paper**: facets that shade apart; in shade lit by the bright horizon and the sea; in fog
   less of the camera's mist in front of it.

Judged by the bird's crops at three aspects; `climb` keeps it whole in the frame; the lag and the
swing are the author's. The flight logs stay identical.

### Leg 16: mist, not clay (the edge)

A cloud here is a solid with an outline a pixel wide, even all the way round: popcorn where lit,
rock in shade, a card up close. Its edge becomes ragged and uneven, long where the cloud is old
and crisp where it grows. Softer, not more detailed.

Why density and not shape (`?dbg=1`): within a few hundred metres the shapes have bumps to spare,
which shade shouldn't show (small shading in shade is rock); under ~150 m the domes end (8 m
cells), and finer ones would not show in a medium whose mean free path is 14–28 m.

Tried in twenty lines, not kept: the camera's own `fray` (trace.wgsl) on every cloud within
1.2–2.5 km (the main loop's density, a stretch's and a sample's, times it; steps of 2 m + 0.004 t
at most through the edge's first 40 m; the light march's first two steps' extinction times it).
`past` and `gap`, flat cards before, show soft masses of light and dark and a ragged outline;
`close` loses its plaster and cracks; `sun` gets no veil over the sea; `skim`'s shade barely
changes (its sky light doesn't read the fray). Nothing is crisp. Cost and motion: not measured.

1. **One medium**: that fray as every cloud's, inside and out, from one function (the trace's two
   loops, the probe, the mist puffs). The seams between the loops may go with it (`entry`, `exit`;
   `past`'s edge and `gap`'s outline: find their causes first). Cost, grain and shimmer first.
2. **Uneven along a cloud**: its reach by the billow volume's liveliness and a slow field, from
   metres on a living head to about 100 m on old flanks; outside the surface too, so an old edge
   trails off.
3. **The light reads it**, the sky light too, or shade stays as even as it is.
4. **Far away** it is under a pixel: the outline's width, soft on old parts, crisp on growing
   ones. Toward the sun a thin edge is the silver lining (dropped as a shell of its own, leg 10).
5. **Shreds** only if the author misses them in flight: finer octaves, and steps a pixel long
   where they show, are the dear part.
6. **The start lower over the billows** (leg 14 left it for now): from 400 m the nearest cloud
   drifts 15 px a second, and the vision has speed tangible from the first second. With it the
   motion number at `start`, and new flight logs.

Judged by `past`, `gap`, `skim`, `exit`, `close`, `belly`, grain and shimmer no worse, and by the
author in flight (an edge that moves ten pixels a frame is the history's to draw). Heed: 30 m
eaten into the edge unlit read as out of focus, soft rims and a thinner edge too; a fringe of even
thickness was glowing veils over the sea toward the sun; fine samples near a surface cost half
the trace again there.

### Leg 17: sizes as in nature (the shapes)

No size, spacing or outline the eye picks out, on a near tower or on the horizon.

What shows now (chunks/cloud.wgsl, cloudSDF; `?dbg=1`): on a tower's big bubbles the turrets are
the lobes' own field again (`tb`): one lattice of 1280 m cells twice, 460 m of relief, then
nothing until the 320 m domes at 45 m. Within a level sizes span 2–3×, in 70–90% of its cells. A
sphere cut off at its shell (`octave`'s clip) is a disc from above and a ring on a hazy face.
Liveliness scales the billows by 0.6–1 only. Past 13 km a tower is L1's 512 m cells and those
lattices; past 40–55 km L2's 2 km cells, where every tower is a rounded cap on a column: the pawn.

Ideas, each first on `?dbg=1`: the level a tower lacks (300–600 m); sizes within a level by a
power law, dense on what carries them (leg 6's were sparse: lone balls); the cascade running all
the way down only where the air is alive; a swell in place of the clip; L1's billows sized as
L0's; the far towers keeping their own outlines (a later handover to L2, what L2 keeps of a head,
a finer far level: memory, known issues).

Judged by `giant`, `tower`, `start`, `high2` and `away`'s horizon; tools/world/levels.js and
catalog.js. Heed the swings between popcorn and dough (decisions: each tuned one lattice a level).
If it swings again, go on to the light, which carries more of the look.

### Leg 18: the light on them

With the edge and the shapes in place. The reference (tools/light/) keeps the energy honest, but
its Monte Carlo is of smooth, even shapes, and real cloud is porous: its light spreads farther and
shades less at small scales.

- `sunScatter`'s fit once more (leg 13 fitted it to the sun's new height, on the old shapes).
- Lit faces nearly even: a bump shown by its neighbour's shadow and its rim, not by a highlight
  of its own.
- Deep folds luminous, never navy pits (`tower`, `close`); the shade smooth, warm where lit cloud
  faces it.
- Far towers with relief: lobes shading lobes past the sun map's fine level (known issues).
- The film once more (leg 13), now that what it grades has changed.

Judged by `giant`, `tower`, `close`, `away`, `down`. Heed: sky ×1.95 and a warm fill everywhere
were milky; facing over 15 m pumice, over 60 m dough; a floor on the diffusion brown shade.

### Leg 19: inside and under

Fog worth flying through, with a way out to see, and an overhang that reads as one.

- **The way in** (the author, 2026-11-25): the screen changes drastically as the camera goes into
  cloud, even at an edge or in a small cloud, where a step in should change little. Much of what
  changes is switched by the point at the camera, not by how much fog lies in front of it: the
  trace's own loop for the camera's cloud (every pixel's, once that point is inside; lit grey
  deeper than 30 m), the mist puffs and the shake (render/probe.js: at full strength from an
  extinction of 0.012/m there, a sixth of the medium's, so in the edge's first metres; eased in over
  a third of a second), the exposure's gain in fog (shaders/exposure.wgsl: up to 4×, by how much the
  camera's fog veils the frame), the history's fog. Which of them the eye catches is not known yet:
  first a flight across an edge and one through a small cloud, frame by frame, with each turned off
  in turn. Then each follows the fog that is there (the light that gets through it), not whether
  the camera is in it. Leg 16's one medium may take the seam between the two loops with it.
- Near a surface it is leg 16's edge from inside.
- Deep in, fog shows its density only where its light varies (leg 9), and at 30 m of sight
  nothing has parallax. So the fog thins and thickens, and its light with it: brighter toward
  where the light comes from, as diffusion has it. Depth, speed, and the way out.
- `under`: metered (leg 13), then lit by the bright horizon under the overhang and the sunlit sea
  beyond its shadow.
- If minutes in fog still drag: a question for the author.

Judged by `inside`, `entry`, `exit`, `under`, `belly` and their strips, and new views whose strips
cross an edge and pass through a small cloud; in motion by the author.

### Leg 20: the air and the sky

Air that shows how far away things are, and a sky a photographer would know.

- **Shadows in the air**: the haze is even because it ignores every shadow (the review's "haze
  empties the middle of the frame"). Lit only where the sun reaches it (the sun map along the view
  ray, in a pass of its own: the trace's 16 textures are taken), it has shafts from behind towers
  and distance in layers.
- **The haze's amount**: towers keep their bases toward the sun (`seed3`, `high2`); a tower 20 km
  off has less contrast than the foreground (`giant`); one 60–100 km off is a pale shape, not a
  lit piece with an outline (`away`).
- **The sky**: a deeper blue overhead, rose opposite the sun, high cloud whose streaks turn.
- **Layers at other heights**, if the author wants them.

Judged by `sun`, `anvil`, `high2`, `seed3`, `away`, `climb`.

### Leg 21: ice

An anvil is smooth, fibrous, thin at its rim, and glows where the sun comes through. Old cloud
high up is ice: no cauliflower, a long fringe drawn out along the wind, a thinner medium, an
outline soft at any distance. The shaders have its height and its liveliness; the world could thin
an anvil to its rim. Judged by `anvil`.

### Leg 22: loose ends, then the review again

- What is left of the artefacts: orphan puffs and knobs, sunlit turret tops afloat in shade.
- Loading: a wordless gradient for 3.5 s, far longer on a slow device. A title until the canvas
  comes? The clean screen is the author's.
- Devices: what the cloud legs' benchmarks left open, on the phone and on integrated graphics.
- The review again, as it was made: the list above, with what is left of each.

## Done

From 2026-11-20 to 24 the piece went through a review against the state of the art (Guerrilla's
Nubis³, Hillaire 2016 and 2020, Wrenninge's octaves) and twelve legs of work from it. The review
found the architecture right: a CPU world, distance-field clipmaps and procedural detail are
Nubis³'s design, generated rather than authored. Don't rebuild it. What it found wrong: the light's
inputs, a skin a trace pixel wide, balls on lattices, and ten defects. The commits and `screenshots/`
captures the legs cited are no longer in the repository, so only their outcomes are kept here, by
leg and step as the decisions and known issues cite them. Numbers are 960×540 on the NVIDIA laptop;
a cost is the trace's GPU time by `node tools/cost.js` (A B B A A B, 200 frames), compiled with FXC
until leg 10, step 5 and with DXC since (the two compare with nothing of each other's).

**Before the review** (2026-11): the billows sized to their bubble (the trace +2–12%, the world's
bakes +25–35%: 4 slices a pass instead of 8; +52 MB, the billow volumes), taller fine domes (the
trace +5–12%; the dive levels off ~40 m higher, at 91–93 m/s), the 2026-11 look (the trace −9 to
−13% in near views, +9 to +19% over wide lit areas).

**Leg 1** (2026-11-20): the light march at the view sample's own lod (small: not what makes the
"pile of even balls"); the detail volume looked up turned in 3D (`DETAIL_ROT`), so its tile's
copies cut every surface obliquely (a warp only moves copies around); the shadow volume's sun rays
rise with the planet's curvature (much of the near sea out of shadow); one sea bounce for the bird
(`ambSea`, the clouds' value, 2.6× less: in shade a faint blue sliver).

**Leg 2** (2026-11-20): the light's reference, `tools/light/`: a Monte Carlo of the medium beside the
trace's light (model.js). It found flat tops at 5° 4–9× too bright, faces to the sun 0.73×, no light
in the shade. The light march and `sunScatter` rebuilt and fitted to it (37 views of 13 shapes within
~1.6× rms): each step's length from its slope, the octaves keeping their forward lobe, single
scattering 0.95 HG(0.85) + 0.05 HG(−0.3), diffusion D μ^1.4 / (1 + 0.11 τμ), every choice a smooth
weight, the light as at a 1 m skin whatever the outline's ramp. The aerosols' absorption ×2.2, the
atmosphere's constants once, in constants.js. AMB_K 1.4 → 1. The look: crisper, sculpted towers,
more relief, heap tops from above lavender, not orange; the shade at 45% of the lit side, a
tower's shadow on the sea lavender, not navy. The trace −2 to −4%.

**Leg 3** (2026-11-20): all of a sample's light at the skin's light point (the raw light nearly
independent of the trace's resolution); the approach's floor near a surface (a stride can't hop a
crest deeper than about an outline: shimmer at rest halved); every octave fading by the pixel's
footprint, capped at a 270-row trace's pixel (`pixC`): the far grape texture softens past ~40 km.
The trace +12–15%.

**Leg 4** (2026-11-21): `tools/world/levels.js`; the coarsest level (L2) grown from the same inputs
as the others (no pieces under 600 m, every dome widened and lowered to its cell, its volume kept):
it had held a third less cloud than L1 and the small cells' towers at under half their height; now
−4 to −5%, those towers at 0.7–0.9. The worker grows the start's cells while the shaders compile.
The dither at 40–55 km fainter. The trace up to +4% where rays graze the far sea.

**Leg 5** (2026-11-21): the medium in constants.js, shared by the shaders and the reference: half
the density at the surface, all of it 40 m in; every depth the light takes is one of full density
(`profileDepth`), so faces look as in a uniform medium and the skin's mapping is exact for any
ramp; the Monte Carlo through the profile (delta tracking). The near sea's rims toward the sun
broader and brighter, folds lighter. The trace −5 to +2%.

**Leg 6** (2026-11-21): an overshooting head spreads as far as the air that stopped it is stable
(towers' tops flatter than 0.45 15 → 8%); a head evaporates at least as far as the middle of its
column (tops over 4× their column's section 15 → 1); a tower's wake lumps blend into one widening
trunk, crowns into their heads (fewer clusters of small balls). Flights within 1.4 m.

**Leg 7** (2026-11-22): the sun map (render/sunmap.js): texels along the sun's rays (64 m across,
32 m in height, 320 m along) over 16 × 20 km around the camera, each the light the clouds past its
own let through. The light march keeps its first three steps (~90 m); the map gives the other
clouds from there on; past its window, the march and the shadow volume. Cast shadows sharp and where
they belong, long shadows across the sea, the billows 1.4–40 km toward the sun shading the near sea.
The clouds hold still (the author: nothing has to drift, for now), so the map bakes once where it
lies and again as its window moves (~2 km of flight, over 128 frames). 14 MB; 0.11–0.15 ms a frame
while it bakes; the trace −4 to +6%.

**Leg 8** (2026-11-22): the shade. The reference's shade (`reference.js --shade`: in colour under
the page's own sky, which sky.js reads out of the built page; another cloud's shadow, a sunlit wall,
folds, the sea below lit or in shadow) found the trace's shaded sea tops at 0.35–0.63 of a real
cloud's, and bluer. The lit map (litmap.wgsl: how much sunlight reaches the sea's layer) lights
bellies, lower sides and the bird from below (chunks/sealit.wgsl) and, where heaps close the sky,
faces turned from the sun; the sky light goes by how open the sky is over the large shapes at 250
and 750 m (in place of `up`) and by the view's angle to that. The shaded near sea lighter, with
form, its brown blotches gone. The author: the shade's tints stay; `under` (navy: the anvil's
shadow) and the bird in shade stay, physically right. The trace ~+5% (+2 to +11%).

**Leg 9** (2026-11-22 – 23): in cloud, and the grain.
1. The exposure from the frame (shaders/exposure.wgsl): the log-mean luminance and the share of the
   frame that is the camera's own fog. Outside cloud 14 as before, deep in a tower 3.3× (its square
   root keeps a cloud in shadow darker than a sunlit one). `inCloud` drives only the camera's
   shake and the mist puffs.
2. The camera's own cloud frays in its first 40 m (`fray`), in place of a bubble of thin density
   that cut ~2.8 optical depths at once as the camera crossed a surface.
3. The grain measured (tools/measure.js: a render against itself with other jitter, `?jit`). The
   camera's own cloud is marched first, in a loop of its own without jitter (0.12 optical depths a
   step, `exitCut` at its end), then the main loop from there.
4. Deep inside a tower: as before (in motion, for the author's eyes).
5. `skim` posed just over the billows, into the sun.
6. Grain in flight (the author: "still pretty grainy"), measured over the motion strip since; the
   view `turn`. The TAAU clamps and blends by the parallax of the camera's movement, not the image's
   motion (rotations reproject exactly), reprojects by the nearest depth of the 3×3, starts a pixel
   new to the frame from the neighbourhood's mean, averages its first 8 frames plainly. Grain in
   flight down to a third, shimmer at rest down everywhere.
7. Flying into a cloud's edge: the own loop goes on until 12 m clear of cloud, near the surface lit
   as the main loop lights a cloud from outside; the main loop starts from there. The view `entry`.
8. Flying out of an edge (moments the author caught with P, which copies a pose as a view since): a
   pale rim along far outlines for a second, stale fog in the history. The TAAU keeps how much of
   the camera's fog it holds (an r8 target) and gives way to the neighbourhood's mean where that
   disagrees with the 3×3 now. The lattice in the camera's fog: its steps 0.4 of the erosion's ramp
   where a ray crosses the surface, 0.8 along it. The trace in cloud +3 to +19%, outside the same.

**Leg 10** (2026-11-23): distance.
1. The far blobs were the shadow volume's 768 m texels past the sun map's window: the map has a coarse
   level around the fine one (256 × 128 × 1280 m texels over 65 × 82 km, 3.7 MB, baked from L1 and
   L2). Each of the map's rays first steps out of its own cloud. The first frame's bake ~45 ms more.
   The trace binds 16 sampled textures since, core WebGPU's limit a stage.
2. The handover from L0 to L1 moved to 10–13 km (from 7–10). What changes there is the surface (L1's
   rounder, larger domes), not the light; a near tower in the band is L0's now.
3. Silver linings (thin cloud over far towers' outlines seen against the sun): dropped by the
   author, not worth their cost (known issues).
4. The haze toward the sun: a row of `?haze` values changes little (most of it is the atmosphere's
   aerosols); the author saw no difference: kept.
5. The tools compile the shaders with DXC, as visitors' Chrome on Windows does (Playwright's full
   Chromium, `use_dxc` asked for by name; elsewhere the headless shell). Under FXC the trace's main
   loop sat at a cliff of registers (one number more carried through it: +12%). Under DXC the trace
   −6 to −8%, a page compiles ~5 s sooner, verify ~10 → ~7 min.

**Leg 11** (2026-11-24): tower shapes.
1. stats.js counts mushrooms (a tower's widest section in its upper third against its narrowest in
   its middle third) and knobs (a bubble perched on ones 2.5× its size). `giant` and `close` posed
   to fill the frame with their towers.
2. Popcorn far away: on a tower, a bubble with billows big enough for the lobes boils in turrets the
   lobes' size; smaller bubbles keep their 640 m ones. The trace +1 to +3%.
3. Mushrooms and knobs by their causes: a crown small beside the bubble it would burst from, or the
   pulse's head, stays in it; a column's lumps about as wide as what rose through it. Mushroom ratio
   p50 1.38 → 1.21, knobs 975 → 467, the bubbles −9%, overhangs within 100 km 28 → 21 (`under`
   searches the 48 nearest towers).
4. Other seeds' starts: dropped (the author: "doesn't matter").

**Leg 12** (2026-11-24): reach.
1. The author's `?bench`: Firefox on a desktop, 60 fps at its 2.3 Mpx cap (its WGSL compiler takes
   the shaders); a mid-range Mali phone, whose passes' times summed said 3.5× its frames (a
   tile-based GPU overlaps its passes). Now (render/gputrust.js) a frame's GPU time is its span from
   its first pass to its last, held to the mean time between frames; frame times are judged by
   their 75th percentile; the canvas never shrinks while frames come on time, and the clouds stay at
   their floor when it does (render/resolution.js). The phone: 57–59 fps once settled, at 0.56–0.8
   Mpx with the clouds at their floor, 4 hitches in the first seconds. Its start stays 1.15 Mpx: a
   smaller one would hold stronger phones back for good (the canvas never grows again).
2. The world's bakes' estimate (`bakeCost`) is scaled by what they take on the device
   (render/bakescale.js; 0.64–0.75× the old constants on the NVIDIA laptop).
3. What the modules make as they load sits in an out-of-memory error scope of its own: running out,
   the page says so (it needs ~141 MB to start).
4. The `top-speed` check: 100 s level at 185 m/s; each patch of domes came 32 s before the edge. CI's
   verify step may take 60 minutes; the branch preview's deploy tries once more a minute on.
5. Values JS and WGSL both used come from constants.js (the sun colour table's heights, the cirrus'
   and high layers' heights and tiles), struct Probe's offsets from its declaration (`PROBE_AT`).
   `tools/linux.js` gives CI's SwiftShader captures (the container's build 0.7 kB larger than
   Windows' own: not looked into, the captures agree).

**After the legs** (2026-11-24), each from a moment the author caught with P:
- **A line across a far tower**: a high layer seen edge-on, less hazed than the tower behind it.
  The layers are in the clouds' air now (airT, the haze in chunks/atmo.wgsl), and pass from in front
  of a cloud to behind it over a tenth of the distance. The TAAU +10–14% (~0.015 ms).
- **The grain at near clouds' edges** was the trace's, not the history's (`?raw`). A stretch's optical
  depth comes from the eroded depth at its two ends (`rampMean`); no light march is reused (each
  sample lit by its own until `LIT_T`, the sky's taps until `SKY_T`); no jitter is left in the march
  but the levels' dither. Grain past near clouds 1.44 → 0.54% (`past`), 2.33 → 1.18% (`gap`),
  `tower` 0.49 → 0.19%; nearer a fine reference. The trace +5 to +9% (`past` +18%).
- **Blue spots on a flank in shade** (`belly`): where the frayed edge left a ray's first sample
  without density, the loop's starting sky (an open top's) was never replaced. A cloud's first lit
  sample always takes the sky's taps now; the same spots, fainter, left every view's shade.
- **A sunlit box on a cloud in shadow** (`backlit`): the sun map's soft shadow fades with the optical
  depth far slower than the light it interpolated, so its edge followed the texels' outline. A texel
  holds the light and its cube root (rg8unorm), the soft shadow read from the root. Nearer a fine
  march everywhere (1.20 → 1.00 levels). The trace 0 to +1%.
- **The held climb** (the author: "once you are down, you can't fly up again"): rising air takes
  over the bird's weight as it slows to `vClimb` (flight.js): held up, it climbs on at 51 m/s and
  26°, 22 m/s up (it had slowed to 43.6 m/s and 3.5 m/s up); half the stick, half the angle. In a
  climb the camera sits and looks on a slope 0.8 of the flight's (`CLIMB_SLOPE`; it was 0.55, and
  the bird sank out of the frame's bottom): the bird whole in the frame (the view `climb`). Looking
  up by half the climb's angle instead took the look up out of `close` and `under`.
- **Fewer views**, 21 → 17 (each costs verify ~13 s here, ~40 s on CI). Retired, with poses to add
  back as views when needed: `geometry` (the `side` preset with `dbg: '1'`; `--query "dbg=1"` shows
  any view's normals), `line` (`-475,1883.7,-246.7,-2.219,0.0079,-0.1648,60`), `edge` (in a billow's
  edge looking out: `0,1400,0,-1.0,-0.03,0`), `exitsun` (out of a top toward the sun:
  `-236.2,1494.8,-4685.5,0.3133,0.2089,-0.049,67.9`). Two moments past near clouds, never views:
  `1553.3,1748.7,-2599.8,-5.4842,0.0578,0.8101,51` (banking), `744.6,1725.5,-810.5,0.9041,-0.0941,0.0389,81.5`.

## Decisions: what failed, and why

What was tried and didn't work, why, and when. **A decision is evidence, not a rule**: when its
cause no longer holds (the code it was tried on has changed since), try again; that is what the
cause and the time are for. *Before the legs* means before 2026-11-20: the light and the medium then
were the ones legs 2–5 rebuilt, and the world the one legs 4 and 6 changed, so a verdict on light or
colour from then is the likeliest to have gone stale. The author's own words are taste: they hold
until the author says otherwise.

### The world

- **A smooth "sand dune" sea** (before the legs, the author): billow strength tied to restlessness
  (≈ 0 over most of the sea) and ridged noise (`1 − |n|`): smooth hills, sharp crests. The sea
  always overturns since: strength ~1 everywhere, `|n|`.
- **The air's levers on towers** (before the legs): an inversion too strong in moderately restless
  air left towers only at I ≈ 1, too weak "foam walls" of medium heaps; an equilibrium level by
  I^1.5 kept almost every tower mid-level (I^0.5 with `deep` lets giants reach the ceiling); weaker
  subsidence (SUB_R 2.0) made walls of medium towers.
- **A continuous buoyancy at the equilibrium level** (leg 6, against flat tops): 15 → 13–14% however
  shaped (no head near `el` was flat), and big pulses overshot into 4 km heads, or with less energy
  10% fewer towers over 6 km. **Ice tied to the column's life**: no change (the wide tops sit under
  8 km).
- **Rounder heads** (before the legs): the sea's heaps grew taller and steeper, into the slope
  limit's boxes; crowns rooted into their head became narrow columns (battlements); pressed very
  round, a head under the ceiling turned a pill with sky beneath it.
- **Heaps at the slope limit** (before the legs): 2D domes steeper than the volumes' slope limit came
  out cones; a heap grown on another came down past its parent (h/r up to 2), and 40% of heaps met
  the limit, cut into flat faces (a box in `side`). Rounding the narrow valleys' floor, or a limiter
  over 16 directions, changed nothing.
- **Shards and floating heads** (before the legs): small bubbles in 512 m cells became polyhedral
  fragments; dropping small pieces one by one left heads floating without their wakes.
- **The start's clearance as a radius** (2·P·1.7 + 2.5 km, before the legs) emptied 10–20 km. A huge
  tower right ahead of the start blocks the sunset and is dull, backlit.
- **The bubble budget** (before the legs): the bake loops over every gathered bubble per texel; 14×
  the bubbles would swamp it (stats.js prints the load).
- **Against mushrooms** (leg 11): a tower's column drawn out by the shear (every piece lengthened
  downwind by the shear × its height × its age): old heads drawn into caps 12× their column's
  section. The column's lumps alone, while the cell lives, at most 0.6 of a lump: mushrooms over 2×
  14 → 11, but it filled in under heads (overhangs within 100 km 27 → 20) and big lumps turned
  sausages (shear tilts a lump; its horizontal slices keep their width). A head tied to its
  column's 75th percentile of evaporation, not the median: the same. The small crowns kept in their
  head on every pulse: the sea's heaps in a 30 km box 2258 → 1601 (on towers only since).

### The billows and the edge

- **Billows of spheres** (before the legs, the author: "a 3D render of foam and clay"): four sphere
  lattices made every bulge a ball with its own highlight; detail only on the 640 m lobes' caps left
  the near sea smooth dough. Near the camera (80 and 40 m) a sphere clipped to its shell is a flat
  disc glowing evenly (bokeh).
- **Billows without a lattice** (leg 6): spheres of power-law sizes, sparse and clustered: the near
  sea smooth swells with lone small balls; milder, compact puffs floating over heaps; the far grape
  texture unchanged.
- **Fewer billows on a tower's biggest bubbles** (leg 11, against far popcorn): the turrets cut to a
  third or a fifth on bubbles whose billows are over ~1 km (the lobes too over ~2 km, or by the
  liveliness): far towers calmer, near ones pillows. The turrets only on the lobes' crowns: hardly a
  change (clipped to their shell, the lobes are plateaus). The turrets and lobes fading at twice the
  pixels a cell on towers: far towers cotton.
- **Turrets the lobes' own size on a tower's big bubbles** (leg 11, still in the code; the review of
  2026-11-25): it took the carpet of 640 m beads away and left the lobes' lattice twice over:
  florets of one size with one size of bump on them (`giant`, `?dbg=1`), beads still to both
  reviewers. Every try so far tuned one lattice a level; leg 17 changes the sizes within one.
- **Billows of one size on every bubble** (before the legs, the author: "puffs all one size"): a 400 m
  crown carried lobes as big as a 4 km head's. Without the 640 m turrets a surface reads as smooth
  dough; a billow scale for heaps by their height took their turrets: dough again.
- **Shells and density** (before the legs): bulges far flatter than wide (shell ≈ 1/6 of the radius)
  read as swells, 1/3–1/2 as cauliflower; a sparse field leaves bare pits, dense everywhere sponge;
  dense large and looser small, the small lower and fading with distance: cauliflower.
- **Paraboloid domes** (before the legs): gentle hills, no outline against the dome behind.
- **Taller 320 and 160 m domes** (×2, before the legs): bubble wrap on towers a few km off; without
  `dome`'s fade, lit balls floating over the sea.
- **The finest domes clustered on the turrets' caps near the camera** (before the legs): the near sea
  doughy; unclustered past ~1.5–5 km, a carpet (frogspawn).
- **Fewer billows under bellies and overhangs** (by the large shapes' slope, before the legs): flat
  shelves where the slope steps between the volume's layers, big lobes smooth boulders.
- **The largest lobes in cloudSDF** (2560 m cells, before the legs): their 500 m in the skip bound
  cost the trace 40–80% near towers; on the sea they raised towers before the camera, on fragments
  balls floating in the sky.
- **Erosion as form** (before the legs): 30 m eaten into the edge read as out of focus, because the
  light never sees it. Form belongs in the distance field, where the light march and the sky's taps
  see it.
- **Soft rims** (before the legs, σ 0.035/m, a 30–80 m ramp): near clouds out of focus, at full
  resolution too. An outline of 2 pixels instead of 1.25 hardly calms the shimmer and gives the
  softness back.
- **A thinner edge** (leg 5): 30% of the density at the surface, full 60 m in: near rims glowed, but
  side-lit heaps turned soft pillows and `close`'s domes washed out; 65% over 30 m kept the domes and
  hardly lit the rims. The edge's thinness and the domes' crispness are one lever, the author's
  (CLOUD_EDGE0, CLOUD_EDGE_W).

### The light

- **The light balance** (before leg 2's light): sky ×1.95 and a warm sea fill everywhere made shade
  nearly as bright as lit faces (milky, flat); at 5° the sky gives a lit face's light /20–40. Light
  not scaled by how squarely the sun enters lit grazed tops as brightly as faces. The sea's warm
  bounce at full weight on downward facets: brown blotches.
- **The scale of a surface's facing** (before leg 2's light; its rebuild kept the principle): over
  15 m every small crease went dark (pumice); the diffusion by the facing over 60 m darkened every
  crease (dough) and lit a tower's far side orange; a diffusion floor of 0.35 on faces turned from
  the sun made shade brown.
- **The light march's jitter** (before the legs): each step at a random point per pixel flipped in
  and out of a bulge beside the path: the screen-door. Averaging each step's occupancy instead
  darkened the sea's lit tops (the air above counted).
- **One channel for all the cloud toward the sun** (before the legs, the shadow volume): e^−τ through
  a point's own cloud blacks out the inside of clouds, where light diffuses through one body
  (~1/(1+0.11τ)): its own cloud and the others are two channels since. The own channel in 768 ×
  360 m texels banded shaded faces; march steps hundreds of metres long hit or missed other clouds
  by the jitter.
- **Other clouds' shadow on the diffusion as e^−τ** (leg 2): every heap's shadow a hard blot of
  paint. Light diffusing under a surface fills a small shadow.
- **An all-or-nothing choice in the diffusion** (leg 2: the step the path leaves its cloud in, own
  cloud or other): flat blots with hard edges across heap tops ("decals"); a constant slant for light
  from far off: milky, the relief gone.
- **Column data per light-march step** (leg 2): the trace +10–13%, the change hard to see.
- **The light from the finer level across a handover** (leg 4): the grain at 7–10 km as strong or
  stronger (the light point lies on the coarser level's surface, inside or outside the finer one).
  In parts (leg 10, the level switched hard at 7 against 13 km): the openness, the light march's long
  steps or its first six steps from L0 changed the difference by 0–15%. What changes is the
  surface, L1's billows.
- **The sun map, first tries** (leg 7): the optical depth interpolated between texels put a shadow's
  edge a tenth of the way to the deep texel, a staircase (store the light that gets through); the
  cloud's edge blurred over 64 m: at 5°, shadows as if from clouds 30 m taller; the lookup snapped
  to a texel: blocks near the camera; a step's share inside from a distance and its slope took a
  bound for a distance on steep slopes (cap the slope at 1).
- **The sun map's coarse level, first tries** (leg 10, against the fine level over 82 × 65 km): four
  320 m steps a texel, as the fine level: a ray 30 m over a billow counted a fifth of a step inside
  (τ ~4.5), lit faces mottled (80 m steps since). The clouds within ~1.4 km from it too: its texels
  sit inside a tower's body, so a side lit at a grazing angle took that body for its own cloud and
  lost its shadow. Four taps a lookup: the trace +8–11%, the same to the eye. Against its window's
  differences after a move, none changed them: the march's first 4 km in 80 m steps, its rays not
  bent with the planet, L2 alone.
- **The sun map's light as a root for every lookup** (2026-11-24, the box on a cloud in shadow): the
  square root left the box fainter, its straight edges still there. The cube root took it away but
  shrank every sunlit patch (`side` 22% of its pixels, `down` 25%): the far clouds' shadow takes the
  light as e^−τ, and between texels the root darkens it. The cube root near and the light far from
  one channel: wrong where a texel holds thin cloud. Readings that didn't hold: the texels inside the
  neighbouring cloud (it stands 500 m off), the lookup a texel farther toward the sun.
- **A march of every cloud toward the sun as the map's judge** (2026-11-24: no map, 8–40 m steps to
  30 km): 10–11 levels from the picture in `close` whatever the map held: the model's seam at 1.4 km
  (known issues), not the map. It judges the near lookups only with the far part as the build has it.
- **Fold occlusion** (before leg 2's light): a tap up and back toward the camera; a 0.2 floor turned
  shade into gravel; a tap straight up can't tell a fold from a wall.
- **The openness of the sky, first tries** (leg 8): a normal from the tap up and the light march's
  facing (a one-sided difference over 58 m, pointing into one wall at a crease: every crease read
  closed); the large scales judged against the billowed surface (every billow flank a crease, the
  sea ~0.55); the scales tied to the pixel (a whole tower in one tap, its flank and the sea under an
  anvil black); the point's distance as the taps' mean (the field kinks at a crease: creases read
  open); a floor of 0.2 (an enclosed spot at 0.12 of the sky, as if its walls sent none). Taken once
  a cloud instead of a sample: the trace +15–22% against +8–12% under FXC (lanes enter clouds at
  different steps, so a warp runs it whenever any lane needs it).
- **A fringe outside the surface for silver linings** (before the legs, thin cloud 40 m out, lit
  forward): rays toward the sun skim the sea's tops through it for kilometres (glowing veils; capped
  per ray, sheets like film).
- **The in-cloud mist's variations near every cloud** (within 900 m of the camera, before the legs):
  near surfaces fogged.

### In cloud

- **Handing the skim of a top to the main loop** (leg 9, step 7): stair-stepped blocks where the ray
  met the top again as a surface seen from outside, fainter with the fog lit like it. Kept in the own
  loop until 20 m clear: `edge`'s near billows a smooth veil, their domes gone; 4 m: a straight seam
  between frayed fog and crisp surface. Not the cause (none changed anything): the own loop's step
  cap, a softer threshold for the shreds, the camera's cloud ramping in over 8 m, finer steps in its
  holes.
- **The stale fog in the history, given way otherwise** (leg 9, step 8): toward each frame's
  jittered sample by how stale it is (×6): the rim gone, the grain while the fog clears doubled (×3:
  +60%); toward the neighbourhood's mean with no threshold: `edge`'s world soft; half mean and half
  sample: a faint rim for a few frames.
- **The lattice in the camera's fog, cheaper** (leg 9, step 8): fine steps everywhere in it, the
  trace in cloud +16 to +33%; within 60 m alone or while the fog in front is thin, about as much;
  growing faster with the distance, or uncapped along the surface: the lines back, faint. The
  erosion's mean at 4 points along a long step: the lines stayed.
- **Grain measured at the still alone** (leg 9, step 3): 12 frames of history is young (1–8% of every
  view, 0.13–0.58% after 2 s), and the bird flies straight: it read the start and missed turns and
  dives. **By frames a step apart in flight**: it mixes the grain with all that moves. The grain is
  the flight against itself rendered with other jitter, over the motion strip.
- **Shreds and holes deep in the fog** (leg 9): 15–28 m under a flat top the fog looks the same with
  them or without: in fog lit evenly density doesn't show, and at a 5° sun the light there is all
  diffusion. They show only near the surface, with the outside behind them.
- **A larger step budget for rays that start in cloud** (leg 9, up to 120 steps more): identical; the
  dark fringes on far silhouettes through the fog were the history's depth.
- **The camera's own cloud in the main loop** (leg 9: a flag per ray, its fine steps, the fray, the
  tints): the trace +18–22% in views never in cloud, +16–17% of it the flag's state and branches in
  the hottest loop (under FXC); in a loop of its own, −4 to +2%. **The exit cut for every cloud**
  (each step's part past a surface taken back): +3%, rims moved by a level or two; kept in the
  camera's own cloud alone.

### Colour, haze and tone

- **The shade's colour and the film's saturation** (before leg 2's light, and leg 2): saturation in
  the final pass turned the golden haze toward the sun into an orange dust band; shade ×1.45 blue
  at ×1.3 saturation was navy at a fifth of the lit side; lifted further (×1.28, AMB_K 1.55)
  periwinkle, and lit towers lost their folds. Leg 2: CLOUD_SAT 1 made lit faces tan; the sky
  light's tints off, the shade neutral grey, on the way to brown.
- **Aerial perspective per channel** (before the legs): toward the sun all sank into blue, though
  that sky is golden because its blue was lost on the long path.
- **The haze in the sun's path and the sky** (leg 2, aerosol in the atmosphere's tables): the sun
  ×0.27 at the sea's height, a white veil over half the frame toward the sun, milky even at ×2–2.5
  exposure.
- **Exposure and the tone curve** (before the legs): exposure 17 (16.5 too), or ACES alone, washed
  the glow toward the sun into a milky veil; a curve per channel from the mid-tones up made sunlit
  orange tan, sandstone.

### The trace and its cost

- **Costs measured with FXC** (until leg 10, step 5; visitors' Chrome on Windows uses DXC, Macs
  Metal, Linux and Android Vulkan): FXC puts the trace's main loop at a cliff of registers (one
  number more carried through it: +12%; every silver lining +12–14% in a view it doesn't change;
  DXC: nothing). Leg 9's flag for the camera's cloud in the main loop and leg 8's openness once a
  cloud were judged under FXC: worth measuring again.
- **The march without jitter, cheaper or simpler** (2026-11-24, the grain at near edges; against a
  fine reference in levels, and the grain; the old picture 2.8 levels and 2.1%): the light march
  reused deeper in by a smooth weight, 4.4 (soft blotches on a near face); the reused march held as
  it was, 4.1; its distance taps coarser with depth, blotchier; lit in two windows with a gap, 3.3
  and dark contours; three marches, 2.7 but more grain far away (`down` 0.82 → 1.11%); the weights'
  ranges where samples usually fall, specks flickering at rest (`close`'s shimmer 0.008 → 0.134%);
  the sky's taps at the surface sample alone, grain 0.9 → 2.1%; the octaves at two points along a
  stretch, 2.1 against the plain mean's 1.2; the lit samples' steps still jittered, grain 1.4%
  against 0.9; a budget of optical depth between lit samples in thin cloud, no cheaper.
- **Samples of the distance alone between the lit ones** (the same work): 2 m apart where a ray runs
  shallow, the grain past a near cloud 0.9 → 0.5% and its outline clean, for +58% of the trace there;
  only within 12° of the surface, the gain gone and over half the cost left.
- **What the trace's loop carries** (the same work, DXC): the light march's result kept from sample
  to sample (ten numbers) cost every step, through clear air too: +6 to +15% with it, −3 to −9%
  without (the sky's taps in four numbers for eight: 2% more). The in-cloud march as a loop inside
  the march's: the trace ×3. Unjittered steps are cheaper by themselves (−3 to −7%): neighbouring
  pixels branch together.
- **The approach's floor at two trace pixels everywhere** (leg 3): shimmer at rest halved, the trace
  +27–46%; near a surface only (kept), nearly as much for +8–10%. Six refinement steps at the entry
  for three: shimmer 10–20% down for +5%. The detail and the strides following a finer trace
  (1920×1080): finer cauliflower, less shimmer, +30%; capped at a 270-row trace's pixel, +11%. The
  lever, if the author would trade resolution for it: `pixC`.
- **A generous billow bound** (before the legs): `shellOf` 460a + 150 cost ~10% more than 400a + 120,
  no visible difference. Crisp rims cost nothing.
- **A weight of the billows' size of its own in cloudSDF** (leg 11): the trace +11% in every view
  however written: a cliff of registers under DXC. Taken from the lobes' weight (`wL`): +3%.
- **TAAU at rest** (before the legs): a wider clamp box alone barely calms crisp rims; the blend rate
  is what flickers (a rim pixel swinging ~150 levels × α 0.05).
- **Against the grain left in a dive** (leg 9, step 6, `tower` at frame 120, 1.59%): the blend at the
  rest rate 1.81%, the clamp as wide as at rest 1.61%, the history reprojected by the first surface
  a ray enters 1.56%. **The neighbourhood's mean on the first frame too**: the slow blend kept that
  soft frame for many frames. **The plain mean past 8 frames**: shimmer at rest up (`start` 0.04 →
  0.078%).
- **Blending the clipmap levels over a handover** instead of the dither (before the legs): no
  lattice, but the trace 12–18% slower in every view, also over 7–10 km alone, also reading the
  second level only near a surface.
- **The clipmap levels in one stacked 3D texture** and a 2D array of column maps (before the legs):
  the trace 5–7% slower, the stacked z shifting the filtering.
- **The billow scale in the distance volume** (rg16float, before the legs): the trace 2–12% slower
  from the format alone (the skip reads it everywhere); blended over a distance growing with the
  cell size, the levels disagreed and the handover lattice grew.
- **Stand-ins for a tower's small bubbles in the coarsest level** (leg 4): their towers in L2 at
  0.69–0.79 of their height in L1 (0.68–0.73 without), L2's bubbles a block +12–30%.
- **Small domes widened to 0.6 of a cell in the coarse levels** (leg 4): the levels agreed better
  (|Δ| p90 66 → 48 m), the render across a hard switch barely changed; coarser cells hold narrower
  domes as facets.
- **Tried, no visible gain** (before the legs): the HG + Draine droplet phase; jitter animated by
  position (Jimenez; shimmer rose a little); sharper TAAU by the nearest sample.

### The GPU

- **The distance-volume bakes as compute shaders** (before the legs): no faster than the fragment
  pass writing 8 slices at once, often slower (it looks at each bubble once for all 8). The shadow
  volume (one long march a texel) is ~2.5× faster as compute.
- **Long serial work in few invocations** (leg 7, the sun map's walk a ray): two columns took as long
  as eight (0.3 ms), waiting on one texture read after another; spread over many invocations, it
  costs by the work.
- **The ambient light as a read-only storage buffer in the trace** (before the legs): ~4% slower than
  a uniform buffer (Chrome on Windows, FXC).

## Known issues and ideas

- **Measured on few devices**: the NVIDIA laptop (60 fps, the clouds at their 0.75 ceiling at
  640×360), a desktop in Firefox (60 fps at 2173×1058, clouds 0.36), a mid-range Mali phone in Chrome
  (57–59 fps at 0.56–0.8 Mpx, the clouds at their floor, blurry; 4 hitches in the first seconds, one
  of them the canvas shrinking from 1.15 Mpx). Never Safari (whose WGSL compiler hasn't seen the
  shaders), and of an integrated GPU only that the tools run on one (Intel gen-9, 2026-11-25: a
  960×540 still with its bake takes 25–45 s, the views with their measurements over half an hour;
  its frame rates are unknown): `?bench` reports them. On the phone the world's bakes read 5.8× the
  laptop's estimate, maybe overstated as the passes' sum was: fewer bakes a frame, slower streaming,
  never a hitch.
- **The world's worker**: the bakes' estimate (`bakeCost`) is one laptop's constants, scaled by what
  the bakes take where the device has timestamp queries (render/bakescale.js); without them a weaker
  GPU's frames take longer over a shift. Startup waits for the whole first bake (the canvas at
  3.5–3.9 s in the player check). The generator allocates many small objects (`makeDome` and `lift`
  dominate profiles). The patch of domes keeps ahead at top speed with ~25× to spare on the laptop;
  on a far slower CPU the page would grow the cells under the bird itself: a stall. The worker
  carries its own copy of the world's code (the page ≈ 19 KB larger).
- **GPU memory** (counted from the formats): 141 MB made at the start that never shrinks, and 55
  bytes a canvas pixel of targets (114 MB at 1920×1080, ~130 MB at the 2.3 Mpx cap). If the first
  runs out the page says so; the targets retry smaller. A third of the targets' is the bird's 4×
  multisampled box (a third of the canvas). What a small device could go without, largest first
  (not done until a device's numbers ask for it): the billow volumes (L0 29 MB, L1 15, L2 8,
  rg16float: as rg8unorm half, the streaming check's tolerance with it), the shape noise (17 MB,
  rgba16float: its signed distances would terrace in 8 bits), the sun map's fine level (14 MB), the
  shadow volume (10 MB), the bird's box (2× multisampling, or a smaller box), its shadow map (4 MB),
  the high layers' 1024² (6 MB with mips).
- **Mushroom tops**: 14 of 145 towers over 5 km have a top over twice their column's section
  (stats.js), the worst dying cells whose head outlived its column (age/life 1.1–1.7). A wider column
  fills in under overhangs: 21 within 100 km, on 8 towers, the nearest the 33rd tower from the start.
- **Close-up surfaces** of towers can look blotchy in low sun (`close`): the lumps' own shade, the
  light march's first ~90 m. The review: plaster where lit, rock in shade (legs 16, 18).
- **Past the sun map's fine level** (8 km across the sun's way, 8 km away from it, 12 km toward it)
  far towers' lobes are not shaded by the lobes beside them toward the sun (the coarse level's
  texels sit inside the tower's body). A reference with the fine level everywhere (230 MB) gives far
  towers more contrast, shaded lobes with lit rims (`seed3`, `high2`, `side`'s middle tower), and
  more grain in flight. Levers: a level between the two (128 m across, 7 MB; the trace's textures
  are at their limit: two levels in one texture), the march's steps there. Within a window the
  map's rays run straight in height, the march past it bends them with the planet: over the coarse
  level's 49 km toward the sun, a cloud 40 km off shades as if ~130 m taller.
- **Near the camera the sun map's shadows are a texel coarse** (64 m across, 32 m in height): a
  shadow's line can lie a texel off, and lower than the view's own clouds cast it (the map holds no
  domes under ~64 m: up to ~40 m of a top). `backlit`: a faint glow on the lobe's shoulder and the
  ridge's crest golden, where a march at the view's detail has both in shadow (3% of its pixels over
  8 levels brighter; `tower` 6%, `gap` 4.5%).
- **The seam between the soft and the hard shadow**, 1.4 km toward the sun (`LIGHT_NEAR`): a cloud
  nearer casts the soft one, one farther takes all the light, and the map's far lookup reads a
  texel up to 320 m before the seam, so a cloud 1.0–1.4 km off shades hard (`close`: a lobe in full
  shadow that a march split at exactly 1.4 km leaves softly lit; neither is a real cloud's).
- **The clouds hold still** (the author, 2026-11-22: nothing has to drift, for now), **the sun
  doesn't set and there is no sound** (the author, 2026-11-25: out for now). With drift back,
  the sun map bakes all the time (0.11–0.15 ms a frame, lagging the billows by 2 s, 7 m); or it holds
  the large shapes alone, and the light march the billows' shadows near by.
- **Popcorn** (leg 17): `away`'s horizon (60–80 km) is still beads: the 1280 m lobes, 90% of their
  cells filled, the turrets faded by then; and so are the lit towers nearer by (`giant`, `tower`,
  `start`: the review of 2026-11-25). A real tower shows 2–4 dominant turrets, smaller domes on
  their upper, sunward shoulders, older parts smoother (what failed: decisions). **Crowns perched on
  heads**: the first crowns, about a third of their head, remain (`start`'s middle tower's two
  bumps). **Sunlit turret tops in shade** read as floating puffs (`start` beside the bird, `sun`,
  `tower`, `away`): attached (`?dbg=1`), their base melts into the shade.
- **Tops**: flatter than 0.45 on 5% of the towers, 18% of those at the ceiling (stats.js); `seed3`
  keeps one flat lens against the haze. Deep folds between lobes go near black (`tower`, `close`: a
  navy pit).
- **Silver linings** of far towers are a pixel wide: a backlit edge 10–20 km off lies within a trace
  pixel (60–80 m) and doesn't blaze (`sun`'s right tower, `anvil`). Thin cloud over the outline's
  footprint, the light march thinned alike, makes them for +7% of the trace (leg 10, step 3); the
  author: not worth it (2026-11-23). Leg 16's fringe is that thin cloud, there for its own sake.
- **Inside cloud** (leg 19), deep in a tower (`inside`), is an even tan card (lit evenly by
  diffusion, its density doesn't show); in motion faint mist puffs drift past and the brightness
  changes slowly (the author's eyes). The puffs and the camera's shake go by `inCloud`, the density
  at the camera's point. In cloud the history reprojects the fog by the depth of what shows through
  it: its own shreds near the camera may smear in motion. Out of a cloud's edge far clouds are a
  little soft for about a second (leg 9, step 8). A metre under a top (`entry`): faint blocks where
  the camera's fog meets the surface seen from outside, one dark, a few pixels wide, for a fifth of
  a second of the skim flight (the stored shapes' texels at a grazing angle, leg 9, step 7).
- **The shade is blue**, navy at the exposure it has (leg 13), not the reviews' lavender grey: the
  sky's own colour, tinted bluer (trace.wgsl: `ambUp`, `skyAnti`) and saturated (CLOUD_SAT).
  Lavender needs red in the shade's light, and the warm bounce from sunlit cloud is there only
  where cloud around is lit. Without the tints, or with the saturation on the sun's light alone,
  the author saw barely a difference (leg 8). `under` is navy
  (the sea beneath lies in the anvil's shadow for tens of km) and the bird in shade nearly vanishes
  into it: kept as physically right on 2026-11-22, and no longer (the author, 2026-11-25: beautiful
  wins where the two part; legs 13, 15, 19).
- **Near the camera** (leg 16) every cloud within about a kilometre is a smooth gradient with a soft
  edge, not the sea into the sun alone (`start` lower left, `seed3`; a soft bluish patch beside the
  bird in `start`), and the shaded sea seen from above is blotchy (`giant`'s foreground): the light
  there is diffusion and sky light, smooth over tens of metres, and under ~150 m the domes end.
- **The light against its reference** (`node tools/light/reference.js`): an isolated small ball's lit
  side 5.7× (the trace can't see how little cloud lies behind a billow), its edge 1.75×; a tower's
  shade 3.4–3.7× a ball's, 0.6× a wall's (real towers lie between); tops with the sun behind
  1.2–1.9×, faces 0.83×, the glare off tops toward the sun 0.83–0.95×. In shade (`--shade`): an open
  top 0.76–1.02, creases 1.1–1.25, bellies 0.56–0.84 over a lit sea (a Lambertian deck has no glare
  toward the sun at the horizon) and 0.66–0.77 over one in shadow, a tower's shade 0.65×, a top
  beside a sunlit wall a kilometre off 0.36–0.81× (the lit map sees the sea's lit share, not a wall
  rising beyond it).
- **Colour and range** (leg 13): lit faces (190,145,108) where a sunset photo shows orange to
  salmon, the shade at 45% of them (as of leg 2); toward the sun the haze is a milky band over the
  low sea (`high2`, `seed3`). Lit faces darker since leg 2 (`tower`'s 174 → 152 luminance), the
  exposure kept at 14 (raised, the glare toward the sun goes milky). The reviews disagree: deeper
  darks, or the creases lit. Levers: sunScatter's DIFFUSE and μ power (change model.js with them),
  CLOUD_SAT, the exposure.
- **Distant flat tops can look like floating lenses** (their bodies sink into haze and behind the
  curvature); real sunsets seen from an airliner show the same, but watch it.
- **The cirrus and the two high layers tile** every 32 and 64 km (seen in no capture), and their
  streaks all run one way (leg 20).
- `dropAdrift` also removes the tops of some dying towers whose columns evaporated (by design: no
  floating fragments): ~30% fewer towers reach the ceiling.
- **Other places can be emptier** than the start (the spawn draw makes the start look good): ~30% of
  the world is calm air with only the sea and its heaps. Seed 5 starts with no tower within 50 km
  (seed 7 has two above 8 km; `tests/world.test.js` holds it to one); of seeds 1–12, 4, 5, 8 and 11
  have none within 20 km. The author: other seeds' starts don't matter (2026-11-24).
- **A lattice at the level handovers** (~10–13 and ~40–55 km: `away`'s middle distance, `anvil`'s
  far sea): pixels dither between two levels; the history averages it at rest, 12-frame captures
  show it. At 40–55 km it is L2's 2 km columns; at 10–13 km L1's billows, sized from 512 m cells,
  rounder and larger than L0's. Levers: blending (+12–18%, decisions), L1's billow sizes nearer L0's
  (leg 17); the first half second's checkerboard on thin far cloud is the same dither, before the
  history holds it (leg 14).
- **The grain** in flight (tools/measure.js): 0.06–0.72% of a frame over the motion strip, 0.54 and
  1.18% past near clouds (`past`, `gap`). The march has no jitter; what differs is the trace's pixel
  where clouds move past: a very near cloud's thin outline stepping at it (samples of the distance
  alone would cure it, for half the trace again there: decisions), the strip a turn or a pitch brings
  in at the frame's edge, near outlines against farther clouds in a dive. No limit yet: a change in
  it is a question for `grain.png`. Motion itself (smear, lag in turns) is for the author's eyes.
- **Sunlit rims**: at rest 0.006–0.035% of a frame flickers, along tower silhouettes and backlit rims,
  most toward the sun (`sun`). The history blends at half the rate where the image holds still,
  which may lag or smear in slow motion (the author's eyes). Levers: the cloud scale, the TAAU's
  clamp and blend rate, the approach's floor (trace.wgsl).
- **The held climb** (since 2026-11-24): its rate and feel are for the author's hands; `vClimb`
  (flight.js) is the lever (52: 27 m/s up at 30°; 44: 17 at 20°). The air is the same everywhere: lift
  tied to the world's thermals (stronger under a growing tower) is leg 14's.
- **The measurements' limits** are set for 960×540: at smaller sizes sunlit rims make `high2` and
  `anvil` warn (CLAUDE.md §4).
- The trace binds 16 sampled textures, core WebGPU's limit a stage: another needs two of them in one
  texture.
- A WebGPU validation error shows no note (a harmless one on a browser never tried would stop the
  piece); the tools hear every one.
- `tools/linux.js`'s SwiftShader captures can differ from CI's by a level on a stray pixel
  (SwiftShader compiles for the CPU it runs on): compare the container's with the container's.
