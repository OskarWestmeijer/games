# Earth Defender — project brief & working notes

> **This is one of several independent games in this repo.** It has its own `package.json`,
> `vite.config.ts`, `tsconfig.json` and `node_modules`; nothing here imports from a sibling folder
> and nothing in a sibling folder imports from here. **It is not deployed** — see "Deploy" below.
>
> **This file is compressed to the rules that would cost real work to rediscover.** The long-form
> version, with each scene's full design history and the reasoning behind every experiment that was
> tried and reverted, is one command away: `git show ed3f592:CLAUDE.md`. Read it before
> re-litigating a decision that looks arbitrary here — the odds are it was tried already. Note that
> paths in it are pre-split: what it calls `src/` is this folder's `src/`, and its Precision Parking
> notes now live in `parking-game/CLAUDE.md`.
>
> The repo was previously a narrative game, *Vuodenkierto*, now fully retired (still in git
> history). Old commit messages reference it.

## What this is

**One Three.js world seen four ways**, picked from a fixed dropdown in the top-right corner
(`#mode-switcher`): a small aeroplane defending the Earth from alien landers, the space station in
orbit above it, an inspector for the planet itself, and a viewer for the AI-generated assets the
whole thing is built out of. All four share `space.ts`, one renderer budget and one page.

**Flight view** (`…/#fly`) is a small aeroplane flown from a chase camera around the same planet:
arrows pitch and bank, `A`/`D` rudder, `W`/`S` throttle, `Space` the laser, speed and altitude in a
centre pill, a key legend over a minimap bottom-right. Twelve fixed sites carry three stacked boost
rings each — the throttle's ceiling is deliberately modest and rings are how you go fast (and
quietly heal). An unarmed saucer drifts somewhere over the planet; alien landing ships descend on
40-second approaches, shooting back, and can be shot down for a repair pack. Take enough fire and
the aircraft explodes until Space restarts it. A command post orbits higher up. The flight model is
deliberately the *minimum* that reads as flying — no lift, drag, stall, gravity or ground; an
orientation, a speed along the nose, a bank *command*, and a level-hold that bends the path round
the globe. Keyboard only. Builds its own `buildSpace()`, so it shares no GPU resources with the
other scenes.

**Planet view** (`…/#planet`) is a space station in orbit around Earth, walked in first person —
click to lock the pointer, WASD to move; drag to look and push the on-screen stick on a tablet. No
astronaut body, no game logic: a place to stand and look out of the window. The station is **one
lofted hull on two storeys**, 15.6 x 10.2 x 6.8 m: a closed round bulb aft where the bridge is, a
blunt cap forward, and **everything forward of the mezzanine is glass** — one unbroken canopy from
floor line over the crown to floor line, closed by a round cap window. Downstairs is one room, the
**lounge**: a low dais with a U of couch open to the window, a table and the radio that plays the
music. A **staircase** hugs the starboard wall up to the **bridge**, a mezzanine across the back
carrying the navigation console and the hologram globe. You operate the station from that console
and nowhere else — altitude, attitude, orbit mode and clock are keys on it, and there is no HUD for
any of them. Form comes from two reference images, both read and neither imported
(`ai-assets/space-station-windowed-edge.jpeg`, `ai-assets/space_station_outside.jpeg`); everything
else is primitives, and the planet, atmosphere and nebula are GLSL.

**Planet inspector** (`…/#inspect`) is the same world with the station taken away and the camera
outside on an `OrbitControls`: drag to swing round, scroll to zoom, and a `Sun` slider sweeps the
sun round the equator. Builds its own `buildSpace()`, so it shares nothing with planet view.

