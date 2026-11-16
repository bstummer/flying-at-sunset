# Plan

How the piece gets built and where it stands. [CLAUDE.md](CLAUDE.md) holds the rules: vision, hard rules,
visual workflow, definition of done. This file holds the rounds: every request of the author verbatim,
what each round built, tried and dropped, the decisions behind the current look, and what is open.

The author directs the work, one request a round, and reviews the result. The AI builds, measures and
reports, and says plainly what it couldn't judge: it sees still images only, so motion, the feel of
the flight and speed on real hardware are for the author to check.

Keep the notes short. A round keeps a few lines on what it built, what was tried and dropped, and what
is still open; how things work belongs in the module headers, and git has the rest.

## How to work a round

1. Read CLAUDE.md, then this file: the Status table, the open issues, the decisions.
2. Add the author's request verbatim as a new round, `in progress`. A new message with a request starts
   a new round (a follow-up within the same task joins the round, quoted too).
3. Take a `before` capture (`--label r<N>-before`) and look at it. Write down what falls short of the
   request and the vision.
4. Build. Change natural causes, not special-case features (CLAUDE.md §2). One convincing result beats
   broad, mediocre coverage. For the world, iterate with `tools/world/` (stats, map, preview, catalog:
   seconds each) before GPU captures, as round 5 did.
5. Finish to CLAUDE.md §10 (verify, compare reviewed, tests, views, docs). If the change can cost GPU
   time, capture with `--profile` before and after and note the per-pass change.
6. Review the result harshly before the author does: every view against its brief and against what the
   author keeps coming back to (CLAUDE.md §1). List everything that still falls short, including what
   got worse. A subagent that hasn't seen the code makes a good second pair of eyes.
7. Hand over: set the round to `review` and give the author the capture label, the compare images, the
   list of known flaws and the frame cost, and name what needs their eyes: motion, feel, real hardware.
   Make sure they can open the images (from a cloud session: CI's `screenshots` artifact, or copied
   out). Once pushed with their OK, a branch's preview is at
   `https://bstummer.github.io/flying-at-sunset/<branch>/`, `?bench` there to measure it (the root runs
   main's build until the round is merged). A round's status is `in progress`, `review` or `done`; only
   the author makes it `done`, saying so or moving on to the next request.
8. Commit and push only when the author asks. Pushing to `main` publishes the piece.

Stop and ask when a new dependency looks necessary, when the frame rate can't be held, or when a
choice is about taste or scope rather than engineering.

## Status

| Round | What | Status |
|---|---|---|
| 1 | The core piece | done |
| 2 | Towers and floating clouds | done |
| 3 | Natural, random clouds | done |
| 4 | Enormous 3D towers, an endless world | done |
| 5 | Grown from natural causes | done |
| 6 | A billowy sea, enormous towers, a lively start | done |
| 7 | Preserve the knowledge | done |
| 8 | Split into modules | done |
| 9 | WebGPU | done |
| 10 | The repository organized like tropical-island's | review |

Measurements up to round 9 were made with software rendering (SwiftShader: GL until round 8, Vulkan for
WebGPU since) in a headless browser, so they are relative. All work before round 10 happened on the
branch `claude/awesome-fermi-i208te`.

**An approved look can be recreated**: captures are deterministic, so building a round's commit (a git
worktree works) and capturing it with the same args on the same backend gives its images again. Up to
round 9 the built page was committed: `git show bc1fca3:index.html > dist/index.html`, then capture
with `--no-measurements`. Round 9's look (`bc1fca3`) is the one the author approved last: the reference
for "keep the lighting, the colours and the sky as they are". Its old docs and reference renders are
in git there (`docs/`).

## Rounds

### 1. The core piece (1 Oct 2026)

