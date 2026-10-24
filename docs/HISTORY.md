# History

How the piece was built, request by request (the requests are quoted in full in `docs/BRIEF.md`).
All work happened on the branch `claude/awesome-fermi-i208te`; commits are listed per round.
Measurements were made with software GL (SwiftShader) in a headless browser, so they are relative.

## Round 1 — the core piece (1 Oct 2026)

Commits: `a3e7666` first working version, `0207ff2`, `aa82140`, `11653c2`, `5d2ee7c`, `77643a9`,
`87dd39a`, `6e57bae`.

- Physically based sky (Hillaire 2020 LUTs: transmittance, multiple scattering, sky view), sun
  colours by altitude, haze.
- Clouds as raymarched signed distance fields: a cloud sea and towers built from fbm-of-spheres
  billows, a tower shadow volume, temporal upsampling (TAAU) from a low-resolution trace, bloom, sun
  rays, hue-preserving filmic tone curve. The world was a 128 km tile.
- An origami crane with paper shading, translucency and flexing wings; an energy-based glider with
  springs, coordinated turns and a soft floor from a GPU probe of the real billowy surface; a chase
  camera; mouse, touch, keys, gamepad; the fading hint; fullscreen on double-click / F.
- Lighting work: cloud interior diffusion, isotropic shadow fill, short-range occlusion, haze without
  a horizon seam, drifting mist puffs and near-camera thinning inside cloud.
- Robustness from an independent code review: dynamic resolution with GPU timers or frame times,
  recognising frame-rate caps; out-of-memory retry at a smaller size; error note instead of a black
  page; pointer leaving the window; Cmd/Ctrl shortcuts; MSAA format support; context loss.
- Fix: distant towers looked dark and speckled because sampling started deep inside a far stride;
  entry points are now found by regula falsi (`77643a9`).

## Round 2 — towers of every size, floating clouds, high layers (1 Oct)

Commit: `9382906`.

- Mid-round question: are the clouds random? A handful had been hand-placed along the opening
  flight path; they were removed: everything generated. Two placement rules remained (keep the start
  and the view of the sun from it clear).
- Towers from a convection field of loose clusters and wind-aligned lines: ~250 low humps, ~50
  medium towers, a couple of dozen large ones, up to five giants. Turrets stacked like a cauliflower
  on broad bases; some leaning, a few torn downwind into wisps; crisp rims (the sea stayed soft).
- ~390 floating cumulus at many heights (flat undersides, lumpy tops, soft shadows); two thin
  wind-stretched layers at 6.3 and 7.7 km drawn as sheets in the composite pass.
- Sky light by orientation (zenith blue on tops, warm sea bounce under bellies, golden or violet on
  the sides); light glowing golden through thin parts, cool where it travelled far.
- Cost: trace 1.3–2× round 1.

## Round 3 — one random landscape (1 Oct; 3 photos attached)

Commit: `b5f8a74`.

- The author: clouds looked designed (too many similar towers, evenly spread, like chess pieces;
  popcorn bumps). Rebuilt as a single generated height field: a thick uneven sea with rolling mounds
  and creased valleys, a base level rising and falling over tens of km, random heaps of domes that
  sprout smaller domes recursively (big ones flat, most heaps wider than tall), rare huge towers at
  peaks of the convection field. Billow strength varying across the world; a seamless warp of the
  billow pattern. Floating puffs and fragments removed (they read as designed); high layers kept.
- Rendering through a macro map (top, slope bound, billow amplitude, sea level) with slope-corrected
  bounds and max-top grids. Trace ≈ 2× faster than round 2. Still a 128 km tile.

## Round 4 — enormous 3D towers, endless world (2 Oct)

Commits: `97a4f68`, `af7bc10`.

- The author: the huge towers of the photos were missing; clouds could only grow upward like hills;
  the sea too flat; no 128 km repetition.
- Rebuilt from scratch: an endless, position-seeded world (hashed value noise; cells generated on
  demand and forgotten far behind). The sea with large relief (swells, hills, narrow deep valleys,
  mounds) and random heaps, slope-limited so heaps get skirts, not walls.
- Towers as true 3D clusters of thermal bubbles (ellipsoids): plumes from a broad shoulder, drifting
  with the wind and outward, stalling in domes crowned by smaller domes; overhangs; anvils on the
  tallest of a storm; storms as lone giants, loose groups or walls. (These were explicit features —
  removed in round 5.) Tops 5–13 km.
- Camera-centred toroidal clipmaps (128 m, 512 m, 2 km cells, ~260 km reach) baked on the GPU from
  the CPU generator's column data and bubbles, streamed within a per-frame budget; a streamed shadow
  volume; rendering relative to a snapped origin; trace to 250 km and clouds up to 14 km.
- Presets that look at generated towers (`tower`, `giant`, `anvil`, `close`, `approach`, `inside`,
  `under`), picking sunlit ones with a clear line of sight.

## Round 5 — grown from natural causes (2 Oct)

Commits: `3f2b11a`, `31ef4e6`.

- The author: remove the special cases (anvils, overhangs, kinds of tower groups); model how real
  clouds grow; let everything emerge; the sea and towers ideally one system.