**Asset view** (`…/#assets`) previews AI-generated 3D assets. `.glb` models from tools like
[Meshy](https://www.meshy.ai/) and [Tripo3D](https://www.tripo3d.ai/), plus reference PNGs, live in
[`ai-assets/`](ai-assets) grouped by source; the site auto-discovers them, lists them in a sidebar
gallery and loads the selected one into an orbit/zoom/pan viewport. A utility — "clean and readable"
is the whole brief there.

## Adding new assets

Drop a `.glb` into `ai-assets/<source>/` and it appears in the gallery on next dev-server reload or
build — no manifest to hand-edit. **Name its thumbnail after it**: a same-folder `.png` whose
filename starts with the `.glb`'s basename is guaranteed to be picked up (`scanModels()` in
`vite.config.ts`). An unmatched PNG is handed out round-robin to models still lacking one — best
effort; rename rather than rely on it.

`ai-assets/` is committed to git — it is the content the site serves, not a build artifact.
**Exception:** `ai-assets/not-public/` is gitignored and must never be pushed (this repo is public).

## Architecture

```
index.html            #mode-switcher (mode + surface-resolution selects), #asset-view (gallery +
                      #viewport), a .hud control pill per 3D view (#planet-controls,
                      #inspect-controls, #fly-controls), #planet-view (#planet-canvas, #crosshair,
                      #interact-prompt), #inspect-view (#inspect-canvas, #sun-azimuth), #fly-view
                      (#fly-canvas, #fly-reticle, #fly-lander-health, #fly-plane-health,
                      #fly-corner = #fly-keys over #minimap with #minimap-plane / #minimap-ufo /
                      #minimap-paths). Loads /src/main.ts
vite.config.ts        publicDir -> ai-assets/; modelManifest() plugin scans it and exposes
                      virtual:model-manifest
src/
  main.ts             bootstrap: manifest, gallery, click-to-load, and setMode() — the dropdown,
                      the URL hash, each mode's render loop. The only file that touches DOM ids
  viewer.ts           asset view: GLTFLoader load() that swaps and disposes the previous model and
                      auto-frames the camera to its bounding box
  planet-view.ts      createPlanetView() — the scene, the orbit from flight.ts, the bloom composer
  planet-inspect.ts   createPlanetInspect() — same space, OrbitControls outside it, sun slider
  fly-view.ts         createFlyView() — aeroplane, four-key flight model, chase camera, trigger,
                      reticle, own health/defeat, updateMinimap(). Its header carries the
                      reasoning for every constant in it
  fly/ufo.ts          the saucer. Unarmed, deliberately
  fly/landers.ts      the landing ships: 40 s approaches, 12 hits, return fire
  fly/burst.ts        expanding shell + thrown shards; used by landers and by the aircraft's death
  fly/places.ts       LAND_TARGETS — a country and a coordinate well inside it. A table rather than
                      a land mask, which is what makes "never in the ocean" true by construction
  fly/rings.ts        boost rings: 12 Fibonacci sites x 3 hoops, swept pass test, tracking, heal
  fly/packs.ts        repair packs: 10 s, magnet pull + tether, swept pickup
  fly/trail.ts        wingtip ribbons while boosting: camera-facing strips, fixed length
  fly/command-post.ts the Earth defence station — scenery on a circular orbit. Not station/
  fly/bolts.ts        a pool of bolts, cadence, swept hit test. Parametrised, so it is both the
                      player's laser and (a second instance) the landers' return fire
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
                      ORBIT_NORMAL / ORBIT_NOON / ORBIT_DAWN), surfaceUv() and worldFromLatLon()
  fpv-controls.ts     pointer-lock mouse look + touch drag and stick, walking clamped to the decks
                      of the storey you are on and pushed out of obstacles
  audio/, textures/, style.css
```

Only one mode renders at a time: `setMode()` hides the other containers and calls
`viewer.setActive(false)` / `planetView.stop()` / `inspect.stop()` / `fly.stop()`, so the WebGL
contexts never compete. `MODE_HASHES` maps each mode to its hash both ways (flight view, the
default, gets the bare `#` — it took `#fly` while the parking game was the landing view here, and
that game is its own project now).

- **`setMode()` is `async` and every scene arrives through a dynamic `import()`.** three.js is half a
  megabyte and is reached only by asking for a scene that needs it, so the initial payload stays a
  bootstrap rather than a renderer.