> Create an interactive art piece that runs in the browser (one single html file): a small folded
> paper bird gliding over a vast sea of clouds at golden hour, steered by the viewer. It is not a
> game with goals or scores. It is a calm, beautiful experience, and the world should look as
> realistic as possible. Every frame should look like a photograph taken from an airplane window
> just before sunset.
>
> The clouds are the heart of the piece. Below the bird lies an endless sea of soft, billowing
> clouds stretching to the horizon, broken up by enormous cloud towers rising high above it, so the
> bird can fly over the cloud sea and weave between the towers. The clouds should feel real: full
> and three-dimensional, with rounded tops, soft wispy edges that fray into the air, and a sense of
> enormous scale. Take the time to get them right.
>
> The light is golden hour. The sun sits low near the horizon. Cloud surfaces facing the sun glow
> warm gold and peach, their thin edges shine brightly where sunlight passes through them, and the
> shadowed sides fall into cool blue and violet. The sky fades from deep blue overhead to warm gold
> near the sun, and haze softens everything in the distance until the farthest clouds melt into
> the sky. Looking toward the sun should feel bright and dazzling.
>
> The paper bird is folded from slightly off-white paper, with crisp creases and a subtle paper
> texture. It is small against the huge landscape, and its wings flex slightly in the air. When the
> sun is behind it, light shines through the paper and makes it glow warmly.
>
> The viewer steers the bird, and the controls should feel intuitive on both phones and computers.
> The flight should feel like gliding: diving builds speed, climbing trades speed for height, and
> turning makes the bird bank gracefully. Steering should be smooth and forgiving, never twitchy.
> The bird cannot crash. It can skim the cloud tops and fly into clouds, where it is briefly
> surrounded by drifting mist, but it is gently kept from sinking deep into the cloud sea.
>
> The camera follows behind the bird with a slight, natural lag, swinging wide on turns and leaning
> into them, so the flight feels fluid and cinematic. Speed should be tangible when diving, with
> nearby clouds rushing past while distant ones barely move.
>
> Keep the screen clean: no score, no menus, just a short hint on how to steer that fades away
> after a few seconds. The whole experience should feel peaceful, vast, and quietly magical. Beauty
> and realism are the priority, but the flight must stay smooth, because stuttering breaks the
> spell. It should have a good amount of FPS.
>
> Go all out for this art piece, it should really impress the user.
> Plan before you start working.
> This is the core version of the piece, later on it will get more additions.

Built (commits `a3e7666` to `6e57bae`): a physically based sky (Hillaire 2020 lookup tables), sun colours
by altitude, haze; clouds as raymarched signed distance fields (a sea and towers of fbm-of-spheres
billows, a shadow volume), temporal upsampling from a low-resolution trace, bloom, sun rays, a
hue-preserving tone curve; the world a 128 km tile. The origami crane with paper shading, translucency
and flexing wings; the energy-based glider with a soft floor from a GPU probe of the real billows; the
chase camera; mouse, touch, keys, gamepad; the fading hint; fullscreen. Lighting: interior diffusion,
shadow fill, short-range occlusion, haze without a horizon seam, mist inside cloud. Robustness from an
independent review: dynamic resolution (GPU timers or frame times, recognising capped frame rates),
retrying smaller when GPU memory runs out, an error note instead of a black page, the pointer leaving
the window, Cmd/Ctrl shortcuts, context loss. Fixed: distant towers dark and speckled (sampling began
deep inside a far stride); entry points are now found by regula falsi.

### 2. Towers and floating clouds (1 Oct)

> The cloud towers need work, and I'd like to add clouds that float freely in the air.
>
> Right now the cloud towers look like soft blobs. Many have the same rounded gumdrop shape and a
> similar size, and they are spread evenly across the cloud sea, so the distant ones look like
> bushes planted in a field. Make them look like real towering clouds seen from an airplane at
> sunset.
>
> They should vary. Some are small humps barely rising above the cloud sea, many are medium-sized,
> and a few are enormous giants that dominate the view. They grow out of the cloud sea from broad
> bases that blend into it seamlessly. Their tops are made of lumpy, cauliflower-like bulges stacked
> on top of each other, each bulge catching its own light and shadow. Some lean slightly or are torn
> at the top by wind, and their thinnest edges fray into wisps rather than ending in smooth
> outlines. Their shaded sides should feel soft and luminous, with light glowing faintly through
> them in cool blue and violet tones, never a flat gray wall. Place them naturally, in loose
> clusters and lines with wide open stretches of cloud sea between them.
>
> Also add clouds that float freely in the air, not connected to the cloud sea, at many different
> heights. Most are smaller puffy clouds, with flatter undersides and rounded tops, and higher up
> there are a few thin, stretched layers catching the golden light. Some float at the bird's own
> altitude, so the viewer can fly past them, beside them, and right through them. Each one should
> look like a believable cloud with its own shape and lighting, never like a piece that broke off a
> tower, and the larger ones cast soft shadows onto the cloud sea below.

