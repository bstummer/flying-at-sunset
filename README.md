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
gently lowers its nose. You can skim the cloud tops, fly under overhangs and through the heaps and towers that
rise above the sea, but the bird is softly kept from sinking deep into the cloud sea.

## How it is made

* **Sky** — a physically based atmosphere (Rayleigh, Mie and ozone) computed into transmittance,
  multiple-scattering and sky-view lookup tables (after Hillaire 2020). The same model colours
  the low sun at every altitude and the haze between you and distant clouds.
* **Clouds** — raymarched volumes defined by signed distance fields. The world is endless and
  never repeats: every feature is drawn from a hash of where it is, generated as you fly toward
  it. Nothing is placed by hand, and there is no kit of set shapes.
  * *Grown, not built.* There are no tower types, anvils or overhangs in the code; the clouds
    grow from a few natural causes and every shape emerges from them:
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
    * *Time.* A cell keeps sending bubbles up for a while: weak while it builds up, strongest in
      its prime, dying down at the end, each bubble rising through what the earlier ones left and
      squeezing past the domes in its way. What stopped rising settles into domes, spreads out
      beneath stable air (a little under the inversion, far under the ceiling), sags, drifts with
      the wind of its height and evaporates, ice high up lingering longest. Outflows set off new
      cells nearby, while the air sinking around a strong tower holds weaker cells next to it
      down.
    * Out of this come heaps on a lumpy, swelling sea, lone giants rising 10 km and more above
      it, clusters and long walls, leaning and sheared towers, overhangs and gaps to fly under,
      decaying towers torn by the wind and crumbling from the top, and storms that hit the
      ceiling and spread into wide, flat anvils. Weak pulses lie on the sea as domes of its
      surface; tall ones are true 3D bubbles, so the sea and the towers are one system. A piece
      of cloud cut off from the rest evaporates first, so nothing floats free.
    * *Where you start.* The restless air is drawn again and again (each draw as random as any
      other) until one leaves the air around the bird calm and open toward the sun, with strong
      cells off to the right of it, lit from the side.
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
* **Light** — a short light march toward the sun with multiple-scattering octaves and a two-lobe
  phase function (golden lit faces, bright silver linings when backlit), light diffusing through
  the clouds (golden in thin parts, cooler where it has travelled far), sky light that depends on
  which way each bulge faces (deep blue zenith, warm bounce from the sea below, golden or violet
  sky on the sides), and a camera-centred *shadow volume* so heaps and towers cast long
  shadows across the cloud sea and into its valleys.
* **Speed** — empty space skipping (the baked distance volumes, coarse to fine),
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
| `?test&preset=start\|sun\|away\|side\|skim\|high\|high2\|bank\|tower\|giant\|anvil\|close\|under\|approach\|inside\|humps\|upward\|fastdive&frames=N&w=W&h=H&scale=S` | deterministic render: fixed time step, stops after `N` frames (for screenshots); `tower`, `giant`, `anvil`, `close`, `under`, `approach` and `inside` look at, under or into generated towers near the start |
| `?seed=N`, `?towers=K` | another world; density of convective cells (default 1) |
| `?test&pose=x,y,z,yaw,pitch,bank` | start the bird at an exact pose |
| `?test&closeup=right,up,forward` | fixed camera offset in the bird's frame |
| `?test&script=dive\|climb\|turn\|weave&log` | scripted input; per-frame flight state in `window.__log` |
| `?view=1..5` | show cloud transmittance, raw cloud light, depth, sun rays or bloom |
| `?dbg=1..7` | cloud debug: normals, sun visibility, shadow volume, march cost, lighting terms |
| `?exp=`, `?con=`, `?haze=`, `?bloom=`, `?rays=` | exposure, contrast, haze density, bloom and sun-ray strength |
| `?cpuprof` | per-pass timing on software GL (fences every pass) |
