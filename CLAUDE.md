# 3D Asset Viewer — project brief & working notes

> This repo was previously a narrative game, *Vuodenkierto* (working title *Suvanto*
> before that). That project has been fully retired — its code, art, and design docs are
> gone from the working tree (still in git history if ever needed) — and the repo is now
> a small, different tool. Old commit messages and the git log may still reference it.

## What this is

A **GitHub Pages site with three Three.js scenes** behind a fourth, plain-HTML view, picked
from a fixed dropdown in the top-right corner (`#mode-switcher`).

**Homepage** is what the site opens on now (`…/#`): a static, hand-written stand-in for
[oskar-westmeijer.com](https://oskar-westmeijer.com/), with a button at the end of the About
section saying **"Get up and look around"** that drops you into planet view — muted and shimmering
with a spinner while the world is still arriving, then lit up in a moving gradient once it is
ready to enter instantly. See "The easter egg" below — the whole point of this view is that it is a prototype of a change to the *real*
homepage, and everything about how the world is loaded behind it exists to serve that.

**Planet view** (`…/#pod`) is a small fictional scene of a one-room space pod
in orbit around an Earth-like planet, with a big window in one wall, and a first-person
camera you walk around with — click to lock the pointer, WASD/arrows to move, Esc to release
on a desktop; drag to look and push the on-screen stick to move on a tablet. There's no
astronaut body and no game logic — it's a place to stand and look out of the window. There is
a desk under that window with a chair and a computer at it, and looking at the computer and
pressing **E** puts you back on the homepage. Nothing in it comes from `ai-assets/`; the room
is built from primitives and the planet, its atmosphere and the nebula are GLSL shaders.

**Planet inspector** (`…/#inspect`) is the same world with the pod taken away and the camera
put outside it on an `OrbitControls`: drag to swing round the planet, scroll to zoom from the
whole disc down to the station's own altitude, and drag the `Sun` slider to sweep the sun
around the equator and light whichever face you want to look at. Planet view is a place to
stand and look out of a window; this is the view for actually studying the planet. It builds
its own `buildSpace()`, so it shares no GPU resources — and no sun — with planet view.

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
index.html            #mode-switcher (mode + surface-resolution selects), then
                      #asset-view (gallery + #viewport canvas); each planet view carries a
                      .hud control pill (#planet-controls: altitude; #inspect-controls: sun),
                      #home-view (the homepage mock + #get-up), #planet-view (#planet-canvas
                      + #crosshair + #interact-prompt) and #inspect-view (#inspect-canvas
                      + the #sun-azimuth slider), loads /src/main.ts
vite.config.ts         publicDir -> ai-assets/ (served as-is, copied into dist/ on
                       build); modelManifest() Vite plugin scans ai-assets/ at
                       dev/build time and exposes virtual:model-manifest
src/
  main.ts             bootstrap: reads the model manifest, renders the gallery list,
                      wires click-to-load, and owns setMode() — the dropdown, the URL
                      hash, and starting/stopping each mode's render loop. Also owns the
                      background preload of the world and the state of #get-up. The only
                      file that reaches for DOM ids, deliberately (see "The easter egg")
  home.ts / home.css  the homepage stand-in: the EN/DE/FI copy and its switch, and the
                      daisyUI *corporate* palette scoped to #home-view. No three.js import,
                      so both stay in the initial chunk
  homepage/           the mock's images — portrait.webp (downscaled from the real site's
                      383 KB JPEG) and the GitHub/LinkedIn SVGs, copied from that repo
  viewer.ts            asset view. createViewer(canvas) — Three.js scene/camera/lights/
                       controls, GLTFLoader-based load(url) that swaps and disposes the
                       previous model, auto-frames the camera to its bounding box
  planet-view.ts       planet view. createPlanetView(canvas) — assembles the scene,
                       drives the orbit, owns the bloom composer and the render loop
  planet-inspect.ts    planet inspector. createPlanetInspect(canvas) — the same space with
                       an OrbitControls camera outside it, plus the sun-azimuth control
  pod/index.ts         buildPod() — assembles the two below and returns the group, the
                       monitor's aiming target and the furniture footprints. Re-exports
                       ROOM / EYE_HEIGHT / ROOM_BOUNDS / WINDOW, so `from './pod'` still
                       means what it always did
  pod/room.ts          the shell: walls, the rounded window + frame + glass, ceiling LED
                       strips, and the dimensions above
  pod/desk.ts          the workstation: desk, chair, monitor, keyboard, the warm desk lamp,
                       and the XZ footprints the player is pushed out of
  pod/screen.ts        makeScreenTexture() — the homepage miniature on the monitor, drawn
                       once into a 2D canvas
  pod/radio.ts         buildRadio() — the unit on the right-hand end of the desk that switches
                       the sound on, its aiming box and its indicator
  interaction.ts       createInteractions() — one raycast a frame from the centre of the
                       screen, the prompt element, and E (or a tap on the prompt)
  audio.ts             createPodAudio() — the room-tone bed and the music playlist, discovered
                       with import.meta.glob, silent and unfetched until the radio is switched
                       on. Owned by planet-view.ts, so it starts/stops/disposes with the view
  space.ts             the planet, its two atmosphere shells, the moon, the starfield and
                       the nebula skydome. Owns the shared simplex-noise GLSL, the planet
                       shader that lights the NASA maps, MAP_SETS / the page-wide map cache
                       behind the 4K/8K switch, and the orbital plane both the pod and the
                       moon fly in (SUN_BETA / ORBIT_NORMAL / ORBIT_NOON / ORBIT_DAWN)
  fpv-controls.ts      createFpvControls() — two input paths (pointer-lock mouse look, and
                       touch drag-to-look plus an on-screen stick) feeding walk-on-the-floor
                       movement clamped to ROOM_BOUNDS and pushed out of `obstacles`
  audio/               bed/ and music/ as MP3, plus CREDITS.md — see "Ambient audio" below
  textures/            NASA Earth maps (day/night/clouds) as WebP, imported from space.ts
                       — see "Planet textures" below
  vite-env.d.ts        type declarations, incl. the virtual:model-manifest module shape
  style.css
```

Only one mode renders at a time: `setMode()` hides the other containers and calls
`viewer.setActive(false)` / `planetView.stop()` / `inspect.stop()` to park their
`requestAnimationFrame` loops, so the WebGL contexts never compete. `MODE_HASHES` in
`main.ts` maps each mode to its URL hash in both directions (the homepage, the default, gets
the bare `#`; planet view is `#pod`). `setMode()` is `async`, because every scene now arrives
through a dynamic `import()` — see "The easter egg".

`setMode()` also toggles `body.world-mode`, which is what carries the rules written for a
full-screen canvas: `overflow: hidden`, `user-select: none`, a viewport-height `#app`. None
of those may be global any more — the homepage is a document that scrolls and whose text you
can select, and on the real site `:root` and `body` belong to somebody else entirely.

All three scenes are constructed lazily on first use — each is a whole WebGL scene, and the
gallery additionally fetches a `.glb` that runs to tens of megabytes, so none of them is
paid for until someone actually looks. Construction must happen *after* the container is
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

### The easter egg — homepage → pod → homepage

The homepage view is a **prototype of a change to the real site**, which lives in a separate
repo (SvelteKit 2 + Svelte 5 runes, `adapter-static`, Tailwind 4 + daisyUI 5 on the hard-coded
`corporate` light theme, shipped as a Docker/nginx image). The plan there is the same button
in the same corner, dropping the reader into this pod. Nothing in that repo has been touched;
everything below exists so that the port is a copy, not a rewrite.

- **The mock is hand-written, not the real source and not an iframe.** `index.html` +
  `home.css` + `home.ts`, mirroring that site's `+layout.svelte` / `+page.svelte`, with its
  daisyUI *corporate* custom properties copied verbatim out of the built CSS (`--hp-primary:
  oklch(45% 0.24 277.023)` and friends). Copying the Svelte source would drag a framework in;
  an iframe cannot be told when the world behind it is ready.
- **The world is a lazy chunk, and that is the point.** `main.ts` reaches every scene through
  `await import(...)`, including `ALTITUDE_RANGE` and `DEFAULT_SUN_AZIMUTH` — plain numbers,
  but importing them statically drags all of three.js in with them, which is why the sliders
  are configured in `initWorldUi()` after the module resolves rather than at module scope.
  The result: a ~10 KB entry chunk instead of the ~660 KB one this used to be, with three.js
  in a chunk the homepage never fetches. **If that number climbs back up, something has been
  imported statically that shouldn't be.**
- **Warm small, show big.** Preloading runs on `load` + `requestIdleCallback`, and it does not
  merely fetch: it builds the whole scene, `await`s `space.ready` (the promise `buildSpace()`
  used to throw away), calls `renderer.compileAsync()` and renders one real frame — inside
  `#planet-view.warming`, an **8-pixel** container behind the page. Everything expensive about
  a first frame is resolution-independent, and warming full-screen would put a whole-viewport
  shader pass and a bloom chain on a page somebody is still reading. Not smaller than 8px:
  `UnrealBloomPass` halves its way down five mip levels.
- **Never warm a view that is already open.** A renderer that resizes itself down to 8px while
  it is on screen stays that way — the full-size render only comes back on the next `start()`.
  Landing straight on `#pod` is exactly that case, and it is why `preloadWorld()` bails when
  the world is showing, and dispatches a `resize` event if the mode changed while it warmed.
- **`#get-up` is disabled until the world can be entered instantly.** That is the whole
  promise of the button, so it comes alive either when the warm-up finishes or — on a direct
  `#pod` load, where there is nothing to preload — as soon as the view is running, so that
  sitting back down leaves a live button rather than a dead one. The two looks are not
  decoration: **booting** is muted, with a shimmer sweeping across it, an orbiting spinner and
  three cycling dots, and says so ("Warming up the view"); **ready** (`.ready`) is a drifting
  three-colour gradient with a halo pulsing out of it — the only saturated thing on the page
  below the header, which is the whole job. Everything is animated through
  `box-shadow` and `background-position` and nothing through `transform` — a control that
  drifts a few pixels forever is a harder target for anyone with imprecise pointing, and an
  element that never holds still can never be clicked by an automated agent at all. All of it
  stops under `prefers-reduced-motion`.
- **It sits in the page, not floating over it.** `.hp-egg` is the last block of the About
  section — a dotted rule, the line "You've been sitting a while.", then the button. Two
  reasons it is not pinned to a corner: anything fixed bottom-right is read as a chat bubble or
  a cookie prompt and dismissed without being looked at, and the end of the bio is where the
  eye ends up anyway. `.hp-about`'s bottom padding is trimmed from the real site's symmetric
  `py-16` for one reason only — on a 13" laptop it is the difference between the button being
  on screen when the page opens and being seven pixels under the fold. The hook line does the
  persuading: it is ordinary, slightly odd, and only makes sense once you have clicked.
- **Preloading is not unconditional.** No WebGL2 → the button is hidden and three.js is never
  fetched. `saveData` or a 2G `effectiveType` → nothing is prefetched and the wait moves to
  the click, where it is at least explained. A coarse pointer or a data-saving connection also
  opens on the **4K** map set rather than 8K: 2.9 MB and ~180 MB of VRAM is a fair price when
  you came to look at the planet, and not one to charge in the background of a page someone is
  reading on a phone.
- **Leaving: `stop()` before revealing the page.** It disables the controls, which releases the
  pointer lock, and the browser can deliver a stray `click` to the canvas as that lock drops.
  With the controls already disabled that click is a no-op; the other way round it re-locks and
  the player is thrown straight back into the room. The view is never disposed, so re-entry is
  instant and the orbit resumes where it paused.

**What has to stay true for the port.** Everything under `pod/`, `space.ts`, `planet-view.ts`,
`fpv-controls.ts` and `interaction.ts` takes its DOM by parameter and never queries for it —
canvas, joystick, prompt, `onExit`. `main.ts` is the only file that reaches for ids, and it is
the one file that does not travel. `createPlanetView` also has a `dispose()` it does not need
here (the page keeps every view it builds) and will need there, because components unmount.

### Looking at things, and walking into them

- **The raycast runs *after* the render, and this is load-bearing.** `Raycaster.setFromCamera`
  reads `camera.matrixWorld` without updating it, and this camera is a child of a rig that
  `updateOrbit()` moves every frame — called before the render it would be tested from where
  the station was last frame, several kilometres away. Rendering has just refreshed every world
  matrix. A prompt that appears one frame late is invisible; one tested against a stale matrix
  never appears at all.
- **The aiming target is an invisible box, not the panel.** `THREE.Raycaster` does not check
  `visible`, so a slightly larger hidden mesh costs one more object and makes "looking at the
  monitor" forgiving enough to hit with a thumb.
- **A crosshair is not decoration here.** "Look at the monitor" has no referent without a mark
  to look with. It shows under `body.pointer-locked`, and always on a touchscreen.
- **The prompt is a real `<button>`.** There is no E key on an iPad, so a tap on the prompt
  activates whatever is targeted. It supplies its own "Press E to" / "Tap to" halves through
  the existing `.fine-only` / `.coarse-only` media-query idiom; only the verb comes from JS.
- **A label may be a function, and the prompt is keyed on its text, not on the target.** The
  radio is one target that says two things ("switch the radio on" / "off"), and `setLive()`
  originally bailed whenever the target was unchanged — so a switch would have shown whichever
  half it happened to be on when you first looked at it, forever. Comparing the rendered string
  costs nothing and is what makes any stateful control possible; roadmap item 4 needs it again.
- **Targets are tested in array order and the first hit wins**, so the small near thing goes
  before the big one. The radio's box is 0.4 wide against the monitor's 0.82 and sits on the
  front edge of the desk rather than behind it; listed second it would lose the odd frame to
  the monitor as you swept across. Its `reach` is shorter too (1.7 against `SCREEN_REACH`'s
  2.4) — you lean in to a switch, and separated reaches stop the two prompts flickering.
- **`ROOM_BOUNDS` cannot express an obstacle**, so `fpv-controls.ts` takes a separate list of
  XZ `Box2` footprints and pushes the eye out of any it is inside, along the axis of least
  penetration, twice — one pass can push you out of the desk and straight into the chair.
  Not swept, which at 2.4 m/s against a 0.7 m desk with a 0.1 s dt cap it does not need to be.
- **The chair is parked out of the approach on purpose.** It is a solid obstacle, and left
  where somebody would actually sit it fences off the one spot you have to stand in to read the
  screen — which is the way out of the room. This was found the hard way: with the chair square
  in front of the desk, the prompt could not be reached at any sane `SCREEN_REACH`.

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
  the room's centre); the planet is toy-scaled at `PLANET_RADIUS = 300`, centred on the
  world origin, with the station somewhere in `ALTITUDE_RANGE` (20..600, opening at 120)
  above it. That keeps the camera's near/far at a plain `0.1 / 20000` — no logarithmic depth
  buffer needed, even at the top of the range.
- **Altitude is a slider, and it is the biggest lever in the scene.** At the bottom (20) the
  limb sits `asin(300/320)` ≈ 69.6° off the nadir — ISS-like, the horizon a wide shallow arc
  and the terrain close enough to read. At the top (600) it is 19.5° and the planet is a ball
  hanging in the glass. Climbing also *brightens* the lap: from higher up the window sees
  further round towards the day side, so mean illumination of the visible ground goes from
  ~0.56 at altitude 20 to ~0.71 by 120.
- **Every camera must stay outside `ATMOSPHERE_RADIUS`** (`1.035 × R` = 310.5, exported from
  `space.ts`). The outer shell is a `BackSide` fresnel: a camera inside it is wrapped in it
  and gets glow smeared across the whole sky instead of a ring round the planet. That is what
  sets `ALTITUDE_RANGE.min` (20, not the 10.5 where the pod would actually touch it) and the
  inspector's `MIN_DISTANCE`. It bit once already, when the altitude dropped from 70 to 20
  with the outer shell still at `1.22 × R`.
- **The camera is a child of `stationRig`**, the group that carries the pod around its
  orbit. This is what keeps the movement code simple: `PointerLockControls` writes
  `camera.position`/`camera.quaternion` and reads `camera.matrix`, all of which are local
  to the parent, so the player walks around in plain room coordinates (and `ROOM_BOUNDS`
  is room-local) while the rig handles where the room actually is in space.
- **The window is on the pod's -Z wall.** `Matrix4.lookAt` puts +Z *away* from its target,
  so aiming the rig at the planet leaves -Z — and the window — facing it.
- **The horizon is pinned, and the pitch is solved for.** The limb lands at `α - pitch`
  relative to the optical axis, where `α = asin(R / (R + altitude))`, and the window spans
  -19.8° to +20.3° vertically about that axis. Rather than fix the pitch, the scene fixes
  where the horizon sits — `HORIZON_ELEVATION` = 9.4°, about three quarters of the way up
  the glass — and `pitchFor(altitude)` inverts the relation every frame. **This is what makes
  the altitude slider work**: without it the horizon slides off the top of the glass within a
  few tens of units of climb. Lower `HORIZON_ELEVATION` to trade planet for sky; at 0 the
  window looks flat out at the limb, which is where this started and why so little of the
  planet was in it. `WINDOW_YAW` (~34°) then turns the pod about its own vertical
  towards the direction of travel, which makes the view oblique — terrain comes towards you
  and passes to one side instead of sliding straight across. Because a horizon is a cone
  about the nadir, yaw is a pure azimuth change: it never tilts the horizon or moves it up
  or down. **Order matters** — `rotateZ(-yaw)` then `rotateX(pitch)`. The other way round
  banks the pod and puts the horizon on a diagonal.
- **The orbit is inclined, and the tilt is measured against the sun.** `SUN_BETA` is the
  angle between the orbital plane and `SUN_DIR`; the plane built from it lives in `space.ts`
  (`ORBIT_NORMAL` / `ORBIT_NOON` / `ORBIT_DAWN`, so orbit angle 0 is local noon and π is
  local midnight) because the moon flies in it too, and `updateOrbit()` puts the pod there. It is the knob for how much of the lap is daylit: an equatorial
  orbit under this sun is β ≈ 18° and spends ~46% of every lap over ground the shader
  renders as fully dark, where β = 74° gets that down to ~31% and takes the station out of
  the planet's shadow entirely (which needs β > α). The window is aimed towards the
  +normal — i.e. sunward — side, which is what buys the extra daylight: it sees ground about
  20° of arc further into the day than the point directly below. The side effect is the one
  you actually notice: the plane comes out ≈73° inclined, so the ground track runs
  diagonally from ice cap to ice cap instead of circling the equator.
- **There is a desk under the window, and it is the way out.** 2.2 x 0.7 at x = -2, offset
  left rather than centred: the eye starts at (0, 1.6, 1.2) and the window's framing is solved
  against exactly that point, so a monitor in the middle of the glass would sit right on the
  horizon `HORIZON_ELEVATION` was tuned to place. The monitor shows a canvas-drawn miniature of
  the homepage; its material is `MeshBasicMaterial` with **`toneMapped: false`** (ACES at
  exposure 0.8 turns a white web page into dingy grey) and a `color` under 1.0 (at 1.0 it picks
  up a bloom halo it has not earned). One short-range warm `PointLight` over the desk is the
  only warm light in the room — under the four cold ceiling points alone the desk is a dark
  smudge against a lit planet, and you cannot read the one object the player has to find.
- **You arrive standing at the desk, in first person already.** `DESK_SPAWN` in `pod/desk.ts`
  puts the eye half a step back and to the left of the chair, as if you had just pushed it
  aside and stood up, facing the window: the opening frame is the planet with your own monitor
  below it — the reveal and the way back out in one look. Entering from the button also takes
  the pointer lock straight away (`capturePointer()`), so there is no "click the canvas first"
  step; that only works while the click's user gesture is still live, which is why `setMode()`
  knows whether it was called from one. A bare `#pod` URL has no gesture to spend and falls
  back to click-to-look.
- **Moving the eye does not disturb the framing.** `HORIZON_ELEVATION` is an angle about the
  optical axis and the planet is 300 units away, so the limb sits where it always did. What
  changes is how much window is in view: from the old middle-of-the-room spawn the glass
  subtended ±40° across and about ±20° up, and from the desk it is -26.6° to +64.4° and -29.0°
  to +29.7° — it fills the view rather than sitting in it, and the horizon lands about two
  thirds up instead of three quarters.
- **The window is nearly the whole wall.** 6.2 x 2.7 of a 7 x 3.2 wall (`WINDOW` in
  `pod.ts`), leaving a 0.4 margin at the sides and ~0.25 top and bottom, with a deliberately
  thin frame ring on top of that (`FRAME_WIDTH` 0.1, `FRAME_DEPTH` 0.14) — enough to give
  the hole an edge and a highlight, not enough to eat the view. The LED strips are
  ceiling-only for the same reason: there is no wall left beside the glass to run them down, and
  nothing bright at eye level competes with the planet.
- **`ORBIT_NORMAL` is also the `lookAt` up hint**, not world up. It is perpendicular to the
  line to the planet by construction, so `lookAt` can't degenerate — with world up this
  steeply inclined an orbit would flip the rig as it passed over the poles.
- **Nothing animates the scene explicitly.** `SUN_DIR` is a fixed world-space constant, so
  simply going round the orbit (`ORBIT_PERIOD`, 5 minutes a lap) sweeps the terminator
  across the window; the night side and its city lights arrive on their own. `ORBIT_START`
  picks where in that cycle the view opens — currently just past sunrise, with a couple of
  minutes of daylight ahead of it.
- **The planet ignores scene lights.** It's a custom `ShaderMaterial` lit by `SUN_DIR`
  inside the fragment shader — surface, clouds, terminator and city lights all come out of
  that one material. The lights added in `planet-view.ts` only light the pod interior.
- **The surface is the NASA maps, untouched — this is Earth, not an Earth-like world.**
  `src/textures/` holds them (day/night/clouds) downscaled to 8K/4K/2K WebP, ~2.9 MB total
  — see "Planet textures" below. The day map is sampled with a plain `vUv` lookup and used
  as-is: no domain warp, no saturation/contrast grade, no bathymetry lift, no procedural
  detail multiplied over it. All of those existed once, to make the map read as somewhere
  that wasn't Earth, and all of them were removed on request — if you are tempted to put
  one back, that is the history you are arguing with. The shader's remaining job is
  *lighting*: terminator, cloud layer, city lights (the night map's own warm sodium colour)
  and limb haze. Procedural noise survives only in `fallbackColor()`, the stand-in world
  drawn for the moment before the maps finish downloading.
- **The clouds are deliberately thin.** The 2048 composite is the softest, blotchiest of the
  three maps, and it used to be thresholded at `smoothstep(0.44, 0.86) * 0.7`, which promoted
  every wisp of haze to white and spread the map's own mush over most of the disc. It is now
  `smoothstep(0.62, 0.97) * 0.5`: the ramp starts well up the histogram so only real weather
  systems register, and the lower opacity lets the ground read through them. If the planet
  ever looks overcast or smeary, those two numbers are the knob — pushing them back up is
  what made it look that way before.
- **Nothing blue is laid over the night side.** The ridged-noise filament network that used
  to glow cyan across the dark hemisphere is gone, and the limb haze is now multiplied by
  the day term instead of keeping a 0.15 night-side floor — it was washing blue over the
  dark limb and over the city lights sitting near it. Scattered sunlight needs sunlight; the
  night limb gets none. The two atmosphere shells were already `lit`-masked, so they only
  ever glowed on the day side and are unchanged.
- **Two map sets, one cache.** `buildSpace(renderer, { quality })` picks the set to open
  on and `Space.setQuality()` swaps it later; both planet scenes are driven together from
  the `#texture-quality` dropdown in `main.ts`. Loaded sets live in a module-level
  `mapCache` in `space.ts`, shared by every scene and never disposed — at most two of them,
  and keeping both is what makes switching back and forth instant. A switch made while an
  earlier one is still downloading wins; the stale promise checks and drops its result.
- **There is a moon, and its placement is the whole trick.** 240 units across at an orbit
  of 3000 — ~9° wide from the pod against the real Moon's 0.5°. The window shows only ~11°
  of sky above the limb and the pod's own rotation sweeps that band past a fixed direction
  in about nine seconds, so **apparent size is the only lever on how long it is in view**:
  the transit lasts `(11° + size) / 1.2° per second`. Ray-casting the window over a lap says
  a moon in *any other* plane has phases of its own orbit where it never appears at all;
  sharing the pod's orbital plane makes it dependable instead — **~15s of every 300s lap,
  every lap**, rising over the limb and setting off the right-hand edge of the glass, and
  ~66s a lap if you walk up to the glass, where the opening subtends ±82° rather than ±40°.
  `MOON_START` (5.62) is tuned so the first transit begins ~10s after the view opens, and
  `MOON_PERIOD` (3600) keeps it slow enough that the timing drifts by only ~30s a lap.
  It was briefly 400 across (~15°) and that was far too loud — over a third of the window's
  height. Size is the knob if it ever needs tuning again; everything else about the transit
  is independent of it.
  - The sun is 74° out of that plane, so the phase angle stays between about 75° and 105°:
    always a half-lit disc with a clean terminator, never full and never new.
  - The surface is procedural (`MOON_FRAG`) — no texture, and none needed at this size.
    Craters are a cellular/Worley search, and the *gradient* comes out of the same search
    (the direction to the nearest crater centre) rather than from finite differences, which
    would cost three more 27-cell searches per octave. The fine octave fades out past three
    moon radii: procedural detail has no mipmaps, so at pod distances it would only shimmer.
  - **Craters must stay sparse, shallow and unpainted.** Cellular noise is the standard way
    to draw cells, scales and bacterial colonies, and the first version of this shader found
    out why: one crater per lattice cell, all a similar size, evenly spaced, with bright rims
    and high-contrast maria over the top, and the moon reads as an infection. Real cratering
    is Poisson-random with a power-law size distribution — mostly smooth ground, a few big
    holes. So: a hash gate leaves ~2 cells in 3 empty, the radius term is squared (many
    small, few large), the profile is shallow with a barely-there rim, and relief is *shaded*
    only — never also multiplied into the albedo, which draws the same pattern twice. Each of
    those is load-bearing; turning any of them back up brings the rash back.
  - It is tidally locked (`moon.lookAt(0, 0, 0)`), and lit from the same `sunDir` the planet
    uses — so the inspector's sun slider swings its phase too.
- **The nebula is deliberately constant, and three attempts to improve it failed.** It is two
  octaves of fbm multiplied into wisps, concentrated into a galactic band, added over a dark
  base, with its colours hard-coded — the construction that was there from the start. Since
  then it has been rebuilt as `smoothstep(fbm) * smoothstep(fbm)` with a colour ramp (the same
  construction as the planet's cloud layer; it looked like overcast weather hung in space), as
  domain-warped ridged filaments (smeared and streaky), and had its colours put on a slow
  cross-fade between authored palettes (distracting). All three were reverted. **The sky reads
  as space because it is constant, faint, isotropic and mostly empty** — if you are about to
  reach for ridged noise, domain warping, a bright core or animated colour here, each has been
  tried and each was worse.
- **Do not give the nebula a negative `renderOrder`.** It had `renderOrder = -1`, which forced
  the skydome to draw before everything else and so shade every pixel on screen — including the
  ~80% of the pod view hidden behind the room and the planet. Left in the ordinary opaque queue
  it draws after nearer opaques (three.js sorts opaque front-to-back) and the depth test throws
  the occluded sky away. It looks like an optimisation and is the opposite of one.
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

### Touch, and iPad in particular
The site is used on an iPad, so planet view has to work without a mouse or a keyboard. The
things that make that true, all of which are easy to undo by accident:

- **iOS Safari has no Pointer Lock API.** Not disabled — absent. `PointerLockControls.lock()`
  calls `domElement.requestPointerLock()`, which is a TypeError there, so *every* call into
  lock/unlock in `fpv-controls.ts` sits behind `POINTER_LOCK_SUPPORTED`. Without the guard, a
  single tap on the canvas throws and the view is dead.
- **Touch look and the stick** live in `fpv-controls.ts` alongside the mouse path, not instead
  of it: pointer events with `pointerType !== 'mouse'` drag the camera's yaw/pitch directly,
  and `#move-stick` feeds a `-1..1` vector into the same velocity smoothing the keys use. Both
  paths read and write the same `camera.quaternion`, so a device with both can switch mid-use.
  Movement is *clamped* rather than normalised, so a half-pushed stick walks at half speed
  while a two-key diagonal still comes back to exactly full speed.
- **`touch-action: none` on every interactive canvas.** Without it Safari treats a drag as a
  page scroll and never delivers the `pointermove`s. OrbitControls sets this itself on the
  canvases it owns; `PointerLockControls` does not, so `#planet-canvas` sets it in CSS.
- **`100dvh`, not `100vh`.** iOS counts the space behind its own browser chrome in `vh`, which
  pushes the bottom HUD off the screen.
- **The stick shows at `any-pointer: coarse`, the hint text swaps at `pointer: coarse`.** An
  iPad in a keyboard case reports `pointer: fine` from its trackpad but is still a device you
  poke with a thumb, so stick visibility keys off "a touchscreen exists at all" while the
  wording follows whichever input is primary.
- **Pixel ratio is capped at 1.5 on coarse-pointer devices** in both planet scenes. Nearly
  every pixel here is full-screen shader work plus a bloom composer, and 2x device pixels on a
  retina tablet is four times the fragment cost for a difference nobody can see at arm's
  length.

### Planet inspector behaviour
Shares `space.ts` with planet view, so everything above about the planet shader still
applies. What differs:

- **The camera also has to stay inside the moon's orbit.** `MAX_DISTANCE` is
  `Math.min(PLANET_RADIUS * 8, MOON_ORBIT_RADIUS - MOON_RADIUS * 3)` — 2280 at the moon's
  current size, so the moon is still the binding constraint but only just. The `min` is there
  so moving either can't quietly let the camera fly through the moon; shrinking the moon
  hands zoom-out range back on its own.
- **The camera has to stay outside the atmosphere shells.** `MIN_DISTANCE` is
  `ATMOSPHERE_RADIUS * 1.03` (≈320) — inside the shell it's the same whole-sky glow smear
  described above, and at exactly the shell radius the near clip plane is already through it.
  Deliberately not tied to where the pod flies, since that is a slider now.
- **Rotate speed is scaled by distance.** Orbiting the camera about the planet's centre
  moves the *surface* past the eye at `distance / (distance - PLANET_RADIUS)` times the
  angular rate — 16x at the closest approach, which makes a close-up drag unusable at a
  fixed `rotateSpeed`. `updateRotateSpeed()` divides it back out every frame so a drag is
  worth about the same screen movement at every zoom level.
- **The planet doesn't spin here.** `buildSpace(renderer, { spinRate: 0 })` — something you
  are studying should hold still. The slow drift in planet view was there to move the
  terminator; the sun slider does that job better, and on demand.
- **The sun is per-space, not global.** `SUN_DIR` is only the default now: `buildSpace()`
  clones it into one vector shared by the planet's uniform and both shells', and
  `Space.setSunDirection()` re-aims all three at once. So the slider relights this scene
  without touching the pod's.
- The slider sweeps azimuth only, at `SUN_DIR`'s original elevation — one knob rather than
  two, and elevation is the axis that matters least for lighting a given face.

## Planet textures — provenance and licence

Everything in `src/textures/` is derived from **NASA Visible Earth**. There are two sets —
see `MAP_SETS` and `TextureQuality` in `space.ts`, and the `#texture-quality` dropdown — named
after the day map's width, which is the file the choice is really about:

| file | set | source | original |
| --- | --- | --- | --- |
| `planet-day-4k.webp` (4096×2048, 719 KB) | 4k | [Blue Marble Next Generation, Dec 2004](https://visibleearth.nasa.gov/images/73909) | `world.topo.bathy.200412.3x5400x2700.jpg` |
| `planet-day-8k.webp` (8192×4096, 2.2 MB) | 8k | same image record | `world.topo.bathy.200412.3x21600x10800.jpg` (28 MB) |
| `planet-night-2k.webp` (2048×1024, 101 KB) | 4k | [Night Lights 2012](https://visibleearth.nasa.gov/images/79765) | `dnb_land_ocean_ice.2012.3600x1800.jpg` |
| `planet-night-4k.webp` (4096×2048, 291 KB) | 8k | same image record | `dnb_land_ocean_ice.2012.13500x6750.jpg` (7.8 MB) |
| `planet-clouds-2k.webp` (2048×1024, 430 KB) | both | [Blue Marble clouds](https://visibleearth.nasa.gov/images/57747) | `cloud_combined_2048.jpg` |

So the 4k set is 1.2 MB and the 8k set 2.9 MB. **Clouds have no larger version** — NASA
publishes that composite at 2048 only — which is fine: it is a soft mask over everything
else rather than something you read detail from, so both sets share the one file.

Downscaled and re-encoded with ImageMagick, e.g.

```sh
magick -define jpeg:size=10800x5400 world.topo.bathy.200412.3x21600x10800.jpg \
  -resize 8192x4096! -quality 80 -define webp:method=6 planet-day-8k.webp
```

The `jpeg:size` hint matters on the big source: it makes libjpeg decode at half scale, which
is the difference between ~350 MB of decode buffer and well over a gigabyte. Otherwise the
maps are used exactly as they come — the planet shader lights them, it does not restyle them.

**Adding a set** is `MAP_SETS` plus two imports plus an `<option>`; nothing else knows the
names. Be aware of what it costs on the GPU, though, which is the part that isn't in the file
sizes: an 8192×4096 map with mipmaps is ~180 MB of texture, uploaded *per renderer*, and
planet view and the inspector have one each. 8k is the default anyway — the surface is the
point of both planet scenes — with 4k kept as the cheap fallback for a slow line or a thin
GPU. The choice is not persisted; the page always opens on 8k.

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

## Ambient audio — provenance and licence

Everything in `src/audio/` must be **CC0 / public domain**, and for exactly the reason the
planet textures are NASA's rather than Solar System Scope's: this repo is public and these files
are committed, so the licence has to permit redistribution with no strings. **CC BY is not
acceptable here** however generous it looks — it would ride an attribution condition, a licence
link and a "changes were made" notice along with the files forever, forks included.
`src/audio/CREDITS.md` carries the per-file table; the credit in it is courtesy and provenance,
not an obligation. Good hunting grounds, all verified CC0, are listed at the bottom of that file.

They live in `src/audio/`, not `ai-assets/`, for the same two reasons the textures do: Vite
content-hashes imported assets into `dist/assets/` and rewrites their URLs against `base: './'`
(so the deployed `/games/` sub-path works with nobody reassembling a path by hand), and it keeps
`ai-assets/` meaning AI-generated 3D models. MP3, because the iPad is a target and it is the one
format every browser plays without a fallback `<source>`.

Conventions worth knowing before touching it:

- **Discovery is `import.meta.glob`, not a Vite plugin.** The retired game had a
  `virtual:audio-manifest` plugin scanning `public/audio/` and handing the client bare filenames
  to prefix with `BASE_URL`. A glob does the same job with no plugin, no `vite-env.d.ts` entry
  and no hand-built paths. `modelManifest()` still earns its keep because it carries metadata
  (thumbnails, sizes); a list of URLs does not.
- **Off by default means not fetched.** No `src` is assigned until `setOn(true)`, so a visitor
  who never touches the radio downloads no audio at all. Same ethos as `PRELOAD_OK` in
  `main.ts`: an easter egg does not spend somebody's metered data uninvited.
- **The radio kills both layers, not just the music.** The old system muted music and left the
  ambient bed running. That is right when audio is on by default; it is wrong here, where "off"
  has to mean silence or the switch does not read as a switch.
- **Nothing is persisted.** Every visit starts silent. Persisting "on" is three lines, but the
  browser would refuse to autoplay it before a gesture anyway, so the stored state would be a
  lie half the time.
- **Everything in `bed/` plays at once and loops; `music/` is a shuffled playlist.** The old
  system layered every file in `nature/` because a forest is many sources — a pressurised hull
  is one, so the bed is expected to be a single file. A bed track whose loop seam clicks will
  click once a minute forever; check it before committing. Music tracks need not loop.
- **The playlist is advanced from the render loop's `dt`, not a `setInterval`.** The old
  `scheduleCrossfade()` polled every 500 ms for the life of the page even with the view parked.
  Driving it from `update(dt)` in `tick()` means it stops exactly when the view does.
- **Fades use `requestAnimationFrame`, not that same `dt`.** The most important fade is the one
  on the way out, and by then `stop()` has already cancelled the render loop. Volume is plain
  linear `HTMLAudioElement.volume` — no WebAudio, so there is no `AudioContext` to unlock.
- **Keep the folder under ~4 MB.** It downloads on top of the surface maps.
- Both layers sit well under 1.0 (bed 0.25, music 0.35). The window is the thing in this room;
  a bed you can consciously hear is a bed that is too loud.

## Deploy — GitHub Pages
`.github/workflows/deploy.yml` builds with Vite and publishes `dist/` to GitHub Pages on
every push to `main`. `base: './'` in `vite.config.ts` keeps asset paths relative, so it
works under the `/games/` sub-path (`https://oskarwestmeijer.github.io/games/`).
`publicDir: 'ai-assets'` means the build step copies the whole asset folder into `dist/`
automatically — no extra copy step needed.

## Where this is going

Two decisions that govern everything from here. They were made deliberately; don't quietly
reverse them.

**It is becoming a space station to inhabit, not a game.** The long-run shape is: move around
on board, and eventually go outside in a suit on a tether — but never really leave. The design
goal is *presence*. **No score, no timers, no objectives, no collectibles.** Those would work
against the only thing that makes a place worth standing in. (The asset view is unaffected —
it stays the plain preview tool it has always been.)

**Real outside, warm inside.** The NASA Earth stays photoreal in the window; the warmth and
softness go into the station, not onto the planet. The contrast is the point — a cluttered
warm human box with something sublime out of the window, which is what the ISS actually is.
So: don't restyle the planet (see "The surface is the NASA maps, untouched" above), and don't
leave the interior a bare box.

The interior is where the effort is owed. Ranked by presence gained per hour of work:

1. **Fit out the room.** *Started.* `pod.ts` is now `pod/` (`room.ts` + `desk.ts` + `screen.ts`,
   assembled by `index.ts`), and there is a desk, chair and computer under the window. Still
   wanted: handrails, a hatch, stowage, floor grating — each is a new module beside `desk.ts`,
   returning its own footprints for `obstacles`.
2. **Relight it warm.** *Started.* The desk has a warm lamp over it and the first non-grey-blue
   materials in the room. The four cyan ceiling points at `toneMappingExposure` 0.8 still read
   clinical everywhere else; a warm interior key against the cold window fill is a few numbers
   and most of the remaining feeling.
3. **Use `ai-assets/`.** The blueberry bush and chanterelle already committed there become a
   hydroponics tray and a mushroom log. A growing thing aboard a station is exactly the detail
   that says someone lives here, and it connects the repo's two halves.
4. **Diegetic controls.** *Started, in one place.* The radio (item 5) is the pattern: a switch
   on the desk with an invisible aiming box and a stateful label, and **no HUD element at all**
   — a mute button was considered and rejected for it. Altitude, sun and texture quality should
   follow it off the HUD onto a console panel you walk up to, which deletes UI instead of
   adding it. `interaction.ts` is the mechanism and now supports labels that change.
5. **Sound.** *Started.* `audio.ts` is the old game's two-layer design rebuilt — a room-tone bed
   under a crossfaded music playlist — but off by default, switched on from `pod/radio.ts`, and
   discovered with `import.meta.glob` rather than the old `virtual:audio-manifest` plugin. See
   "Ambient audio" below. What is missing is the files: `src/audio/bed/` and `src/audio/music/`
   ship empty, and the code treats that as a supported state. The retired implementation is
   still in git at `git show 29d1246^:src/audio.ts` if the old crossfade is ever wanted back.
6. **EVA.** `fpv-controls.ts` is already positioned for it: `bounds`, `obstacles` and
   `eyeHeight` are injected, and anything parented to `stationRig` floats along for free.
   Going outside is a second controller mode — free the Y axis, swap the `Box3` for a tether
   sphere — plus a hatch and an exterior hull to look back at. Keep room-clamping out of
   anything new and it stays cheap.

## Notes for whoever picks this up
- The asset view is a utility — keep it simple there, "clean and readable" is the whole brief.
  The planet views are held to a different standard; see "Where this is going" above.
- If the gallery grows large or assets get much bigger, revisit: lazy-loading thumbnails,
  a loading spinner during `viewer.load()`, and possibly Draco/meshopt compression for
  the `.glb`s themselves (`GLTFLoader` supports both via extra decoder setup, not wired
  up yet since the current handful of files load fine uncompressed).
