# 3D Asset Viewer — project brief & working notes

> This repo was previously a narrative game, *Vuodenkierto* (working title *Suvanto*
> before that). That project has been fully retired — its code, art, and design docs are
> gone from the working tree (still in git history if ever needed) — and the repo is now
> a small, different tool. Old commit messages and the git log may still reference it.

## What this is

A **GitHub Pages site with two Three.js scenes**, picked from a fixed dropdown in the
top-right corner (`#mode-switcher`).

**Planet view** is what the site opens on: a small fictional scene of a one-room space pod
in orbit around an Earth-like planet, with a big window in one wall, and a first-person
camera you walk around with (click to lock the pointer, WASD/arrows to move, Esc to
release). There's no astronaut body and no game logic — it's a place to stand and look out
of the window. Nothing in it comes from `ai-assets/`; the room is built from primitives and
the planet, its atmosphere and the nebula are GLSL shaders.

**Asset view** visualizes AI-generated 3D assets, and is one hash away at `…/#assets`. The
assets — `.glb` models produced by tools like [Meshy](https://www.meshy.ai/) and
[Tripo3D](https://www.tripo3d.ai/), plus their reference/preview PNGs — live in
[`ai-assets/`](ai-assets), grouped by source (`ai-assets/meshy/`, `ai-assets/tripo3d/`,
...). The site auto-discovers whatever `.glb` files are present, lists them in a sidebar
gallery, and loads the selected one into an interactive Three.js viewport (orbit, zoom,
pan via mouse). It's a preview/inspection tool.

## Adding new assets

Drop a `.glb` file into `ai-assets/<source>/` (create the source subfolder if it's a new
one) and it appears in the gallery automatically on next dev-server reload or build — no
manifest file to hand-edit. **Name its thumbnail after it** — a same-folder `.png` whose
filename starts with the `.glb`'s own basename (e.g. `rock with moss 3d
model.glb` ↔ `rock with moss 3d model-0.png`) is guaranteed to be picked up as that
model's thumbnail, however many other models/PNGs share the folder (see `scanModels()`
in `vite.config.ts`). A PNG with no matching name is instead handed out round-robin
across whichever models in that folder still lack a thumbnail — a best-effort guess,
not a guaranteed match; if a model ends up with the wrong picture, rename the PNG to
match its model's basename rather than relying on the fallback.

`ai-assets/` is committed to git (not gitignored) — it's the actual content the site
serves, not a build artifact or licensed reference material.

**Exception:** `ai-assets/not-public/` is gitignored. Its contents must never be pushed
to GitHub (this repo is public) — use it for assets that shouldn't be published, e.g.
under review, unlicensed, or otherwise not cleared for public release.

## Architecture

```
index.html            #mode-switcher, then #asset-view (gallery + #viewport canvas)
                      and #planet-view (#planet-canvas), loads /src/main.ts
vite.config.ts         publicDir -> ai-assets/ (served as-is, copied into dist/ on
                       build); modelManifest() Vite plugin scans ai-assets/ at
                       dev/build time and exposes virtual:model-manifest
src/
  main.ts             bootstrap: reads the model manifest, renders the gallery list,
                      wires click-to-load, and owns setMode() — the dropdown, the URL
                      hash, and starting/stopping each mode's render loop
  viewer.ts            asset view. createViewer(canvas) — Three.js scene/camera/lights/
                       controls, GLTFLoader-based load(url) that swaps and disposes the
                       previous model, auto-frames the camera to its bounding box
  planet-view.ts       planet view. createPlanetView(canvas) — assembles the scene,
                       drives the orbit, owns the bloom composer and the render loop
  pod.ts               the room: walls, the rounded window + frame + glass, LED strips.
                       Also exports ROOM / EYE_HEIGHT / ROOM_BOUNDS
  space.ts             the planet, its two atmosphere shells, the starfield and the
                       nebula skydome. Owns the shared simplex-noise GLSL and the planet
                       shader that restyles the NASA maps
  fpv-controls.ts      createFpvControls() — PointerLockControls plus walk-on-the-floor
                       movement clamped to ROOM_BOUNDS
  textures/            NASA Earth maps (day/night/clouds) as WebP, imported from space.ts
                       — see "Planet textures" below
  vite-env.d.ts        type declarations, incl. the virtual:model-manifest module shape
  style.css
```

Only one mode renders at a time: `setMode()` hides the other container and calls
`viewer.setActive(false)` / `planetView.stop()` to park its `requestAnimationFrame` loop,
so the two WebGL contexts never compete.

Both scenes are constructed lazily on first use — each is a whole WebGL scene, and the
gallery additionally fetches a `.glb` that runs to tens of megabytes, so neither is paid
for until someone actually looks at it. Construction must happen *after* the container is
unhidden: the renderer sizes itself from `canvas.clientWidth`, which is 0 while the
container is `hidden`. That's why `setMode()` sets the `hidden` flags first. The gallery
list itself is still built eagerly (it's just DOM), and `selectModel()` tolerates being
called before the viewer exists — it parks the choice in `selectedIndex` for
`ensureViewer()` to pick up.

### How the manifest works
`modelManifest()` in `vite.config.ts` follows the same pattern the old game used for its
audio track list: a Vite plugin that resolves a `virtual:model-manifest` module id and
`load()`s it with a JSON array built by scanning the filesystem — no manifest file
checked into git, so it can never drift out of sync with what's actually in
`ai-assets/`. Each entry is `{ url, name, source, thumbnail, sizeBytes }`; `url`/
`thumbnail` are `encodeURIComponent`-escaped since source filenames contain spaces (e.g.
`rock with moss 3d model.glb`); `sizeBytes` is the `.glb` file's raw size from `statSync`,
formatted client-side (`formatBytes()` in `main.ts`) and shown per-item in the gallery
and in the `#model-name` info line under the viewport.

### Asset viewer behaviour
- Single-model view only: the gallery lists every discovered `.glb`, and clicking one
  loads it into the shared viewport (`selectModel()` in `main.ts`).
- Switching models fully disposes whatever was previously in the scene via
  `disposeCurrent()`/`disposeObject()` in `viewer.ts`, to avoid leaking GPU memory across
  a long browsing session. `load()` is `async` and guards against a slower call being
  superseded by a newer one before it resolves, via a bumped `loadToken`.
- Camera auto-frames to the loaded model via its bounding box (`Box3.setFromObject`,
  `frameToObject()`), shifted to sit on the ground grid (`y -= box.min.y`) rather than
  straddling it, since exported models don't share a common scale or origin.
- Lighting is a simple three-point-ish studio setup (hemisphere + key + fill directional
  lights) — these are isolated asset previews, not a scene with its own mood/atmosphere.

### Planet view behaviour
Conventions worth knowing before touching it:

- **Two scales in one scene.** The pod is in metres (7 x 3.2 x 5 m, origin on the floor at
  the room's centre); the planet is toy-scaled at `PLANET_RADIUS = 300` with the station
  orbiting `ORBIT_ALTITUDE = 20` above it, centred on the world origin. That keeps the
  camera's near/far at a plain `0.1 / 20000` — no logarithmic depth buffer needed.
- **The orbit is deliberately low.** At altitude 20 the limb sits `asin(300/320)` ≈ 69.6°
  off the nadir — ISS-like — which is what makes the horizon read as a wide shallow arc
  rather than the edge of a ball. Raising the altitude rounds the planet off again, and
  `WINDOW_PITCH` has to follow because it's derived from that angle.
- **Anything wrapping the planet must stay inside the orbit radius** (`PLANET_RADIUS +
  ORBIT_ALTITUDE` = 320). The atmosphere shells are the live case: a `BackSide` fresnel
  shell larger than the orbit ends up wrapped *around* the camera and smears glow across
  the whole sky instead of ringing the planet. This bit once already when the altitude
  dropped from 70 to 20 and the outer shell was still at `1.22 × R`.
- **The camera is a child of `stationRig`**, the group that carries the pod around its
  orbit. This is what keeps the movement code simple: `PointerLockControls` writes
  `camera.position`/`camera.quaternion` and reads `camera.matrix`, all of which are local
  to the parent, so the player walks around in plain room coordinates (and `ROOM_BOUNDS`
  is room-local) while the rig handles where the room actually is in space.
- **The window is on the pod's -Z wall.** `Matrix4.lookAt` puts +Z *away* from its target,
  so aiming the rig at the planet leaves -Z — and the window — facing it.
- **`WINDOW_PITCH` is the one knob for framing.** It pitches the pod up off the
  planet-centre axis, and the limb lands at `α - WINDOW_PITCH` relative to the optical
  axis, where `α = asin(R / (R + altitude))` ≈ 69.6°. From the start position the window
  spans -14.4° to +15.9° about that axis, so the current ~71° puts the horizon at -1.4° —
  a little over halfway down the window, surface below, stars above. Raise it to push the
  horizon further down.
- **Nothing animates the scene explicitly.** `SUN_DIR` is a fixed world-space constant, so
  simply going round the orbit (`ORBIT_PERIOD`, 5 minutes a lap) sweeps the terminator
  across the visible face; the night side and its city lights arrive on their own.
- **The planet ignores scene lights.** It's a custom `ShaderMaterial` lit by `SUN_DIR`
  inside the fragment shader — surface, clouds, terminator and city lights all come out of
  that one material. The lights added in `planet-view.ts` only light the pod interior.
- **The surface is real Earth data, heavily restyled.** `src/textures/` holds NASA maps
  (day/night/clouds) downscaled to 4K/2K/2K WebP, ~1.3 MB total — see "Planet textures"
  below. The shader domain-warps the UV lookup so the geography reads as an invented world,
  remaps the day map's luminance through a hand-authored electric-blue `palette()`, and
  adds ridged-noise filament networks that the source photography can't supply. Procedural
  noise is still there but only as the high-frequency detail layer that keeps the surface
  crisp from 20 units up; the texture carries the structure.
- **Textures need anisotropy.** From this orbit we look *along* the surface at a grazing
  angle for nearly the whole view, which is the worst case for plain mipmapping. That's why
  `buildSpace()` takes the renderer — purely to read `capabilities.getMaxAnisotropy()`.
- **The limb haze is remapped, not raw.** `grazing` never drops below ~0.62 anywhere in
  view at this altitude, so feeding it straight to `pow()` hazes the entire visible strip
  into a pale smear. It runs through a `smoothstep(0.62, 1.0, …)` first.
- **The planet must never be a black sphere on load.** Planet view is the site's landing
  view and the maps take a moment, so the shader carries a procedural fallback selected by
  the `uHasMaps` uniform, faded in over ~0.4s once the textures resolve.
- **Bloom does the glowing.** The LED strips and the atmosphere are authored with colour
  channels deliberately over 1.0 and `UnrealBloomPass` has a threshold just above 1.0, so
  only those pick up a halo. `OutputPass` must stay last in the composer chain — with a
  composer in play the renderer skips its own tone mapping and colour conversion. If the
  scene ever looks washed out, reach for `toneMappingExposure` and the bloom threshold
  before touching the light intensities.
- The fbm noise in `space.ts` sums to a bell curve tight around 0.5, so the terrain and
  cloud shaders stretch it (`0.5 + (raw - 0.5) * 2.6`) before thresholding. That's what
  makes constants like "land above 0.6" mean something you can reason about.

## Planet textures — provenance and licence

`src/textures/planet-{day,night,clouds}.webp` are derived from **NASA Visible Earth**:

| file | source | original |
| --- | --- | --- |
| `planet-day.webp` (4096×2048) | [Blue Marble Next Generation, Dec 2004](https://visibleearth.nasa.gov/images/73909) | `world.topo.bathy.200412.3x5400x2700.jpg` |
| `planet-night.webp` (2048×1024) | [Night Lights 2012](https://visibleearth.nasa.gov/images/79765) | `dnb_land_ocean_ice.2012.3600x1800.jpg` |
| `planet-clouds.webp` (2048×1024) | [Blue Marble clouds](https://visibleearth.nasa.gov/images/57747) | `cloud_combined_2048.jpg` |

Downscaled and re-encoded with ImageMagick (`-quality 80..82 -define webp:method=6`), then
recoloured at runtime by the planet shader.

**Why NASA specifically.** This repo is public and these files are committed, so the licence
has to permit redistribution with no strings attached. NASA content "generally are not
subject to copyright in the United States" and their guidance names texture maps explicitly;
attribution is *requested, not required*, so nothing is imposed on the repo or on forks. The
credit in `#planet-credit` is courtesy, plus provenance.

The obvious alternative, [Solar System Scope](https://www.solarsystemscope.com/textures/), is
**CC BY 4.0, not CC0** — redistribution is permitted, but only on condition of carrying
creator credit, a licence link and a "changes were made" notice everywhere the files travel,
forever, forks included. Its Earth textures are NASA-derived anyway, so going to the source
loses nothing and drops the condition. If more layers are ever needed, go to NASA first.

They live in `src/textures/` and are imported from TS, **not** dropped in `ai-assets/`: Vite
emits imported assets to `dist/assets/` with a content hash and rewrites paths relative to
`base: './'`, and it keeps `ai-assets/` meaning what this document says it means (AI-generated
3D models) as well as keeping them away from `scanModels()`.

## Deploy — GitHub Pages
`.github/workflows/deploy.yml` builds with Vite and publishes `dist/` to GitHub Pages on
every push to `main`. `base: './'` in `vite.config.ts` keeps asset paths relative, so it
works under the `/games/` sub-path (`https://oskarwestmeijer.github.io/games/`).
`publicDir: 'ai-assets'` means the build step copies the whole asset folder into `dist/`
automatically — no extra copy step needed.

## Notes for whoever picks this up
- Keep it simple — this is a utility/preview tool, not a product with its own design
  language. Don't over-invest in visual polish beyond "clean and readable".
- If the gallery grows large or assets get much bigger, revisit: lazy-loading thumbnails,
  a loading spinner during `viewer.load()`, and possibly Draco/meshopt compression for
  the `.glb`s themselves (`GLTFLoader` supports both via extra decoder setup, not wired
  up yet since the current handful of files load fine uncompressed).