- **Construction must happen *after* the container is unhidden**: the renderer sizes itself from
  `canvas.clientWidth`, which is 0 while `hidden`. That is why `setMode()` sets the flags first.
- The gallery list is built eagerly (it is just DOM), and `selectModel()` tolerates being called
  before the viewer exists. `modelManifest()` builds its JSON by scanning the filesystem — no
  manifest in git, so it cannot drift; `url`/`thumbnail` are `encodeURIComponent`d because source
  filenames contain spaces.


## The station, and planet view

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
- **Two map sets, one cache** — a module-level `mapCache`, never disposed, shared by every scene, so
  switching is instant; a switch made mid-download wins and the stale promise drops its result.

**Planet inspector**

- `MAX_DISTANCE` is `min(PLANET_RADIUS * 8, MOON_ORBIT_RADIUS - MOON_RADIUS * 3)` so moving either
  can't let the camera fly through the moon; `MIN_DISTANCE` is `ATMOSPHERE_RADIUS * 1.03`.
- **Rotate speed is scaled by distance** — the surface moves past the eye at
  `distance / (distance - PLANET_RADIUS)` times the angular rate, 16x at closest approach.
- **The planet doesn't spin here** (`spinRate: 0`); the sun slider moves the terminator on demand.
  **The sun is per-space, not global**, so the slider relights this scene without touching the pod's.

## Flight view

Compressed hard; the header of `fly-view.ts` carries the reasoning for every constant, and the full
notes are in `git show ed3f592:CLAUDE.md`. **This is the one place in the repo with any game in it**
— no score, no timer, no objective beyond something to fly to and something to shoot.

- **The minimap is static and the marker moves** — the marker's position on the panel *is* its
  longitude and latitude. `aspect-ratio: 2 / 1` is load-bearing twice: the map is 360x180, and
  `updateMinimap()` reads the panel's proportions back out in `resize()` rather than per frame,
  because touching `clientWidth` forces layout.
- **The mapping is derived from `SphereGeometry`, not guessed** — `surfaceUv()` inverts three's own
  parameterisation. Asked in the planet's **local** frame so the axial spin is in the answer, and
  called **after `space.update()`**. **The heading is finite-differenced in map space**, not taken
  from the nose, with `du` wrapped at ±0.5 or the antimeridian frame reads as a sprint across the map.
- **A lander gets a line, not a mark** — a mark says where something is, a line says where it is
  *going*. The SVG overlay is its own space (`viewBox="0 0 100 50"`, `preserveAspectRatio="none"`),
  a path spanning more than half the map is drawn twice a map width apart, and paths are redrawn
  every frame because the planet turns underneath them. **The boost rings are deliberately not on
  the map** — it is for the things that are *happening*.
- **Rings are why the throttle ceiling came down** (130 → 30): boosted the aeroplane does 120, so one
  ring is worth half as much again as the whole throttle range. **The boost is its own term**,
  decaying on top of the throttle, so the aeroplane surges and coasts back to what you left it on.
- **Nothing about a ring is solid** — no collision, no deflection; the only question is whether the
  segment flown this frame crossed the disc, tested **swept** like the laser's and the packs'.
  **Sites are fixed to the ground** (12 Fibonacci points x 3 hoops), so a run between three of them
  is a route you can fly twice. **A hoop is a lit object, not a light** — over the bloom threshold,
  36 white-hot circles outshouted the landing ships; what blooms is its six lamps. **Every hoop turns
  to face the aeroplane**, rate-limited.
- **The wake is capped shorter than the chase camera's standoff**, which is the whole of why it looks
  like a wake, and tapers by **distance along the wake, not sample index**. Camera-facing strips, not
  lines. Lives in world space; history dropped when the boost ends or the view is parked.
