# Flying at Sunset

Standing instructions for every session in this repo. Read this file fully before changing anything,
then [PLAN.md](PLAN.md): what was tried and failed, and why, and what is still open. §11 says how to
work a request.

## 1. Vision

An interactive art piece in the browser, one HTML file: a small folded paper bird gliding over a vast
sea of clouds at golden hour, steered by the viewer. Not a game: no goals, no score, no menus. A calm
experience, as realistic as possible.

**Above all, the piece should be as beautiful as possible.** Beauty ranks above features, cleverness
and coverage: when two approaches compete, take the one that looks better, then make it fit the frame
budget (§9). **From an airplane's distance every frame should look like a photograph taken from its
window just before sunset; closer than any such photograph, beside the bird and inside cloud,
nothing should break that spell.** Where what is physically right and what is beautiful part ways,
beautiful wins, as a photographer wins it: by the exposure, the hour and where the camera stands,
never by anything a viewer would call fake. It should feel peaceful, vast and quietly magical, and
it must stay smooth, because stuttering breaks the spell.

- **The clouds are the heart of the piece.** An endless sea of soft, billowing cloud stretching to the
  horizon, broken by enormous towers rising far above the bird: full and three-dimensional, with
  rounded tops, soft wispy edges and a sense of enormous scale. Up close a cloud is mist, not a
  surface: soft and smooth as in nature, but never perfectly even, its edge ragged.
- **Golden-hour light.** The sun sits low, yet most of what is in view lies in its light. Faces
  toward it glow gold, orange and peach, thin edges shine where sunlight passes through, shaded
  sides are a luminous cool blue and violet, never navy or brown. The sky fades from deep blue
  overhead to gold near the sun, and haze melts the farthest clouds into it. Looking toward the sun
  is bright and dazzling; every other way is exposed as a photographer would expose it.
- **The paper bird.** Slightly off-white paper with crisp creases, small against the landscape; its
  wings flex, and it glows warmly when the sun is behind it. It reads as folded paper, never a
  white dart, nor a ghost in shade or mist.
- **The flight.** Gliding: diving builds speed, climbing trades it for height, turning banks
  gracefully. From down at the cloud tops the bird can always fly up again, for as long as the
  climb is held, past the towers' heads. Smooth and forgiving, never twitchy, on phones and
  computers alike. The bird can't crash: it can skim the cloud tops and fly into clouds, but is
  gently kept from sinking deep into the sea. Inside a cloud the fog has depth and shows the way
  out; never an even card.
- **The camera** follows with a slight, natural lag, swinging wide on turns and leaning into them.
  Speed is tangible from the first second: near clouds rush past, far ones barely move. The bird
  stays whole in the frame, in a long climb too, and the frame is composed on tall screens as on
  wide ones.
- **A clean screen**: only a short hint on how to steer, which fades away, and a note only when
  WebGPU is missing or something fails.
- **Out, for now**: sound, a sun that sets, clouds that drift.

What the author keeps coming back to (what the result should be; how to get there is open):