Sent while that was being built:

> Are the clouds generated randomly? I don't want that you place them manually

Built (`9382906`): a handful of hand-placed clouds along the opening flight path removed: everything
generated. Towers from a convection field of loose clusters and wind-aligned lines (~250 humps, ~50
medium, a couple of dozen large, up to five giants), cauliflower turrets on broad bases, some leaning or
torn; ~390 floating cumulus; two thin wind-stretched high layers at 6.3 and 7.7 km (still there); sky
light by which way a surface faces; light glowing golden through thin parts. Trace 1.3–2× round 1.

### 3. Natural, random clouds; 3 photos attached (1 Oct)

> The cloud towers need a complete rework, because the scene still doesn't look like a real view
> above the clouds.
>
> The main problem is that the clouds look designed rather than natural. There are too many towers,
> they're similar in size and shape, and they're spread across the cloud sea as if they had been
> placed there. They stand on the cloud sea like narrow pillars or chess pieces on a board. Their
> surfaces are covered in small bumps that are all the similar size, like popcorn. Real clouds are
> random and irregular, and that randomness is what I'm after. No two clouds should look alike,
> and no shape, feature, or spacing should repeat in a way the eye can notice. Flying around, the
> world should keep surprising me.
>
> I've attached real photos taken from airplanes at sunset as inspiration. Use them to guide the
> shapes, sizes, and arrangement of the clouds, but don't copy them. The world should be its own,
> with clouds that feel just as natural. Don't change the lighting or colors for now, only the
> clouds.
>
> Keep the sea of clouds below the bird, but make it more like the one in the photos. It isn't a
> flat, even blanket. Its surface is thick and uneven, with big rolling mounds and deep, shadowed
> valleys between them, and it rises and falls across the landscape. In some places it heaps up
> into large billowing masses, and occasionally those grow into a tower, so there's no clear line
> between the sea and the towers; they're the same cloud, just piled higher.
>
> Towers are rare and huge. Most are broad, irregular heaps built from rising domes of different
> sizes, often wider than they are tall. Distant clouds are softened by haze, which shows how
> enormous they are.
>
> All of this should be random and irregular, as in nature. The descriptions above are a sense of
> what's possible, not a checklist. Don't give every cloud every feature, and don't spread any
> feature evenly across the world. No shape, feature, or spacing should repeat in a way the eye
> can notice, and flying around, the world should keep surprising me. Don't use a "building kit"
> of set clouds that you place, generate everything randomly.
>
> Remove the compact, round puffs floating high in the sky, since they look artificial.

Built (`b5f8a74`): one generated height field: a thick uneven sea with rolling mounds and creased
valleys, a base level rising and falling over tens of km, random heaps of domes sprouting smaller domes
(most wider than tall), rare huge towers at peaks of the convection field; billow strength varying over
the world; floating puffs and fragments removed. Rendering through a macro map with slope-corrected
bounds: trace ≈ 2× faster than round 2. Still a 128 km tile.

### 4. Enormous 3D towers, an endless world (2 Oct)

