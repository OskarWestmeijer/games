# Space Station — project brief & working notes

> **This is one of several independent games in this repo.** It has its own `package.json`,
> `vite.config.ts`, `tsconfig.json` and `node_modules`; nothing here imports from a sibling folder
> and nothing in a sibling folder imports from here. **It is not deployed** — see "Deploy" below.
>
> **This was `#planet`, one of four views behind a dropdown in `earth-defender/`** — alongside the
> flight game, a planet inspector and an AI-asset gallery, all sharing one `src/`, one page and one
> renderer budget. They are four root folders now and this one keeps the station. `space.ts` and
> `src/textures/` were **copied** out, not shared: `earth-defender/` and `planet-inspector/` own
> their own copies of the same planet, which is the repo's house rule. A fix to the planet shader
> made here does not reach them.
>
> **This file is compressed to the rules that would cost real work to rediscover.** The long-form
> version, with the full design history and the reasoning behind every experiment that was tried
> and reverted, is one command away: `git show ed3f592:CLAUDE.md`. Read it before re-litigating a
> decision that looks arbitrary here — the odds are it was tried already. Paths in it are pre-split
> twice over: what it calls `src/` is now spread across four folders.
>
> The repo was previously a narrative game, *Vuodenkierto*, now fully retired (still in git
> history). Old commit messages reference it.

## What this is

**A space station in orbit around Earth, walked in first person** — click to lock the pointer, WASD
to move; drag to look and push the on-screen stick on a tablet. No astronaut body, no game logic: a
place to stand and look out of the window.

The station is **one lofted hull on two storeys**, 15.6 x 10.2 x 6.8 m: a closed round bulb aft
where the bridge is, a blunt cap forward, and **everything forward of the mezzanine is glass** — one
unbroken canopy from floor line over the crown to floor line, closed by a round cap window.
Downstairs is one room, the **lounge**: a low dais with a U of couch open to the window, a table and
the radio that plays the music. A **staircase** hugs the starboard wall up to the **bridge**, a
mezzanine across the back carrying the navigation console and the hologram globe. You operate the
station from that console and nowhere else — altitude, attitude, orbit mode and clock are keys on
it, and there is no HUD for any of them.

Form comes from two reference images, both read and neither imported
([`reference/space-station-windowed-edge.jpeg`](reference/space-station-windowed-edge.jpeg),
[`reference/space_station_outside.jpeg`](reference/space_station_outside.jpeg), with the lounge
concept alongside them); everything else is primitives, and the planet, atmosphere and nebula are
GLSL. Those files used to live in `ai-assets/` next to the AI-generated `.glb` models; they are
station design references rather than gallery content, so they came here and the gallery went to
`asset-viewer/`.

## Architecture

