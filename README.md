# Flying at Sunset

A small folded paper bird glides over an endless sea of clouds at golden hour, steered by you.
No goals, no score — just the light, the clouds and the glide.

## Fly

- **Online:** https://bstummer.github.io/flying-at-sunset/
- **Download:** [flying-at-sunset.html](https://github.com/bstummer/flying-at-sunset/releases/latest/download/flying-at-sunset.html).
  It's one file and always the latest build: open it in a browser. It works offline, with nothing to
  install or load.

It needs WebGPU: a recent Chrome or Edge, Safari 26, or Firefox where it has WebGPU, on a computer or a
phone. If your browser has it but the page says otherwise, WebGPU may be turned off in its settings, or
your graphics driver blocked.

| | |
|---|---|
| **Mouse** | point where you want to go — left/right banks into a turn, up climbs, down dives. Move the pointer to the centre (or out of the window) and the bird levels out. |
| **Touch** | touch anywhere and drag; the offset from where you touched steers. Let go to level out. |
| **Keyboard** | arrow keys or WASD |
| **Gamepad** | left stick |
| **Fullscreen** | double-click or press **F** |

**Benchmark:** add `?bench` to the address (https://bstummer.github.io/flying-at-sunset/?bench). The
bird flies a fixed route for about 40 seconds while the page measures, then shows a summary of frame
times and the GPU, browser and screen it ran on. Copy it into an issue or a development session.

Diving gathers speed, climbing trades it back for height; when the speed is spent the bird lowers
its nose a little and climbs on more slowly, carried by rising air, as long as you hold it there:
from the cloud tops up past the towers' heads. You can skim the cloud tops, fly under overhangs and through the heaps and
towers that rise above the sea, but the bird is softly kept from sinking deep into the cloud sea.

## How it is made

* **Sky** — a physically based atmosphere (Rayleigh, Mie and ozone) computed into transmittance,
  multiple-scattering and sky-view lookup tables (after Hillaire 2020). The same model colours
  the low sun at every altitude and the haze between you and distant clouds.
* **Clouds** — raymarched volumes defined by signed distance fields. The world is endless and
  never repeats: every feature is drawn from a hash of where it is, generated as you fly toward
  it. Nothing is placed by hand, and there is no kit of set shapes.
  * *Grown, not built.* There are no tower types or set shapes in the code; the clouds grow
    from a few natural causes and every shape emerges from them:
    * *The air.* Slow fields decide how restless it is (broad unstable patches and long
      winding bands where air streams converge; elsewhere calm), how much stronger the wind
      blows higher up and from where, where the ceiling (tropopause) lies, how strong the
      inversion capping the sea is, and how moist the air is.
    * *Thermals.* Convective cells of every size send bubbles of warm air up out of the sea, a
      few far stronger than the rest. Each bubble rises by an entraining-parcel model: it swells,
      mixes with the air around it (the smaller it is, the faster it loses its strength, and
      mixed-in dry air chills it), drifts with the wind of its height, sheds smaller bubbles that
      crowd outward, and boils up into domes on domes as it slows. Calm air holds even big
      bubbles down under its inversion; restless air lets them break through and climb until the
      air above stops them, the strongest up to the ceiling, which nothing passes.
    * *Towers.* Where a pulse rises high it leaves a tower built as a cumulus is: a heap of
      turrets, thermal on thermal, each a third to a half the size of what it rose through,
      packed over a body that is broad where it swells out of the sea and narrower toward its
      head, the highest turret off the middle. The wind leans it; as it ages its turrets melt
      into it and it goes from the top down.
    * *Time.* A cell keeps sending bubbles up for a while: weak while it builds up, strongest in
      its prime, dying down at the end, each bubble rising through what the earlier ones left and
      squeezing past the domes in its way. What stopped rising low settles into domes and spreads
      out beneath the inversion; everything sags, drifts with the wind of its height and
      evaporates, ice high up lingering longest. Outflows set off new cells nearby, while the
      air sinking around a strong tower holds weaker cells next to it down.
    * Out of this come heaps on a lumpy, swelling sea, lone giants rising 10 km and more above
      it, clusters and long walls, leaning towers with turrets to fly under and gaps to fly
      through, old towers softening and crumbling from the top, and giants rounding off under
      the ceiling. Weak pulses lie on the sea as domes of its surface; tall ones are true 3D
      bubbles, so the sea and the towers are one system. A piece of cloud cut off from the rest
      evaporates first, so nothing floats free.
    * *Where you start.* The weather is moved against the sea again and again (each try as
      random as any other) until one leaves the air around the bird calm and open toward the
      sun, with a strong tower ahead to the right of it, lit from the side, into whose rising
      air the bird flies in two or three minutes if it just flies on.
  * *Billows.* The sea itself is always overturning, so it is billowy everywhere: big rolling
    mounds covered in smaller bulges, covered in even smaller ones. They are an *fbm of spheres*
    (random spheres baked into tileable 3D textures, the large ones packed close, merged octave
    by octave into rounded bulges with crisp creases, behind a slow, never-repeating warp), the
    largest standing out most; the finest fade with distance, and the rolling mounds of the sea
    are rounded on top and creased between, never ridged.
  * *Streaming.* The large shapes are baked on the GPU into three camera-centred 3D distance
    volumes (128 m, 512 m and 2 km cells, reaching about 260 km). They are addressed toroidally,
    so as you fly only the strips that come into view are generated and baked. Rendering happens
    around a moving origin, so precision holds on endless flights.
* **Light** — a short light march toward the sun with multiple-scattering octaves, a two-lobe
  phase function and light diffusing through the clouds, all fitted to a Monte Carlo simulation of
  the cloud medium (golden lit faces, rims that glow when backlit); sky light that depends on
  which way each bulge faces and how open the sky is above it (deep blue zenith, light from the sea
  below, warm where it lies in the sun, golden or violet sky on the sides); and a *sun map* along
  the sun's rays around the camera, with a coarser shadow volume beyond it, so heaps and towers
  cast long shadows across the cloud sea and into its valleys.
* **Speed** — empty space skipping (the baked distance volumes, coarse to fine),
  optical-depth driven steps, clouds traced at a reduced, dynamically adjusted resolution and
  reconstructed with temporal upsampling (reprojection + variance clamping). Dynamic
  resolution uses GPU timestamps when available and falls back to frame times otherwise,
  recognising displays and browsers that cap the frame rate (50 Hz screens, 30 fps power saving).
* **The bird** — an origami crane mesh with flat-shaded crisp creases, a procedural paper fibre
  texture, translucent paper (it glows when the sun is behind it), a self-shadow map in which
  paper layers let some light through, flexing wings, and mist when flying through cloud.
* **Flight & camera** — an energy-based glider with coordinated banked turns and spring-smoothed
  input; a chase camera that lags, swings wide in turns, leans into them and widens its field of
  view with speed. In cloud, drifting mist puffs, the cloud fraying into shreds around the camera
  and an exposure that adapts to the fog give the feeling of flying through it.
* **Image** — HDR throughout, bloom, occlusion-aware sun rays, a hue-preserving filmic tone
  curve with a golden-hour split tone, vignette and fine grain.
* **WebGPU** — all of it is drawn with WebGPU and shaders in WGSL (the piece was written for
  WebGL 2 and ported in November 2026, looking the same).

## Develop

Requires Node 22.12+.

```sh
npm install      # also downloads the Chromium the tools run, headless
npm run dev      # dev server, reloading on every edit
npm run verify   # tests, build, checks and screenshots: run before every push
```

On a fresh Linux machine, also run `npx playwright install-deps chromium` once (it installs system
libraries with apt, so it needs root or sudo). On a machine without a GPU, `npm run verify:ci` verifies
as CI does, with SwiftShader, which WebGPU has on Linux only: on Windows or macOS, run it in a Linux
container with Docker, `node tools/linux.js npm run verify:ci`; its screenshots match CI's, but
for a stray pixel a level off.

The build is `dist/index.html`. GitHub Actions verifies every push that changes more than Markdown.
`main`'s, once verified, is deployed to Pages and published as the download above; every other
branch's goes up at once, unverified, at `https://bstummer.github.io/flying-at-sunset/<branch>/`. [CLAUDE.md](CLAUDE.md) holds the project's
rules, architecture and workflow; [PLAN.md](PLAN.md) what was tried and failed, and what is still open.