> The huge clouds that should grow out of the cloud sea are completely missing. Compare the scene
> with the 3 insipiration photos again (read them again). In them, massive towering clouds rise out
> of the cloud sea and dominate the view, their tops reaching as high as the airplane or higher. In
> the current scene, the biggest clouds are small lumps on the horizon, and the ones nearby are
> low, soft mounds. Keep the lighting, colors, and sky as they are, and focus on this.
>
> Add truly enormous towering clouds that grow out of the cloud sea. They should rise far above the
> height where the bird flies, so when the bird is near one, you have to look up to see its top,
> and even far away they should stand tall above the horizon. Wherever you fly, a few big towers
> should usually be in sight, some near and some far, with open stretches of cloud sea between
> them. If anything about how the clouds are made currently limits how tall or large they can be,
> change that. The towers have to be truly huge.
>
> Each tower is a massive heap of rising domes of different sizes, broad at the base where it swells
> up out of the cloud sea, with crisp, sharply sculpted, cauliflower-like edges and deep shadowed
> folds between the domes, like in the photos. They should look dense and solid, not like soft
> pillows. They vary freely in size, width, shape, and lean: some are lone giants, some merge into
> long walls or ranges, and a rare one far away spreads out at the top into a wide, flat anvil.
> Don't space them evenly, don't make them alike, and don't give every tower every feature. Don't
> use a "building kit", generate everything randomly.
>
> Step back and rethink how the clouds are generated. Right now they seem only able to rise upward
> from the cloud sea, like hills in a landscape, which can only ever make mounds and pillars. Real
> clouds grow in every direction. Domes bulge outward and hang over the parts below them, towers
> widen as they rise, tops spread sideways into flat anvils, and undersides sag and fray downward.
> Parts of a cloud overlap and fold over each other, leaving overhangs and gaps the bird could fly
> under. Choose whatever approach makes this possible, even if it means rebuilding the clouds from
> scratch, as long as it still runs smoothly.
>
> The cloud sea is also still too flat. Give it large-scale relief: broad swells and hills, deep
> valleys, and places where it heaps up higher and higher until it becomes a tower. Up close, its
> billows should be crisper and more defined, like in the photos, rather than smooth and blurry.
>
> All of this should be random and irregular, like in nature. Treat these descriptions as a sense
> of what's possible, not a checklist. Don't space the clouds evenly, don't make them alike, and
> don't give every cloud every feature. And I don't want the world repeating every 128km, the world
> should be generated randomly endlessly.

Built (`97a4f68`, `af7bc10`), rebuilt from scratch: an endless, position-seeded world (cells generated on
demand, forgotten far behind); the sea with large relief and slope-limited heaps; towers as true 3D
clusters of thermal bubbles (ellipsoids) with overhangs, tops 5–13 km (anvils and kinds of storm groups
were explicit features then: removed in round 5); camera-centred toroidal clipmaps (128 m, 512 m, 2 km;
~260 km reach) baked on the GPU from the CPU's columns and bubbles; a streamed shadow volume; rendering
around a snapped origin; tower presets (`tower giant anvil close approach inside under`).

### 5. Grown from natural causes (2 Oct)

> Rework the cloud generation so the shapes come from a few natural causes instead of special-case
> features. Right now there are separate features for anvils, overhangs, and types of tower groups
> like lone giants, clusters, and walls. Remove these special cases. I want a general generator in
> which all of these and others appear on their own, the way they do in nature.
>
> Model how real clouds grow. Warm air rises from the cloud sea in bubbles, some much stronger than
> others. As they rise, they swell and push outward, crowding and bulging over each other. When a
> bubble runs out of strength, it stops and settles into a dome. High up there is a ceiling that
> rising air can't pass, so the strongest towers that reach it are forced to spread out sideways.
> Wind gets stronger with height, so tops drift, lean, and stretch downwind. Some areas have
> restless air where towers form, often near each other; other areas are calm, with only gentle
> rolling cloud sea. Anvils, overhangs, leaning towers, lone giants, clusters, and long walls should
> all emerge from this without being created on purpose.
>
> Ideally, the cloud sea and the towers are one continuous system.
>
> Keep what works now: the huge scale of the towers, the lighting, and the sky. If something from
> the photos doesn't appear or appears too often, adjust the natural causes rather than adding a
> feature for it. Reminder: I uploaded 3 inspiration images, but don't copy them exactly.
> And again: Don't take this prompt literally, just build what is best for the result!

