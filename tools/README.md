# Tools

Development tools for the piece: a local server for the sources, rendering and comparing views,
measuring and drawing the generated world without a browser, behaviour checks, and regression
tests. None of this is needed to run the piece. See `docs/DEVELOPMENT.md` for how it works (section
2: the source files and the build).

## Setup

- **Node 18+** (22 used).
- **Playwright with Chromium** for everything that renders: `npm install` (the root `package.json`
  pins Playwright 1.56.1, Chromium 141, which recorded the baselines) and
  `npx playwright install chromium`, or set `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs`.
  `npm run build`, `npm run dev`, `npm run fingerprint`, `npm run regress`, `npm run check:modules`,
  `npm run check:presets` (see `package.json`). The build and the server need only Node.
  Chromium runs headless with **software GL (SwiftShader)**: no GPU needed, renders are
  deterministic, but slow (a 320×180 test render ≈ 30–60 s, mostly the first frame's world bake)
  and only relative timings mean anything. `CHROMIUM_ARGS` replaces the flags (e.g. for a GPU).
- **Python 3 with Pillow** only for `combine.py` / `crop.py` / `render.sh` (image grids).
- Every browser tool renders `PAGE` (default: `index.html` at the repo root, the built page).
  **Build first** (`node build.mjs`) after changing `src/`; the tools warn when `index.html` is
  older than the sources. `PAGE=/tmp/other.html` tests another build (`node build.mjs --out ...`).
- Node world tools run the generator's modules (`src/world/` and what they import) through
  `tools/world/load.js`; `WSRC=dir` loads another copy (e.g. `src/world` of another checkout), or
  module files joined with `:`. `QS="seed=3&towers=1.5"` sets the URL parameters the generator
  reads.

## Working on the sources

| command | what |
|---|---|
| `node tools/serve.mjs [port]` | a local server: http://localhost:8000/src/ runs the sources as ES modules (edit, reload), http://localhost:8000/ the built page |
| `node build.mjs` | write `index.html` from `src/` (`--check`: fail if it is out of date; `--out f.html`, `--src dir`) |
| `node tools/checks/modules.mjs [queries]` | the sources run as modules render exactly what the built page renders, without errors |

## Regression tests (run these after a change)

| command | what |
|---|---|
| `node tools/world/fingerprint.js` | hash of everything the CPU world generator produces for fixed places (air, sea columns, column and bubble blocks of every level, towers, surface heights); compares with `world/fingerprint.json`, prints which part differs. `--write` records the current world. ~3 s |
| `node tools/regress.mjs` | 14 small renders (start, sun, away, side, skim, high2, tower, giant, anvil, close, under, inside, another seed, cloud geometry) compared with `tools/baseline/*.png`; bit-identical on the same Chromium build. `record` re-records; `TOL_MEAN`, `TOL_OVER16` tolerances; new renders in `tools/out/regress/`. ~6 min |
| `node tools/checks/presets.mjs` | every test preset renders without page or GL errors. ~6 min |

## Rendering and comparing

| command | what |
|---|---|
| `node tools/shot.mjs out.png "preset=start&frames=12&w=960&h=540&scale=0.5"` | one deterministic render (`?test` is added); prints `{err, frame, gpu, secs}` and console messages |
| `tools/render.sh outdir tag start side away high2 tower giant` | several views, two at a time, combined into `outdir/tag_all.png` (env `W H SCALE FRAMES EXTRA PAGE JOBS`; `name=pose:x,y,z,yaw,pitch` for exact poses) |
| `python3 tools/combine.py out.png a.png b.png ...` | images side by side, two per row |
| `python3 tools/crop.py out.png x0 y0 x1 y1 a.png b.png` | the same region (fractions) of several images, stacked: compare detail between versions |
| `python3 tools/variant.py index.html /tmp/v.html edits.py` | a variant of the built page from exact text replacements (each must match once): quick A/B experiments with `PAGE=/tmp/v.html` without touching `src/` |
| `node tools/checks/profile.mjs [pageB.html] [presets]` | per-pass times (`?cpuprof`) of the page, or of two pages side by side with the change in % |

Useful query additions: `&dbg=1` (normals of the cloud surface: geometry without lighting),
`&dbg=4` (march cost), `&seed=N`, `&towers=K`, `&view=1..5`. All parameters: `docs/DEVELOPMENT.md` §11.

## The world in Node (no browser)

| command | what |
|---|---|
| `node tools/world/stats.js [cx cz] [R]` | the sea (restlessness, billow strength, domes), towers by size class (rise, width), counts by distance, the nearest towers, the bubble load |
| `node tools/world/map.js out.png` | top-down map: restlessness (grey) and towers (coloured by top height); `HALF N CX CZ` |
| `node tools/world/relief.js out.png` | shaded relief of the sea surface with its heaps (the column data); `CX CZ HALF CELL` |
| `node tools/world/preview.js out.png x,y,z,yawDeg,pitchDeg` | CPU sphere-traced preview of the large shapes (no billows) in seconds; `--look tx,tz,dist,azDeg[,camY,pitchDeg]`; `OPT='{"w":640,"h":360}'` |
| `node tools/world/catalog.js out.png` | side views of the biggest towers around a point, with the ceiling; `K R CX CZ MINTOP ONE` |
| `node tools/world/pose.js tx tz dist azDeg` | a camera pose looking at a point, for `?test&pose=...`; `--towers` lists towers near the start |
| `node tools/world/thermal.js` | how high single thermals rise for several sizes and restlessness values (`AIRMOD='...'` to experiment) |
| `node tools/world/startup.js` | CPU cost of the page's first frame of world work, level by level |
| `node tools/world/spawn.js [seeds]` | the start for several seeds: restlessness around it, big towers in the start view |

## Behaviour checks

| command | what |
|---|---|
| `node tools/checks/gl-errors.mjs ["test&frames=3&w=160&h=90&preset=tower"]` | every WebGL error with the call, page errors, console |
| `node tools/checks/input.mjs mouse\|keys\|touch` | steering through real input events (bank, climb, level out) |
| `node tools/checks/pointer-keys.mjs` | pointer leaving the window, Cmd/Ctrl + arrows, Meta clearing keys |
| `node tools/checks/flight.mjs weave 600` | scripted flight log (`dive climb turn weave`; `none 300 "preset=approach&dt=0.1"` flies into a tower) |
| `node tools/checks/ui.mjs [prefix]` | as a visitor sees it: canvas fade-in, hint on/off timing, no errors, desktop / phone / `?debug` |
| `node tools/checks/alloc-fail.mjs` | GPU memory running out at start and on resize: the page retries smaller and keeps running |
| `node tools/checks/dynres.mjs [s]` | dynamic resolution over time in normal use (software GL takes the weak-GPU path) |
| `node tools/checks/volumes.mjs` | baked volumes: NaNs, cloud touching a volume's ceiling, column map ranges |
| `node tools/checks/stream.mjs [dir]` | fly 8 km, then start fresh at the same pose: the images must match |

Expected results (Oct 2026): all presets ok; 0 GL errors; input banks ±53–55° and levels out;
alloc-fail recovers in both cases; stream difference small (billows drift with time); modules and
built page identical; fingerprint `a3088118a50acbd470b41785`.