- **Irregular, as in nature.** No two clouds alike, and nothing the eye catches repeating or
  looking placed: no bumps of one size ("popcorn"), no towers spread evenly ("chess pieces on a
  board"), no kit of set shapes. Flying on keeps surprising.
- **Enormous towers** that rise far above the bird, one of them within a minute or two of the
  start, broad where they swell out of the sea (never a wide top on a thin stem, "like a
  mushroom"); lone giants, walls and clusters with open sea between, some to fly under.
- **Cloud, not pillow and not rock.** Crisply sculpted from afar, soft up close; never smooth
  pillows all over, never solid like rock or dough.
- **A billowy sea** with large relief: not a flat blanket, not "sand dunes", no sharp ridgelines.
- **No render noise** of any kind (a screen-door, a lattice).

## 2. Hard rules

- **The output is one file**: `dist/index.html`, with all JS and CSS inlined, working when opened via
  `file://` and from any static server. It is never committed: CI builds and verifies it on every push,
  to any branch (a push that changes only Markdown runs nothing), and publishes it
  (`.github/workflows/deploy.yml`). Pushing to `main` publishes the
  piece, at the site's root (https://bstummer.github.io/flying-at-sunset/) and as the download, once it
  passes verify; any other branch goes up at once, unverified, at `/<branch>/`. `./index.html` is the
  source template.
- **No assets and no runtime network access.** No fetch, XHR, WebSocket, CDN or font links, no image
  or model files. `npm run check` enforces this, and the screenshot tool fails on any network request.
- **No runtime dependencies.** The renderer, the shaders and the maths are the project's own. The build
  fails on any module from outside `src/`, and `npm run check` lints that `src/` imports only its own
  files. Ask the user before adding any dependency, runtime or dev.
- **The clouds are generated, never placed by hand**, and there is no kit of set shapes. If something
  appears too often, too rarely or looks wrong, change a natural cause (the air, the thermals, time),
  never add a special-case feature.
- **The world is a function of position and the seed** (`?seed`), endless and never repeating. No
  `Math.random` or `Date` anywhere in `src/`, and no clock in `src/world/` (`npm run check` lints for
  them); the world never depends on the order it is asked for (`npm test`).
- **WebGPU, core only**: no optional feature is required (`timestamp-query` is used where it exists).
  There is no WebGL fallback: without WebGPU the page says so.

## 3. Commands

| Command | What it does |
|---|---|
| `npm install` | Installs the dev dependencies (Vite, Playwright) and Playwright's Chromium, the only browser the tools use, always headless (`tools/install-chromium.js`): on Windows the full build, whose Dawn compiles the shaders with DXC as visitors' Chrome does; elsewhere the headless shell. |
| `npm run dev` | Vite's dev server: the sources as ES modules, reloading on every edit. |
| `npm test` | Tests, `tests/*.test.js` (Node's built-in runner): the world generator, the flight model and the chase camera (§5), the URL parameters and the views, the detail volume's turn, the sun map's grid, the light's reference and the trace's light against it, the shaders' includes, the bakes' scale (`render/bakescale.js`), whether the GPU's timestamps may steer (`render/gputrust.js`), the screenshot tool's arguments and compares, the cost tool's runs, the image measurements, the build check, the PNG codec, the site's folders, the repo's layout. ~15 s. |
| `npm run build` | `dist/index.html`. Fails on any other output, or a module from outside `src/`. |
| `npm run check` | `tools/check-build.js`: one self-contained file within the size budget, and the `src/` lint. |
| `npm run shot -- [args]` | Builds, then `tools/screenshot.js`: a PNG per view of `tools/views.js`, `contact-sheet.png` and `info.json` in `screenshots/<label>/`, and per view its measurements in `<label>/<view>/` (`tools/measure.js`): `banding.png` and the share of the frame in visible bands, zoomed `crop-*.png`, `shimmer.png` and the share that flickers while nothing moves, `grain.png` and the share where the flight (the motion strip's frames) differs from itself rendered with other jitter (the grain the history can't average in motion, over the frame and each crop), `motion.png` (the flight on from the still, a strip of frames) and the share of pixels that change along it; the still's tone (the share under luma 96 and over 200, the colour of its darkest third and its brightest tenth) and each crop's texture (its contrast octave by octave). Measurements past their limits warn (the tone, the texture and the motion have none yet: they guard, from rows the author has approved). Fails on any console, page or WebGPU error, network request or timeout. |
| `npm run verify` | test + build + check + shot with `--checks` (`tools/checks.js`: streaming, the domes kept ahead of the bird at top speed, flight, steering, captures that repeat byte for byte, running out of GPU memory, the baked volumes, pointer and keys, errors the tools must hear, what a visitor sees, the benchmark). Args after `--` go to the capture (`npm run verify -- --size 640x360`). About 7 min on a desktop GPU (the NVIDIA laptop: the views ~3.5, the checks ~3.5). **The definition-of-done command.** |
| `npm run verify:ci` | verify as CI runs it: SwiftShader, 320×180, 8 frames, no measurements. The one to run without a GPU (cloud sessions; `node tools/linux.js npm run verify:ci` on Windows and macOS). |
| `node tools/screenshot.js --compare A B [--views a,b]` | Before/after sheet `screenshots/compare/A_vs_B.png` with a diff column, per view how many pixels differ and how the measurements changed, and for each view that changed `compare/A_vs_B/<view>.png`: A, B and the diff at full size, then the view's crops zoomed. |
| `node tools/checks.js [names]` | The behaviour checks alone (`streaming top-speed flight steering reproducible out-of-memory volumes pointer-and-keys errors player benchmark`), writing into `screenshots/checks/`. |
| `node tools/cost.js [--against HEAD] [--views a,b] [--frames 200] [--rounds 3]` | What a change costs the GPU: the working tree's build against another commit's (built in a temporary git worktree), interleaved A B B A A B, a view at a time, with `?cpuprof`; per view and pass the totals, the change and each side's spread (a change within it is noise), every run in `screenshots/cost/<label>.json`. After committing a change, `--against HEAD~1`. About 6 minutes for the six default views on a desktop GPU. The same build against itself reads the trace within 0–2%: a change past ~3% is real (`world` and `sunmap` swing far more: the first frame's bakes). |
| `node tools/flights.js [--label L]`, `--compare A B` | The scripted flights' logs (15 s each, from the start and diving into the cloud tops; and `reach`, 6 minutes from the start up the first tower in its rising air: when the air is felt, how high it carries the bird) into `screenshots/flights/<label>.json`; compare says per flight "identical" or where they part and by how much. About 1.5 min. |
| `npm run map` | `tools/world/map.js`: a top-down map of the world (restlessness, towers by height), without rendering. |
| `node tools/world/fingerprint.js [--write]` | Whether the CPU world is the one recorded in `tests/fixtures/world-fingerprint.json`; `--write` records it after a deliberate change. |
| `node tools/light/reference.js [--cases top,face] [--shade] [--fresh]` | The trace's light against a Monte Carlo of the medium (`tools/light/`): per shape (tops, slopes, faces, walls lit from behind, balls) and view, the radiance a real cloud sends and the trace's (its model, `tools/light/model.js`); then the shade (`--shade` alone): in colour under the page's sky, in another cloud's shadow, beside a sunlit wall, folds, an overhang over a sea lit or in shadow. The Monte Carlo's numbers are kept in `screenshots/light/` (minutes to make again; made again when the medium in `constants.js` or the sky changes). The sky is read out of the built page once (`tools/light/sky.js`; again when the atmosphere changes). |
| `node tools/linux.js <command>` | Runs a command in a Linux container like CI's runner (Docker): SwiftShader captures on Windows and macOS (§4). |

The tools test `dist/index.html` as built, and refuse one older than its sources: `npm run build` first
(`npm run shot` and `npm run verify` do).

Screenshot args: `--views start,tower` (default: all), `--label` (default `<git hash>[-dirty]-<UTC timestamp>`),
`--size 960x540`, `--frames 12`, `--scale 0.5` (the clouds' resolution), `--seed 3`,
`--query "dbg=1&exp=16"` (more URL parameters, §7), `--gl auto|hardware|swiftshader` (auto: the GPU, else
SwiftShader, which WebGPU has on Linux only), `--profile` (per-pass GPU times in `info.json` and the
compare), `--checks`, `--no-measurements` (stills only: CI's, as the measurements only warn and would
take most of a run on SwiftShader; it frees `--query` to set `freeze`, which a change to the clouds'
shapes needs to frame its variants alike: the probe steers the flight by them).

**The benchmark** (`?bench`, `src/core/benchmark.js`): the piece flies a fixed route from the start (level,
a long turn, a dive and climb, a weave) as in normal use, measuring each leg, then shows a summary
(frame times, GPU time (its passes summed, and the span from the first to the last), the clouds'
resolution, hitches, the GPU, browser and screen, the GPU memory made, whether the timestamps steered
the resolution, the world's bakes against their estimate) with a button to copy it. It is how numbers from real computers and phones reach a session: ask the user to run it on
the published page (`https://bstummer.github.io/flying-at-sunset/?bench`) and paste the summary.

**P** (in the page, the deployed one too; nothing on screen says so): logs and copies the moment as a
`tools/views.js` entry, `{ name: 'new-view', params: { pose: 'x,y,z,yaw,pitch,bank,speed' } }` (and
`seed`, `towers`, `weather` if set): the bird's pose 0.2 s before the key, so a capture's still (12 frames on)
lands on what was on screen. How a moment the author saw in flight reaches a session: ask them to
press P there and paste it.

The world in Node (`tools/world/`, no browser; `QS="seed=3"` for another world, `WSRC=dir` for another
checkout's `src/world`): `stats.js` (the sea, towers by size and how flat their tops, mushrooms (a
tower's widest section up top against its narrowest in the middle) and knobs (small bubbles perched
on big ones), the bubble load), `map.js`, `preview.js`
(a CPU sphere-traced view of the large shapes in seconds), `catalog.js` (side views of the biggest
towers, for silhouettes), `pose.js` (a camera pose looking at a point, for `?pose=`), `levels.js` (how far
the clipmap levels' large shapes disagree over boxes: the top surface, the heaps, the towers' peaks; each
level baked on the CPU as the GPU bakes it). Images go to `screenshots/world/`.

**Cloud sessions** run in Linux with no GPU and no display: run `npm ci`, then once per machine
`npx playwright install-deps chromium` (needs root). Captures fall back to SwiftShader: slow (a 320×180
view takes 30–60 s, mostly its first frame's world bake), and only relative timings mean anything. Use
CI's settings there: `npm run verify:ci`, and captures with `--gl swiftshader --size 320x180 --frames 8
--no-measurements`; measure only the views a change touches (`--views a,b`, measurements on). The
images reach the author through CI's `screenshots` artifact, or copied out of the session.

## 4. Visual workflow

For every change that can affect pixels:

1. `npm run shot -- --label before` on the current state, before editing (a reused label replaces its
   capture).
2. Make the change.
3. `npm run shot -- --label after`
4. `node tools/screenshot.js --compare before after`, then **open and look at** the images of the
   views that changed (`screenshots/compare/before_vs_after/<view>.png`: full size, crops
   zoomed; the whole sheet is too small to judge a subtle change by), and at the measurements of the
   views the change touches (`screenshots/after/<view>/`: banding, crops, shimmer, grain, the motion strip).
5. **Never claim a visual improvement without looking at the images.** Say what you saw, including what
   got worse. A still can't show motion, the feel of the flight or speed on real hardware: name what you
   couldn't check and leave it to the user.

- Captures are deterministic (the test mode, §7): the same args on the same backend give byte-identical
  PNGs, so any difference is real, and a refactor must show "identical" on every view. An older
  commit's look comes back the same way: build it in a git worktree and capture it with the same args.
- Compare only captures from the **same backend** (WebGPU adapter and Chromium build): a GPU and
  SwiftShader differ everywhere, and on Windows so do DXC and FXC (the tools' compiler before
  2026-11-23: older captures there are another backend's). CI's are SwiftShader's (`npm run verify:ci`: 320×180, 8 frames). On
  Windows and macOS those come from `node tools/linux.js node tools/screenshot.js --gl swiftshader --size
  320x180 --frames 8 --no-measurements --label ...`, the same as CI's while `package-lock.json`
  pins the same Playwright, and with it the same Chromium, but for a stray pixel a level off
  (SwiftShader compiles for the CPU it runs on: compare the container's with the container's).
- For a lighting or post tunable with a URL parameter (§7), try values before editing: `--query
  "rays=0.24"`, and isolate its pass with `view=` (`--query "view=4&rays=0.24"`).
- A change that can touch the flight (flight, input, camera, the probe, the world near the bird):
  `node tools/flights.js --label before` before, `--label after` after, then `--compare`.
- Something new worth watching gets a view in `tools/views.js`, with a `brief`: one line on what the
  shot is for, in the vision's terms (§1), `crops` where its detail is, and an `aspect` for a screen
  of another shape (`start-phone`). Keep existing views stable so captures stay comparable: a view by
  pose keeps its world with `weather` when the spawn draw moves.
- The limits (`tools/measure.js`: banded and shimmering share of the frame) only warn; a warning is a
  question to look at the image, and a change that raises one says why when it is handed over. They are
  set for the default 960×540: at smaller sizes sunlit rims make `high2` and `anvil` warn (PLAN.md,
  known issues). The measurements move with exposure, glow and the tone curve too: a change in them is
  a question for `shimmer.png` and `banding.png`, not a result.
- After a deliberate change to the world, `node tools/world/fingerprint.js --write`, and say so in the
  commit.

## 5. Testing

**Pure logic gets tests; visuals get screenshots; behaviour gets checks** (`tools/checks.js`).

- The world generator runs in Node exactly as in the page (`tools/world/load.js` imports `src/world/`
  and what it imports), and `tests/world.test.js` holds it to: the recorded fingerprint (a change to
  the world must be deliberate), independence from the order places are asked for (what streaming
  relies on), and invariants of properties over seeds 1–20 (sound column data for the GPU, towers
  under the trace's ceiling, a first tower ahead of the start: the spawn draw).
- Invariants are properties, not specific numbers, and each seed's world runs in a worker thread of its
  own (a module graph holds one world).
- The flight model runs in Node too (`src/flight/flight.js` needs only the world): `tests/flight.test.js` holds
  it to its promises (top speed, the floor under the sea, the ceiling, climbs trading speed for height,
  stability at a coarse time step, the first tower's rising air within three minutes, still air away
  from towers). The flights in the page are `tools/flights.js`'s and the flight check's.
- The chase camera follows it in Node (`src/flight/camera.js`): `tests/camera.test.js` holds it to
  where the bird sits in the frame on a wide screen, a tablet and a phone (low, in the middle), and
  to keeping it whole through a held climb, a held dive and turns at full bank.
- The light has a reference: `tests/light.test.js` holds the Monte Carlo (`tools/light/mc.js`, of
  the medium in `constants.js`: its extinction and profile) to closed forms, the trace's light
  within a factor two of it and independent of the outline's width, and its shade under a sky near
  it (a crease darker than an open top in both). The trace's light is `tools/light/model.js`, a
  copy of the shaders' (`sunScatter`, `lightPath`, the skin, the profile's depths, the sky light:
  `traceAmbient`): a change to those formulas changes it too, and `reference.js` says how far it
  then is from a real cloud.
- The checks test the piece, and the tools themselves: the streaming check compares the streamed
  volumes with a fresh start's texel by texel, and the errors check proves the tools hear a WebGPU
  validation error and a lost device.
- `node:test` and `node:assert/strict` only; ask before adding a test dependency. Files are
  `tests/<module>.test.js`, and nothing outside `tests/` may have a name `node --test` picks up
  (`tests/layout.test.js` checks).
- `tools/check-build.js`'s HTML rules each have a fixture in `tests/fixtures/check-build/fail/<rule-id>.html`
  that trips exactly that rule; `pass/*.html` trip none.
- A test or check that has never failed proves little: break the code it covers once and watch it go red.

## 6. Architecture

```
index.html            source template: canvas, hint, touch ring, note, the benchmark's panel
vite.config.js        single-file build to dist/ (the shaders' includes: tools/wgsl.js; the world's worker, inlined; __BUILD__, the build id)
PLAN.md               what was tried and failed, and why; what is still open
src/
  main.js             the start, the main loop (frameStep), the steering hint, a lost device, window.__debug
  worker.js           the world's worker: src/world/ off the page's thread (the spawn draw, column data, bubbles, the
                      domes and rising air around the bird, ?preset's place), bundled into the page as a string
                      and started from a blob: URL
  math.js constants.js  the small math kit; the sun (7° up, toward −Z) and its light's colour, the wind, the noise tiles and the detail volume's turn, the render origin, the ceiling, the clouds' medium, the clipmap levels' grids, the atmosphere
  core/               the page around the piece: every URL parameter (params.js, §7), its elements, the note,
                      refused requests and fullscreen (page.js), steering (input.js), the world's worker from the
                      page's side (world.js), the test mode (capture.js), the readout (readout.js, ?debug), the
                      benchmark (benchmark.js, ?bench)
  flight/             the glider (flight.js, needs only the world), the chase camera (camera.js; the start's heading
                      and the bird's place in the frame by the screen's shape), where the bird starts (presets.js: the test views, ?preset, ?pose)
  world/              the CPU world generator: the air, thermals, cells (and the spawn draw: where the weather lies
                      against the start), shapes, what the GPU and the flight get. No DOM, no GPU
  render/             WebGPU: the device and pipelines (gpu.js), static resources (setup.js), streamed volumes (stream.js),
                      the sun map and the lit map (sunmap.js; its grid, sungrid.js), size-dependent targets, the probe, timing, the sun's colours (sun.js), the bird, one frame
                      (frame.js), dynamic resolution
  shaders/            WGSL: a .wgsl file per shader, chunks/ they include; per family (sky, textures, cloud, volumes,
                      trace, taau, probe, mist, bird, post) a .js module with the uniforms and the shaders
  style.css
tools/                screenshots, measurements (measure.js, image.js) and compares, behaviour checks, the build check, the world in Node, the light's reference (light/), the Linux container, the site's folders, the browser's install
tests/                node:test suites and their fixtures
```

Each module's header says what it does and how; `src/world/air.js` gives the overview of the world.
`main.js` imports the modules in the order they are set up: the world's worker (`core/world.js`
starts it; it runs the spawn draw and grows the world around the start while the rest sets up), the
GPU device and the canvas (`render/gpu.js` awaits the device at its top level), the world's queries
(the page may grow cells itself, `core/world.js`, in the weather the worker's start hands over), the shaders and static resources (`render/setup.js` creates every pipeline; they compile in
parallel and `main.js` waits for them before the first frame), the streamed volumes, the render
targets, the flight, the test views, the frame, then what reads them all: the benchmark, the test
mode, the readout. Before the first frame `main.js` waits for the pipelines, the worker's start (where
the bird starts) and the domes around the bird; the first frame waits for its world volumes. (`npm run dev` runs the modules natively, where those
that don't import `render/gpu.js` can run while it awaits the device; the build waits for it
everywhere. Verify judges the build.)

## 7. The test mode and the tools' contract

The tools rely on these; keep them, or change the tools with them.

- `?test`: a fixed time step (`dt`, default 0.0166), a canvas of `w`×`h` (default 960×540), clouds at
  `scale` (0.5), stops after `frames` (24): the last frame is copied out of the canvas texture as a PNG
  data URL in `window.__png`, then `window.__done = true`. No hint, no dynamic resolution, each frame
  waits for the world's worker to answer what it asked and bakes all of it, and for the probe of the
  last frame, as on a GPU and a worker that keep up: renders are deterministic (`src/core/capture.js`). A request the page can't serve sets `__error`, which
  fails the capture: a URL parameter it doesn't know or a value not of its kind (`src/core/params.js`),
  an unknown preset or route, a tower view the world has no place for; so does a lost device (the page
  never reloads). `&live`: input is read as normally (the steering checks).
  `&log`: a per-frame flight log in `window.__log` (t, x, alt, z, speed, bank, flight-path angle γ, yaw
  (angles in degrees), sea top, the probe's distance to the cloud at the bird, camera roll, fov, the
  rising air). `&script=dive|climb|turn|weave|divedeep|holddive|reach`: scripted input
  (`src/core/capture.js`). The start's heading follows the canvas's shape (`flight/camera.js`). `&freeze`: no
  flight. `&preset=...` (the table below), `&pose=x,y,z,yaw,pitch,bank[,speed]`: where the bird is (metres, the
  height absolute; radians, yaw 0 toward the sun (−Z), pitch the flight-path angle; m/s); the chase camera
  sits a few metres behind it, and the flight goes on from there (`tools/world/pose.js` finds a pose
  looking at a point). `&closeup=right,up,forward`: a camera fixed to the bird.
  `&jit=J`: the jitter sequences start J frames on (the grain measurement: the same render with
  other noise). `&keep=K&every=S`: hand over K frames, S frames apart, from the `frames`th on, in
  `window.__frames` (the first is `__png`, the same as without them); with `&freeze&dt=0` nothing
  moves but the clouds' jitter (the shimmer measurement).
- `?bench` (not with `?test`): the benchmark; `&benchSeconds` and `&benchWarmup` per leg (default 8
  and 2). `window.__BENCH__` = `{ done, summary, legs }` once it ends; `#bench` holds the summary.
- Globals: `window.__done`, `__error` (also shown in `#note`), `__frame`, `__png`, `__frames`, `__gpu` (with
  `?cpuprof`: per-pass GPU times summed over the run), `__log`, `__debug` (`bird`, `cam`, `R`,
  `seaTopAt`, `cloudTopAt`, `towersNear`, `input`, `DR`, `LEVELS`, `TSVL`, `SUNMAPS`, `worldStats`, `patchStats` (the domes around the bird: core/world.js), `device`, `T`,
  `readTexture(texture, z, nz)`, `probe()`), `__BENCH__`. Elements: `#view` (the canvas, class `on`
  once shown), `#hint` (class `on`), `#touch`, `#note`, `#stats`, `#bench`.
- Out-of-memory error scopes open in two places only (the out-of-memory check counts on it): `render/gpu.js`,
  once, around what the modules make as they load (`main.js` closes it before the first frame), and
  `render/targets.js`, around each allocation of the size-dependent targets.

URL parameters, for working on the piece (all of them, with their defaults, in `src/core/params.js`'s
header; outside the test mode one the page can't read is a console warning, and the piece runs on):

| parameter | effect |
|---|---|
| `?debug` | frame rate, resolutions, GPU times, altitude, speed, world jobs |
| `?bench` | the benchmark (§3) |
| `?seed=N`, `?towers=K` | another world (default 7); the density of convective cells (default 1) |
| `?weather=rx,rz,sx,sz` | where the weather (the restless air, the cells' grids) lies against the sea and the start, in place of the spawn draw's choice (`world/cells.js`; `node tools/world/stats.js` prints the draw's): the views made before leg 14 keep their world by it |
| `?preset=start\|sun\|away\|side\|skim\|high\|bank\|fastdive\|humps\|high2\|upward\|tower\|giant\|anvil\|close\|approach\|inside\|under` | where the bird starts (in normal play too: `?preset=tower`); the last seven look at generated towers |
| `?view=1..5` | cloud transmittance, raw cloud light, depth, sun rays, bloom |
| `?dbg=1..7` | cloud debug: normals, sun visibility, the shadow volume and the sun map, march cost, lighting terms |
| `?raw` | each frame's own cloud trace, upsampled without the history: what the trace alone gives a frame (its noise and aliasing, before the temporal upsampling averages them) |
| `?sun=D` | the sun's height in degrees (default 7) |
| `?exp ?veil ?con ?haze ?bloom ?bloomw ?bclamp ?rays ?tm` | the base exposure (the meter lifts it where a frame is dull: `shaders/exposure.wgsl`), the lens's veiling glare, contrast, haze density, bloom, sun rays, tone curve |
| `?cpuprof` | with `?test`: `window.__gpu` sums the per-pass GPU times over the run (timestamp queries; `--profile`) |

## 8. Conventions

- Plain JS ES modules, no TypeScript, no framework. Small modules, short comments that explain *why*,
  no dead code. Each module's header says what it does and how, briefly: what a reader needs before
  the code (its job, its mechanism, its entry points, who uses it), not the code's formulas restated.
  A `.wgsl` file's header follows its `#include` lines (a line above them would stop the includes);
  its family's `.js` module describes the family.
- **Shaders** are `.wgsl` files in `src/shaders/`, one per shader, that `#include "chunks/x.wgsl"` shared
  code at their top (`tools/wgsl.js`: each chunk once, in the order first reached); a `.js` module per
  family exports them with their uniforms. A shader names its uniforms `u.x`, declared in that module
  as `U_...` fields, its textures `tX`, storage textures `oX` (a compute shader's output) and storage
  buffers `bX` (registered in `render/gpu.js`; a name in a comment doesn't count; a buffer's struct is
  declared in a chunk the shaders that use it include); a pass (`pass`, `dispatch`) hands them over by
  those names, and a missing one throws (`render/gpu.js`'s header). Entry points: `vs`, `fs`, `cs`.
  A value JS and WGSL both use comes from `constants.js` through the pipeline's header (its
  `FOR_SHADERS`: the ceiling, the medium, the noise tiles, `DETAIL_ROT`, the atmosphere), never as a second literal; a switch is an `override` set by the pipeline's
  `constants` (the trace's `DBG`).
- **Row order**: every texture keeps GL's, row 0 at the bottom of the view, as when the piece was
  written for WebGL. Fullscreen passes work in pixel coordinates (`@builtin(position)` numbers rows like
  `gl_FragCoord`), geometry flips y in clip space (`toClip`, which also maps GL's depth range to
  WebGPU's), and only the final pass turns the image the right way up for the canvas.
- **Shared state** that other modules change lives in objects (`R`, `T`, `bird_`, `cam`, `input`, `DR`)
  or is changed through a function of its own module (`setRestOffset`, `updateInCloud`): ES modules
  can't assign to an imported binding. The flight and the camera take what they read as arguments
  (`updateFlight(bird, dt, time, steer, probe)`), so they run without the page.
- `src/world/` stays free of the DOM and the GPU, and every value it gives is a function of position and
  the seed (§2): the Node tools and the tests run it.
- Tunables live as named constants next to what they tune, or as numbers in the formula they belong
  to, whose comment says what it does (the world's, in `src/world/`). A number a header quotes is
  part of the header: change both together.
- **URL parameters** are read in `src/core/params.js` alone (`PARAMS`: each with its kind), and a module
  reads one as `params.x`, null when it is missing, keeping the default next to what it tunes
  (`params.exp ?? 14.0`). `tests/params.test.js` holds `src/` to reading exactly the names `PARAMS` has.
  A request the page can't serve goes through `refuse()` (`core/page.js`), never past it in silence.
- A tool's main runs under a top-level await, so a tool must never reach itself again through its
  imports: it would wait for itself and hang without a word. What two tools share goes in a module
  of its own (`tools/browser.js`, `labels.js`); `tests/layout.test.js` checks.

## 9. Performance budget

Smooth before sharp: dynamic resolution keeps the GPU under 12.5 ms a frame where the browser has
timestamp queries (a frame's time: the span from its first pass to its last; a phone's Mali
overlaps its passes, and their own times summed said 3.5 times what its frames took), held to the
time between frames (`render/gputrust.js`), else it aims at the display's frame rate by frame times
(their 75th percentile: frames that fall behind come in bursts) (`render/resolution.js`),
and detail gives way first. Phones get a lower resolution cap and cloud scale. Real computers and
phones report through the benchmark (`?bench`, §3); the numbers in hand are in PLAN.md (known issues). CI's
SwiftShader timings are only relative. To compare two builds on one machine, `node tools/cost.js`:
it runs them interleaved (A B B A A B, the older one in a git worktree), a view at a time, over a
few hundred frames each: the NVIDIA laptop's clocks drift between runs (the same bake 2× apart,
separate captures ±25%), a page that waited idle runs its frames slower, and two pages side by side
(as `npm run shot` renders them) share the GPU. On Windows the tools' shaders are DXC's, as in
visitors' Chrome (FXC, the headless shell's, had a cliff of registers in the trace that DXC doesn't:
PLAN.md, leg 10). Watch the CPU too: the world generator
runs in a worker, but the page applies what it sends within a budget of main-thread and estimated GPU
time (`render/stream.js`; the estimate scaled by what the bakes take on the device, where it has
timestamp queries: `render/bakescale.js`): a hitch in the benchmark is a question for that budget.

## 10. Definition of done

- `npm run verify` passes (without a GPU: `npm run verify:ci`): tests, build, check, screenshots and
  checks with zero console, page or WebGPU errors.
- A change that can touch the flight has identical flight logs (`tools/flights.js --compare`), or says
  how and why they differ.
- New or changed pure logic has tests; a world change keeps the invariants, and a deliberate one is
  re-recorded (`fingerprint.js --write`) and said so in the commit.
- The before/after `--compare` sheet has been opened and reviewed, and you can say what changed.
- Something new worth watching has a view in `tools/views.js`.
- This file is updated if the structure, commands, conventions or contract changed.
- PLAN.md is updated: an approach that failed goes in its decisions, with why and when; what is still open in
  its known issues; what got fixed comes out. Commit and push only when the user asks; pushing to
  `main` publishes the piece.

## 11. How to work a request

The author directs the work, one request at a time, and reviews the result. In between, the approach
is yours: read a request for what it is after, not only for what it says, and build whatever serves
the result best (§1), within the hard rules (§2). Experiment, try several ideas side by side, rethink
or rebuild a part when that beats tuning it, and drop what doesn't work.

What tends to help:

- A `before` capture (§4) shows where the piece falls short of the request and the vision.
- For the world, `tools/world/` (stats, map, preview, catalog) answers in seconds, before any GPU
  capture; `node tools/cost.js` shows what a change costs on the GPU (§9).
- Judging the result as harshly as the author will: the views against their briefs and against what
  the author keeps coming back to (§1). A subagent that hasn't seen the code is a good second pair of
  eyes.

When handing over, say what changed, what still falls short (what got worse too), what it costs, and
what you couldn't judge: you see still images only, so motion, the feel of the flight and speed on real
hardware are for the author's eyes. Make sure they can open the images (from a cloud session: CI's
`screenshots` artifact, or copied out). A pushed branch's preview is at
`https://bstummer.github.io/flying-at-sunset/<branch>/`, with `?bench` there to measure it.

Ask when a new dependency looks necessary, when the frame rate can't be held, or when a choice is
about taste or scope rather than engineering.