Built (`3f2b11a`, `31ef4e6`): the generator of `src/world/`, prototyped in Node with CPU previews, maps
and statistics: the air, convective cells with a power law of potentials, pulses of bubbles rising by
an entraining-parcel model, the ceiling, settling and spreading (anvils emerge), drifting, evaporating,
daughters, subsidence; weak pulses as 2D domes on the sea, tall ones as 3D bubbles: one system. Tuned
by causes only. 1–3 big towers within 30 km and 6–10 within 30–80 km in typical regions; trace ≈ 22%
faster than round 4.

### 6. A billowy sea, enormous towers, a lively start; 2 more photos attached (2 Oct)

> The new cloud generation based on natural causes is a good direction. But compared to the
> previous version, some things got worse. Keep the new approach and fix these.
>
> The cloud sea now looks like sand dunes: smooth, rounded hills. A real cloud sea is made of
> billows at every size: big rolling mounds covered in smaller bulges, covered in even smaller
> ones, with soft edges that never form sharp ridgelines. Bring back a billowy, cauliflower-like
> detail, crisp where sunlight catches it. I attached two images for reference.
>
> The towers are too small. The towers should be enormous again, rising far above the bird.
>
> In the spawn point, there is too much open space. I want generally less of that.
>
> Keep the generation based on natural causes. If something looks wrong, adjust the causes rather
> than adding special features.

A first version of this message was sent and then interrupted; it says what was seen:

> The new cloud generation based on natural causes is a good direction. But compared to the
> previous version, some things got worse. Keep the new approach and fix these.
>
> The cloud sea now looks like sand dunes: smooth, rounded hills. A real cloud sea is made of
> billows at every size: big rolling mounds covered in smaller bulges, covered in even smaller
> ones, with soft edges that never form sharp ridgelines. Bring back the billowy, cauliflower-like
> detail, crisp where sunlight catches it. I att[ached two images for inspiration.]
>
> The towers are two small. From the starting point, only small puffs are visible on the horizon,
> plus one large tower whose wide top sits on a narrow base like a mushroom. The towers should be
> enormous again, rising far above the bird, and at least one huge tower should be in view from
> the start. When a tower's top spreads out, the column beneath it should be massive and broad,
> never a thin stem.
>
> In the spawn point, there is too much open space. I want generally more
>
> Keep the generation based on natural causes. If something looks wrong, adjust the causes rather
> than adding special features.

Built (`bdd8cdc`, `38751c6`), all by causes: the sea always overturns (billow strength ~1, it had
followed restlessness), rounded billow noise instead of ridged, taller rounder bulges (large spheres
packed, small ones looser and fading with distance), crisp rims on the sea's tops, half the warm sea
bounce under bulges; restless air over ~70% of the world, a weaker inversion there, moister and deeper
unstable air, larger thermals (3.5 km); the start's clearance only around its column; the spawn draw;
fragments cut off evaporate first; heaps no steeper than cloud can stand; start yaw 0.45. Within 150 km
53 towers above 9 km (was 8). Trace ≈ 40–50% more on sea-level views.
Tried and dropped: crisp density edges alone (pits), dense sphere fields at every octave (sponge),
sparse small spheres (warts), towers right ahead of the start (a dull backlit wall over the sunset),
weaker subsidence (walls), a wide start clearance (open space), filtering pieces by size (floating
heads without wakes).

### 7. Preserve the knowledge (24 Oct)

> Commit all useful things that one might need. This chat will be deleted and after that the
> project will be restructured (split in multiple files, output is one file).

Built (`9be51d2`, `f9dc128`, `9453631`, `33b8996`, `9b6d7f6`): the docs (brief, history, development
notes, reference renders) and the tools (render and image tools, the world in Node, checks, the world
fingerprint, render baselines). Two startup fixes found on
the way (`f9dc128`, `9453631`): the coarsest level gathered bubbles from fully grown cells across 524 km,
and the test views searched 200 km for towers on every load (startup ≈ 11.8 s → 4.7 s on software GL).
The test mode made fully deterministic (the probe read back at once and used the next frame).

