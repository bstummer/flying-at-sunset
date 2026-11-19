# Plan

What a session needs beyond [CLAUDE.md](CLAUDE.md) (the vision, the rules, how to work a request):
what was tried and failed, and why, and what is still open. Keep it short and current: an approach
that fails goes in the decisions with why; a fixed issue comes out. How things work belongs in the
module headers.

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
- **Popcorn far away**: towers on the horizon still read as heads of even bumps ("broccoli", `away`,
  `sun`, `anvil`), and towers a few km out (`close`) as a pile of even balls: the 640 m turrets,
  now mostly on the lobes' caps and under the baked 2560 m lobes, still too even. **Gumdrops**: puffs
  on thin necks remain (`close`): the CPU preview shows small world bubbles perched on heaps
  (src/world/), not only billow octaves. **Sunlit turret tops in shade** read as floating puffs
  (`start` beside the bird, `sun`, `tower`): attached (`?dbg=1`), their base melts into the shade.
- **Flat tops**: a stopped head is pressed to 0.3–0.85 of its radius by how stable the air that
  stopped it is (thermals.js, settle), and that is near 1 for almost every stopped head: flat discs
  stacked at the tops (`catalog.js`), flat-topped blocks (`start`'s left tower, `seed3`, `high2`).
  The baked lobes round some. The cause to change is in the world (and needs the fingerprint).
- **Silver linings** are a pixel wide: a backlit tower's edge doesn't blaze (`sun`, `anvil`); a
  fringe outside the surface failed (decisions).
- **Inside cloud** is a uniform wall (mauve grey, `inside`), even with the exposure adapting to the
  mist (the probe's estimate runs brighter than what the trace draws there, so the gain stays low);
  drifting mist only shows in motion. `under` (an anvil's underside) is dark navy now: right
  for shade at sunset, but judge it against its brief.
- **`close` no longer meets its brief**: since heaps are wider (2026-11) the first spot clear of
  them is farther from the tower (presets.js, clearOf), so it shows the tower whole, from a few km,
  not its flank from below. `stats.js` counts 10% more bubbles in its 120 km box (6,158): more
  systems reach into it with wider heaps, each counted whole; no tower changed. A faint vertical seam
  in shaded sea in `close` too.
- **Near the camera** the sea into the sun is still soft, glowing mush (`start` lower left, `seed3`),
  and the shaded sea seen from above blotchy (`giant`'s foreground): the light there is diffusion
  and sky light, smooth over tens of metres. **Into the sun** the sea's tops are pale cream: the sky
  light on faces turned from the sun brightens them (`?dbg=7`).
- **Colour and range** (reviews, 2026-11): lit faces apricot (≈ 238,177,116) where a sunset photo
  shows orange to salmon; toward the sun the haze is a milky band over the low sea (`high2`,
  `seed3`). Lit tower faces sit high on the tone curve with their folds filled by the light inside
  (`tower`'s lit face: luminance SD 36 before, 20 now); one review wants deeper darks, another
  wanted the creases lit: the balance (`facing` in sunScatter, AMB_K) is the lever.
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
- **Sunlit rims**: with nothing moving 0.02–0.16% of a frame flickers (`close` 0.36%, `geometry`
  0.46%): the finer domes flicker along tower silhouettes against the sky and backlit rims. The history blends at half the rate where the image holds still. The slower blend may
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
