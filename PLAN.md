# Plan

What a session needs beyond [CLAUDE.md](CLAUDE.md) (the vision, the rules, how to work a request):
what was tried and failed, and why, and what is still open. Keep it short and current: an approach
that fails goes in the decisions with why and when (evidence for later, not a rule); a fixed issue
comes out. How things work belongs in the module headers, how to work in CLAUDE.md.

## Next: legs 8–12, from the known issues (2026-11-22)

The known issues below, checked on HEAD (8a4dacb) against a capture of every view (960×540, NVIDIA
laptop), the scripted flights and the world tools, and put in the order the images ask for.
`screenshots/` isn't kept: the numbers here (sRGB means over a region of a still) are what is left
of that capture. As in legs 1–7, each step: a before/after capture of the views named (CLAUDE.md
§4), the cost (`node tools/cost.js`) where the trace or a bake changes, flights compared where the
flight or the world changes, then a line here on what held (and in the decisions on what failed).
The author judges after each leg; legs 8 and 9 are mostly taste.

**First, from the author**: `?bench` on the branch's preview
(https://bstummer.github.io/flying-at-sunset/cloud-improvement/?bench) on a phone and on an
integrated GPU, and the page opened once in Safari and in Firefox. Every budget below is one NVIDIA
laptop's in Chrome; if a phone can't hold the piece, leg 12 comes first.

**Leg 8, done (2026-11-22)** (`screenshots/l8-before` → `l8-final`; `node
tools/light/reference.js --shade`). Before it the near shaded sea was navy and flat: (41,49,73) in
`start`'s lower right, luminance ~50 with an SD of 3.5–6, 26–35% of the lit faces beside it; all of
`under` (60,54,61).
1. The shade's reference (tools/light/): the Monte Carlo in colour under the page's own sky (sky.js
   reads the sky view out of the built page at the start's height, 1845 m; its integrals match the
   ambient buffer within 1%, 6% on the sun's side), the sun lit or behind another cloud, a path
   leaving the shape meeting the sky, a sunlit wall, or the sea below (lit or in shadow, as the
   Monte Carlo's own top sends it); a fold (a crease between walls at 30–60°) besides slabs and
   balls. At 5° the sun puts only 1.4 times the sky's light on a level top. It found the trace's
   shaded sea tops at 0.35–0.63 of a real cloud's and bluer (b/r 3.6 against 2.4 in light, before
   the saturation): its sky light fell to 0.59 at the sea's level (`up`, the prototype's stand-in
   for openness). Against the lit top seen the same way, a real top in shadow sends 50–67% (from the
   side and away from the sun), the trace 31–39%. A crease between walls at 30, 45, 60° sends 0.8,
   0.7, 0.6 of an open top (the trace: as much as the top); a sunlit wall 0–15° up a kilometre off
   lifts a shaded top 20–40% (2.6× seen grazing toward it); a top seen 10° down sends 1.6–2× what it
   sends up (the trace: the same every way); bellies 3–4.5× the trace's over a lit sea, 1.4× over a
   shaded one; a tower's own shade 0.65× (the diffusion, leg 2's fit).
2. The light from the sunlit cloud around: the lit map (render/sunmap.js, shaders/litmap.wgsl): over
   the sun map's window, how much sunlight reaches the sea's layer (the sun map halfway up its
   billows: the heaps' and towers' cast shadows, not the billows' own shading, which is the deck's
   albedo), 80 × 64 m texels with mip levels, drawn when a window's bake ends. The sea's light from
   below (chunks/sealit.wgsl) is the sky's as it reflects it (0.8) and the sunlit deck's where it is
   lit, over a stretch as wide as the point is high (≥ 400 m): on bellies at full weight, on the
   lower half of the sides, the bird's `ambDn`. Where the heaps around close the sky (step 3), the
   light of their sunlit flanks on faces turned from the sun (0.05 of the sunlight × the closed
   share × the lit share), at the surface only. Bellies 0.56–0.84 of the reference over a lit sea
   (a Lambertian deck has no glare toward the sun at the horizon), 0.66–0.77 over one in shadow.