### 8. Split into modules (24 Oct)

> One single file is very annoying for development. Split it up in a structure that makes sense.
> Commit it. Remove anything that is unnecessary and make sure the output game doesn't change
> through the splitting.

Built (`36f38ab`, `ff087e7`): the code moved verbatim into ES modules under `src/`, joined back into
one file by a build script of its own; unused variables, parameters and uniforms removed. Checked unchanged against the
single file: the world fingerprint, the 14 regression renders (bit-identical), eight scripted flights,
an 8 km streaming flight.

### 9. WebGPU (5 Nov)

> Port everything from WebGL to WebGPU. Make sure the game stays approximately the same.

Built (`bc1fca3`): every shader rewritten in WGSL with the same structure, names and comments; the renderer on
WebGPU (pipelines compiled in parallel, bind group layouts from the textures each shader names, all
uniforms of a submit in one buffer at dynamic offsets, the world baked 8 slices per pass, the probe
read back by mapping a copy, GPU timestamps, out-of-memory through an error scope, the bird's shadow
map with a comparison sampler, the high layers' mips drawn by a pass, a lost device reloading the page
once a GPU is back). Textures keep GL's row order (CLAUDE.md §8). Checked against WebGL on the same
Chromium: the 14 views within 7 levels of 255 (mean ≤ 0.006), bird close-ups, debug views and the other
tone curve within 5; seven scripted flights identical; the world untouched.

### 10. The repository organized like tropical-island's (16 Nov)

> help me organize this repo. it is very messy. a good reference is [the tropical-island repository].
> I want to copy all the things around the core game from there, where it makes sense. you can
> question and discard all things you find in the flying-at-sunset repo.

Built: Vite builds `dist/index.html` (a single file, minified: 130 KB) from `index.html` and `src/`,
in place of the build script of round 8 and its rule that top-level names be unique across modules;
the built page is no longer committed. CI (`.github/workflows/`) verifies every push, publishes main's
build as the site's root and as the download, and every other branch at `/<branch>/`. `npm test`:
the world generator in Node (its fingerprint, order independence, invariants over 20 seeds), the build
check, the PNG codec, the site's folders. `tools/screenshot.js` (captures, contact sheets, compares),
`tools/checks.js` (behaviour checks with pass/fail thresholds, where the old ones printed numbers), the
build check, the Linux container, the site's folders. The docs folded into CLAUDE.md, this file and the
module headers. A licence (MIT).
Dropped: the build script, the local server (Vite's), the committed render baselines (captures are
compared before/after instead), the Python and shell image tools (the screenshot tool), the tools
`relief`, `thermal` (kept a copy of the air's formulas), `startup`, `spawn` (the world tests), the
modules-vs-build check, the dynamic resolution and profile tools (`--profile`), the reference renders.
Then:

> isn't it a good idea to copy the whole tools? like measurements?

and, choosing five of those proposed ("I want the first 5 things"): the views' measurements (`tools/measure.js`, `image.js`: banding, zoomed crops, shimmer while
nothing moves, a motion strip, with warning limits), a check that captures repeat byte for byte, and
the benchmark (`?bench`). For them the test mode hands over several frames (`?keep`, `?every`). Not
taken from tropical-island: overdraw, the sea's seams and repeats, wave runs, draw-call and memory
counts, its test scenes and quality switching (this piece has no meshes to speak of, no water, no
quality presets) and its capture API (re-rendering one page at another time or camera).
Checked: the Vite build renders the 14 views byte-identical to the last committed page (same Chromium,
on a GPU), four scripted flights log identically, the world matches the recorded fingerprint; with
the multi-frame handover and the benchmark in, the stills are still identical.
Found: the out-of-memory check had stopped forcing anything once function names were minified (fixed);
seed 5 starts with no tower in view; sunlit cloud rims flicker while nothing moves (both below). No
view shows banding: the grain dithers every gradient.
Then:

> i want to make sure that i have a really good setup. you had to do everything at once, so couldn't
> go into depth. can you let subagents make sure that i have a good setup? i don't mind changing the
> game as long as it stays the same for now. practically everything can be changed, a good reference
> is tropical-island.

