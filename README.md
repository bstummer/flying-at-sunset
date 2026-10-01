# Paper Bird — flying at sunset

A small folded paper bird glides over an endless sea of clouds at golden hour, steered by you.
No goals, no score — just the light, the clouds and the glide.

Everything lives in one self-contained file: **`index.html`**. Open it in a recent desktop or
mobile browser with WebGL 2 (Chrome, Edge, Firefox, Safari 15+). It works straight from disk
(`file://`) or from any static web server; there are no dependencies or assets to load.

## Controls

| | |
|---|---|
| **Mouse** | point where you want to go — left/right banks into a turn, up climbs, down dives. Move the pointer to the centre (or out of the window) and the bird levels out. |
| **Touch** | touch anywhere and drag; the offset from where you touched steers. Let go to level out. |
| **Keyboard** | arrow keys or WASD |
| **Gamepad** | left stick |
| **Fullscreen** | double-click or press **F** |

Diving gathers speed, climbing trades it back for height; when the bird runs out of speed it
gently lowers its nose. You can skim the cloud tops and fly through clouds, but the bird is
softly kept from sinking deep into the cloud sea.

## How it is made

* **Sky** — a physically based atmosphere (Rayleigh, Mie and ozone) computed into transmittance,
  multiple-scattering and sky-view lookup tables (after Hillaire 2020). The same model colours
  the low sun at every altitude and the haze between you and distant clouds.
* **Clouds** — raymarched volumes defined by signed distance fields, all generated (nothing is
  placed by hand). A curved sea of clouds drops away with the Earth's curvature to a real
  horizon. Towering cumulus of every size rise out of it, from low humps to a few giants; a
  convection field of loose clusters and wind-aligned lines decides where they grow, with wide
  open stretches between. Each tower is a cluster of turrets stacked like a cauliflower on a
  broad base that swells out of the sea; some lean with the wind and a few are torn off
  downwind at the top. Smaller cumulus float freely at many heights, flat underneath and lumpy
  on top, and a few thin, wind-stretched layers drift higher up. Billows and bulges are an *fbm
  of spheres* (fields of random spheres baked into tileable 3D textures and merged onto the
  base shapes octave by octave); detail noise frays the thinnest edges into wisps.
* **Light** — a short light march toward the sun with multiple-scattering octaves and a two-lobe
  phase function (golden lit faces, bright silver linings when backlit), light diffusing through
  the clouds (golden in thin parts, cooler where it has travelled far), sky light that depends on
  which way each bulge faces (deep blue zenith, warm bounce from the sea below, golden or violet
  sky on the sides), and a precomputed *shadow volume* so towers and the larger floating clouds
  cast long shadows across the cloud sea.
* **Speed** — empty space skipping (two coarse "max-top" grids plus the distance field),
  optical-depth driven steps, clouds traced at a reduced, dynamically adjusted resolution and
  reconstructed with temporal upsampling (reprojection + variance clipping). Dynamic
  resolution uses GPU timer queries when available and falls back to frame times otherwise,
  recognising displays and browsers that cap the frame rate (50 Hz screens, 30 fps power saving).
* **The bird** — an origami crane mesh with flat-shaded crisp creases, a procedural paper fibre
  texture, translucent paper (it glows when the sun is behind it), a self-shadow map in which
  paper layers let some light through, flexing wings, and mist when flying through cloud.
* **Flight & camera** — an energy-based glider with coordinated banked turns and spring-smoothed
  input; a chase camera that lags, swings wide in turns, leans into them and widens its field of
  view with speed. Drifting mist puffs and a lighter near-camera density give the feeling of
  flying through cloud.
* **Image** — HDR throughout, bloom, occlusion-aware sun rays, a hue-preserving filmic tone
  curve with a golden-hour split tone, vignette and fine grain.

## Developer switches (URL parameters)

These are for working on the piece and are not needed to enjoy it.

| parameter | effect |
|---|---|
| `?debug` | frame-rate / resolution / GPU-time overlay |
| `?test&preset=start\|sun\|away\|side\|skim\|high\|high2\|bank\|tower\|giant\|torn\|humps\|floats\|upward\|approach\|inside\|fastdive&frames=N&w=W&h=H&scale=S` | deterministic render: fixed time step, stops after `N` frames (for screenshots); `tower`, `giant` and `torn` look at the nearest generated tower of that kind, `approach` and `inside` at a floating cloud |
| `?test&pose=x,y,z,yaw,pitch,bank` | start the bird at an exact pose |
| `?test&closeup=right,up,forward` | fixed camera offset in the bird's frame |
| `?test&script=dive\|climb\|turn\|weave&log` | scripted input; per-frame flight state in `window.__log` |
| `?view=1..5` | show cloud transmittance, raw cloud light, depth, sun rays or bloom |
| `?dbg=1..7` | cloud debug: normals, sun visibility, tower shadows, march cost, lighting terms |
| `?exp=`, `?con=`, `?haze=`, `?bloom=`, `?rays=` | exposure, contrast, haze density, bloom and sun-ray strength |
| `?cpuprof` | per-pass timing on software GL (fences every pass) |
