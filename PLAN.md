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
- **The bubble budget**: the bake loops over every gathered bubble per texel; 14 times as many bubbles
  (a first try) would have been a disaster: prune, minimum sizes, one wake lump for small bubbles. Now
  ≈ 5,600 bubbles in a 120 km box around the start, per bake block at most ≈ 1,700 of the 4096 cap.
- **The coarse level** must take bubbles from coarse cells (`gatherBubbles(..., coarse)`), or the first
  frame grows everything in full across 524 km.
- **Tests compare the world's sums, not a hash**: Math.sin, exp and pow round their last bit
  differently between Node versions (the recorded hash was off on Node 24 while every part agreed to
  12 digits).

## Known issues and ideas

- **Measured only on one desktop GPU**: NVIDIA, headless, at 640×360, where a short benchmark ran at 60
  fps (capped) with 5.9 ms of GPU time a frame, the clouds at the 0.75 ceiling and no hitches; never on
  phones, integrated GPUs or at full-screen sizes, so frame rate, dynamic resolution and memory there
  are unknown (`?bench` reports them). Only Chrome's WGSL compiler (Tint) has seen the shaders;
  Safari's and Firefox's haven't.
- **The CPU world generation runs on the main thread**, synchronously when a new grid cell is first
  needed (startup ≈ 4.7 s on software rendering; spikes of ≈ 200–250 ms entering new areas). The
  generator is DOM-free and deterministic: a Web Worker posting column blocks and bubble arrays back
  would remove the stalls. It would need an explicit start of the world (`initWorld({ seed, towers })`):
  a worker has no `location`, so `core/params.js` would read every value as missing (the seed silently
  7). The generator also allocates many small objects (`makeDome` and `lift` dominate profiles).
- Textures created once at start (`T.trans` … `T.shadow`, the world volumes) have no out-of-memory
  fallback: if one fails, the frames draw nothing (only the size-dependent targets retry smaller).
- **Mushroom tops**: some towers have a wide spreading top over a narrower body (`tools/world/preview.js`
  and `catalog.js` show them); the author dislikes thin stems under spreading tops. Causes to look at:
  spreading lobes against column width, the shear drift of tops, column pieces evaporating before heads,
  the pulse spread (0.6·P).
- **Close-up surfaces** of towers can look blotchy in low sun (cast shadows between many lumps), and
  shadowed towers show bright sun patches where light comes through gaps between towers (the 768 m
  shadow volume makes them blob-shaped).
- **Distant flat tops can look like floating lenses** (their bodies sink into haze and behind the
  curvature); photo 1 shows the same, but watch it.
- **The cirrus and the two high layers tile** every 32 and 64 km.
- `dropAdrift` also removes the tops of some dying towers whose columns evaporated (by design: no
  floating fragments), which lowers the count of towers reaching the ceiling by ~30%.
- The world is drawn so the start looks good (the spawn draw); other places can be emptier: about 30%
  of the world is calm air with only the billowy sea and its heaps. The draw doesn't promise towers in
  view for every seed: **seed 5 starts with none** within 50 km (the piece's seed 7 has two above 8 km;
  `tests/world.test.js` holds it to one).
- Inside thick cloud near the camera surfaces read soft (mist thinning, 14 m rims).
- **A screen-door pattern** in the shaded parts of the sea seen from straight down (`down`, its
  `billows` crop): a faint, fine, regular grid. Perhaps the trace's jitter or the temporal upsampling
  on shaded surfaces seen head-on; not looked into.
- **Sunlit rims shimmer**: with nothing moving, 0.1–0.5% of a frame changes by 6 levels or more from
  frame to frame, almost all of it along sunlit cloud edges against the sky, where the jittered
  low-resolution trace and the temporal upsampling don't settle (`high2` 0.48%, `anvil` 0.46% at
  960×540; over the 0.5% limit at 640×360). Whether it shows as crawl in motion is for the author's
  eyes. The cloud scale and the TAAU clamp are the levers.
- The `skim` view (170 m over the sea's top) shows nothing but haze: the billows rise higher than that
  there, so the bird is inside them. Its brief wants billows up close; a pose a few hundred metres
  higher would show them.
- Values JS and WGSL both keep as literals of their own: the sun-colour table's 750 m steps, the planet
  radius, the high layers' heights, the probe's layout (CLAUDE.md §8 wants them from `constants.js`).
- A WebGPU validation error shows no note (left out: a harmless one on a browser never tried would stop
  the piece); the tools hear every one.
- Nothing publishes until main's first verified build makes the "latest" release; until then every
  deploy stops before publishing and the old site stays up.
- `tools/linux.js` is untried (Docker wasn't running).
