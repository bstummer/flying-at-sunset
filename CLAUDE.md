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
budget (§9). **Every frame should look like a photograph taken from an airplane window just before
sunset.** It should feel peaceful, vast and quietly magical, and it must stay smooth, because
stuttering breaks the spell.

- **The clouds are the heart of the piece.** An endless sea of soft, billowing cloud stretching to the
  horizon, broken by enormous towers rising far above the bird: full and three-dimensional, with
  rounded tops, soft wispy edges and a sense of enormous scale.
- **Golden-hour light.** The sun sits low. Faces toward it glow gold, orange and peach, thin edges
  shine where sunlight passes through, shaded sides fall into a luminous cool blue and violet (lit by
  the sky and the light inside the cloud, never navy or brown). The sky fades from deep blue
  overhead to gold near the sun; haze melts the farthest clouds into the sky: the farther, the hazier,
  paler and bluer. Looking toward the sun is bright and dazzling.
- **The paper bird.** Slightly off-white paper, crisp creases, a subtle paper texture. Small against
  the landscape; its wings flex; it glows warmly when the sun is behind it.
- **The flight.** Gliding: diving builds speed, climbing trades it for height, turning banks
  gracefully. Smooth and forgiving, never twitchy, on phones and computers alike. The bird can't crash:
  it can skim the cloud tops and fly into clouds (briefly surrounded by drifting mist), but is gently
  kept from sinking deep into the sea.
- **The camera** follows with a slight, natural lag, swinging wide on turns and leaning into them.
  Speed is tangible in a dive: near clouds rush past, far ones barely move.
- **A clean screen**: only a short hint on how to steer (in at ~1.8 s, out at ~10 s or after 3 s of
  steering), and a note only when WebGPU is missing or something fails.

What the author keeps coming back to:

- **Random and irregular, as in nature.** No two clouds alike; no shape, feature or spacing that
  repeats in a way the eye notices; flying around should keep surprising. Disliked: anything that
  looks designed or placed (gumdrops of one size, towers spread evenly "like bushes planted in a
  field" or "chess pieces on a board", narrow pillars, a building kit of set shapes), popcorn (bumps
  of one size all over a surface), every cloud having every feature.