- **A pack is what a lander leaves when *you* shoot it down** — one that lands leaves nothing. Ten
  seconds; inside `MAGNET_RANGE` it comes to you on a ramp (the ramp, not the top speed, reads as a
  magnet), tether recomputed *after* the pack moves. Cleared when the view is parked.
- **Landers take 12 hits — two seconds of sustained fire** — and **shoot back** through a second
  `createBolts` instance whose own `interval` caps the *combined* incoming rate from every ship.
  `LANDER_HIT_DAMAGE` 15, so seven hits kills a fresh aircraft; `PACK_HEAL_AMOUNT` 60 and
  `RING_HEAL_AMOUNT` a quarter of the tank undo it. The ring's heal is deliberately **unmarked** —
  two marks were tried in the hoop and both were pulled.
- **A lander never comes down in the ocean, and that is structural**: the site is a row out of
  `fly/places.ts`, so there is no land mask and the countdown's label cannot disagree with the place.
  Both ends of the approach are lat/lon converted every frame — held in world space a target drifts
  ~9° west of its own country over a 40 s descent.
- **The alert bar is the one thing here that shouts**; everything else is a dim pill in a corner.
- **Landing is not animated; being shot is** — nothing you did caused a landing. A burst **outlives
  the ship that made it**, so it is ticked *outside* the active check.
- **Health bars float over their target**, placed **after the render**. The aircraft's own is anchored
  to its **own up**, or it swings out to one side in every bank. `#fly-lander-health` needs
  `inset: 0`: a zero-size absolute layer makes every bar's percentage offset resolve to one point.
- **Bolts**: a pool that never allocates, cadence owned by `bolts`, a swept hit test, no inherited
  aircraft speed, targets walked per bolt (`hit()` must tolerate two bolts in one frame), and **no
  lead prediction on either side**. **The reticle is boresighted at `RETICLE_RANGE`** because the
  chase camera is aimed below the nose. **`Space` is `preventDefault`ed** or the page scrolls.
- **The saucer is unarmed and slower than `MIN_SPEED`**, a place to go rather than a chase, spawning
  in a band 1.0–2.4 radians of arc away.
- **Zero health explodes the aircraft and stops the flight.** `update()` returns immediately once
  `destroyed` is set, ticking only the burst — a held frame reads as a stopping point where a world
  quietly running on round a missing aeroplane reads as a bug. `DEFEAT_MESSAGE` must say how to get
  out of the state it just put you in, and `spaceLabel` swaps "laser" for "restart". Space is read
  from the **keydown event**, not the held-keys set, because the trigger is likely still down.
  `start()` re-shows the defeat message if `destroyed`; `reset()` is the only way out.
- **The command post is scenery with a job description** — it makes the saucers read as being
  *answered*. Not the station in `src/station/`: that is 15.6 m for a first-person interior, this
  view is arcade-scaled. Its orbit is evaluated, not integrated, and `SUN_BETA` means it is never
  eclipsed and never fully front-lit.

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
- **Pixel ratio is capped at 1.5 on coarse pointers** in both planet scenes (full-screen shader work
  under a bloom composer).

## Checking a change

`dev/` has two harnesses; neither is wired into `npm run build`. **Both name their hash
explicitly** — `#planet`, so that a change to which view is the default cannot leave a harness
waiting sixty seconds for a `window.__station` that never arrives.

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
| `planet-minimap-1024.webp` (59 KB) | — | downscaled from `planet-day-8k.webp` |

4k set 1.2 MB, 8k set 2.9 MB. **Clouds have no larger version** — NASA publishes that composite at
2048 only, fine for a soft mask. The minimap file is in no set: it is flight view's flat world map
and the one texture reached from **CSS** (`url()` in `#minimap::before`), which Vite content-hashes
exactly as it does a TS import. Deliberately independent of the 4K/8K switch.

Re-encoded with ImageMagick, e.g.

```sh
magick -define jpeg:size=10800x5400 world.topo.bathy.200412.3x21600x10800.jpg \
  -resize 8192x4096! -quality 80 -define webp:method=6 planet-day-8k.webp
```