3. Form without the sun, in place of `up`: the sky light by how open the sky is over the large
   shapes at 250 and 750 m (their normal from a tetrahedron of `macroAt` taps 64 m out; how much
   farther from them a point out along it lies, over the distance; the two scales' mean), as 0.35 +
   0.65 of it, at each lit sample near the surface (as the taps before it); the small tap (~55 m)
   out along that normal and back toward the camera (up and back, it ran into every belly seen
   from below); and by the view's angle to that normal (0.92–1.5×, milder than the flat slab's:
   billows tilt their faces toward a grazing view). The trace against the reference: an open top in
   shadow 0.76–1.02 (grazing views 0.61–0.73 before), against the lit top 47–51%; creases 1.1–1.25
   (0.91, 0.84, 0.68 of an open top for walls at 30, 45, 60°). Failed on the way (decisions): a
   normal from the light march's facing, the openness against the billowed surface, scales tied to
   the pixel, the point's distance as the taps' mean, a 0.2 floor, the openness once a cloud.
   The look: the shaded near sea lighter (sRGB luminance 50 → 56 in `start`'s lower right, 49 → 55
   in `side`'s, 50 → 61 in `giant`'s foreground, 67 → 70 in `down`; against the lit faces beside it
   35 → 38% in `start`, where a tower's shadow lies over all of it, 46–52% elsewhere), with form in
   its swells and valleys and in the middle distance, the brown blotches gone (the constant warm
   bounce on downward facets where the sea below lies in shadow); bluer, not lavender ((45,56,83)
   in `start`). `under` navy, (56,53,64) → (37,44,60): the sea beneath lies in the anvil's shadow
   for tens of km, nothing warm comes up. `close` and `tower`: the creases between lit lobes bluer,
   the darkest 1% as before. `skim` a lighter mauve-grey card, `inside` a shade darker (leg 9).
   Shimmer at rest down in every view (`start` 0.048 → 0.040%, `tower` 0.111 → 0.101%). Flights
   identical (only the bird's light from below changed in the probe). Cost (`node tools/cost.js
   --against e43f53a`: interleaved A B B A A B, a view at a time, 200 frames, NVIDIA laptop): the
   trace +2 to +11%, ~+5% on average (`start` +6, `sun` +2, `side` +11, `tower` +3, `high2` +5,
   `close` +5; a second run of the tool read up to 4% otherwise a view; the openness's seven reads
   a lit sample near the surface); two pages at a time, as `npm run shot` renders them, it read +8
   to +12% (`tower` +11): they share the GPU. The lit map 0.03–0.04 ms once a window (~2 km of
   flight), 170 KB.
4. The author (2026-11-22): between the shade's colours (A as now, B the tints off, C the
   saturation on the sun's light alone) they barely see a difference: A stays (the violet on the
   sides turned from the sun is the nearest to lavender; B and C only take blue out). `under` and
   the bird in shade stay as they are, physically right. The trace's ~+5% a frame stays (dynamic
   resolution takes it; leg 12's devices will say more). Noted for leg 9: flying through dark
   clouds the screen turns bright (step 1).

**Leg 9, done (2026-11-22)** (`screenshots/l9-before`, HEAD 13e949c with `?jit` patched in for the
grain, → `l9-after`; the skim flight as a 12 s strip, scratch). Before it `inside` and `skim` were
flat cards, brown and mauve grey ((124,98,80) and (136,116,116)), each starting dark while the
exposure ramped up from nothing; seen from a billow's edge (`edge`, new) the far towers were outlines
under an orange veil, and the picture grainy in flight.
1. The exposure from the frame (shaders/exposure.wgsl, after the bloom chain's down passes; bExpo,
   which the final pass reads): the log-mean luminance of the chain's coarsest level, and how much
   of the frame is the fog of the camera's own cloud (the trace's second target, step 3: the light
   that gets through it, over a 24 × 14 grid), each adapted at 2/s, the first frame adapted. The gain
   (e^−2.3 over the mean)^0.5, between 1 and 4, to the power of the fog's share. Outside cloud the
   exposure is 14 as before; `inside` gets 3.3× ((124,98,80) → (174,142,122), tan-peach), the old
   `skim` pose 3×, `edge` 1.26× (37% of it fog), where the probe's point at the camera made
   it all fog. The square root keeps a cloud in shadow darker than a sunlit one (the author: flying
   through dark clouds turned the screen bright, at the old 8×); a higher target (−1.8, −1.3) put
   `inside` at (190,156,132), the cap: a little lighter, not kept. The probe's estimate of the mist
   lights only the bird now; `inCloud` (the point) only the camera's shake and the mist puffs, and
   it starts at the first reading (a flight that starts in cloud doesn't fly in).
2. The first tens of metres: the bubble of thin density around the camera (0.22× within 12 m, all
   of it by 160 m) is gone: crossing a surface it took ~2.8 optical depths out of the view at once,
   a cut. The camera's own cloud frays in its first 40 m instead (`fray`, trace.wgsl: the detail
   volume's Worley noise, 16–64 and 4–16 m cells, about 60% holes at the surface, 20% 20 m in): from
   `edge` the sky's blue and the ridge show through a peach veil, where without it the whole frame
   is veiled orange. 15–28 m under a flat top (the skim flight's first 4 s) the fog stays even: in
   fog lit evenly, density doesn't show (every ray comes to the fog's colour), and that deep, at a 5°
   sun, the light is all diffusion. What it shows: warmer and brighter toward the sun, the sun's
   disc through thin fog, the edge of a cloud's shadow in the mist as a shaft from the sun.
3. The grain. The instruments: the view `edge` (the pose of the known issue, crops over the horizon,
   the ridge and the sky), and the grain (tools/measure.js, `grain.png`): the still against itself
   rendered with its jitter sequences 8 frames on (`?jit`): whatever moves moves alike in both,
   only the noise the history can't average in flight differs. The cure: the camera's own cloud is
   marched first, in a loop of its own (trace.wgsl), from the camera (no jittered start) in steps of
   0.12 optical depths, the same for every pixel, until the ray first comes out, that last step's
   part past the surface taken back (by the distances at its ends, `exitCut`); then the main loop,
   as before, from there. `edge`'s grain at the still 6.5 → 2.1% (the ridge 17 → 2.4%, the sky 0.18 → 0%, the
   horizon 4.9 → 4.2%: what is left lies on silhouettes, as in every view at a 12-frame history:
   `tower` 6.5%, `close` 8.2%); its shimmer at rest 0.002 → 0.036% (the far rims show through the
   fog now). `inCloud` no longer reaches the trace: in the camera's own cloud the shade's tints and
   saturation are off, its variations on. Outside cloud every view is as before (within a level,
   on under 0.1% of the pixels: the tints' arithmetic). Two faults on the way, fixed: reprojected by the fog's
   tens of metres, the far towers' silhouettes behind it got dark fringes in flight (the depth for
   the history is now that of what shows through the fog, the sky's where only sky does); and so
   marked, a fog pixel put the two high layers in front of the fog (a white streak toward the sun:
   the fog lies in front of them, by the trace's second target). The far towers have their form
   back, no longer outlines.
4. Deep inside a tower: the variations of density and the mist puffs as they were; the motion strip
   shows faint puffs drifting and the brightness changing slowly over a tan card. For the author's
   eyes.
5. `skim`'s view from 400 m over the sea's top (just over the billows there, 21 m by the probe;
   `pose`, tools/views.js): into the sun over the tops, billows at every size, the near ones in
   blue shade, the lit tops crisp. The preset and its flight stay in the billows: from over them a
   held dive skims along 19–133 m above for 15 s and never enters (the flight check wants it in).
   Flights identical (all five).
   Cost (`node tools/cost.js --against HEAD`, interleaved A B B A A B, 200 frames, NVIDIA laptop):
   the trace −4 to +2% (`start` −2, `sun` −1, `side` −3, `tower` −1, `high2` −4, `close` −1, `edge`
   +2, `inside` −2, `skim` −1); the exposure pass ~0.01 ms a frame (`post`); the mist puffs drawn
   from `inside`'s first frame, `taau` +7% there. Carried through the main loop, the camera's own
   cloud had cost the trace +16–17% in every view (decisions). The views' capture (`npm run shot`)
   155 → 240–400 s: a third render a view, for the grain. `npm run verify` 580 s.
6. The grain at the clouds' edges in flight, the camera outside cloud (the author, 2026-11-23: "still
   pretty grainy / noisy ... you can see it better in motion"). The grain at the still read the
   history's youth (12 frames in: 1–8% of every view, after 2 s of straight flight 0.13–0.58%), so
   it is measured over the motion strip's frames now (2 s), and a view `turn` (`side` flown through
   the weave) holds a turn. In a dive at frame 120 the sub-pixel jitter and the trace's own
   sequences gave about half of it each. What helped (shaders/taau.wgsl): the clamp and the blend by
   the parallax of the camera's movement (where the history lies against where it would at
   infinity), not by the image's motion: a turn, a bank, the camera's shake are rotations, which
   reproject exactly, and each had tightened the clamp and quickened the blend, so the history
   followed each frame's jittered rims; the history reprojected by the nearest depth of the 3×3
   around (at a silhouette both sides move as the near cloud does; the same depth sorts the high
   layers, which had flickered on towers' outlines at rest); where a turn leaves a pixel's history
   off the frame, the neighbourhood's mean to start from; the history's first 8 frames their plain
   mean (at the slower rate the first frame's one sample had lingered for seconds). Grain in flight
   (the strip, 4 levels or more): `turn` 1.27 → 0.44%, `away` 1.16 → 0.29, `side` 1.06 → 0.36,
   `tower` 1.45 → 0.46, `close` 1.74 → 0.97, `start` 0.70 → 0.23, `edge` 0.67 → 0.44, `down` 1.19 →
   0.73 (its billows crop 0.59 → 0.84: the corner of a dive straight down); at frame 120 weaving
   about halved, diving a quarter to a half. Shimmer at rest down in every view (`tower` 0.101 →
   0.015%, `sun` 0.061 → 0.035, `geometry` 0.35 → 0.21). The stills as sharp (1–9% of their pixels
   move by more than 2 levels: other noise converged otherwise). Left: the strip a turn or a pitch
   brings in at the frame's edge, near outlines against farther clouds in a dive. Cost: the TAAU
   +10% (0.012 ms a frame), the trace unchanged.
7. Flying into a cloud's edge (the author, 2026-11-23: "the outlines of the clouds in the
   background look weird"). In the skim flight at 5.6 s, the camera a metre under the top of the
   billow ahead, for 0.2 s: the near billow dark, the lit sea beyond in a hard-edged strip, a
   lighter block between with stair-stepped edges (new in leg 9; before it, `inCloud`'s fading
   thinned it all away). The rays that skim the top from just under it came out, were handed to
   the main loop, and met the top again as a crisp surface lit from outside, or stayed in the
   camera's fog, by the smallest bumps of the stored shapes (texel-sized, at a grazing angle): two
   ways of drawing one cloud, in blocks. Now the own loop goes on through the air near the camera
   until clear of cloud by 12 m; a cloud it dips back into is unfrayed and lit toward the main
   loop's skin by how far clear the gap took it (none at a hair's breadth, all of it by the
   clearance, as the main loop lights it past there); near its surface the camera's fog is lit as
   the main loop lights the cloud from outside (the tints, the saturation, a grazing view's sky
   light), deep in, grey as before, so going out of a top or into it changes nothing (it jumped
   from dark grey fog to the lighter blue surface). And the main loop starts where the own loop
   leaves off as from a point outside (it started as if entered at the camera: its light points
   tens of metres off where a ray went straight back in). A view `entry` holds the moment (the
   skim flight 5.4 s in). The views outside cloud as before (within a level, on a few pixels);
   `edge`'s near billows softer, without a seam. Cost: the trace in cloud `entry` +2%, `edge` +6%,
   `inside` +3%; elsewhere the same.
8. The author (2026-11-23): not fixed: what they see flying into an edge wasn't what step 7 found
   (it was never reproduced). P now copies the moment's pose as a view (CLAUDE.md §3, the deployed
   page too), and they sent three, each flying out of a cloud's edge. There: a pale yellow-green
   rim a few pixels wide along every far cloud's outline against the sky, for about a second after
   the camera leaves the fog (before leg 9 too; step 6's blend by parallax made it a little
   stronger). Not the trace (its frames are clean): the history. In the fog it learned "fog over
   sky" at each pixel; out of it, at a silhouette the clamp box spans cloud and sky, so the stale
   fog passed it, and far clouds have no parallax to quicken the blend. Now the TAAU keeps beside
   the history how much of the camera's fog it holds (an r8 target at full resolution, blended as
   the history is), and where that lies more than 0.06 outside the fog the 3×3 around sees now,
   the history gives way to the neighbourhood's mean (decisions). And a lattice in the camera's fog,
   new in leg 9: straight-edged bands and stair-steps across it (`?view=1` shows them in the
   transmittance, faint in the image), as the camera moves a lattice crawling over the sky. The own
   loop's unjittered steps, up to 6 m where the fog is thin and the same for every pixel, stepped
   over the erosion's rises (4 m) or onto them: in that ramp, steps of 0.4 of it where a ray goes
   into the cloud or out, 0.8 where it runs along the surface. Views `exit` and `exitsun` hold two of
   the moments. Grain over the strip: `exit` 0.90 → 0.77%, `exitsun` 1.44 → 1.12, `edge` 0.42 → 0.37,
   `entry` 0.67 → 0.62; out of cloud identical. `entry`'s lit cloud through the shreds brighter and
   more whole (the long steps had counted fog where a ray only grazed it); `edge`'s shimmer at rest
   0.007 → 0.021% (a few more dots on the lit tower, a few in the near fog). The far clouds just
   out of the fog are a little softer for a second (the mean the history took while it cleared).
   Cost: the trace in cloud (each view's first 30 frames) `edge` +3%, `entry` +6%, `exit` +7%,
   `exitsun` +19%, `inside` 0; out of cloud the same. The TAAU +4–8% (0.01 ms a frame).

**Leg 10: distance.**
1. Done (2026-11-23; `screenshots/l10-before` → `l10-after`). Where the far blobs came from
   (`?dbg=3` split by channel, and each channel turned off): the shadow volume's other clouds,
   its 768 m texels, past the sun map's window (8 km off the camera across the sun's way, 8 km away
   from the sun, 12 km toward it), so in most of every view's middle distance; its own channel
   (a cloud's body past 6.3 km) hardly shows, and `seed3`'s far sea lies in its towers' real
   shadow. With the shadow volume in the sun map's place near the camera, `side`'s sea showed the
   same blobs. Now the sun map has a coarse level around the fine one (render/sunmap.js): texels
   256 m across, 128 m up, 1280 m along the sun's rays, over 65 × 82 km (33 km away from the sun,
   49 km toward it), 3.7 MB, baked from L1 and L2; the light takes the clouds past ~1.4 km from it
   where the fine level fades, the shadow volume past it. The judge: the fine level stretched over
   82 × 65 km (a reference build, 230 MB), the mean distance from it in sRGB levels, before → after:
   `side` 2.29 → 1.99, `high2` 1.65 → 1.45 (the right tower's lit blobs gone, the heaps below it
   lit as there), `close` 1.76 → 1.67, `start` 0.83 → 0.81, `giant` 0.18 → 0.16, `sun` 0.55 →
   0.54, `seed3` 1.00 → 0.99; `anvil` 1.68 → 1.71 and `away` 0.59 → 0.62 a hair farther. Pixels
   changed (> 2 levels): `high2` 6.8%, `side` 5.1%, `close` 4.2%, `start` 2.3%, `away` 2.1%,
   `anvil` 1.4%; the near views as before (`inside`, `geometry`, `down` identical, `under` within 3
   levels). Grain over the strip up where far towers now have shadows (`start`'s tower 0.44 →
   0.54%, `sun`'s rim 0.51 → 0.63, `high2` 0.24 → 0.27): the reference has more (0.95, 1.06,
   0.27), the true shading's own structure, which the jitter moves; four taps a lookup the same.
   What is left of the gap to the reference: far towers' lobes shaded by the lobes beside them
   toward the sun, within ~1.4 km (known issues). On the way, a fault in both levels' march past
   their window (the streaming check found it once the coarse window moved in its flight): a ray
   whose end lay over 600 m inside a cloud was taken as deep in the sea, dark past it, and past
   the march's first 1.5 km every cloud counted as another's; a window ending inside a tower
   shadowed the texels in it toward the camera with the rest of that tower (up to 0.36 of a texel
   column's light against a window ending a few texels farther). Each ray now first steps out of
   its own cloud by its distance. Failed on the way (decisions). Cost (`node tools/cost.js`, 200
   frames): the trace −1 to 0%; the bake ~45 ms more in the first frame (the fine level's 20–35),
   ~0.18 ms a frame for 4 s each time the coarse window moves (every ~5 km). The trace binds 16
   sampled textures now, core WebGPU's limit a stage.
2. Done (2026-11-23; `l10-after` → `l10b-after`). The handover from L0 to L1 at 10–13 km (it was
   7–10; L0's window reaches 14 km from the camera even while it shifts). What changes there is
   mostly the surface, not the light: hard-switched at 7 km against 13 km, the views differ by 0.6
   to 1.2 levels on average, and the openness, the light march's far steps or its first steps taken
   from L0 changed that by 0–15% (decisions); L1's billow sizes, from 512 m cells, make rounder,
   larger domes than L0's at the same place. A near tower in the band showed both, with the dither's
   lattice between (`side`'s lit tower, 7–10 km off); now it is L0's, crisper, and the band lies on
   smaller, hazier clouds. Grain over the strip: `side` 0.36 → 0.19%, `turn` 0.46 → 0.30, `sun`
   0.33 → 0.30, `giant` 0.22 → 0.19, `away` 0.29 → 0.28; up in `close` 0.98 → 1.06 (its tower's
   near part, L0's finer domes now), `high2` 0.27 → 0.31, `start`'s tower 0.54 → 0.58. Shimmer at
   rest: `side` 0.013 → 0.006%, `giant` 0.007 → 0.003, `down` 0.008 → 0.003; `close` 0.014 →
   0.019, `anvil` 0.033 → 0.039. Pixels changed (> 2 levels): `close` 9.3%, `side` 8.4%, `geometry`
   7.6%, `away` 6.6%, `high2` 4.8%, `down` 4.1%; `under` and `inside` identical. The trace −1 to 0%
   (`node tools/cost.js`, six views).
3. Silver linings, tried (2026-11-23), not kept: for the author (frame rate). Thin cloud over the
   outline's footprint of far towers (from 4–10 km on, above the sea's heaps) seen against the sun
   (the sun within ~45–70° of the view: lit from the front it softened their cauliflower to
   cotton), the light march thinned alike (else the thin edge is lit as dense cloud: dark). At a
   fifth of the density over two pixels, `sun`'s towers and `anvil`'s top get a warm rim a few
   pixels wide on the side toward the sun, the lobes still drawn; at a tenth or a twentieth the
   rims glow wider, but the edge turns see-through: lobes blur, ghost rings where they overlap. The
   outline's ramp widened (the light's skin follows it) and the light march thinned does as well.
   The cost, and what it is (the author asked whether a register limit is the cause): the tools'
   headless shell compiles the shaders with FXC (it ships without DXC, tools/browser.js), Chrome
   with DXC (its default; the trace 1111–1120 ms over 200 frames of `away` against FXC's 1219–1224,
   Chrome 157 and the shell, NVIDIA laptop). Under FXC one more number carried through the main
   loop (a sum, one add a lit sample) costs +12.2%, more arithmetic in it (sines, cosines) −0.5%: a
   cliff of registers, where every way of writing the silver lining cost +12–14% in `away`, where it
   changes nothing. Under DXC both cost nothing; the silver lining +6.6% (`away`) and +7.2% (`sun`)
   with the ramp, +8.5% and +13.6% with the thin view density. Of that, the ramp +0.5%, the thin
   edge in the light march +7.4%: its state through the six steps, each a `cloudSDF`.
4. The haze toward the sun: a row of `?haze` values (1.3–5 × 10⁻⁵ against 2.6 now) changes the veil
   over the low sea toward the sun little (most of it is the atmosphere's own aerosols, `MIE_S`);
   the author saw no difference: kept (2026-11-23).

**Leg 11: tower shapes** (the world: the fingerprint recorded again, flights compared).
1. The instruments: the mushroom measure (leg 6's scratch script) and a count of knobs into
   stats.js; and two views that miss their briefs (known issues): `giant` and `close`, their poses
   found again, `close` up a flank from below.
2. Popcorn far away: every bubble over ~2 km carries the same 1280 and 640 m lobes (90% and 70% of
   their cells filled), and its liveliness moves their height only between 0.6 and 1 (cloudSDF's
   A), so a tower 20–60 km off is rows of beads (`high2`'s right tower, `away`'s horizon, `start`'s
   right tower). Old parts smooth and young ones boiling (the liveliness over its whole range), the
   lobes' size by the bubble's billow scale; spheres of power-law sizes failed (decisions).
3. Mushrooms and knobs by their causes (known issues; catalog.js still shows a wide top on a
   narrow column among the twelve tallest, and small balls perched on most heads): a column
   widening with the shear it stands in, the smallest crowns taken into their heads.
4. Other seeds' starts (known issues): the spawn draw scores sites, not the towers that grew in
   view. Low: only `?seed` reaches them.

**Leg 12: reach, before `main`** (the branch is 28 commits ahead of what is published).
1. The devices' numbers (above), and what they ask for: the phones' resolution cap and cloud
   scale, the budgets.
2. `bakeCost` (render/stream.js) from the device's own GPU times where it has timestamp queries; it
   is one NVIDIA laptop's constants.
3. The textures and buffers made once at the start: a note in place of blank frames when one
   fails, and what a small device could go without (about 130 MB of volumes and tables that never
   shrink, and 40–80 MB of targets by the canvas: counted from the formats, not measured).
4. The stall where the bird outruns its patch of domes (core/world.js): a check that flies it
   there at top speed, then what the check asks for.
5. The values JS and WGSL both keep as literals into constants.js; tools/linux.js tried (Docker
   wasn't running on 2026-11-22 either).

Not in a leg: the drift (the author's: nothing has to, for now); the shimmer at sunlit rims
(0–0.11% a view in this capture, `geometry` 0.35%: within the limits, and each lever left costs
5–46% of the trace, decisions); the cirrus and the high layers' tiling (seen in no capture);
`dropAdrift` (by design); the far
flat lenses (real ones look so; `seed3` has one); an isolated ball against the light's reference
(the trace can't see how little cloud lies behind a billow).

## Done: the cloud review of 2026-11-20, legs 1–7

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
- **The sun map's coarse level, first tries** (leg 10, against a reference with the fine level
  over 82 × 65 km): its stretches in four steps a texel as the fine level's (320 m each): where a
  ray passed 30 m over a billow a step counted a fifth of itself inside (an optical depth of ~4.5),
  and lit faces and the far sea came out mottled with shadow (`side` 2.98 levels from the
  reference, the shadow volume 2.29; steps of 80 m since). The clouds within ~1.4 km from it too, as
  the fine level gives them: its texels sit inside a tower's body, so a side lit at a grazing angle
  took the body beside it toward the sun for its own cloud and lost its shadow (the march's steps
  see some of it). Four taps a lookup, as the fine level's: the trace +8–11%, one the same to the
  eye and in the grain. Against its window's differences after a move (the march past it, found
  above): the march's first 4 km in steps of 80 m as the window's stretches, its rays not bent
  with the planet, L2 alone: none changed them.
- **Costs measured with FXC** (leg 10): the tools compile the shaders with FXC (the headless shell
  has no DXC), visitors' Chrome on Windows with DXC, Macs with Metal, Linux and Android with Vulkan.
  FXC puts the trace's main loop at a cliff of registers: one number more carried through it costs
  +12% (DXC: nothing), and every formulation of the silver lining +12–14% in a view it doesn't
  change. Leg 9's flag for the camera's own cloud in the main loop (+16–17%) and leg 8's openness
  once a cloud (+15–22%) were judged so too: worth measuring again under DXC.
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
- **The openness of the sky, first tries** (leg 8): a normal from the tap up and the light march's
  facing toward the sun: that facing is a one-sided difference over 58 m, so at a crease it points
  into one wall and taps along it read every crease closed (folds at 0.4–0.5 of the reference).
  The large scales judged against the billowed surface (the distance to the billows out along the
  large shapes' normal): every billow flank tilted from the large shapes read as a crease, the
  sea's openness ~0.55 on average, which ate what dropping `up` gave; against the large shapes' own
  distance it is consistent. The scales tied to the pixel (to 670 m and 2 km at 9 km): a whole
  tower in one tap, its flank and the sea under an anvil black. The point's distance as the mean
  of the tetrahedron's taps: the field kinks at a crease (−45 m against −1 m), creases read open.
  A floor of 0.2: an enclosed spot fell to 0.12 of the sky's light, as if the walls closing it
  sent none of their own. Taken once a cloud the ray enters instead of a sample (the same to the
  eye): the trace +15–22% where per sample it is +8–12% (both two pages at a time), lanes
  entering clouds at different steps, so a warp runs it whenever any lane needs it.
- **A fringe outside the surface for silver linings** (before the legs, thin cloud 40 m out, lit
  forward): rays toward the sun skim the sea's tops through it for kilometres (glowing veils; capped
  per ray, sheets with hard edges, like film).
- **The in-cloud mist's variations near every cloud** (within 900 m of the camera, before the legs):
  near surfaces fogged.

### In cloud

- **Handing the skim of a top to the main loop** (leg 9, step 7), the ray out of the camera's cloud
  at its first air: stair-stepped blocks where it met the top again as a surface seen from outside,
  fainter with the fog lit like it, still there. Kept in the own loop until 20 m clear: `edge`'s near
  billows a smooth veil, their domes gone; 4 m clear: a straight seam across them between frayed
  fog and crisp surface, as much without the fray past the first air. Not the cause (each changed
  nothing): the own loop's step cap (240 or 2000), a softer threshold for the shreds, the camera's
  cloud ramping in over its first 8 m, finer steps in its holes.
- **The stale fog in the history, given way otherwise** (leg 9, step 8): toward each frame's
  jittered sample by how stale it is (×6), the rim gone, but the grain while the fog clears doubled
  (`exit`'s neighbour 1.23 → 2.70%), ×3 still +60%; toward the neighbourhood's mean with no
  threshold, `edge`'s world soft (its fog drifts a little each frame); half mean and half sample,
  a faint rim for a few frames.
- **The lattice in the camera's fog, cheaper** (leg 9, step 8): steps of 0.4 of the erosion's ramp
  everywhere in it, the trace in cloud +16% (`exit`) to +33% (`exitsun`); within 60 m alone or
  while the fog in front is thin, about as much (the steps go to thin fog near the camera); growing
  faster with the distance (0.03–0.05 per m), or uncapped where a ray runs along the surface, the
  lines back, faint. The erosion's mean at 4 points along a long step (a few texture reads instead of
  steps): the lines stayed.
- **Grain measured at the still alone** (leg 9, step 3): 12 frames in the history is young (1–8% of
  every view, after 2 s of straight flight 0.13–0.58%), and the bird flies straight: it read the
  start, and missed turns and dives. Over the motion strip since step 6.
- **Grain measured by frames a step apart in flight** (leg 9, the plan's first instrument): the
  share of pixels changing from one frame to the next mixes the grain with all that moves (the
  cirrus drifting, the camera's shake in cloud, every edge): with the grain gone from the difference
  images, `edge`'s sky read 9.6 → 11%. And over the motion strip's 2 s the bird leaves the billow in
  its first quarter second. The grain is the still against itself rendered with other jitter.
- **Shreds and holes deep in the fog** (leg 9): 15–28 m under a flat top the fog looks the same with
  them or without: in fog lit evenly, density doesn't show (each ray comes to the fog's own colour),
  and that deep at a 5° sun the light is all diffusion, so holes in the light march would light no
  pockets either. They show only where the outside lies behind them, near the surface.
- **A larger step budget for rays that start in cloud** (leg 9, up to 120 steps more): renders
  identical; the dark fringes on far silhouettes seen through the fog were the history's depth.
- **The camera's own cloud in the main loop** (leg 9: a flag per ray, its fine steps, the fray, the
  tints and the depth by it): the trace +18–22% in views that never enter cloud (`start`, `side`,
  `close`), +16–17% of it the flag's state and branches in the hottest loop, whatever they did;
  in a loop of its own before the main one, −4 to +2%. **The exit cut for every cloud** (each
  step's part past a surface taken back where a ray comes out): +3%, and it moved rims by a level
  or two, nothing the measures saw; kept in the camera's own cloud alone.

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
- **Against the grain left in a dive** (leg 9, step 6, `tower` at frame 120, 1.59%): the blend at the
  rest rate whatever the parallax (1.81%), the clamp as wide as at rest (1.61%), the history
  reprojected by the first surface a ray enters, not the weighted mean (1.56%). What is left there:
  the strip the pitch brings in, near outlines. **The neighbourhood's mean on the first frame too**
  (no history at all): the slow blend kept that soft frame for many frames, the stills softer
  (`close`'s creases). **The plain mean past 8 frames**: at frame 12 still 1/13, the shimmer at rest
  up (`start` 0.04 → 0.078%).
- **The light from L0 across the handover at 7–10 km, in parts** (leg 10): with the level switched
  hard at 7 km against 13 km, the openness (`openLarge`), the light march's long steps or its first
  six steps read from L0 where it reaches changed the views' difference by 0–15% (`side` 1.19 →
  1.01 for the first steps, the rest within 0.1): what changes is the surface, L1's billows (since
  then the handover lies at 10–13 km).
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

- **The tools measure FXC's shaders** (tools/browser.js: the headless shell ships without DXC),
  where visitors' Chrome on Windows runs DXC's, the trace ~9% faster (leg 10). The full Chromium
  build Playwright installs has DXC: the cost tool's numbers would then be the visitors'.
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
  shade, the light march's first ~90 m. **Past the sun map's fine level** (8 km across the sun's
  way, 8 km away from it, 12 km toward it; since leg 10 its coarse level beyond, the shadow
  volume's 768 × 360 m texels past 33 and 49 km) far towers' lobes are not shaded by the lobes
  beside them toward the sun: within ~1.4 km the fine level's texels see that (the march's three
  long steps barely do; the coarse level's sit inside the tower's body). A reference with the fine
  level everywhere (82 × 65 km, 230 MB) gives far towers more contrast, shaded lobes with lit
  rims (`seed3`'s and `high2`'s towers, `side`'s middle tower in its own body's shadow), and more
  grain in flight (`start`'s tower 0.95%, now 0.54). Levers: a level between the two (128 m across,
  7 MB, and the trace's textures at the limit: two levels in one texture), the march's steps there.
  Within a window the map's rays run straight in height, the march past it bends them with the
  planet from where it starts: over the coarse level's 49 km toward the sun a cloud 40 km off
  shades as if ~130 m taller (the fine level's 12 km: ~10 m).
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
  fringe outside the surface failed (decisions). Thin cloud over the outline's footprint, the
  light march thinned alike, makes them (leg 10, step 3), for the trace +7% under DXC (Chrome's
  compiler; +13% under the tools' FXC): for the author.
- **Inside cloud**, deep in a tower (`inside`), is an even tan card ((174,142,122) since leg 9, the
  exposure adapting to the frame: 3.3×): the fog there is lit evenly by diffusion, so its density
  doesn't show; in motion faint mist puffs drift past and the brightness changes slowly (the
  author's eyes). The puffs and the camera's shake still go by `inCloud`, the density at the
  camera's point. Where the camera is in cloud, the history reprojects the fog by the depth of what
  shows through it (far clouds, or the sky): its own shreds near the camera may smear in motion.
  Out of a cloud's edge the far clouds are a little soft for about a second (the history took the
  neighbourhood's mean while the fog cleared, and sharpens at the rate at rest; leg 9, step 8).
  The shreds' edge seen nearly edge-on, a metre under a top (`entry`'s crop), is stippled at the
  trace's pixel: it may shimmer in motion (the author's eyes). `under` (an anvil's underside) is navy since leg 8:
  the sea beneath lies in the anvil's shadow for tens of km at a 5° sun, so nothing warm comes up.
  Kept: physically right (the author, 2026-11-22).
- **`giant` and `close` miss their briefs** (presets.js, clearOf): `giant` stands 62 km from its
  tower (25 km clear of every tower: in a crowd, far out), which fills about an eighth of the
  frame's height where it should dominate. `close` stands 17.4 km from the tower `tower` sees from 9.4 km
  (the first air clear of the heaps at 1100 m over the sea lies that far out) and frames all of
  it; neither looks up a flank from below.
- **The shade's colour**: since leg 8 lighter and with form, but blue, not the reviews' lavender
  grey: the sky's own colour (the reference's shade, b/r 2.4 in light), tinted bluer (COOL_UP,
  COOL_ANTI: b/r 3.5) and saturated (CLOUD_SAT). Lavender needs red in the shade's light: the
  warm bounce from sunlit cloud is there only where cloud around is lit. Without the tints, or
  with the saturation on the sun's light alone, the author saw barely a difference (leg 8).
- **Near the camera** the sea into the sun is still soft, glowing mush (`start` lower left, `seed3`),
  and the shaded sea seen from above blotchy (`giant`'s foreground): the light there is diffusion
  and sky light, smooth over tens of metres. **Into the sun** the sea's tops were pale cream, lit by
  the sky; since leg 2 they have form, with a soft bluish patch beside the bird in `start`.
- **The light against its reference** (`node tools/light/reference.js`): an isolated small ball's lit
  side 5.7× (the trace can't see how little cloud lies behind a billow; on a real cloud, a whole
  body), its edge 1.75×, a tower's shade 3.4–3.7× a ball's, 0.6× a wall's (real towers lie
  between), tops seen with the sun behind 1.2–1.9×, faces 0.83×, the glare off tops toward the sun
  0.83–0.95× (leg 5's medium). In shade, under the sky (`--shade`, leg 8): an open top 0.76–1.02,
  creases 1.1–1.25 (their walls' own light kept by a floor), bellies 0.56–0.84 over a lit sea (a
  Lambertian deck has no glare toward the sun at the horizon) and 0.66–0.77 over one in shadow, a
  tower's shade with the sky 0.65× (the diffusion's 0.6× above), a top beside a sunlit wall
  standing a kilometre off 0.36–0.81× (the lit map sees the sea's lit share, not a wall rising
  beyond it).
- **Lit faces darker since leg 2**: `tower`'s 174 → 152, `away`'s lit sea 146 → 114 (luminance), the
  exposure kept at 14 (raised, the glare toward the sun goes milky, decisions): for the author.
- **The bird in shade** (`giant`): a pale blue-grey silhouette, like the shade around it (its keel
  glowed orange from a sea bounce 2.6× the clouds' until leg 1); since leg 8 its light from below
  is the sea's under it, in shadow there: it nearly vanishes into the shade. Kept: physically
  right (the author, 2026-11-22).
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
  `tests/world.test.js` holds it to one). Of seeds 1–12, four (4, 5, 8, 11) have no tower of any
  height within 20 km, and 4 and 11 only three within 40 km (stats.js; seed 7: 13 and 41).
- **A lattice at the level handovers** (~10–13 and ~40–55 km: `away`'s middle distance, `anvil`'s far
  sea): pixels dither between two levels; the history averages it at rest, 12-frame captures show
  it. At 40–55 km fainter since leg 4: the levels' shapes agree to ~0.1 km (p50), and what is left
  is L2's 2 km columns. At 10–13 km (since leg 10; 7–10 before) the large shapes agree, but L1's
  billows, sized from 512 m cells, are rounder and larger than L0's. Levers: blending (+12–18%,
  decisions), L1's billow sizes nearer L0's (the bake's blend of each bubble's own by how near its
  surface is, over cells four times as wide).
- **The grain** (tools/measure.js, since leg 9): over the motion strip, 0.17–0.97% of a frame
  differs by 4 levels or more from the same flight rendered with other jitter (`close` 0.97%, `down`
  0.73, `tower` 0.46, `turn` 0.44, `edge` 0.44; `geometry` 1.8%): the strip a turn or a pitch brings
  in at the frame's edge, near outlines against farther clouds in a dive. No limit yet: a change in
  it is a question for `grain.png`. Motion itself (smear, lag in turns) is for the author's eyes.
- **Sunlit rims**: with nothing moving 0.006–0.035% of a frame flickers (`geometry` 0.21%; leg 3 halved
  it: strides no longer hop over crests by the jitter; leg 9 halved it again, the high layers sorted
  by the nearest depth around), along tower silhouettes against the sky and
  backlit rims, most toward the sun (`sun`). The history blends at half the rate where the image
  holds still. The slower blend may lag or smear in slow motion: for the author's eyes. The cloud
  scale, the TAAU clamp and blend rate, and the approach's floor (trace.wgsl) are the levers.
- Values JS and WGSL both keep as literals of their own: the sun-colour table's 750 m steps, the high layers' heights, the offsets of struct Probe's fields read back (CLAUDE.md §8 wants them from `constants.js`).
- The trace binds 16 sampled textures (since leg 10, the sun map's coarse level), core WebGPU's
  limit a stage: another needs two of them in one texture.
- A WebGPU validation error shows no note (left out: a harmless one on a browser never tried would stop
  the piece); the tools hear every one.
- `tools/linux.js` is untried (Docker wasn't running).