- **Enormous towers**, rising far above the bird (you look up at a near one's top), at least one in view
  from the start, broad at the base where they swell out of the sea: the sea and the towers are one
  system, the same cloud piled higher. Crisp, sharply sculpted cauliflower domes with shadowed folds,
  never soft pillows, yet never solid like rock or dough: light inside the cloud keeps the folds
  luminous and glows through thin parts; a few huge lobes carrying smaller ones, carrying smaller
  ones still; sides that bulge and lean, never carved cliffs; leaning, sheared and torn tops (flat
  only as an anvil); overhangs and gaps to fly under; lone giants, walls, clusters, open stretches of
  sea; rare wide flat anvils far away. A
  spreading top needs a massive, broad column, never a thin stem ("like a mushroom").
- **A billowy sea**: billows at every size (big rolling mounds covered in smaller bulges, covered in
  smaller ones), crisp where sunlight catches them, soft edges, never sharp ridgelines. Not a flat
  blanket, not smooth "sand dunes". Large relief: swells, deep valleys, heaps.
- Not too much open space around the start. No compact round puffs floating high in the sky, nothing
  that looks broken off.
- **Like a photograph**: near clouds show more detail than far ones, never less (bulges on
  bulges down to metres, ragged edges: close clouds as smooth pillows read as cotton wool a few
  metres across, and the scale is lost); no render noise of any kind (a screen-door, a lattice).

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
| `npm install` | Installs the dev dependencies (Vite, Playwright) and Playwright's headless Chromium, the only browser the tools use. |
| `npm run dev` | Vite's dev server: the sources as ES modules, reloading on every edit. |
| `npm test` | Tests, `tests/*.test.js` (Node's built-in runner): the world generator and the flight model (§5), the URL parameters and the views, the detail volume's turn, the light's reference and the trace's light against it, the shaders' includes, the screenshot tool's arguments and compares, the image measurements, the build check, the PNG codec, the site's folders, the repo's layout. ~15 s. |
| `npm run build` | `dist/index.html`. Fails on any other output, or a module from outside `src/`. |
| `npm run check` | `tools/check-build.js`: one self-contained file within the size budget, and the `src/` lint. |
| `npm run shot -- [args]` | Builds, then `tools/screenshot.js`: a PNG per view of `tools/views.js`, `contact-sheet.png` and `info.json` in `screenshots/<label>/`, and per view its measurements in `<label>/<view>/` (`tools/measure.js`): `banding.png` and the share of the frame in visible bands, zoomed `crop-*.png`, `shimmer.png` and the share that flickers while nothing moves, `motion.png` (the flight on from the still, a strip of frames). Measurements past their limits warn. Fails on any console, page or WebGPU error, network request or timeout. |
| `npm run verify` | test + build + check + shot with `--checks` (`tools/checks.js`: streaming, flight, steering, captures that repeat byte for byte, running out of GPU memory, the baked volumes, pointer and keys, errors the tools must hear, what a visitor sees, the benchmark). Args after `--` go to the capture (`npm run verify -- --size 640x360`). About 3–4 min on a desktop GPU. **The definition-of-done command.** |
| `npm run verify:ci` | verify as CI runs it: SwiftShader, 320×180, 8 frames, no measurements. The one to run without a GPU (cloud sessions; `node tools/linux.js npm run verify:ci` on Windows and macOS). |
| `node tools/screenshot.js --compare A B [--views a,b]` | Before/after sheet `screenshots/compare/A_vs_B.png` with a diff column, per view how many pixels differ and how the measurements changed, and for each view that changed `compare/A_vs_B/<view>.png`: A, B and the diff at full size, then the view's crops zoomed. |
| `node tools/checks.js [names]` | The behaviour checks alone (`streaming flight steering reproducible out-of-memory volumes pointer-and-keys errors player benchmark`), writing into `screenshots/checks/`. |
| `node tools/flights.js [--label L]`, `--compare A B` | The scripted flights' logs (15 s each, from the start and diving into the cloud tops) into `screenshots/flights/<label>.json`; compare says per flight "identical" or where they part and by how much. |
| `npm run map` | `tools/world/map.js`: a top-down map of the world (restlessness, towers by height), without rendering. |
| `node tools/world/fingerprint.js [--write]` | Whether the CPU world is the one recorded in `tests/fixtures/world-fingerprint.json`; `--write` records it after a deliberate change. |
| `node tools/light/reference.js [--cases top,face] [--fresh]` | The trace's light against a Monte Carlo of the medium (`tools/light/`): per shape (tops, slopes, faces, walls lit from behind, balls) and view, the radiance a real cloud sends and the trace's (its model, `tools/light/model.js`). The Monte Carlo's numbers are kept in `screenshots/light/` (minutes to make again). |
| `node tools/linux.js <command>` | Runs a command in a Linux container like CI's runner (Docker): SwiftShader captures on Windows and macOS (§4). |

The tools test `dist/index.html` as built, and refuse one older than its sources: `npm run build` first
(`npm run shot` and `npm run verify` do).

Screenshot args: `--views start,tower` (default: all), `--label` (default `<git hash>[-dirty]-<UTC timestamp>`),
`--size 960x540`, `--frames 12`, `--scale 0.5` (the clouds' resolution), `--seed 3`,
`--query "dbg=1&exp=16"` (more URL parameters, §7), `--gl auto|hardware|swiftshader` (auto: the GPU, else
SwiftShader, which WebGPU has on Linux only), `--profile` (per-pass GPU times in `info.json` and the
compare), `--checks`, `--no-measurements` (stills only: CI's, as the measurements only warn and would
take most of a run on SwiftShader).

**The benchmark** (`?bench`, `src/core/benchmark.js`): the piece flies a fixed route from the start (level,
a long turn, a dive and climb, a weave) as in normal use, measuring each leg, then shows a summary
(frame times, GPU time, the clouds' resolution, hitches, the GPU, browser and screen) with a button to
copy it. It is how numbers from real computers and phones reach a session: ask the user to run it on
the published page (`https://bstummer.github.io/flying-at-sunset/?bench`) and paste the summary.

The world in Node (`tools/world/`, no browser; `QS="seed=3"` for another world, `WSRC=dir` for another
checkout's `src/world`): `stats.js` (the sea, towers by size, the bubble load), `map.js`, `preview.js`
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
   views the change touches (`screenshots/after/<view>/`: banding, crops, shimmer, the motion strip).
5. **Never claim a visual improvement without looking at the images.** Say what you saw, including what
   got worse. A still can't show motion, the feel of the flight or speed on real hardware: name what you
   couldn't check and leave it to the user.

- Captures are deterministic (the test mode, §7): the same args on the same backend give byte-identical
  PNGs, so any difference is real, and a refactor must show "identical" on every view. An older
  commit's look comes back the same way: build it in a git worktree and capture it with the same args.
- Compare only captures from the **same backend** (WebGPU adapter and Chromium build): a GPU and
  SwiftShader differ everywhere. CI's are SwiftShader's (`npm run verify:ci`: 320×180, 8 frames). On
  Windows and macOS those come from `node tools/linux.js node tools/screenshot.js --gl swiftshader --size
  320x180 --frames 8 --no-measurements --label ...`, byte-identical to CI's while `package-lock.json`
  pins the same Playwright, and with it the same Chromium.
- For a lighting or post tunable with a URL parameter (§7), try values before editing: `--query
  "rays=0.24"`, and isolate its pass with `view=` (`--query "view=4&rays=0.24"`).
- A change that can touch the flight (flight, input, camera, the probe, the world near the bird):
  `node tools/flights.js --label before` before, `--label after` after, then `--compare`.
- Something new worth watching gets a view in `tools/views.js`, with a `brief`: one line on what the
  shot is for, and `crops` where its detail is. Keep existing views stable so captures stay comparable.
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
  under the trace's ceiling); checks tied to the start run on the piece's seed (7).
- Invariants are properties, not specific numbers, and each seed's world runs in a worker thread of its
  own (a module graph holds one world).
- The flight model runs in Node too (`src/flight/flight.js` needs only the world): `tests/flight.test.js` holds
  it to its promises (top speed, the floor under the sea, the ceiling, climbs trading speed for height,
  stability at a coarse time step). The flights in the page are `tools/flights.js`'s and the flight
  check's.
- The light has a reference: `tests/light.test.js` holds the Monte Carlo (`tools/light/mc.js`) to
  closed forms, and the trace's light within a factor two of it and independent of the outline's
  width. The trace's light is `tools/light/model.js`, a copy of the shaders' (`sunScatter`,
  `lightPath`, the skin): a change to those formulas changes it too, and `reference.js` says how far
  it then is from a real cloud.
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
  worker.js           the world's worker: src/world/ off the page's thread (column data, bubbles, the domes around
                      the bird, ?preset's place), bundled into the page as a string and started from a blob: URL
  math.js constants.js  the small math kit; the sun (5° up, toward −Z), the wind, the noise tiles and the detail volume's turn, the render origin, the ceiling, the clipmap levels' grids, the atmosphere
  core/               the page around the piece: every URL parameter (params.js, §7), its elements, the note,
                      refused requests and fullscreen (page.js), steering (input.js), the world's worker from the
                      page's side (world.js), the test mode (capture.js), the readout (readout.js, ?debug), the
                      benchmark (benchmark.js, ?bench)
  flight/             the glider (flight.js, needs only the world), the chase camera (camera.js), where the bird
                      starts (presets.js: the test views, ?preset, ?pose)
  world/              the CPU world generator: the air, thermals, cells, shapes, what the GPU and the flight get. No DOM, no GPU
  render/             WebGPU: the device and pipelines (gpu.js), static resources (setup.js), streamed volumes (stream.js),
                      size-dependent targets, the probe, timing, the sun's colours (sun.js), the bird, one frame
                      (frame.js), dynamic resolution
  shaders/            WGSL: a .wgsl file per shader, chunks/ they include; per family (sky, textures, cloud, volumes,
                      trace, taau, probe, mist, bird, post) a .js module with the uniforms and the shaders
  style.css
tools/                screenshots, measurements (measure.js, image.js) and compares, behaviour checks, the build check, the world in Node, the light's reference (light/), the Linux container, the site's folders
tests/                node:test suites and their fixtures
```

Each module's header says what it does and how; `src/world/air.js` gives the overview of the world.
`main.js` imports the modules in the order they are set up: the world's worker (`core/world.js`
starts it; it grows the world around the start while the rest sets up), the GPU device and the canvas
(`render/gpu.js` awaits the device at its top level), the world's queries (the spawn draw runs again
as `world/cells.js` loads: the page may grow cells itself, `core/world.js`), the shaders and static resources (`render/setup.js` creates every pipeline; they compile in
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
  (angles in degrees), sea top, the probe's distance to the cloud at the bird, camera roll, fov).
  `&script=dive|climb|turn|weave|divedeep|holddive`: scripted input (`src/core/capture.js`). `&freeze`: no
  flight. `&preset=...` (the table below), `&pose=x,y,z,yaw,pitch,bank`: where the bird is (metres, the
  height absolute; radians, yaw 0 toward the sun (−Z), pitch the flight-path angle); the chase camera
  sits a few metres behind it, and the flight goes on from there (`tools/world/pose.js` finds a pose
  looking at a point). `&closeup=right,up,forward`: a camera fixed to the bird.
  `&keep=K&every=S`: hand over K frames, S frames apart, from the `frames`th on, in
  `window.__frames` (the first is `__png`, the same as without them); with `&freeze&dt=0` nothing
  moves but the clouds' jitter (the shimmer measurement).
- `?bench` (not with `?test`): the benchmark; `&benchSeconds` and `&benchWarmup` per leg (default 8
  and 2). `window.__BENCH__` = `{ done, summary, legs }` once it ends; `#bench` holds the summary.
- Globals: `window.__done`, `__error` (also shown in `#note`), `__frame`, `__png`, `__frames`, `__gpu` (with
  `?cpuprof`: per-pass GPU times summed over the run), `__log`, `__debug` (`bird`, `cam`, `R`,
  `seaTopAt`, `cloudTopAt`, `towersNear`, `input`, `DR`, `LEVELS`, `TSVL`, `worldStats`, `device`, `T`,
  `readTexture(texture, z, nz)`, `probe()`), `__BENCH__`. Elements: `#view` (the canvas, class `on`
  once shown), `#hint` (class `on`), `#touch`, `#note`, `#stats`, `#bench`.
- Only `render/targets.js` opens out-of-memory error scopes (the out-of-memory check counts on it).

URL parameters, for working on the piece (all of them, with their defaults, in `src/core/params.js`'s
header; outside the test mode one the page can't read is a console warning, and the piece runs on):

| parameter | effect |
|---|---|
| `?debug` | frame rate, resolutions, GPU times, altitude, speed, world jobs |
| `?bench` | the benchmark (§3) |
| `?seed=N`, `?towers=K` | another world (default 7); the density of convective cells (default 1) |
| `?preset=start\|sun\|away\|side\|skim\|high\|bank\|fastdive\|humps\|high2\|upward\|tower\|giant\|anvil\|close\|approach\|inside\|under` | where the bird starts (in normal play too: `?preset=tower`); the last seven look at generated towers |
| `?view=1..5` | cloud transmittance, raw cloud light, depth, sun rays, bloom |
| `?dbg=1..7` | cloud debug: normals, sun visibility, shadow volume, march cost, lighting terms |
| `?exp ?con ?haze ?bloom ?bloomw ?bclamp ?rays ?tm` | exposure, contrast, haze density, bloom, sun rays, tone curve |
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
  `FOR_SHADERS`: the ceiling, the noise tiles, `DETAIL_ROT`, the atmosphere), never as a second literal; a switch is an `override` set by the pipeline's
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
timestamp queries, else it aims at the display's frame rate by frame times (`render/resolution.js`),
and detail gives way first. Phones get a lower resolution cap and cloud scale. Real computers and
phones report through the benchmark (`?bench`, §3); the numbers in hand are in PLAN.md (known issues). CI's
SwiftShader timings are only relative. Watch the CPU too: the world generator runs in a worker, but the
page applies what it sends within a budget of main-thread and estimated GPU time (`render/stream.js`):
a hitch in the benchmark is a question for that budget.

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
- PLAN.md is updated: an approach that failed goes in its decisions, with why; what is still open in
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
  capture; `--profile` shows what a change costs on the GPU.
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