The `jpeg:size` hint makes libjpeg decode at half scale — ~350 MB of buffer instead of over a
gigabyte. Otherwise the maps are used exactly as they come.

**Adding a set** is `MAP_SETS` plus two imports plus an `<option>`. Mind the GPU cost, which is not
in the file sizes: an 8192x4096 map with mipmaps is ~180 MB of texture **per renderer**, and planet
view and the inspector have one each. 8k is the default; the choice is not persisted.

**Why NASA specifically.** This repo is public and these files are committed, so the licence must
permit redistribution with no strings. NASA content "generally are not subject to copyright in the
United States" and attribution is *requested, not required*, so nothing is imposed on forks. The
obvious alternative, [Solar System Scope](https://www.solarsystemscope.com/textures/), is **CC BY
4.0, not CC0** — credit, a licence link and a "changes were made" notice, forever, forks included —
and its Earth textures are NASA-derived anyway. If more layers are needed, go to NASA first.

They live in `src/textures/` and are imported from TS, **not** dropped in `ai-assets/`: Vite emits
imported assets to `dist/assets/` with a content hash and rewrites paths against `base: './'`, and it
keeps `ai-assets/` meaning AI-generated 3D models.

## Ambient audio — provenance and licence

Everything in `src/audio/` must be **CC0 / public domain**, for the same reason the textures are
NASA's. **CC BY is not acceptable here** however generous it looks. `src/audio/CREDITS.md` carries
the per-file table and a list of verified CC0 sources.

- **Discovery is `import.meta.glob`, not a Vite plugin** — no plugin, no `vite-env.d.ts` entry, no
  hand-built paths. `modelManifest()` still earns its keep because it carries metadata.
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

## Deploy — nothing, for now

**This project is not deployed.** The repo's single Pages workflow builds `parking-game/` and
nothing else; there is no workflow for this folder and no CI check on it either, so it is on
whoever changes it to run `npm run build` before believing it still works.

The build itself is intact and ready: `base: './'` keeps asset paths relative so a `/games/`
sub-path would work, and `publicDir: 'ai-assets'` copies the asset folder into `dist/` with no
extra step. **GitHub Pages serves one site per repo**, so publishing this would take the parking
game's URL — which is the decision to make, not a config to write, whenever it comes up.

## Where this is going

**The station is a place to inhabit, not a game.** The long-run shape is: move around on board, and
eventually go outside in a suit on a tether — but never really leave. The goal is *presence*. **No
score, no timers, no objectives, no collectibles.** That rule is about the station; flight view is
outside it (a saucer, landers that shoot back, a countdown, boost rings, a way to lose), and even
there the line holds loosely — no score, no timer counting up, no reward for anything done right.

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
3. **Use `ai-assets/`.** The committed blueberry bush and chanterelle become a hydroponics tray and a
   mushroom log — a growing thing aboard says someone lives here, and connects this project's two
   halves.
4. **Diegetic controls.** *Largely done* — the radio was the pattern and the console followed it.
   Only the texture-quality dropdown is left off the console, being a download rather than a thing
   the station does.
5. **Sound.** *Started* — see "Ambient audio" above. An empty folder is still a supported state.
6. **EVA.** `fpv-controls.ts` is well positioned: `decks`, `obstacles` and `eyeHeight` are injected,
   Y is already data-driven, and anything parented to `stationRig` floats along for free. Going
   outside is a second controller mode — free Y, swap the deck clamp for a tether sphere — plus a
   hatch. Keep floor-clamping out of anything new and it stays cheap.

## Notes for whoever picks this up

- The asset view is a utility — "clean and readable" is the whole brief. The planet views are held
  to a different standard.
- If the gallery grows large or assets get much bigger, revisit lazy thumbnails, a loading spinner
  during `viewer.load()`, and Draco/meshopt for the `.glb`s (`GLTFLoader` supports both with extra
  decoder setup, not wired up since the current handful load fine uncompressed).