```
index.html            #settings (the surface-resolution select — the one control that is NOT on
                      the navigation console, because it is a download), #planet-view
                      (#planet-canvas, #crosshair, #interact-prompt, #planet-controls,
                      #move-stick). Loads /src/main.ts
vite.config.ts        `base: './'` and nothing else — no publicDir, no plugins
src/
  main.ts             bootstrap: find the elements, pick a map resolution, build the view, start
                      it. The only file that touches DOM ids
  planet-view.ts      createPlanetView() — the scene, the orbit from flight.ts, the bloom composer
  flight.ts           the station's altitude, attitude, orbit mode, clock; owns pitchFor()
  regions.ts          walkable floor: convex XZ polygons, the clamp, Deck (region + height +
                      storey), clipRegion(), arcDecks()
  station/index.ts    buildStation() — composes the station, returns decks/obstacles/spawn/targets
  station/hull.ts     the hull's form as functions: profile, sectionAt/roofAt/ringAt,
                      halfWidthAt(z, y), floorOutline/outlineAt, zForProfile, wallArc, keel*,
                      buildHullSurface
  station/layout.ts   the bauplan as data: BRIDGE/STAIR/LOUNGE/CONSOLE/GLOBE, SPAWN, EYE_HEIGHT,
                      stairWalkOuter(), and DECKS, whose order is load-bearing
  station/hall.ts     hull, floor plate, canopy frames in three weights, cap window, lit rim
  station/bridge.ts   mezzanine slab, railings, the flight of stairs, the globe's plinth
  station/shell.ts    MATERIALS — the shared palette, and nothing else
  station/console.ts  the navigation desk and its seven keys (invisible aiming boxes, live labels)
  station/globe.ts    the hologram Earth, from space.ts's own createEarthMaterial
  station/lounge.ts   dais, U of couch, table, radio, plant, lamp, and its own box chain
  station/radio.ts    the unit that switches the music on. Built at the origin
  interaction.ts      one raycast a frame from screen centre, the prompt element, and E
  audio.ts            room-tone bed (always aboard) under a music playlist the radio switches on
  space.ts            planet, two atmosphere shells, moon, starfield, nebula; the noise GLSL, the
                      planet shader, MAP_SETS and the map cache, the orbital plane (SUN_BETA /
                      ORBIT_NORMAL / ORBIT_NOON / ORBIT_DAWN), surfaceUv() and worldFromLatLon().
                      **A private copy** — `earth-defender/` and `planet-inspector/` have their own
  fpv-controls.ts     pointer-lock mouse look + touch drag and stick, walking clamped to the decks
                      of the storey you are on and pushed out of obstacles
  audio/, textures/, style.css
dev/shots.mjs         a PNG per scripted camera pose
dev/walk.mjs          replays the floor logic over a route through the station
reference/            the two concept images the hull's form was read from, plus the lounge sheet
```

- **Everything is imported statically, and that is a change.** It used to be four scenes behind a
  dropdown, each arriving through a dynamic `import()` so that half a megabyte of three.js was
  only fetched by asking for a scene that needed it. There is one scene now and you always ask for
  it, so the indirection bought nothing and went. One consequence worth knowing: **the "construct
  only after the container is unhidden" rule is gone with it** — nothing is hidden any more, so
  `canvas.clientWidth` is real on the first frame.
- **`main.ts` is the only file that knows a DOM id.**

## The station

Compressed hard — the reasoning behind each of these is in `git show ed3f592:CLAUDE.md`.

**Scale, camera, rig**

- Two scales: the station in metres (origin on the lower floor amidships), the planet toy-scaled at
  `PLANET_RADIUS = 300`, altitude in `ALTITUDE_DETENTS` (35..600). Keeps near/far at `0.1 / 20000`.
- **Every camera must stay outside `ATMOSPHERE_RADIUS`** (`1.035 × R`) — the outer shell is a
  `BackSide` fresnel and a camera inside it gets glow smeared across the whole sky. Sets the lowest
  detent, the inspector's `MIN_DISTANCE`, and `STATION_REACH` (9; the hull's far point is 8.37).
- **The camera is a child of `stationRig`**, so the player walks in plain station coordinates — as do
  `DECKS` and the footprints — while the rig handles where the station is in space.
- **The glass is the hall's -Z end**, because `Matrix4.lookAt` puts +Z *away* from its target.
- **The horizon is pinned and the pitch solved for**: `pitchFor(altitude, horizon)` inverts
  `α = asin(R / (R + altitude))` every frame, without which the horizon slides off the glass within
  a few tens of units of climb. **Order matters** — `rotateZ(-ROLL)`, `rotateX(pitch)`,
  `rotateY(bearing)`; any other order banks the station or flattens the pitch at 90° of bearing.
  The two storeys wanting different horizons is a feature; the console's horizon key is the answer.
- **Nothing in `SPAWN` is a coordinate** — derived from the stair, which is derived from the wall,
  aimed by `lookAt` at the middle of the cap window. It is on the bridge, so `spawn.y` is real and
  the step guard is exempt on the first frame.
- **`tryLock()` fires from three places** — view going live, a click, the first movement key —
  because no browser grants pointer lock on a cold load without user activation. It calls
  `domElement.requestPointerLock()`, not `controls.lock()`, whose dropped promise leaves an
  unhandled rejection on every load.