- New generator, prototyped in Node with CPU previews, maps and statistics, then put into the page:
  the air (restlessness patches and bands, inversion, wind shear, ceiling, moisture, depth of
  unstable air); convective cells with a power law of potentials; pulses of bubbles rising by an
  entraining-parcel model that swell, mix, chill with dry air, shed, crowd and boil into domes; the
  ceiling stops everything; settling, spreading lobes under stable air (anvils emerge), sagging,
  drifting, evaporating, tops crumbling first; outflows setting off new cells; subsidence spacing
  towers. Weak pulses become 2D domes on the sea, tall ones 3D bubbles: one system.
- Tuning by causes only: the inversion really stops bubbles (60 m steps through it), sinking air
  spaces towers, anvil rarity from the unstable layer seldom reaching the ceiling.
- Result: 1–3 big towers within 30 km and 6–10 within 30–80 km in typical regions; trace ≈ 22%
  faster than round 4; startup 1.8 s (Node) vs 1.25 s. Caveats then: mushroom-like tops on some
  dying towers, distant tops floating in haze, crowded stormy regions.

## Round 6 — billowy sea, enormous towers, a lively start (2 Oct; 2 photos attached)

Commits: `bdd8cdc`, `38751c6`.

- The author: the sea looked like sand dunes; the towers too small; too much open space at the start.
- Causes found: the billow strength followed restlessness (≈ 0 over most of the sea), the rolling
  mounds used ridged noise (crest lines like dunes), the bulges were very flat for their size, the
  sea's rims were deliberately soft; the inversion stayed strong in moderately restless air and the
  unstable layer rarely reached the ceiling; the start sat in a calm patch with a "keep the start
  clear" radius of 10–20 km.
- Changes (all causes): the sea always overturns (billow strength ~1), rounded billow noise, taller
  rounder bulges (large spheres packed, small ones looser and fading with distance), crisp rims on
  the sea's tops, halved sea bounce on bulge undersides (dirty brown blotches); restless air covers
  ~70% of the world, a weaker inversion there, moister and deeper unstable air, larger maximum
  thermal (3.5 km); start clearance only around the start column; the spawn draw (calm start, open
  sun, strong cells to its right, lit from the side); pieces cut off from their cloud evaporate
  first; small bubbles left out whole; heaps no steeper than cloud can stand; start yaw 0.22 → 0.45.
- Result: within 150 km 53 towers above 9 km (was 8) and 17 above 11 km; every tested seed starts
  with at least one tower above 8 km in view. Trace ≈ 40–50% more on sea-level views; bubbles ≈ 5×
  round 5 but trimmed from a first ×14.
- Tried and dropped along the way: crisp density edges alone (revealed pits), denser sphere fields
  for every octave (sponge), sparse small spheres (warts and pocks), towers right ahead of the start
  (a dull backlit wall over the sunset), weaker subsidence (walls), a wide start clearance (open
  space), filtering pieces by size (floating heads without wakes).

## Round 7 — preserving the knowledge (24 Oct)

- The author: commit everything useful; the chat will be deleted and the project restructured
  (split into files, one output file).
- Added `docs/` (this file, `BRIEF.md`, `DEVELOPMENT.md`, reference renders) and `tools/` (render
  and image tools, Node world tools, checks, world fingerprint, render regression with baselines).
- Two startup fixes found while building the tools (`f9dc128`, `9453631`): the coarsest clipmap
  level gathered bubbles from fully grown cells across its 524 km window, and the test views searched
  200 km for towers on every page load. Startup main-thread time on software GL ≈ 11.8 s → 4.7 s;
  memory far lower; renders unchanged (the second fix pixel-identical, the first within 0.15 levels
  on distant clouds).
- Test mode made fully deterministic: the probe (light and cloud at the bird and camera) is read
  back asynchronously, so under load in-cloud test renders varied by 1–2 levels between runs; test
  mode now reads it at once and uses it the next frame (normal use unchanged).

## Round 8 — split into modules (24 Oct)

- The author: one single file is very annoying for development; split it into a structure that
  makes sense, remove anything unnecessary, and make sure the game does not change.
- The code moved verbatim into ES modules under `src/` (the world generator, the renderer, the
  shaders, the flight, steering, camera, test views and the main loop); `build.mjs` (Node, no
  dependencies) joins them into `index.html`, still the one published file: the stylesheet
  inlined, the modules in the order the browser runs them, one scope. `tools/serve.mjs` serves the
  sources as modules for development. ES modules needed a few edits: without WebGL 2 the context
  module throws instead of returning; state other parts change lives in objects or is changed
  through its own module; the clock and the frame number are passed as parameters.
- Removed as unnecessary: an unused variable, unused parameters and object fields, shader uniforms
  nothing read (`uTime` in the shared cloud code, `uSky` and `uFrame` in the probe) with the values
  passed for them, a second copy of the touch-device check, the tool that spliced world sections
  into the single file, and the Node tools' copy of the math kit (they load `src/world/` itself).
- Checked unchanged against the single file: the world fingerprint, the 14 regression renders
  (bit-identical), the full flight logs of eight scripted flights, an 8 km flight that streams the
  world in (images byte-identical); and all presets, input, UI timing, out-of-memory recovery,
  dynamic resolution, the baked volumes. The sources run as modules render exactly what the build
  renders.
