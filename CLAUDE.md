# Flying at Sunset

A paper bird gliding over an endless sea of clouds at golden hour: one self-contained WebGL 2 page,
`index.html`, built from the ES modules in `src/` and published with GitHub Pages from this public
repository.

Read before changing anything:

- `docs/BRIEF.md`: what the author wants. Every request verbatim, the inspiration photos described,
  likes and dislikes.
- `docs/DEVELOPMENT.md`: how it works (§2: the source files and the build), test hooks, known
  issues, tuning lessons.
- `docs/HISTORY.md`: what each round built, tried and dropped.
- `tools/README.md`: the local server, renders, world tools in Node, behaviour checks, regression
  tests.

Rules from the author (details in `docs/DEVELOPMENT.md` §1):

- The output stays one HTML file that works from `file://`: no network, libraries or assets.
- Clouds are generated, never placed by hand. If something looks wrong, change a natural cause
  (the air, the thermals, time), not a special-case feature.
- Keep the lighting, colours and sky as they are unless asked.
- The repository is public: never commit the author's inspiration photos (they are described in
  `docs/BRIEF.md` instead).

Working on the code:

- Edit `src/`, then run `node build.mjs` and commit the rebuilt `index.html` with the sources: it is
  the page GitHub Pages serves and the page the tools test. `node build.mjs --check` says whether
  it is current.
- The build joins all modules into one scope: top-level names must be unique across `src/` (the
  build checks), imports are named and never renamed, and a module never assigns to a binding it
  imports. `src/world/` must stay free of the DOM and WebGL (the Node tools run it).
- `node tools/serve.mjs` serves the sources as ES modules at http://localhost:8000/src/.

Checking a change:

- `node tools/world/fingerprint.js`: the CPU world generator's output (~3 s; exits 1 if it changed).
- `node tools/regress.mjs`: 14 small renders of the built page against `tools/baseline/` (~6 min;
  bit-identical on the same Chromium build).
- `node tools/checks/modules.mjs`: the sources run as modules render what the build renders.
- `node tools/checks/presets.mjs`: every test view renders without errors.
- Rendering in the cloud container uses software GL (SwiftShader): slow, timings only relative,
  nothing measured on real GPUs or phones yet.
- After a deliberate change to the world or the look, re-record (`fingerprint.js --write`,
  `regress.mjs record`) and say so in the commit.