**The hull**

- **It is a loft, and three properties of the profile are load-bearing.** One `f(z)` scales a single
  elliptical section along the length (`sqrt(1 - s³)` forward of z = 2.4, `sqrt(1 - u⁴)` aft).
  (1) Both halves are **concave**, so the floor oval is **convex** and the lower deck stays one
  region for `clampToRegions` — true for `sqrt(1 - u^p)` at any p ≥ 2, so the round-off powers may
  move within that family; a profile from outside it needs a convex decomposition of the whole
  floor. (2) It **reaches zero at both ends**, so the loft seals itself — no end caps, no code for
  them. (3) `TAIL_ROUND` (4) and `NOSE_ROUND` (3) hold each section near full and round it off hard
  at the last stretch, which is what keeps each end under a roof.
- **The hull leans inward above the waist**, so anything tall — railings, console, globe, treads,
  stringers — must be tested with `halfWidthAt(z, y)` at *its own* height. A stair railing came out
  0.48 m outside the hull the first time one was drawn. **Below the waist it leans the other way**
  (the section's centre sits `FLOOR_DROP` above the floor plane).
- **The keel exists only to be looked at from outside** — nothing under the floor plate is visible
  from inside, and the first exterior shot ever taken showed a half-egg on a plate. The glazing is a
  *canopy*; the belly is plain metal.
- **Everything forward of `NOSE_Z` (1.8) is glass above the floor** — the same line as the
  mezzanine's front edge, so the glass begins where the bridge ends. The floor is solid; the **lit
  rim** does the job the glass floor was meant to.
- **The canopy's frames are collars, hoops and longerons in three weights** — one thickness reads as
  a net thrown over the hull. A collar is a *band* pushed proud, built from `sectionRing` (the whole
  ellipse, keel included). `frameZs()` exists so a member can die *inside* a collar rather than at
  the nearest fixed station.
- **The nose cap is a round window with a cross inside its collar; the longerons die on the collar.**
  `NOSE_CAP_FRACTION` is a fraction of full beam, so `zForProfile` places it whatever the profile
  does later. Longerons run to the tip made a spider's web. Both mullions are the surface's own
  lines, so they cross exactly without either being told about the other. No second concentric ring.
- **Don't reintroduce**: a flat prow wall with a punched window; a tail the rings do not close; a
  diagonal rib lattice; glazing over the tip with solid shoulders; a hull sliced flat at the floor
  plane; a freestanding helical stair mid-floor; or the old hub-and-arms plan.

**The floor, and walking on it**

- **`Region` is XZ only**, so a `Deck` is a region + floor height + storey and the player carries
  which storey they are on. Only reachable decks are clamped against, which is why falling off the
  mezzanine is not prevented but *inexpressible*. **The staircase is the one deck in both storeys**
  and swaps the walkable set at a midpoint that must be *inside* the flight.
- **The flight is derived from the wall**: `wallArc()` fits a circle through three points of the
  hull's floor outline, so nothing about the staircase is a coordinate. The 26 m radius is correct —
  an ovoid's flank is nearly straight amidships. The three-point fit is only valid over a short run.
- **An arc stair is many decks.** `arcDecks()` cuts the sector into quads answering height and storey
  from the *same* function of the angle, which makes the seams exact however coarse the cut. Sweep
  stays under half a turn and off `atan2`'s ±180° branch cut; `overlap` is in **metres**.
- **The walkable band is a function of *where you are on the flight*** — `stairWalkOuter(t)`, 1.39 m
  at the foot to 0.68 at the head. One worst-case radius instead is what "I fall through the stairs"
  was, because `DECKS` is first-match and the hall deck reached further outboard at the foot.
- **`DECKS` is ordered and the order is load-bearing** — listed the other way you walk *under* the
  treads. **Outlines are taken at head height, not floor height** (the hull leans in, so a bridge
  laid out on the slab's own edge walks you into the roof); the lower floor uses `floorOutline()`.
  The *slab* is still drawn to deck height or there is a gap at the hull.
- **There is a step guard and `MAX_STEP` (0.25) is bounded from both sides**: below ~0.15 the stairs
  are unwalkable on a slow frame; above, it is exactly how far up the side of the flight you can hop
  — and the guard is symmetric, so you would then be trapped. **The railing is load-bearing, not
  trim**: it explains the invisible wall the guard creates, and starts a little way up so the
  boardable stretch stays open. The outboard flank needs nothing, because it is the hull.
- **The walking surface is a ramp; the treads are decoration.** A region also runs past its last
  tread, because two regions butted together exactly catch you on the seam.
- **Obstacles are XZ `Box2` footprints** tagged with a storey, pushed out along the axis of least
  penetration **twice** — one pass can push you out of the table and into the couch. **A curved
  obstacle is a chain of boxes and the chain's fineness is a clearance**: each box bulges inboard by
  the sagitta, and 12 boxes round the couch sealed the pocket the U exists to make (0.55 m); 32 puts
  it under 8 cm. **An axis-aligned box is a bad circle** — two crossed boxes over the round table.
- **The lounge dais is floor, not furniture** (a `Deck` at 0.18); the couch is what you are pushed
  out of, and the pocket inside the U is a solved clearance, not a chosen radius. **The mouth of the
  U faces the window** — a closed ring puts a back between you and the planet from anywhere.

**Looking at things**

- **The raycast runs *after* the render, and this is load-bearing.** `setFromCamera` reads
  `camera.matrixWorld` without updating it, and the camera is a child of a rig that moved this
  frame. Same trap as the reticle, the health bars and `updateMinimap()`.
- **The aiming target is an invisible box** — `Raycaster` ignores `visible`, and a larger hidden mesh
  makes aiming thumb-forgiving. **First hit wins in array order**, so small near things go first.
- **The prompt is a real `<button>`** (no E key on an iPad) with its "Press E to" / "Tap to" halves
  in CSS. **It is keyed on the label's rendered text**, because a label may be a function — comparing
  the target alone froze the radio on whichever half you first looked at.


**Lighting and the planet shader**

- **The planet is the light in the forward half, and every floor-level source was removed to let it
  be.** Floor-level strips are on **`MATERIALS.ledFloor`**, deliberately *under* the bloom threshold;
  only things mounted high stay on the bright `led`. Putting a floor run back on `led` is what made
  the station look like a lit runway.
- **Bloom does the glowing** — colours authored over 1.0, threshold just above it; which side a strip
  sits on is a design decision, not a brightness tweak. `OutputPass` must stay last. Reach for
  `toneMappingExposure` and the threshold before touching light intensities.
- **The surface is the NASA maps, untouched — this is Earth, not an Earth-like world.** No domain
  warp, grade, bathymetry lift or procedural detail; all existed once and all were removed on
  request. The shader's job is *lighting*. Procedural noise survives only in `fallbackColor()` —
  **the planet must never be a black sphere on load** (`uHasMaps`, faded in over ~0.4 s).
- **The clouds are deliberately thin** (`smoothstep(0.62, 0.97) * 0.5`); the old
  `smoothstep(0.44, 0.86) * 0.7` promoted every wisp of haze to white. Those two numbers are the
  knob if the planet ever looks overcast.
- **Nothing blue is laid over the night side** — limb haze is multiplied by the day term, not given a
  night floor, and is remapped through `smoothstep(0.62, 1.0, …)` because `grazing` never drops
  below ~0.62 in view.
- **The nebula is deliberately constant, and three attempts to improve it failed** (colour-ramped
  smoothstep product; domain-warped ridged filaments; cross-fading palettes). **Do not give it a
  negative `renderOrder`** — that forces it to shade every pixel instead of letting the depth test
  throw the occluded ~80% away.
- **Textures need anisotropy** (grazing angles nearly the whole view), which is why `buildSpace()`
  takes the renderer. **The fbm sums to a bell curve tight around 0.5**, so shaders stretch it
  (`0.5 + (raw - 0.5) * 2.6`) before thresholding.
- **The orbit is inclined and the tilt is measured against the sun.** `SUN_BETA` is the knob for how
  much of the lap is daylit; the plane lives in `space.ts` because the moon and the command post fly
  in it too. Side effect: ≈73° inclination, so the ground track runs cap to cap. **`ORBIT_NORMAL` is
  also the `lookAt` up hint**, perpendicular by construction, so the rig cannot flip over the poles.
  **Nothing animates the scene explicitly** — `SUN_DIR` is fixed and the orbit sweeps the terminator.
- **The moon shares the pod's orbital plane, and that is the whole trick**: any other plane has
  phases where it never appears at all, where this gives ~15 s of every 300 s lap, every lap.
  Apparent size is the only lever on transit length. **Craters must stay sparse, shallow and
  unpainted** — a hash gate leaving ~2 cells in 3 empty, a squared radius term, a shallow profile,
  and relief *shaded* only, never multiplied into the albedo, or the moon reads as an infection.
- **Two map sets, one cache** — a module-level `mapCache`, never disposed, shared by every scene in the project that holds it, so
  switching is instant; a switch made mid-download wins and the stale promise drops its result.

## Touch, and iPad in particular

- **iOS Safari has no Pointer Lock API** — not disabled, absent. Every call into lock/unlock sits
  behind `POINTER_LOCK_SUPPORTED`; without the guard one tap kills the view.
- **Touch look and the stick live alongside the mouse path, not instead of it** — both write the same
  `camera.quaternion`. Movement is *clamped* rather than normalised, so a half-pushed stick walks at
  half speed while a two-key diagonal still comes back to full.
- **`touch-action: none` on every interactive canvas**, or Safari treats a drag as a page scroll.
  OrbitControls sets it itself; `PointerLockControls` does not, so `#planet-canvas` sets it in CSS.
- **`100dvh`, not `100vh`** — iOS counts the space behind its own chrome and pushes the HUD off.
- **The stick shows at `any-pointer: coarse`, the hint text swaps at `pointer: coarse`** — an iPad in
  a keyboard case reports `pointer: fine` and is still a device you poke with a thumb.
- **Pixel ratio is capped at 1.5 on coarse pointers** — full-screen shader work under a bloom
  composer. `planet-inspector/` caps it too, in its own copy.

## Checking a change

`dev/` has two harnesses; neither is wired into `npm run build`. **Both open the bare dev-server
URL** — they used to name `#planet` explicitly, because the page had four views and this one was
not the default; there is nothing to name now. Both still wait on `window.__station`, which
`planet-view.ts` installs under `import.meta.env.DEV` once the scene exists.

- **`node dev/shots.mjs`** — a PNG per scripted camera pose to `dev/shots/`. Run after any change to
  the hull, glazing or lighting, and *actually look at the output*: the open tail, the tangled
  lattice and the longerons ending in mid-air were all invisible in the numbers. **Four poses are
  outside the hull**, because the silhouette is the one thing nobody can see from inside. **Don't
  edit source while it runs** — Vite hot-reloads mid-shot and the screenshot times out.
- **`node dev/walk.mjs`** — replays the exact floor logic of `fpv-controls.ts` over a route down the
  stairs, round the lounge and back up, at the 0.1 s dt cap; reports the biggest single-frame step
  per leg and exits non-zero if a leg fails to arrive. Run after any change to `DECKS`, the stair,
  `MAX_STEP` or a footprint — it is the only thing that catches a floor bug. **Read a failing leg
  before believing it**: a leg drawn through furniture is testing the push-out, but the same
  signature is also what an unreachable pocket looks like. Ask whether the point it stuck at is
  anywhere a player could have reached.

## Planet textures — provenance and licence

Everything in `src/textures/` derives from **NASA Visible Earth**. Two sets (`MAP_SETS` in
`space.ts`, driven by `#texture-quality`), named after the day map's width:

| file | set | source |
| --- | --- | --- |
| `planet-day-4k.webp` (719 KB) | 4k | [Blue Marble Next Generation, Dec 2004](https://visibleearth.nasa.gov/images/73909) |
| `planet-day-8k.webp` (2.2 MB) | 8k | same record, from the 21600x10800 original |
| `planet-night-2k.webp` (101 KB) | 4k | [Night Lights 2012](https://visibleearth.nasa.gov/images/79765) |
| `planet-night-4k.webp` (291 KB) | 8k | same record |
| `planet-clouds-2k.webp` (430 KB) | both | [Blue Marble clouds](https://visibleearth.nasa.gov/images/57747) |

4k set 1.2 MB, 8k set 2.9 MB. **Clouds have no larger version** — NASA publishes that composite at
2048 only, fine for a soft mask. There was a sixth file here, `planet-minimap-1024.webp` — flight
view's flat world map, reached from CSS rather than from TS. It went to `earth-defender/` with the
minimap and nothing here wants it back.

Re-encoded with ImageMagick, e.g.

```sh
magick -define jpeg:size=10800x5400 world.topo.bathy.200412.3x21600x10800.jpg \
  -resize 8192x4096! -quality 80 -define webp:method=6 planet-day-8k.webp
```

The `jpeg:size` hint makes libjpeg decode at half scale — ~350 MB of buffer instead of over a
gigabyte. Otherwise the maps are used exactly as they come.

**Adding a set** is `MAP_SETS` plus two imports plus an `<option>`. Mind the GPU cost, which is not
in the file sizes: an 8192x4096 map with mipmaps is ~180 MB of texture **per renderer**. 8k is the
default; the choice is not persisted.

**Why NASA specifically.** This repo is public and these files are committed, so the licence must
permit redistribution with no strings. NASA content "generally are not subject to copyright in the
United States" and attribution is *requested, not required*, so nothing is imposed on forks. The
obvious alternative, [Solar System Scope](https://www.solarsystemscope.com/textures/), is **CC BY
4.0, not CC0** — credit, a licence link and a "changes were made" notice, forever, forks included —
and its Earth textures are NASA-derived anyway. If more layers are needed, go to NASA first.

They live in `src/textures/` and are **imported from TS**, which is why this project has no
`publicDir` at all: Vite emits an imported asset to `dist/assets/` with a content hash and rewrites
the path against `base: './'`, so nothing has to be copied by hand or resolved at runtime. The same
goes for the audio and for `reference/`, which nothing imports and which therefore never ships.

`earth-defender/` and `planet-inspector/` carry their own copies of these same files.
**Re-encoding one means re-encoding all three** — or deciding, deliberately, that they are
different worlds now.

## Ambient audio — provenance and licence

Everything in `src/audio/` must be **CC0 / public domain**, for the same reason the textures are
NASA's. **CC BY is not acceptable here** however generous it looks. `src/audio/CREDITS.md` carries
the per-file table and a list of verified CC0 sources.

- **Discovery is `import.meta.glob`, not a Vite plugin** — no plugin, no `vite-env.d.ts` entry, no
  hand-built paths, and it is why this project's `vite.config.ts` is four lines. (The one plugin
  that ever earned its keep, `modelManifest()`, carried metadata a glob cannot; it lives in
  `asset-viewer/` now.)
- **The two layers have two different owners, and that is the design.** The bed is the *room*: it
  comes up with the view and stays up the whole time you are aboard, because a pressurised hull hums
  whether or not anybody fancies listening to it. The music is the *radio's*, and starts off;
  switching the radio off leaves the hum running. **Don't put them back under one switch.**
- **A layer is not fetched until it is wanted** — no `src` until `setEnabled(true)` / `setOn(true)`,
  which matters because `music/` (~22 MB) is much the larger; the bed is fetched on arrival, on top
  of the surface maps, so it has to stay small. Both sit well under 1.0 (bed 0.25, music 0.35).
- **M is a shortcut to the radio, not a second control** — same `toggleMusic()`, gated on the view
  running, no HUD element. There is no M key on an iPad, which is why the unit on the table stays the
  control this is a shortcut *to*. **`available` is about the music only.**
- **Nothing is persisted** — the browser would refuse to autoplay before a gesture anyway.
- **The bed repeats by crossfading into itself, not with `el.loop`**: MP3 encoder padding inserts a
  tick every time round. **The playlist is advanced from the render loop's `dt`**, so it stops when
  the view does, but **fades use `requestAnimationFrame`**, because the most important fade is the
  one on the way out and by then `stop()` has cancelled the render loop. Plain linear
  `HTMLAudioElement.volume` — no `AudioContext` to unlock.
- MP3, because the iPad is a target and it is the one format every browser plays without a fallback.

## Deploy — not yet, but it is a one-word change

**This project is not deployed**, and there is no CI check on it either, so it is on whoever
changes it to run `npm run build` before believing it still works.

Publishing it is **adding `space-station` to the `GAMES` variable in
`.github/workflows/deploy.yml`, plus an `<li>` in `site/index.html`.** That workflow builds every
folder it names and gives each one a directory in a single Pages site, so this is no longer a
decision about who owns the root URL — it used to be, and the older notes in this repo may still
say so. It would land at `https://oskarwestmeijer.github.io/games/space-station/`.

The build is ready for it: `base: './'` keeps every emitted asset path relative, which is the one
requirement for being served from a sub-path.

**The reason to hesitate is weight, not architecture.** `dist/` here is ~29 MB, and ~24 MB of that
is the music. The rest of the site is ~4.4 MB together. A Pages artifact that size is legal and
would work; whether it is a reasonable thing to serve to someone who clicked a link is a real
question, and the honest answer is probably "not until the playlist is trimmed or fetched from
somewhere else". Note that the music is already lazy — no `src` until the radio is switched on — so
the *initial* load is not 30 MB; it is the artifact that is.

## Where this is going

**The station is a place to inhabit, not a game.** The long-run shape is: move around on board, and
eventually go outside in a suit on a tether — but never really leave. The goal is *presence*. **No
score, no timers, no objectives, no collectibles.** The rule used to need the qualifier "this is
about the station, not about flight view" — flight view is its own project now, so the rule is
simply the rule.

**Real outside, warm inside.** The NASA Earth stays photoreal in the window; warmth and softness go
into the station, not onto the planet. Don't restyle the planet, and don't leave the interior a bare
box.

Interior work, ranked by presence gained per hour:

1. **Fit out the hall.** *Started; the shell is right and the lounge is done, and it is the pattern
   for everything else* — authored around the origin, placed by one constant, returning its own box
   chain for `obstacles`. Upstairs is still bare. Wanted: a hatch, stowage, floor grating, something
   on the bridge besides the console. The canopy starts at z = 1.8, so anything wall- or roof-mounted
   must live aft of that — the one stretch of solid interior wall there is, and exactly where the
   reference sheet puts its stowage and hatch.
2. **Relight it warm — and then dimmer.** *Largely done, now constrained by the glass.* One test: a
   frame in which the deck is brighter than the Earth is the failure mode this was fixing.
3. **Use the AI-generated assets.** The blueberry bush and the chanterelle in
   `asset-viewer/ai-assets/` become a hydroponics tray and a mushroom log — a growing thing aboard
   says someone lives here. **Copy the `.glb` into this folder**; do not reach across into the
   sibling, which is the one thing the house rules forbid. That means adding a `GLTFLoader` here,
   which nothing in this project currently uses.
4. **Diegetic controls.** *Largely done* — the radio was the pattern and the console followed it.
   Only the texture-quality select is left off the console, being a download rather than a thing
   the station does. It is now the only element in `#settings`, and losing the mode dropdown next
   to it made the corner considerably quieter.
5. **Sound.** *Started* — see "Ambient audio" above. An empty folder is still a supported state.
6. **EVA.** `fpv-controls.ts` is well positioned: `decks`, `obstacles` and `eyeHeight` are injected,
   Y is already data-driven, and anything parented to `stationRig` floats along for free. Going
   outside is a second controller mode — free Y, swap the deck clamp for a tether sphere — plus a
   hatch. Keep floor-clamping out of anything new and it stays cheap.