Five reviews by subagents: the CI pipeline, the tools and tests (breaking the piece on purpose in a
copy), the docs against the code, the code against tropical-island's conventions (with a prototype),
and a fresh session trying two tasks in a copy from the docs alone. Built from what they found:
- The tools can't hang or pass on a failure: a watchdog closes a page not done in its time, one that
  stops drawing fails, a crash, a lost device or a page without an image is a problem, and a capture
  goes on past a view that fails. In test mode an unknown preset, or a tower view the world has no
  place for, fails instead of rendering the start. The tools refuse a build older than its sources.
- The hint's clock starts when the bird fades in. It started at the first frame, which bakes the
  world: where that takes over 10 s (CI, slow devices) the hint came and went within one frame and
  never showed. On a fast machine it now comes 1.8 s after the bird, not with it.
- Streaming: the bake reads each column's neighbours, which at a window's edge wrap to its far side;
  that edge stayed wrong once the window moved past it (up to ~100 m of distance in L0, ~1.2 km in L1,
  along lines). The old edge beside an entering strip is now baked again, and the streaming check
  compares the streamed volumes with a fresh start's texel by texel (its image compare hadn't seen
  this: 240 pixels of 57,600 changed, by 3 levels at most).
- Checks: player one variant at a time and last, alone (with the benchmark), recording every change
  of the hint; flight also dives into the cloud tops (`skim`: in, but not deep); out of memory retries
  smaller at start, and four in a row show the note; `errors` (a validation error and a lost device
  must be heard); the benchmark's summary saved (`checks/benchmark.txt`, uploaded by CI).
- `tools/flights.js` records and compares the flights' logs; compare takes `--views` and writes each
  changed view at full size with its crops; `info.json` has the seed; the fingerprint weighs values by
  place too (swapped values were the same world to it); `npm run verify:ci`; `tools/linux.js` reads
  Playwright's version from the lock and says when Docker isn't running; Node 22 at least.
- The code: shaders in `.wgsl` files that include shared chunks (`tools/wgsl.js`), the cloud ceiling
  and the noise tiles from `constants.js` (the trace had its own 14000), the debug views an
  `override`; the flight and the camera take what they read, so `tests/flight.test.js` flies the
  flight model in Node; an unhandled rejection or an error at startup shows the note.
- A view straight down (`down`): what a still of the sea from above shows (below).
- The first full verify after these hung for over an hour, silently, between the captures and the
  checks: `screenshot.js` loads `checks.js` while its main is still running (under a top-level await),
  `checks.js` loaded `flights.js`, which loaded `screenshot.js` for its labels, and so waited for the
  very main that was waiting for it. No page was open, so no watchdog could see it. The labels moved
  to `tools/labels.js`, and `tests/layout.test.js` fails on any tool that reaches itself through its
  imports.
Checked after each step: the 14 views identical (640×360, NVIDIA), the five flights' logs identical,
the world the same (the fingerprint re-recorded with its new sum, the old sums unchanged).
Open:
- `main` doesn't exist yet. Create it at `bc1fca3` (`git push origin bc1fca3:refs/heads/main`, not
  from GitHub's branch picker once this branch is pushed, which would take this round) and
  squash-merge this round onto it, so the earlier rounds' commits and the old docs stay in main's
  history. Then make `main` the default branch and delete `claude/awesome-fermi-i208te` (else it keeps
  a preview folder). Settings → Pages → Source is already "GitHub Actions", with no branch restriction
  on the `github-pages` environment.
- Push this branch first and read its verify log before merging: Chromium 159 has never run
  SwiftShader's WebGPU here, and verify's length on CI is unmeasured (estimated 25–50 of its 60
  minutes; after the first green runs, set the limit to about twice what it takes). Nothing publishes
  until main's first verified build makes the "latest" release; until then every deploy stops before
  publishing and the old site stays up. Seeding the release once from the live page lets branch runs
  go green and previews deploy at once: `git show bc1fca3:index.html > flying-at-sunset.html && gh
  release create latest flying-at-sunset.html --target bc1fca3 --title "Latest build" --latest`.
- `tools/linux.js` is untried (Docker wasn't running).
- Left as recommendations: one test-mode module (the fixed step, the frame handover, the log and the
  scripted flights, now in `main.js` and `input.js`, and every URL parameter read in `params.js`); an
  explicit start of the world (`initWorld({ seed, towers })`), needed once it moves into a Web Worker,
  where `location` is empty and the seed would silently be 7; the other values JS and WGSL both keep
  (the sun-colour table's 750 m steps, the planet radius, the high layers' heights, the probe's
  layout); a note on any WebGPU validation error (left out: a harmless one on a browser never tried
  would stop the piece). The page's title still says "Paper Bird".

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
- **The bubble budget**: the bake loops over every gathered bubble per texel; ×14 bubbles (round 6's
  first try) would have been a disaster: prune, minimum sizes, one wake lump for small bubbles.
- **The coarse level** must take bubbles from coarse cells (`gatherBubbles(..., coarse)`), or the first
  frame grows everything in full across 524 km.
- **Tests compare the world's sums, not a hash**: Math.sin, exp and pow round their last bit
  differently between Node versions (round 10 found the recorded hash off on Node 24 while every part
  agreed to 12 digits).

## Known issues and ideas

- **Measured only on one desktop GPU**: NVIDIA, headless, at 640×360 (round 10); never on phones,
  integrated GPUs or at full-screen sizes, so frame rate, dynamic resolution and memory there are
  unknown (`?bench` reports them). Only Chrome's WGSL compiler (Tint) has seen the shaders; Safari's
  and Firefox's haven't.
- **The CPU world generation runs on the main thread**, synchronously when a new grid cell is first
  needed (startup ≈ 4.7 s on software GL; streaming spikes of ≈ 200–250 ms entering new areas in round
  5). The generator is DOM-free and deterministic: a Web Worker posting column blocks and bubble arrays
  back would remove the stalls. It also allocates many small objects (`makeDome` and `lift` dominate
  profiles).
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
- **The cirrus and the two high layers tile** every 32 and 64 km (the sky was to be kept as is).
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
- The `skim` view (170 m over the sea's top) shows nothing but haze, as it already did in round 9's
  baselines: the billows rise higher than that there, so the bird is inside them. Its brief wants
  billows up close; a pose a few hundred metres higher would show them.

## Performance notes

Software rendering, so only ratios mean anything.

- WebGPU against WebGL (round 9, Chromium 153, 640×360, `preset=start`, 12 frames, ms summed): world
  11,973 / 12,385, sky 897 / 692, trace 15,471 / 14,699, taau 1,434 / 1,412, bird 644 / 609, post
  1,206 / 1,194. Both settle at ≈ 0.7 frames per second at 640×360 on SwiftShader.
- With WebGL (round 7): startup on the main thread (480×270, three frames) ≈ 4.7 s, ≈ 8.3 s with
  `?preset` (the tower search); world generation in Node for all three levels ≈ 3.2 s, ≈ 115 MB heap.
  Trace per view, 640×360, 12 frames: start ≈ 10.6 s, side ≈ 10.5 s, high2 ≈ 7.4 s, tower ≈ 10.5 s.
- Bubbles: ≈ 5,600 in a 120 km box around the start; per bake block at most ≈ 1,700 (L2) and ≈ 1,500
  (L1) of the 4096 cap. World statistics (seed 7): within 150 km 572 cells with 3D towers, tops above
  9 km 53, above 11 km 17; within 40 km of the start 12 tops above 6 km, 5 above 9 km.
- On a desktop GPU (round 10, NVIDIA, headless): a 640×360 capture of a view takes 4–8 s, almost all
  of it the first frame's world bake on the CPU. A short benchmark there (640×360, 1.5 s a leg): 60 fps
  throughout (capped), 5.9 ms of GPU time a frame, the clouds at the 0.75 ceiling, no hitches. Real
  numbers need `?bench` on the author's own screens and phones.
