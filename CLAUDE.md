# 3D Asset Viewer — project brief & working notes

> This repo was previously a narrative game, *Vuodenkierto* (working title *Suvanto*
> before that). That project has been fully retired — its code, art, and design docs are
> gone from the working tree (still in git history if ever needed) — and the repo is now
> a small, different tool. Old commit messages and the git log may still reference it.

## What this is

A **GitHub Pages site with five scenes**, picked from a fixed dropdown in the top-right corner
(`#mode-switcher`). Four are Three.js and share one world; the fifth, **Precision Parking**, is a
plain 2D canvas game and shares nothing with them at all.

**Flight view** (`…/#fly`) is a small aeroplane you fly around the same
planet from a chase camera: the arrows pitch and bank it, `A`/`D` are the rudder and `W`/`S` the
throttle, `Space` the laser, with speed and altitude in the centre pill and the bottom right
corner carrying the key legend over a minimap of the whole world with the aircraft's ground
track on it. Twelve places around the globe carry a stack of three boost rings each — low, middle and high
orbit over the same patch of ground — which are how you go fast: the throttle's own ceiling is
deliberately modest, and flying through a hoop adds a burst on top of it that the wingtips drag a
pair of glowing ribbons behind, and heals the aircraft besides, quietly. The sites never move, so a run between three of them is a route you can
fly twice — they are not on the minimap, which is kept for the things that are happening.
Somewhere over the planet there is one alien saucer, drifting slowly and marked on that map, and
a few alien landing ships on their way down — each drawn on the map as the line of its approach,
with forty seconds from appearing to touchdown, and shooting back while they are in the air.
Land, and a ship is simply gone; get there first and it can be shot down — twelve hits, a health
bar of its own floating above it — and it leaves a repair pack falling where it died, gone in ten
seconds, that comes to you on its own once you are close enough (a tether between it and the
aircraft the only sign) and undoes some of whatever the return fire has taken off the aircraft's
own health, shown the same way. The saucer stays unarmed. Take enough of that fire yourself and the aircraft
explodes and the flight stops there, with a line from the command post that the fight for Earth
has been lost, until Space brings it back. Higher up, an Earth defence command post goes round
the planet on a fixed orbit, warm-lit and ringed on the map. It is deliberately the *minimum* that reads as flying — no lift, no drag, no
stall, no gravity and no ground, only an orientation, a speed along the nose, a bank *command*
rather than a roll rate, and a level-hold that bends the path round the globe instead of letting
it fly off on a tangent. See the header of `src/fly-view.ts`, which carries the reasoning for
each of those. Keyboard only, so a touchscreen is told as much rather than given a stick it
cannot fly with. Like the inspector it builds its own `buildSpace()`, so it shares no GPU
resources — and no sun — with the other scenes.

**Planet view** (`…/#planet`) is a space station in orbit around Earth, with a
first-person camera you walk around inside it — click to lock the pointer, WASD/arrows to move,
Esc to release on a desktop; drag to look and push the on-screen stick to move on a tablet.
There's no astronaut body and no game logic — it's a place to stand and look out of the window.

The station is **one lofted hull on two storeys** — an ovoid 15.6 m long, 10.2 m across and
10.46 m from keel to crown, of which 6.8 m is above the floor. A closed round bulb aft where the
bridge is; forward it holds its beam through the whole hall and then rounds off over the last
metre and a half into a **blunt cap**. **Everything forward of the mezzanine is glass**: roof and
both flanks and the shoulders between them, one unbroken canopy running from the floor line on
one side over the crown to the floor line on the other, framed with hoops and a few fore-and-aft
longerons, and closed at the front by a **round cap window** with a collar round it. The form
comes from two reference images, both read and neither imported:
`ai-assets/space-station-windowed-edge.jpeg` for the inside and
`ai-assets/space_station_outside.jpeg` for the hull and the glazing.

**It is deliberately tight, and it used to be much bigger.** The first hull was 18 x 12 x 8.6
with the bridge at 3.6 — correct proportions and far too much of them, a hall you crossed rather
than a room you were in. The concept sheet is close quarters, so the hull came in by about 15% in
every dimension and the mezzanine dropped to 2.75. That is a *budget*: floor added anywhere now
comes out of somewhere else. The one place that went the other way is the bridge, which got
deeper (`BRIDGE.frontZ` 3.6 -> 1.8) because upstairs was the half that felt cramped.

- the **lower floor** runs the whole length, and amidships-forward it is one room: the **lounge**,
  a low dais carrying a U of couch open to the window, a table in the middle of it and the radio
  that switches the music on sitting on the table. You stand in the mouth of the U with the whole
  glazed nose in front of you.
- a **staircase** runs the length of the starboard wall, hard against it, from the lounge up to
  the **bridge** — a mezzanine across the back. It arrives level with the mezzanine's front edge,
  so there is no stair well. The navigation console stands at that front edge facing forward down
  the length of the hall and out through the glass, and the hologram globe floats behind it.

You operate the station from that console and nowhere else — altitude, attitude, orbit mode and
the clock are all keys on it, and there is no HUD for any of them.

**There was an office in the nose and there is not any more.** A desk, a chair, a keyboard and a
monitor showing a canvas-drawn miniature of [oskar-westmeijer.com](https://oskar-westmeijer.com/),
with the radio on the end of the desk — the whole of `station/office/` and the point the player
used to spawn at. It was removed on request in favour of the couch, and it is worth knowing that
the homepage miniature (`station/office/screen.ts`, `makeScreenTexture()`) went with it; that is
the one piece of the station that was *about* its owner, and `git show` has it if it should come
back somewhere. The radio survived the demolition and lives at `station/radio.ts` now, built at
the origin so whatever it stands on places it.

This all replaced a hub-and-arms plan (an octagonal hub with four modules and corridors off it),
which spent most of its floor on corridor and put the workstation and the console as far apart as
it could. Don't reintroduce it. The hull has been through several shapes since, and each was worse
in a way worth remembering:

- a **flat-roofed box**, then a box that tapered to a **flat prow wall with a rounded window
  punched in it**. A rectangular room with a rectangular window is exactly what the loft exists
  to get away from — don't put a flat wall or a punched opening back.
- a hull that **stopped at 84% of full beam aft and simply ended**, leaving a 10 m elliptical
  hole open to space behind the globe. The profile closes to zero at both ends now and the loft
  seals itself; don't reintroduce a tail the rings do not close.
- glazing over the **tip only**, with the shoulders solid. The shoulders are the part you
  actually look through on the way to the planet from anywhere but the very point of the nose.
- a **diagonal rib lattice** over that tip, and a **freestanding helix** of a staircase in the
  middle of the floor. Both are covered below; neither should come back.
- a nose that **tapered to a point** over its whole forward 10.6 m — a plain half-ellipse, so the
  hull was visibly narrowing everywhere you stood, the longerons ran into a needle, and there was
  nowhere to put the one thing the exterior sheet is most recognisable for. `NOSE_ROUND` is 3 now
  and the nose is blunt; see the profile note below.
- a hull with **no keel at all**, sliced off flat at the floor plane. Nothing below it can be seen
  from inside and the player can never leave, so for a long time it was simply not modelled — and
  the first exterior shot ever taken showed a half-egg sitting on a plate. It is a closed ovoid
  now; don't take the underside away again on the grounds that nobody indoors can see it.

Nothing else in the station comes from `ai-assets/`; it is built from primitives, and the planet,
its atmosphere and the nebula are GLSL shaders.

**Planet inspector** (`…/#inspect`) is the same world with the station taken away and the camera
put outside it on an `OrbitControls`: drag to swing round the planet, scroll to zoom from the
whole disc down to the station's own altitude, and drag the `Sun` slider to sweep the sun
around the equator and light whichever face you want to look at. Planet view is a place to
stand and look out of a window; this is the view for actually studying the planet. It builds
its own `buildSpace()`, so it shares no GPU resources — and no sun — with planet view.

**Precision Parking** (`…/#`, what the site opens on) is the odd one out and deliberately so:
no three.js, no planet, no shared anything. A chunky toy car rolls left to right along a plain street towards a
painted parking zone; one tap stops it dead; the score is how close its centre landed to the
bay's centre. **Parked means both tyres between the bay's two lines** — the car's own size is
part of the question, which is what makes it parking rather than target practice. A session is
**five fixed bays, the same five for everybody, and you always play all five**: putting a tyre
over a line or running into the block costs a flat penalty and the session carries on. At the end
you get one number, the total distance off centre, which is the point of the whole thing — a
score two strangers can hold up against each other. There is nothing else on the street, on
purpose.
Overshoot and the bumper meets a wooden buffer block and the run is over. It is drawn on a plain
2D canvas onto a **fixed 360 x 640 portrait board that is letterboxed into whatever viewport it
lands in** — which is not decoration but the load-bearing decision of the whole scene, because a
board that stretched to the window would make "you stopped 4 units off centre" mean a different
thing on every device, and the per-stage comparison this game is shaped around could never be
made. See "The parking game" below, and the header of `src/park-view.ts`.

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
                      #asset-view (gallery + #viewport canvas); each 3D view carries a
                      .hud control pill (#planet-controls: how to move; #inspect-controls: sun;
                      #fly-controls: speed and altitude), #planet-view (#planet-canvas +
                      #crosshair + #interact-prompt), #inspect-view (#inspect-canvas + the
                      #sun-azimuth slider) and #fly-view (#fly-canvas + #fly-reticle +
                      #fly-lander-health, one floating bar per landing ship + #fly-corner,
                      which stacks the #fly-keys legend over the #minimap, its two markers
                      #minimap-plane and #minimap-ufo, and #minimap-paths, the empty SVG layer
                      the landing ships' paths are drawn into) and #park-view, which is one
                      #park-canvas and nothing else — every readout in the parking game is drawn
                      inside its own letterboxed board, where a .hud pill could not follow it;
                      loads /src/main.ts
vite.config.ts         publicDir -> ai-assets/ (served as-is, copied into dist/ on
                       build); modelManifest() Vite plugin scans ai-assets/ at
                       dev/build time and exposes virtual:model-manifest
src/
  main.ts             bootstrap: reads the model manifest, renders the gallery list,
                      wires click-to-load, and owns setMode() — the dropdown, the URL
                      hash, and starting/stopping each mode's render loop. The only file
                      that reaches for DOM ids, deliberately
  viewer.ts            asset view. createViewer(canvas) — Three.js scene/camera/lights/
                       controls, GLTFLoader-based load(url) that swaps and disposes the
                       previous model, auto-frames the camera to its bounding box
  planet-view.ts       planet view. createPlanetView(canvas) — assembles the scene, drives
                       the orbit from flight.ts, owns the bloom composer and the render loop
  planet-inspect.ts    planet inspector. createPlanetInspect(canvas) — the same space with
                       an OrbitControls camera outside it, plus the sun-azimuth control
  fly-view.ts          flight view. createFlyView(canvas) — the aeroplane, the four-key flight
                       model (bank command, level-hold), the chase camera, the trigger and the
                       aiming reticle, and updateMinimap(), which puts both the ground track and
                       the saucer on the flat map in the corner. Its header carries the
                       reasoning for every constant in it
  fly/ufo.ts           createUfo() — the saucer: how it is built, where it spawns, how it
                       drifts, and what happens when it is hit. Unarmed, deliberately
  fly/landers.ts       createLanders() — the landing ships: three of them, each appearing,
                       descending a straight approach for 40 s, taking LANDER_MAX_HEALTH hits to
                       bring down, shooting back the whole time through a second Bolts pool, and
                       going the moment it lands or dies. LANDER_COUNT lives here, which is why
                       the map's marks are built in code
  fly/burst.ts         createBurst() — the explosion: an expanding shell and a handful of
                       thrown shards, parametrised by colour and scale. A landing ship's kill and
                       the aircraft's own destruction (fly-view.ts) are two instances of it
  fly/places.ts        LAND_TARGETS — every place a landing ship may come down: a country, and
                       a coordinate well inside it. A table rather than a land mask, which is
                       what makes "never in the ocean" true by construction
  fly/rings.ts         createRings() — the boost rings: twelve sites on a Fibonacci sphere with
                       three hoops stacked over each, the swept pass test, the tracking that
                       turns every hoop to face the aeroplane, and a quiet heal on top of the
                       boost. No collision of any kind, and no mark for the heal either — see the
                       file's own header for what was tried there and pulled
  fly/packs.ts         createPacks() — the repair packs a shot-down landing ship leaves behind:
                       a pool of crates, ten seconds each, a magnet pull and tether once the
                       aircraft is close, and the swept pickup test. Heals the aircraft in
                       fly-view.ts, now that a landing ship's return fire can hurt it
  fly/trail.ts         createTrail() — the wingtip ribbons dragged behind while boosting: two
                       camera-facing strips of a fixed length, tapered by distance along the wake
  fly/command-post.ts  createCommandPost() — the Earth defence station: one circular orbit in
                       space.ts's own inclined plane, a hub-ring-and-solar-wings model, and
                       nothing else. Not the station in station/ — see the file's header
  fly/bolts.ts         createBolts() — a fixed pool of bolts, the cadence, and the swept hit test
                       that stops a fast bolt tunnelling through the target. Parametrised via
                       BoltsOptions (colour, pool size, speed, lifetime, interval) so it is both
                       the player's own laser and, a second instance, the landing ships' return
                       fire — a bolt does not care who fired it
  park-view.ts         Precision Parking. createParkView(canvas) — the 2D board transform, the
                       ready/rolling/judging/over state machine, the tap (back-dated to the
                       event's own timestamp, which is the whole reason the game is fair), the
                       scoring and the render loop. The only scene here with no three.js in it
  park/board.ts        the board as constants: the 360x640 field, the vertical bands, the track
                       geometry, the warm palette, and rrect(). Stated once because three files
                       draw into it
  park/levels.ts       levelSpec(n) — the deterministic ladder: two curves and an integer hash of
                       the level number, and **no Math.random anywhere**, which is what makes
                       everybody's level 7 the same level 7. One bay per level, sized as the car's
                       own CAR_HALF plus the round's clearance, and nothing else on the street
  park/draw.ts         every 2D drawing routine, in board units: mat, street, the parking bay, the
                       buffer block, the car, the header and the verdict
  park/effects.ts      createEffects() — one fixed particle pool (dust, tyre smoke, confetti,
                       debris) plus the screen shake, allocated once and parked
  park/best.ts         the only persistence in the repo: a versioned localStorage record holding
                       the best run and the smallest error achieved on each level
  flight.ts            createFlight() — the station's altitude, attitude, orbit mode and clock.
                       Written by the navigation console, read by the rig and the globe. Owns
                       pitchFor() and the detent tables
  regions.ts           the walkable floor: convex XZ polygons (Region), the clamp that holds
                       the player inside their union, Deck — a region with a floor height and a
                       storey, which is what makes two floors possible — clipRegion(), which
                       halves a convex region and keeps it convex, and arcDecks(), which cuts a
                       turning staircase into convex quads sharing one height function
  station/index.ts     buildStation() — the seam. Composes the hall, the bridge, the lounge,
                       the console and the globe, and hands planet-view.ts one object:
                       decks, obstacles, spawn, targets, globe
  station/hull.ts      the hull's *form*, as functions, and nothing else: the profile that scales
                       one elliptical section along Z, sectionAt() / roofAt() / ringAt(),
                       halfWidthAt(z, y) — the clearance test for anything tall — floorOutline()
                       and outlineAt(), zForProfile(), which inverts the forward profile so the
                       nose cap can be derived from the hull, wallArc(), which fits a circle to
                       one flank so the stairs can be derived from it too, keelPoint() /
                       keelAt() / sectionRing() — the same section under the floor and the whole
                       loop closed, both of which exist for the exterior alone — and
                       buildHullSurface(), which lofts the rings into an opaque shell aft and one
                       sheet of glass forward sharing the seam ring, plus the keel in one piece
  station/layout.ts    the bauplan as data: BRIDGE / STAIR / LOUNGE / CONSOLE / GLOBE, SPAWN,
                       EYE_HEIGHT, bridgeSlabPolygon(), stairWalkOuter() — the walkable band of
                       the flight, solved per tread — and DECKS, the walkable floor of both
                       storeys, whose *order* is load-bearing and whose outlines are taken at
                       head height, not at floor height
  station/hall.ts      buildHall() — what makes a lofted surface read as a room: the hull itself,
                       the oval floor plate, the canopy's frames in three weights (two collars,
                       hoops, longerons) and the round cap window closing the nose, the lit rim
                       where the glass meets the floor, and the roof strips aft
  station/bridge.ts    buildBridge() — the mezzanine slab (extruded from a hull-following
                       polygon), one railing along its exposed front edge, the flight of stairs
                       with its treads run out to the wall, its single inboard railing, the
                       globe's plinth/lens/emitter, and the deck's lamps
  station/shell.ts     MATERIALS — the shared palette, and nothing else. It used to hold a
                       generic room builder for the hub-and-arms plan; see git if that is
                       ever wanted back
  station/console.ts   buildConsole() — the navigation desk on the bridge and its seven keys,
                       each an invisible aiming box with a label that reads live flight state
  station/globe.ts     buildGlobe() — the hologram Earth behind the console, built from
                       space.ts's own createEarthMaterial so it shares the planet's maps, sun
                       and spin. Counter-rotated against the rig so it holds still in space
  station/lounge.ts    buildLounge() — the whole of the lower deck's furniture: the dais, the
                       U of couch open to the window (extruded annular sectors, a rolled back, two
                       arms, throw pillows), the table with the radio and the plant on it, the warm
                       lamp, and the box chain the player is pushed out of. The one upholstered
                       room in the station
  station/radio.ts     buildRadio() — the unit that switches the music on, its aiming box and its
                       indicator. Built at the origin, so the caller stands it on a surface
  interaction.ts       createInteractions() — one raycast a frame from the centre of the
                       screen, the prompt element, and E (or a tap on the prompt)
  audio.ts             createPodAudio() — the room-tone bed, which runs whenever you are aboard,
                       under a music playlist the table radio switches on. Discovered with
                       import.meta.glob; neither layer is fetched until it is wanted. Owned
                       by planet-view.ts, so it starts/stops/disposes with the view
  space.ts             the planet, its two atmosphere shells, the moon, the starfield and
                       the nebula skydome. Owns the shared simplex-noise GLSL, the planet
                       shader that lights the NASA maps, MAP_SETS / the page-wide map cache
                       behind the 4K/8K switch, the orbital plane both the pod and the
                       moon fly in (SUN_BETA / ORBIT_NORMAL / ORBIT_NOON / ORBIT_DAWN), and
                       surfaceUv(), which answers where a point in space sits on those maps
  fpv-controls.ts      createFpvControls() — two input paths (pointer-lock mouse look, and
                       touch drag-to-look plus an on-screen stick) feeding walk-on-the-floor
                       movement clamped to the `decks` of the storey you are on and pushed out
                       of `obstacles`. Carries which storey that is, and the step guard
  audio/               bed/ and music/ as MP3, plus CREDITS.md — see "Ambient audio" below
  textures/            NASA Earth maps (day/night/clouds) as WebP, imported from space.ts
                       — see "Planet textures" below
  vite-env.d.ts        type declarations, incl. the virtual:model-manifest module shape
  style.css
```

Only one mode renders at a time: `setMode()` hides the other containers and calls
`viewer.setActive(false)` / `planetView.stop()` / `inspect.stop()` / `fly.stop()` / `park.stop()`
to park their `requestAnimationFrame` loops, so the WebGL contexts never compete. Parking has no
WebGL to compete with, and so also no `webglcontextlost` handler and no part in the
texture-quality fan-out — its `qualitySelect.hidden` case is the same one the asset view takes. `MODE_HASHES` in
`main.ts` maps each mode to its URL hash in both directions (Precision Parking, the default,
gets the bare `#`). `setMode()` is `async`, because every scene arrives through a dynamic
`import()` — three.js never has to be fetched by a browser that only ever looks at one mode.

Every scene is constructed lazily on first use — four of them are a whole WebGL world, and the
gallery additionally fetches a `.glb` that runs to tens of megabytes, so none of them is
paid for until someone actually looks. Parking is cheap either way (its chunk is a few kilobytes
and pulls in no three.js at all), but it is loaded the same way for the sake of one rule rather
than four. **Since it is also the landing view, a visitor who never touches the dropdown
downloads no renderer at all** — three.js is half a megabyte and is now reached only by asking
for one of the scenes that needs it. Construction must happen *after* the container is
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

### Looking at things, and walking into them

- **The raycast runs *after* the render, and this is load-bearing.** `Raycaster.setFromCamera`
  reads `camera.matrixWorld` without updating it, and this camera is a child of a rig that
  `updateOrbit()` moves every frame — called before the render it would be tested from where
  the station was last frame, several kilometres away. Rendering has just refreshed every world
  matrix. A prompt that appears one frame late is invisible; one tested against a stale matrix
  never appears at all.
- **The aiming target is an invisible box, not the unit itself.** `THREE.Raycaster` does not
  check `visible`, so a slightly larger hidden mesh costs one more object and makes "looking at
  the radio" forgiving enough to hit with a thumb.
- **A crosshair is not decoration here.** "Look at the radio" has no referent without a mark
  to look with. It shows under `body.pointer-locked`, and always on a touchscreen.
- **The prompt is a real `<button>`.** There is no E key on an iPad, so a tap on the prompt
  activates whatever is targeted. It supplies its own "Press E to" / "Tap to" halves through
  the existing `.fine-only` / `.coarse-only` media-query idiom; only the verb comes from JS.
- **A label may be a function, and the prompt is keyed on its text, not on the target.** The
  radio is a target that says two things ("switch the radio on" / "off"), and `setLive()`
  originally bailed whenever the target was unchanged — so a switch would have shown whichever
  half it happened to be on when you first looked at it, forever. Comparing the rendered string
  costs nothing and is what makes any stateful control possible; roadmap item 4 needs it again.
- **Targets are tested in array order and the first hit wins**, so a future small near thing
  has to be listed before a big one it would otherwise lose the odd frame to as you swept
  across. Worth keeping in mind now that the radio is the only target — it stops mattering
  quietly, right up until a second one is added.
- **A walkable region cannot express an obstacle**, so `fpv-controls.ts` takes a separate list
  of XZ `Box2` footprints and pushes the eye out of any it is inside, along the axis of least
  penetration, twice — one pass can push you out of the table and straight into the couch. Not
  swept, which at 2.4 m/s against a 0.7 m obstacle with a 0.1 s dt cap it does not need to be.
  Each footprint carries the storey it stands on, so the couch downstairs does not fence off a
  patch of the mezzanine above it.
- **A curved obstacle is a chain of boxes, and the chain's fineness is a clearance.** The couch
  is an arc, so `lounge.ts` hands over 32 boxes round it rather than one over the whole dais —
  a single footprint would fence off the pocket the U exists to make. Each box bounds one
  sector, so it bulges *inboard* of the arc by the sagitta, and the player is a point tested
  against boxes already inflated by `PLAYER_RADIUS`: that bulge comes straight off the walkable
  ring inside the couch. At 12 boxes it was 0.55 m — wider than the ring — and the pocket
  silently sealed itself. It is under 8 cm at 32.
- **And an axis-aligned box is a bad circle in the one place it matters.** A square over a round
  table puts its corners at `r * sqrt(2)`, so the table pinched the same ring shut on all four
  diagonals while measuring correct on the axes. Two crossed boxes are an octagon — corners at
  `1.23 * r` — and cost one more entry in a list that is walked twice a frame.

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

### Two storeys, and how you walk between them

`Region` in `regions.ts` is XZ only, so a mezzanine and the floor beneath it are the same
rectangle and the clamp cannot tell them apart. Rather than make every clamp a 3D problem for a
building whose floors are all flat, a **`Deck`** is a region plus a floor height plus a storey,
and the player carries which storey they are on. Only decks reachable from that storey are
clamped against.

- **Falling off the mezzanine is not prevented, it is inexpressible.** While you are on the
  bridge, the hall floor is simply not in the set being clamped against, so there is no edge to
  cross. The same fact going the other way is why you cannot walk up into the underside of the
  deck.
- **The staircase is the one deck in both storeys**, and it is what moves you between them:
  its floor ramps along the arc, and its `levelAt` answers the lower storey at the foot and the
  upper one past the middle. Crossing that midpoint is what swaps the walkable set. The
  midpoint has to be *inside* the flight — at either end you would swap sets while standing on
  a deck the new set does not contain.
- **The flight is derived from the wall, not placed against it.** `wallArc()` in `hull.ts` fits
  a circle through three points of the hull's own floor outline between the flight's two ends,
  and `STAIR` is that circle. So nothing about the staircase is a coordinate: give it a foot,
  a width and two clearances and it follows whatever shape the hull is. The fit is a three-point
  circle rather than least squares because over a run short enough to be a flight of stairs the
  two agree to about a centimetre — but that is a property of a *short* run, so don't reach this
  round the tail, where the outline stops being an arc.
- **The radius that comes out is enormous — 26 m against a 10 m beam — and that is correct.**
  The flank of an ovoid is nearly straight amidships: it bows out by 0.11 m over the whole 4.8 m
  of the flight. A tighter curve is not a stair that hugs this wall, it is a spiral standing next
  to one. (It was 21 m while the nose still came to a point. Blunting the nose flattened this
  wall and the flight followed on its own, which is exactly what fitting it to the hull is for.) The previous version was exactly that — a 3.4 m helix in the open middle of the floor,
  which walled off the centre of the hall, put its outer rail 0.48 m through the hull the first
  time it was drawn, and needed a well bitten out of the mezzanine to come up through.
- **Running fore-and-aft pays for itself three times.** 4.65 m of run at 30.6° instead of 5.3 m
  at 34°; the outer flank is the hull, so one railing instead of two; and the top tread lands
  level with the mezzanine's front edge, so there is **no stair well** and the slab is a plain
  outline with one convex walkable piece rather than two clipped ones.
- **An arc stair is not convex, so it is many decks.** `arcDecks()` cuts the annular sector
  into quads, and every one of them answers height and storey from the *same* function of the
  angle about the arc's centre. That is what makes the seams exact however coarse the cut:
  there is no per-segment height to disagree about. It also means the sweep must stay under
  half a turn and must not straddle the ±180° branch cut of `atan2` — which the current 15.7°
  sweep about a centre far off to port is nowhere near, but a re-placed stair could be.
- **The walkable band is solved, not chosen, it is narrower than the flight, and it is a
  *function of where you are on the flight*.** The flight is 1.8 m wide and its treads reach the
  wall; `stairWalkOuter(t)` in `layout.ts` pulls the band in until the eye clears the hull, and
  because the hull leans in above the waist the limit tightens as you climb — 1.39 m across at
  the foot, 0.68 at the head.
- **Returning one radius from that instead of a function is what "I fall through the stairs"
  was.** Solve it once for the worst case (the head, where the hull is tightest) and apply that
  the length of the run, and at the *foot* the lower-floor deck reaches further outboard than the
  stair band does — in exactly the place where the treads are ankle high. `DECKS` is first-match,
  so walking up the wall there hands you the hall floor while the steps are around your knees.
  Letting the band follow the lean closes that strip: at the foot it now reaches 0.2 m past the
  floor's own limit, and the strip that opens further up is honest headroom under a flight two
  metres overhead. `arcDecks()` takes an `ArcRadius` — a number or a `(t) => number` — for this.
- **`arcDecks`'s `overlap` is in metres, not radians.** It was an angle, which on a 20 m arc
  meant 0.035 rad = 0.7 m of overlap — larger than a whole segment. It is converted at the
  segment's own mid-radius now.
- **The treads are run out to `halfWidthAt` at their own height, not to the arc.** The arc is
  fitted at floor level and the hull's widest point is around y = 2, so treads all cut to the arc
  would touch the wall at the bottom and stand 0.27 m off it in the middle — a slot up the side
  of the staircase with the planet visible through it. The outer stringer follows the same rule.
- **The stair's region runs past its last tread**, at the flat height of the deck, so the two
  share floor rather than butting up edge to edge — the corridor-overlap trick from the old hub
  plan. Butt two regions together exactly and the closest-point clamp catches you on the seam.
- **`DECKS` is ordered, and the order is load-bearing.** `deckAt` is first-match, and the stair
  shares its XZ with the hall floor it curves over — listed the other way round you would walk
  *under* the treads at ground level instead of up them.
- **A deck's outline is taken at the height of your head, not your feet.** The hull leans in, so
  the two are different shapes: at z = 5 it is 4.76 wide at the bridge deck and only 4.06 at eye
  height, and by z = 6.5, where the bulb is closing, 3.44 against 2.14. Laid out on the slab's own
  edge, the bridge would walk you head-first into the roof well before you ran out of floor, and
  aft *badly* before — so `DECKS` derives it from `outlineAt(BRIDGE.y + EYE_HEIGHT, …)`, which
  also stops the walkable deck at z ≈ 6.8 on its own, where the headroom runs out. The lower
  floor is the other way round: the hull is widest a little above eye height, which is why
  `floorOutline()` serves there. The *slab* is still drawn to deck height, or there would be a
  gap at the hull to see through.
- **The lounge dais is floor, and this reverses an earlier rule.** It used to be furniture — one
  footprint you walked around — because a *closed* couch ring left a hand's width of tread
  outside it and an unreachable pocket inside. Opening the couch into a U changes the argument
  completely: the pocket becomes the best standing spot in the station, so the dais is a `Deck`
  at 0.18 (one step, well under `MAX_STEP`) and the couch is the thing you are pushed out of.
- **The pocket inside the U is a solved clearance, not a chosen radius.** You stand in the gap
  between the table and the seats, and both are inflated by `PLAYER_RADIUS`, so the ring is only
  `couchInner - tableRadius - 0.64` wide. At the first numbers (1.35 and 0.5) that was 0.21 m,
  and once the box chain and the table's own square footprint had taken their share there was
  nothing left at all: you could reach the mouth and the near edge of the table and go no
  further, and `dev/walk.mjs` wedged in a sliver between two boxes with no way out. 1.45 and
  0.38 give 0.49 m — and they buy it without growing `couchOuter` or the dais, which is the
  point, because the station is meant to be tight.
- **There is a step guard, and it is not optional.** `clampToRegions` moves an out-of-bounds
  point onto the nearest boundary of the *nearest* region, and distance knows nothing about
  height — a sideways shove from the hall floor towards the raised part of the flight lands
  nearer the stair's edge than the floor's, and would lift the eye through the mezzanine. A
  move that changes the floor by more than `MAX_STEP` is refused and the previous position
  kept.
- **`MAX_STEP` is bounded from both sides and the window is narrow**, so don't nudge it
  casually. Below: the steepest *legitimate* frame is 2.4 m/s up the flight at the 0.1 s dt cap
  — `dev/walk.mjs` measures 0.144 at that cap on the current 30.6°, and measured 0.168 on the
  34° helix — so anything under about 0.15 makes the stairs themselves unwalkable on a slow
  frame, and under 0.17 would have on the old one. Above: at the flank of the flight the clamp
  offers heights rising continuously from zero, so whatever it is set to is exactly how far up
  the side of the staircase you can hop — at 0.5 that was a visible half-metre vault onto the
  third tread, *and* a trap, because the guard is symmetric and would then refuse to let you step
  back down. 0.25 sits between. The gentler flight bought margin at the bottom of that window,
  not permission to spend it.
- **The stair's railing is load-bearing, not trim.** The guard lets you board the flight only
  where it is under `MAX_STEP` off the ground and refuses to let you step off sideways above
  that, so its inboard flank is a 7 m invisible wall down the middle of the hall with nothing to
  explain it. The rail is the explanation. It starts a little way up, which leaves open exactly
  the stretch at the foot the guard actually lets you walk on from the floor. The *outboard*
  flank needs nothing, because it is the hull — which is the whole reason to put the flight
  against a wall.
- **The walking surface is a ramp; the treads are decoration.** Mid-tread the eye rides half a
  rise (15 cm) below the tread it is nominally on. That is invisible with no body to look at,
  where stepping the eye instead would put a 30 cm jolt in it twelve times a flight.
- **You walk behind the console, not along the deck edge.** It stands close enough to the front
  of the bridge that its inflated footprint meets the walkable edge — which is correct for a
  bridge, and worth knowing before wondering why you cannot squeeze past it.

### Checking a change

The station's shape is only judgeable by eye, and its floor is only judgeable by walking it.
`dev/` has one harness for each, both of which start their own Vite server and drive a headless
Chromium; neither is wired into `npm run build`.

- **`node dev/shots.mjs`** writes a PNG per scripted camera pose to `dev/shots/`. Run it after
  any change to the hull, the glazing or the lighting, and then *actually look at the output* —
  the open tail, the tangled lattice and the longerons ending in mid-air were all invisible in
  the numbers and obvious in the first frame.
- **Four of those poses are outside the hull, and they exist because the silhouette is the one
  thing about the station nobody can ever see.** There is no exterior view in the site: planet
  view puts you indoors and the inspector takes the station away. So every shape mistake was
  found from inside, by accident, late — and the exterior was never checked against the sheet it
  was drawn from at all. `pose()` takes station-local coordinates and the camera is a child of
  the rig, so standing 20 m off the hull costs nothing. The flat-bottomed half-egg was the first
  thing the first exterior frame showed. **Don't edit the source while the harness is running** —
  Vite hot-reloads the page mid-shot and the screenshot times out.
- **Every harness names its hash explicitly**, and `walk.mjs` and `shots.mjs` say `#planet`
  rather than the bare `#`. They used to open the bare hash because the station was reachable
  that way; the site's landing view is Precision Parking now, and a harness left on `#` sits
  waiting sixty seconds for a `window.__station` that never arrives.
- **`node dev/park.mjs`** is the parking game's, and belongs to a different scene entirely — see
  "The parking game" below. It checks the two things about that game which are invisible in any
  frame: that the level ladder is deterministic, and that a stop is back-dated to the tap.
- **`node dev/walk.mjs`** replays the exact floor logic of `fpv-controls.ts` — clamp, obstacle
  push-out, first-match `deckAt`, step guard — over a route round the lounge, in through the
  mouth of the U, round the table, up the stairs, round the bridge and back, at the 0.1 s dt cap.
  It starts where the player does, which is now the bridge, so the route goes down the flight,
  round the lounge and back up — both directions on the stairs, which is the half of it that
  catches a step-guard bug. It reports the biggest single-frame step on each leg and exits
  non-zero if a leg fails to arrive. Run it after any change to `DECKS`, the stair, `MAX_STEP` or a footprint. It is the
  only thing that catches a floor bug: the fall-through above was invisible in every screenshot.
- **Read a failing leg before believing it, but do not assume it is the route's fault.** Each leg
  is a straight line, so one drawn through furniture is testing the push-out rather than the
  floor — the fix there is to route it the way a player would walk. But the *same* failure
  signature, a leg that stops dead and every leg after it, is also what an unreachable pocket
  looks like: the push-out is two passes over a list of boxes, not a solver, so a gap the boxes
  close around is somewhere you get wedged with no way out. Ask which it is by checking whether
  the point it stuck at is anywhere a player could have got to.

### Planet view behaviour
Conventions worth knowing before touching it:

- **Two scales in one scene.** The station is in metres (a 15.6 x 10.2 x 6.8 m hull, origin on
  the lower floor amidships); the planet is toy-scaled at `PLANET_RADIUS = 300`, centred on the
  world origin, with the station somewhere in `ALTITUDE_DETENTS` (35..600, opening at 120)
  above it. That keeps the camera's near/far at a plain `0.1 / 20000` — no logarithmic depth
  buffer needed, even at the top of the range.
- **Altitude is a console key, and it is the biggest lever in the scene.** At the bottom (35)
  the limb sits ≈ 63° off the nadir — ISS-like, the horizon a wide shallow arc and the terrain
  close enough to read. At the top (600) it is 19.5° and the planet is a ball hanging in the
  glass. Climbing also *brightens* the lap: from higher up the window sees further round
  towards the day side.
- **Every camera must stay outside `ATMOSPHERE_RADIUS`** (`1.035 × R` = 310.5, exported from
  `space.ts`). The outer shell is a `BackSide` fresnel: a camera inside it is wrapped in it
  and gets glow smeared across the whole sky instead of a ring round the planet. That is what
  sets the lowest altitude detent and the inspector's `MIN_DISTANCE`, and `STATION_REACH`
  (9 — the hull's own farthest point is 8.37, the crown of the arch at z = 5.8) says how much
  clearance the *building* needs on top of that. That used to be the top of a blunt tail; the
  tail is a closed round bulb now and the crown of the arch beat it. It came down from 11 with
  the hull. It bit once already, when the altitude dropped from 70 to 20 with the outer shell
  still at `1.22 × R`.
- **The camera is a child of `stationRig`**, the group that carries the station around its
  orbit. This is what keeps the movement code simple: `PointerLockControls` writes
  `camera.position`/`camera.quaternion` and reads `camera.matrix`, all of which are local
  to the parent, so the player walks around in plain station coordinates (and so do `DECKS`
  and the furniture footprints) while the rig handles where the station actually is in space.
- **The glass is the hall's -Z end.** `Matrix4.lookAt` puts +Z *away* from its target, so
  aiming the rig at the planet leaves -Z — and the nose — facing it. Bearing 0° is that
  same -Z, which is why the detent is called "the window" and why it is the one worth being on.
- **The horizon is pinned, and the pitch is solved for.** The limb lands at `α - pitch`
  relative to the optical axis, where `α = asin(R / (R + altitude))`. Rather than fix the
  pitch, the scene fixes where the horizon sits — `flight.state.horizon`, opening at 9.4° —
  and `pitchFor(altitude, horizon)` inverts the relation every frame. **This is what makes
  changing altitude work**: without it the horizon slides off the top of the glass within a
  few tens of units of climb. `ROLL` (0.6 rad, the pod's old `WINDOW_YAW`) then turns the
  station about its own vertical towards the direction of travel, which makes the view oblique
  — terrain comes towards you and passes to one side instead of sliding straight across.
  Because a horizon is a cone about the nadir, roll is a pure azimuth change: it never tilts
  the horizon or moves it up or down. **Order matters** — `rotateZ(-ROLL)`, then
  `rotateX(pitch)`, then `rotateY(bearing)`. Any other order banks the station, or lets the
  bearing cross-couple into the pitch and flatten it to zero at 90°.
- **The two storeys want different horizons, and that is a feature.** The horizon is an angle
  about the optical axis, so it does not move when the eye does — but *where in the glass it
  lands* very much does. From the lounge (eye 1.78 on the dais, amidships-forward) the default
  9.4° puts the limb mid-glass, exactly where it has always been. From the console (eye 4.35,
  11 m back from the tip) the same 9.4° puts it up in the roof of the nose. The console's own
  horizon key brings it back down. Don't "fix" this by moving the bridge or stretching the glass; the control is
  the answer, and having a reason to touch it is worth more than never needing to.
  **The spawn is up here now**, so the bridge framing is what planet view opens on: the limb sits
  high in the nose and almost the whole cap window is planet, which is the right opening frame
  even though it is not where the default 9.4° was tuned. The key is still the answer for
  anyone who wants it lower.
- **The lounge is centred on the glass, and it is the only thing in the nose.** A dais 2.3 across
  at z = -4.2, a U of couch open to -Z, a table in the middle. Centred rather than off to one
  side — the horizon runs through the middle of the window and the couch is *below* it, so
  nothing has to dodge sideways. It sits inside the glazed nose with glass ahead, overhead and to
  both sides and the lit rim at its feet. The forward edge of the dais lands at z = -6.5, where
  the floor is 3.11 from the centreline against the dais's 2.3. **That used to be 2.64, and the
  dais very nearly touched the glass on both flanks** — blunting the nose (`NOSE_ROUND`) gave the
  lounge back half a metre a side and 0.65 m of headroom without the station growing anywhere.
  There is still not room to move it much bigger or much further forward before it runs out
  through the hull. What you look *at* from there is now the round cap window, dead ahead, with
  the horizon across the middle of it.
- **The mouth of the U faces the window, and that is the whole arrangement.** `GAP_CENTER` is
  -π/2 and `openAngle` 100°, so the couch wraps the aft three quarters of the circle with its
  arms either side of you and the opening looking straight down the glass. You walk in through
  that mouth and stand at the table; the seats are behind you. A closed ring — which is what this
  was while there was a desk in the nose — puts a back between you and the planet from wherever
  you stand.
- **You arrive at the head of the stairs, on the bridge, in first person already.** It is the
  one viewpoint with the whole station in it at once: four metres up and eleven back, so the
  mezzanine's edge is in front of you, the flight drops away to starboard, the lounge and its lit
  dais sit below and to port, and the cap window with the planet in it is dead ahead. From the
  lounge, where this used to be, you see the window and almost nothing of the place you are
  standing in.
- **Nothing in `SPAWN` is a coordinate, including the aim.** The position is one stride inboard
  of the flight's inner edge (`STAIR_TOP_X`) and one stride aft of where it arrives
  (`BRIDGE.frontZ`), so it follows the staircase, which follows the wall, which follows the hull.
  The yaw and pitch are a `lookAt` at the **middle of the cap window** — `NOSE_CAP_Z`, which
  moved from `hall.ts` into `hull.ts` when the spawn became its second consumer — because
  "looking out at the planet" through a round window means looking at the middle of it. The
  lounge then falls into the lower left of the frame on its own: 6.5° off the axis and 13.8°
  down, against a field of ±45.5° by ±32.5°. It has been at a desk in the nose, then on the floor
  behind the couch; the couch turns out to be better looked *at* than stood behind.
- **The spawn is on the mezzanine, so `spawn.y` is real.** `station/index.ts` used to hand out a
  hard-coded `y: 0`, which was invisible while every spawn was on the lower floor. The step guard
  is exempt on the first frame (`floorY` starts `null`), so arriving at 2.75 is not read as a
  2.75 m fall.
- **Arriving is not the same as being in control, and the gap is the pointer lock.** You used to
  have to click the canvas before anything responded to the mouse. `tryLock()` in
  `fpv-controls.ts` now fires from three places: when the view goes live, on a click, and on the
  first movement key. The first works whenever the player got here by a gesture — a mode switch,
  or coming back from the asset viewer — and does nothing on a cold page load, where no browser
  will hand over the pointer without transient user activation. **The key path is the one that
  matters there**: press W and you are in, without hunting for something to click.
  It calls `domElement.requestPointerLock()` rather than `controls.lock()` deliberately — three
  drops the promise that returns, so a refused lock leaves an unhandled rejection in the console
  on every load. Three tracks the state from `pointerlockchange` either way.
- **The lamp over the table is most of the light in the nose.** One short-range warm `PointLight`
  1.5 m above the table, plus the two LED rings let into the dais. With the roof points gone from
  the canopy there is nothing else forward of the seam, and without it the whole lounge is a dark
  smudge against a lit planet.
- **The table has to be warm, and that is a lighting fact rather than a taste.** Its top face and
  the dais are the two big upward-facing surfaces down there, so they catch the cold blue fill off
  the planet and almost nothing else. At the near-black it started as (0x24211e against the dais's
  0x272d38) both washed out to the same pale grey and the table stopped reading as an object.
- **The hull is a loft, and three properties of its profile are load-bearing.** One function
  `f(z)` in `station/hull.ts` scales a single elliptical section along the length:
  `sqrt(1 - s³)` forward of the fullest station at z = 2.4, and `sqrt(1 - u⁴)` aft of it.
  Everything else — the floor's outline, the roof over any point, how far a railing may stand
  out, where the staircase runs — falls out of that one curve. First: both halves are
  **concave**, so the oval the profile traces on the floor is **convex**, and the whole lower
  deck can stay a *single* region for `clampToRegions`. The floor's half-width is exactly a
  constant times `f(z)`, so "convex floor" and "concave profile" are the same statement — and
  `sqrt(1 - u^p)` is concave for **any** exponent ≥ 2, so the two round-off powers are free to
  move within that family. A profile from outside it is not a free choice: check it, or pay for a
  convex decomposition of the entire floor. Second: **it reaches zero at both ends**, so the loft
  closes itself — `ringPoint` collapses a vanishing section onto the axis, and tip and tail are
  sealed by the same triangles that make the sides. There are no end caps and no code to add
  them. Third: **the two round-off exponents are what keep each end under a roof.** A plain
  ellipse starts closing immediately: aft it was down to 1.9 m of headroom by the globe, and
  forward it left the lounge 2.64 m of half-width at the front edge of its own 2.3 m dais.
  `TAIL_ROUND` (4) and `NOSE_ROUND` (3) hold each section near full and then round it off hard
  over the last stretch, which is what both ends of an egg actually look like.
- **`NOSE_ROUND` is the whole difference between the old hull and the reference's, and it cost
  nothing.** The envelope is untouched — same length, same beam, same roof, both ends in the same
  place — the hull simply stops narrowing so early. What it buys: at the forward edge of the dais
  (z = -6.5) the floor goes from 2.64 out to 3.11 and the roof from 3.69 to 4.34; the starboard
  wall flattens, so the stair's fitted arc opens from 21 m of radius to 26 (the flight follows on
  its own, which is the point of fitting it); and the nose ends wide enough to carry a cap
  *window* instead of running into a needle. `STATION_REACH` is unaffected — the farthest point
  on the hull is still the aft crown at 8.37, and adding the keel did not beat it either.
- **The keel exists only to be looked at from outside.** For most of the station's life only the
  arc above y = 0 was built: nothing below the floor plate can be seen from inside, the player
  can never leave, and skipping it halved the hull's geometry. The first exterior shot ever taken
  settled the argument — a half-egg sliced off flat along its waterline, against a reference that
  is a closed ovoid. `keelPoint` is the complement of `ringPoint` (the same ellipse, under the
  floor instead of over it) and `buildHullSurface` lofts it in one opaque piece the whole length:
  the glazing is a *canopy*, and the reference's belly is plain metal tip to tail.
- **The hull leans inward above the waist, and a floor plan is not a clearance check.** At z = 5
  it is 5.76 wide at the bridge deck, 5.42 at a railing's top rail and 5.17 at eye height.
  Anything tall — railings, the console, the globe, the top of the staircase — has to be tested
  with `halfWidthAt(z, y)` at *its own* height. This is not theoretical: a stair railing came out
  0.48 m outside the hull the first time one was drawn. It is also why the bridge carries a
  railing on its front edge only — along the sides the hull is already the barrier, and a rail
  there would poke straight through it.
- **Below the waist it leans the other way, which is just as easy to get wrong.** The section's
  centre sits `FLOOR_DROP` above the floor plane, so the hull is widest around y = 2 and the
  floor outline is *narrower* than the wall a metre above it — by up to 0.21 m along the
  staircase. Anything meant to meet the wall at a height has to ask for that height.
- **Everything forward of `NOSE_Z` is glass on every face above the floor, and carries no lights
  at all.** `NOSE_Z` is 1.8 — the same line as the mezzanine's front edge, which is the whole
  layout in one number: **the glass begins where the bridge ends**, and ten of the hull's
  fifteen and a half metres are window. The floor is solid: the glass floor of an earlier pass came out on
  the concept's authority, and the **lit rim** — a tube down each side where the glass meets the
  deck — took over its real job of drawing the floor line against the planet.
- **The planet is the light in the forward half, and every floor-level source was taken away to
  let it be.** There is nowhere to mount a lamp in a glass cage and nothing that should compete
  with what is outside one. Four warm points used to hang under the crown amidships; they are
  inside the canopy now, so they are gone. Then the *floor* took over as the offender: four
  short-range warm points at the rim, with thirteen metres of strip authored over 1.0 blooming
  right under the eye, and the deck came out the brightest surface in every frame with the Earth
  behind it second. Both are gone — the rim points entirely, and every strip at floor level onto
  **`MATERIALS.ledFloor`**, which is the same warm colour deliberately *under* the bloom
  threshold. What is left is one pair on the **seam hoop** at `NOSE_Z`, the last real frame in
  the hall, throwing its length from behind you as you look out, plus a `DirectionalLight` from
  the glass (`planetShine`) standing in for the planet itself. The room is dimmer than it was and
  that is the point: the window is the thing in it.
- **Deck edges are marked, not lit, and that is what `ledFloor` means.** The rim in the nose,
  the two rings in the lounge dais and the strip along the mezzanine's front edge are all on it.
  Anything mounted *high* — the roof strips aft, the globe's emitter — stays on the bright `led`,
  where a bloom reads as a light overhead rather than as glare underfoot. Putting a floor-level
  run back on `led` is what made the station look like a lit runway with a planet out of the
  window; that is the history you would be arguing with.
- **The canopy's frames are collars, hoops and longerons, and they are not decoration.** An
  unbroken sheet of glass has no scale: without them you cannot tell a 4 m canopy from a 40 m
  one. They are also the second thing about the shape you can see from inside, after the way the
  roof comes down.
- **There are three weights, and the hierarchy is the point.** A canopy framed in one thickness
  reads as a net thrown over the hull. The reference has a clear primary structure — the collar
  where the metal ends, one heavy ring across the middle of the glass, the collar round the nose
  cap — with lighter hoops between and lighter longerons again running through them all. Two more
  numbers (`MAJOR_RADIUS`, `MAJOR_HOOP_FRACTION`) buy the whole of it.
- **A collar is a band, not a line, and it goes all the way round.** The two structural breaks
  are an inch of raised metal with a visible thickness, and that thickness is what says the glass
  is *set into* something. A tube cannot say it, so `collar()` lofts two rings into a short opaque
  band, pushes it 5 cm proud so it reads as a bezel from outside, and puts a heavy tube on each
  lip. The seam collar laps 0.3 m onto the glass rather than butting up to it, because a bezel
  overlaps what it holds. It is built from `sectionRing` rather than `ringAt` — the *whole*
  ellipse, under the keel as well as over the crown — because a collar that stops at the
  waterline is a band painted on the top half of an egg, and now that there is a keel that is the
  first thing an exterior frame shows. None of the lower half is visible from inside.
- **The nose cap is a round window, and its collar is derived from the hull, not placed on it.**
  `NOSE_CAP_FRACTION` (0.62) is given as a fraction of full beam, so `zForProfile` puts the
  collar on the shoulder of the cap whatever the profile does later — the same trick as fitting
  the staircase to the wall. It lands at z = -6.6 and leaves a cap 6.3 m across and 1.6 m deep.
- **Inside the ring is a cross, and the longerons stop at it. This is the whole of the front
  window.** The first version ran all seven longerons through to `Z_TIP`, where the profile
  reaches zero and `ringPoint` collapses every ring parameter onto one point, so they met at an
  apex. As geometry that is tidy, and it was defended here as "the radial mullions come free".
  As a *window* it was wrong, and you could only find out by looking through it: seven members
  converging on a point at the floor line turn the front of the ship into a spider's web, and a
  circle you can see the whole of is the entire effect the reference is after. The frames die on
  the collar now, exactly as they do in `space_station_outside.jpeg`, and what is inside the ring
  is four panes.
- **Both mullions are the surface's own lines, not bars laid over it.** The upright is the crown
  line `ringPoint(z, 0.5)` from the top of the collar forward to the tip — and because the
  section's centre sits `FLOOR_DROP` up, and that drops to zero as the section vanishes, the tip
  lands *on* the floor plane, so from inside the upright runs the full height of what you can
  see. The crossbar is the hull cut by a horizontal plane at half the cap's height:
  `x = ±halfWidthAt(z, h)`, port side forward, round the nose, starboard side back. It pinches to
  a point at `zForProfile(NOSE_CAP_FRACTION / 2)`, where the crown comes down to exactly that
  height — which is a point on the crown line too, so **the two cross exactly** without either
  being told about the other.
- **There is no second concentric ring**, though there was one, on a reading of the reference
  that a closer look does not support: what sits just inside its collar is the collar's own inner
  lip plus the far rim of the ring seen through the glass. One ring and a cross.
- **`frameZs()` exists because a member has to die *inside* the collar.** `stations()` is a fixed
  cosine-spaced list, so filtering it gives a longeron that stops at whichever sample is nearest
  — which was harmless while every frame ran to the tip and is not harmless against a band 0.26 m
  deep. It returns the stations in a range with both ends landing exactly.
- **The cap closes down to the floor line, not to the section's axis, and that is correct.** The
  section's centre sits `FLOOR_DROP × hh` above the floor, and `hh` goes to zero at the tip, so
  the hull's axis droops to y = 0 at both ends. Looked at head-on the mullions therefore converge
  at the *bottom* of the cap rather than its middle. Pinning the axis level instead would leave
  the end rings hanging above the floor plate with a gap between.
- **This replaced a diagonal lattice, and the reason matters.** Two families of ribs spiralling
  round the nose in opposite directions and crossing into lozenges was defensible over a 7 m
  nose. Stretched over 13 m of hull it stopped reading as structure at all: every rib crossed
  every other one at a different place along the length, and from the lounge the window was a
  tangle of black curves with a planet somewhere behind it. Fore-and-aft members are legible from
  any standing position because they all run to the same place — the ring round the front window.
- **The lit rim must stop short of the tip, unlike the cap's upright mullion.** It is offset inboard of the
  hull by a fixed 0.09, so carried all the way in, the two sides would cross over in the last
  half metre and each end up on the wrong one. It is filtered on `floorHalfWidthAt` rather than
  on a z limit, so it follows the hull.
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
- **The planet must never be a black sphere on load.** The maps take a moment, so the shader
  carries a procedural fallback selected by the `uHasMaps` uniform, faded in over ~0.4s once the
  textures resolve. This mattered most when flight view was the site's landing view; it is one
  hash away now, but a mode switch is still a moment where the maps may not have arrived.
- **Bloom does the glowing.** The high LED strips, the globe and the atmosphere are authored with
  colour channels deliberately over 1.0 and `UnrealBloomPass` has a threshold just above 1.0, so
  only those pick up a halo. **Which side of that threshold a strip sits on is a design decision,
  not a brightness tweak** — see `MATERIALS.led` against `MATERIALS.ledFloor` above: everything at
  floor level is under it on purpose. `OutputPass` must stay last in the composer chain — with a
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

### The flight view's minimap

Bottom right, under the key legend, in `#minimap`: a flat equirectangular Earth with the
aeroplane on it. Built from three pieces — `Space.surfaceUv()` in `space.ts`, `updateMinimap()`
in `fly-view.ts`, and the panel in `style.css` — so it is worth having the reasoning in one
place.

- **The map is static and the marker moves.** No rotation, no panning, no zoom. A map that
  turned under the aircraft would be illegible at 272 px wide and would throw away the one thing
  a world map has going for it, which is that you already know the shape of it. So the marker's
  position on the panel *is* its longitude and latitude, and you can read them off it.
- **`aspect-ratio: 2 / 1` is load-bearing twice.** The map is 360° by 180°, so any other shape
  stretches it — and `updateMinimap()` reads the panel's own proportions back out to point the
  marker along its track. That read happens in `resize()`, not per frame: touching
  `clientWidth` forces layout, and `resize()` is already the one place that knows the window
  changed.
- **The mapping is derived from `SphereGeometry`, not guessed at.** `surfaceUv()` inverts
  three's own sphere parameterisation, which is what fixes u = 0 on the left edge of the map
  (180° W) and puts +X at 0°, +Z at 90° W and -X at 180°. Verified by dropping the aircraft on
  seven landmarks — the Gulf of Guinea, London, Sydney, Cape Horn, the Sahara, Queen Maud Land
  and the dateline — and reading the marker back: all within a degree, the residual being the
  frame of flight between setting the position and reading it.
- **It asks in the planet's *local* frame**, so the slow axial spin is in the answer. Asked in
  world space the marker would drift against the terrain it is supposed to be over.
- **It is called after `space.update()`**, which is where the frame's spin lands on the planet.
  Same "the matrices have to be current" trap as raycasting from a rig that has already moved.
- **The heading is finite-differenced in map space, not taken from the aircraft's nose.** The
  marker sits on a projection: due north over Greenland is drawn as a run along the top of the
  map, and a marker pointing up there would disagree with the track it is leaving. `du` is
  wrapped at ±0.5, or the single frame that crosses the antimeridian reads as a sprint the whole
  way back across the map and snaps the dart round on the spot. Smoothed over `TRACK_LAG`,
  because a difference between two frames over a variable `dt` jitters.
- **The marker carries its own outline**, with `paint-order: stroke` so the stroke paints under
  the fill rather than eating it. The map runs from black ocean to white ice; nothing that is
  one flat colour is legible against both.
- **The panel is dropped below 560 px of viewport**, where it would start to collide with the
  readout pill — and a viewport that narrow is a phone, which has no keyboard to fly with in the
  first place.
- **The saucer is on the same map by the same means**, as a circle rather than a dart: a contact
  is a *place*, and at eight units per second a heading arrow would be a lie at this scale. It
  pulses (opacity only, so it cannot fight the position JS writes) because a 6 px contact on a
  272 px map is one you will otherwise miss, and it is hidden outright between one being shot
  down and the next appearing.
- **The boost rings are deliberately not on the map**, though they were briefly, one mark per
  site. The map is for the things that are *happening* — where a ship is coming down and how long
  it has — and a fixed constellation of thirty-six hoops turned it into a scatter of warm rings
  with the green marks that matter lost among them. The rings are big, lit and three deep; you
  find them by looking out of the window.
- **A landing ship gets a line, not a mark**, from where it came in to where it will touch down,
  with a ring on the site and a square on the ship. A mark says where something is; a line says
  where it is *going*, which is the thing you need in order to decide whether to fly after it.
  Its four nodes per ship are built in `fly-view.ts` rather than written into `index.html`,
  because how many there are is `LANDER_COUNT`'s business.
- **The overlay is its own coordinate space**, `viewBox="0 0 100 50"` with
  `preserveAspectRatio="none"`: the numbers in it are map fractions, so a longitude is an x and
  a latitude is a y with nothing in between, and every stroke width scales with the panel.
- **A path whose ends are more than half a map apart is going round the back of the world**, and
  drawn as one line it streaks all the way across the front instead. It is drawn twice, a map
  width apart, and the panel's own clipping leaves exactly the two halves you should see.
- **The paths are redrawn every frame, not once at spawn**, because the planet turns underneath
  them: both ends are fixed in space, so on the map they creep west together with the ground
  they are over.

### The boost rings, and the wake behind the wings

`fly/rings.ts` and `fly/trail.ts`, wired together in `fly-view.ts`.

- **They are the reason the throttle ceiling came down**, from `MAX_SPEED` 130 to 70 and then to
  30. At 130 the throttle alone got you anywhere and a ring would have been a curiosity. Under
  its own power the aeroplane now loafs — four minutes to a lap, terrain close enough to read —
  and everything fast in this view is a ring: boosted it does 120, four times what the throttle
  alone will give. One ring is worth half as much again as the whole throttle range, which is
  deliberate, because a boost you can barely feel is not worth flying to.
- **`THROTTLE_UP`/`THROTTLE_DOWN` came down with it**, 34/70 to 12/24. The usable range is 18
  units wide now against 118 at the original ceiling, and the old authority crossed the whole of
  it in half a second — a lever that became a switch.
- **The boost is its own term, not a change to the throttle.** `speed` is what the throttle is
  set to; `boost` sits on top of it and decays exponentially (`BOOST_DECAY` 2.6, a half-life just
  under two seconds), so the aeroplane surges, coasts back down and is still cruising at exactly
  what you left it on. Rings stack up to `BOOST_MAX`, so a run through a stack is worth chaining.
  The readout shows the total and goes warm while there is a boost on it.
- **Nothing about a ring is solid.** No collision, no deflection, no slow-down for clipping the
  rim: the only question ever asked is whether the segment the aeroplane flew this frame crossed
  the disc. This scene has no ground and no walls, and a gate that could swat you out of the sky
  would be the first solid thing in it.
- **The test is swept, for the same reason the laser's is.** A boosted frame is three units and a
  slow one sixteen; "is the aircraft inside the hoop right now" would miss most passes.
- **The sites are fixed to the ground, not spawned near you.** Twelve places from a Fibonacci
  sphere — even spacing by construction, where random latitudes and longitudes bunch at the poles
  and pile up on each other — each holding three hoops at 50, 110 and 170. Fly through one and
  the same hoop is back over the same country six seconds later. An earlier pass put each ring
  out at a random bearing from the aircraft and recycled it whenever it fell behind, which made
  the minimap a list of things that happened to be near you rather than a map you could aim at
  twice.
- **Three hoops per site, not one, so a site is reachable at whatever altitude you are flying.**
  It also gives the view its best thing to fly: having found a stack, the obvious move is to take
  all three, which is a climb. A single hoop per site made one height right and the rest of the
  aeroplane's band a place you passed through.
- **A hoop is a lit object, not a light**, and that is a correction. It was one material
  authored well over 1.0, which put a whole 20-unit torus through the bloom threshold: from any
  distance a ring was a white-hot circle, and with thirty-six of them the loudest thing in the
  scene was its scenery — the alien landing ships, the one thing here with a clock on it, were
  outshouted by the furniture. The hoop is warm metal now, lit by the same sun and earthshine as
  the aeroplane, with a low emissive so it still reads over the night side. What blooms is the
  six lamps, which are spheres under a metre across: six points of light, not a glare.
- **Every hoop turns to face the aeroplane, and that is a mechanic rather than a flourish.** Left
  on a fixed heading most of the hoops you found were edge-on, and flying through one meant
  spotting its facing from several hundred units out, overflying it and coming back round. It is
  aimed halfway between the bearing to you and the reverse of your heading — lined up, the two
  agree and the hoop is square to your approach; off to one side, it leans towards the path you
  would fly to reach it. Rate-limited (`FACE_RATE`), because a ring that tracks exactly reads as
  a decal pinned to the camera, and because the bearing changes faster than any object could turn
  when you shoot past a near miss.
- **The wake is capped at a length shorter than the chase camera's standoff, and that is the
  whole of why it looks like a wake.** Drawn as "however far `SAMPLES` frames of history reach",
  it is 75 units at boosted speed against a camera 15 units behind — so its widest, brightest end
  sweeps straight past the lens, and two half-metre ribbons at three metres from the eye fill a
  third of the screen each. The first version looked like the aeroplane was towing two
  searchlights. `MAX_LENGTH` is 12, under the standoff, and everything past the cut is collapsed
  onto it.
- **The ribbons taper by distance along the wake, not by sample index.** Index is the tempting
  shortcut because then the colour attribute is static — but samples are *frames* and the cut is
  a *length*, so at speed the whole visible ribbon is the first three or four samples of
  twenty-four, and tapering by index gives a uniformly bright square-ended paddle.
- **They are camera-facing strips, not lines.** `LineBasicMaterial.linewidth` is one pixel
  everywhere that matters. Spanning the width by `cross(direction of travel, direction to the
  camera)` is what keeps a ribbon full-width in a bank, where one spanned by the wing axis or by
  the aircraft's up would collapse to an edge.
- **The wake lives in world space, beside the aeroplane rather than under it** — parented to the
  aircraft it would turn with it — and its history is dropped whenever the boost falls to nothing
  or the view is parked, so the next boost cannot draw a streak from wherever the last one ended.
- **A ring repairs as well as boosts, and it is deliberately not marked.** `RING_HEAL_AMOUNT`
  (see "Losing" below) is a quarter of the aircraft's health per hoop, on top of the speed the
  ring already gives — the two are the same errand now rather than separate things to fly to. A
  mark was tried in the middle of every hoop to say so — first a plain cross, which read as a
  target reticle rather than as "repair", then the repair pack itself (`buildPackMesh()` from
  `fly/packs.ts`), scaled up and tumbling. Both were pulled: the heal is a quiet bonus on top of
  a boost you were already flying to the ring for, not a second landmark competing with the
  ring's own six lamps and the real falling packs for attention, and a ring at full health simply
  does nothing you would notice, the same as one you did not need to boost from either.

### The repair packs

`fly/packs.ts`, dropped from `fly/landers.ts` through its `onShotDown` callback.

- **A pack is what a landing ship leaves when you shoot it down**, and only then — a ship that
  lands is nobody's doing and leaves nothing. It sinks slowly down the local vertical for ten
  seconds, fading over the last two and a half, and is gone whether or not anyone came for it.
- **There was nothing to repair for a while, and the file said so.** The saucer stayed unarmed
  (still is), and there was no ground to hit, so a pack was *a reason to fly at the wreck* — ten
  seconds short enough that taking one means committing to the kill before you have made it —
  rather than a resource, and `Packs.taken` was a number waiting for a use. A landing ship now
  shoots back on the way down (see "And the landing ships" below), so a recovered pack finally
  does something: it heals the aircraft by `PACK_HEAL_AMOUNT` in `fly-view.ts`, capped at
  `PLANE_MAX_HEALTH`.
- **It is not a score.** The count exists so the command post can say a line when you take one.
  Taking one is worth a sentence and nothing else — see the "no score, no timers, no objectives"
  line above.
- **The pickup test is swept**, like the rings' and the laser's, over the segment the aeroplane
  flew: at speed a 9-unit crate fits between two frames.
- **The pool is four and `drop()` tolerates a full one.** That needs four kills inside ten
  seconds, and silently dropping the fifth is cheaper than any bookkeeping that would avoid it.
- **Packs are cleared when the view is parked**, not left hanging: their ten seconds do not run
  while nothing is rendering, so one left behind would still be there — with its clock restarted
  — on the way back in.
- **Inside `MAGNET_RANGE` (40 units) a pack stops sinking and comes to you, slow at first and
  then fast.** `pullTime` counts seconds spent inside range without a break — reset the instant
  the aircraft leaves it — and the pull speed is `min(MAGNET_MAX_SPEED, pullTime / MAGNET_RAMP_TIME * MAGNET_MAX_SPEED)`:
  the ramp, not the top speed, is what makes it read as a *magnet* rather than a snap. A pack
  that only ever sank would be easy to lose the moment you broke off to keep fighting rather than
  babysit the wreck; the magnet is what makes "come back for it in a few seconds" actually work.
- **A thin tether is the only sign the magnet is live**, a box stretched between the pack and the
  aircraft by the same `setFromUnitVectors` technique `fly/bolts.ts` uses to aim its own boxes,
  recomputed *after* the pack moves each frame — computed against where it started, the tether
  would visibly lag a step behind the crate it is attached to. It fades with the pack's own
  fade rather than on its own clock, so the two always disappear together.

### The saucer, the landing ships and the laser

`fly/ufo.ts` and `fly/bolts.ts`, wired together in `fly-view.ts`. **This is the one place in the
repo with any game in it**, and it stays as small as that can be: there is no score, no timer and
no objective — the "no score, no timers, no objectives" line under "Where this is going" is about
the station, which is a place to be rather than a thing to do. Here there is something to fly to
and something to shoot, and that is all.

- **The saucer is unarmed, and that is a decision rather than an omission.** It has no weapon and
  no knowledge of where the aircraft is beyond the point it was told to spawn away from. If it is
  ever given a gun, `update()` in `fly/ufo.ts` is where it would have to start caring.
- **It is slower than the aeroplane can fly**, 8 units per second against a `MIN_SPEED` of 12, so
  it can always be caught and the contact reads as a place to go rather than as a chase.
- **It spawns in a band, not anywhere.** A random bearing and 1.0–2.4 radians of arc from the
  aircraft — a quarter of the way round the planet to most of the way to the far side — at an
  altitude of 45 to 130, inside the aeroplane's own range. Anywhere-on-the-globe would be a
  needle in a haystack even with the map; on top of you would be a jump scare. Turning the local
  vertical about a horizontal axis is what makes "that far away" mean an arc rather than a chord.
- **Shooting it down is a pop and a respawn, six seconds later, somewhere else.** No debris, no
  sound, no score popup. The flash is an additive shell that expands from 2 to 34 units over 0.7s
  with an `(1-t)²` fade, so it is bright for the first fifth of a second and then gone.
- **The hit test is swept, not a point.** A bolt covers about six units a frame at 60 fps and
  more on a slow one, against a target 11 across — a point test would let it through the middle
  of the saucer often enough to feel broken. The closest approach of the segment it travelled
  this frame is the honest question, and it is the same cost.
- **The bolt pool never allocates.** Twenty-four meshes made once and parked invisible; `fire()`
  wakes one, expiry parks it again. The cadence lives in `bolts` rather than in the caller, so
  holding the key down is all `fly-view.ts` has to know.
- **Bolts do not inherit the aeroplane's speed**, which is both what light would do and 13% of
  the answer at cruise. They die on expiry or on reaching the planet.
- **The reticle is not decoration, for the same reason the station's crosshair is not.** The
  chase camera is aimed a little below the nose so the planet stays in frame, so the middle of
  the screen is *not* where the shots go. It is boresighted at `RETICLE_RANGE` because the camera
  sits above the nose line and no single ring can be right at every range — see the constant.
- **It is placed after the render**, like the station's raycast and for the same reason:
  `Vector3.project` reads `camera.matrixWorldInverse` without updating it, and the camera has
  just moved.
- **`Space` is `preventDefault`ed** along with the arrows, or the browser scrolls the page a
  screenful every time you fire.

And the command post, in `fly/command-post.ts`:

- **It is scenery with a job description**: no interior, no docking, nothing to shoot, nothing
  run from it. What it is for is that the saucers now read as being *answered* rather than only
  watched — and it is the biggest warm thing in a scene whose alien half is all cold green.
- **It is not the station in `src/station/`.** That one is 15.6 m and modelled in metres for a
  first-person interior; this view is arcade-scaled (an 8-unit aeroplane against a 300-unit
  Earth), where the same building would be far under a pixel. This is a *symbol* of a station,
  built from primitives like the aeroplane and the saucer.
- **The orbit is a circle in `space.ts`'s own `(ORBIT_NOON, ORBIT_DAWN)` basis**, the inclined
  plane the moon already flies in — so it is evaluated rather than integrated (nothing to drift)
  and its ground track crosses latitudes instead of tracing the equator. A lap takes 150 s at
  altitude 220: above the saucer's band, above the landing ships' entry altitude, and well inside
  the aeroplane's ceiling, so it can be climbed to.
- **`SUN_BETA` means it is never eclipsed and never fully front-lit**: the sun sits 74° out of
  that plane, so the dot of the sun with its position never exceeds ~0.28. Permanent daylight,
  always from the side.
- **Its lamps are sized for distance, not for the model.** At 250 units a half-unit sphere is one
  pixel and blooms into nothing; over the night side the lamps are the only part of it there is.
- **The ring turns and its lamps turn with it.** A bare torus is rotationally symmetric, so a
  spin nobody can see is a spin that need not exist.

And the landing ships, in `fly/landers.ts`:

- **Forty seconds from appearing to touchdown, and that clock is the whole of them.** Land and
  the ship is gone; shoot it first and it explodes. The intention is still that letting them land
  eventually costs you the game, which is why the countdown is the loudest thing on screen.
- **It now takes `LANDER_MAX_HEALTH` hits, not one — twelve.** The laser fires six times a
  second and a ship on a straight approach was an easy thing to keep pointed at, so a single hit
  made the forty-second clock really mean "forty seconds to notice it exists". Twelve is two
  seconds of sustained fire at the laser's own cadence: against a forty-second approach that is
  real commitment, not a click in passing, without being the grind twenty was when it was tried.
  `hit()` tolerates being called any number of times past zero, the same guard it always needed
  for two bolts landing in one frame.
- **The health bar floats over the ship, not in the corner alert panel.** It was there first,
  under the countdown, and that put it somewhere you were not looking: a ship you are actually
  aiming at is on screen, not in the top-left panel. `updateLanderHealthBars()` projects a point
  `LANDER_BAR_OFFSET` above each live ship — along its own local vertical, not its mesh's "up",
  which on a descending ship points at the ground — the same load-bearing after-the-render
  ordering as the reticle. Plain on purpose: no glow, no box-shadow, no animation. The alert
  bar's own countdown fill is the thing here that is meant to shout; this only has to say the
  hits are landing.
- **Kills are counted; landings are not.** `Landers.downed` is a tally of what the *player* did,
  so a ship that reaches the ground does not touch it, and `reset()` zeroes it with everything
  else. It shows as `N down` in the instrument pill beside speed and altitude — deliberately in
  the dim corner readout rather than anywhere near the alert bar, because it is a fact about the
  session rather than something to play against. There is still no score in the sense the
  "no score, no timers" line means: nothing rewards it, nothing is lost by it, and it does not
  gate anything. The HUD is written only when the number changes.
- **They shoot back, and this reverses the "unarmed" note that used to sit here.** The saucer
  stays unarmed on purpose (see below); a landing ship under fire returns it while it is still in
  the air, through the same `fly/bolts.ts` pool the player's own laser is — a second `createBolts`
  instance, cold green instead of warm, tuned slower and sparser via `BoltsOptions`. A ship's own
  `FIRE_INTERVAL` is currently 0.9 s — under a second, so lingering in front of one is genuinely
  costly — but the *combined* rate from every ship in the air is separately capped by that pool's
  own `interval` (0.28 s), which is what keeps three inbound ships from tripling the incoming
  fire. `FIRE_RANGE` (220) keeps a ship from sniping across a hemisphere, and a random initial
  `fireCooldown` on spawn stops a ship opening up the instant it appears.
- **`LANDER_HIT_DAMAGE` is 15, not the 7 it launched at.** Seven read as sniping rather than
  fighting back, especially next to the fast cadence above; at 15 seven hits brings a fresh
  aircraft down, which is real stakes for standing in front of a ship and trading shots. The
  aircraft's own health, `PLANE_MAX_HEALTH` (100) and its floating bar, live in `fly-view.ts`
  (see "The player's own health bar" below) — this is the file that first gave that bar a reason
  to move.
- **A recovered repair pack is what undoes this**, which is the "if damage is ever added" that
  `fly/packs.ts`'s header was written for before there was any. `PACK_HEAL_AMOUNT` is 60, so two
  packs make a fresh aircraft whole exactly — matched to how much harder the fire that damages
  you got, not to the old 7-damage number, and kept a clean multiple of `PLANE_MAX_HEALTH` when
  that went up 20% (100 to 120).
- **A boost ring heals too, `RING_HEAL_AMOUNT` a hoop — a quarter of the tank — and unmarked.**
  It is on top of the boost the ring already gave, not instead of it: going fast and staying in
  the fight are the same errand now. Four rings, a third of one stack, make a fresh aircraft
  whole. Two things were tried to say so in the hoop itself — a plain cross, then the repair pack
  scaled up and tumbling — and both were pulled: the heal reads better as a quiet bonus on a ring
  you were already flying to, not a second thing competing for attention with the ring's own
  lamps. It happens whether you were damaged or not; healing at full health just clamps there.
- **There is no lead prediction, on either side of this fight.** A bolt travels in the straight
  line it was fired along; it does not re-aim at where the target will be. That is consistent
  with the player's own gun, which does not lead the saucer either, and it is also honestly the
  reason a lingering, drifting aircraft under autopilot alone can go untouched for a long
  time — the shots that land are the ones taken at a target that is not moving much *across* the
  line of fire, which in practice means close range and a head-on approach: exactly the geometry
  of actually finishing off a kill.
- **The alert bar across the top is that clock, and it is the one thing here that shouts.**
  One row per ship — its mark, the country it is coming down on, the seconds left — bold,
  uppercase and green, turning warm amber and pulsing under ten seconds. The bar hides itself
  when nothing is inbound, and its right end is padded clear of the mode switcher, which floats
  over it. Everything else in this view is a dim pill in a corner on purpose; this is not.
- **A ship never comes down in the ocean, and that is structural rather than checked.** The site
  is a row out of `fly/places.ts` — a country and a coordinate well inside it — so there is no
  land mask to consult and no random point that might turn out to be sea. The name on the
  countdown comes from the same row, so the label cannot disagree with the place.
- **Both ends of the approach are places on the ground, not points in space.** They are stored
  as latitude and longitude and turned back into world positions every frame through
  `Space.worldFromLatLon()`, the inverse of `surfaceUv`. Held in world space instead, the target
  would drift about nine degrees west of its own country over a forty-second descent, and the
  ring on the map would slide off the coastline it was aimed at.
- **A ship you shoot leaves a repair pack; a ship that lands leaves nothing.** The callback fires
  from `hit()` and not from the landing branch, which is the same distinction the kill counter
  draws — see `fly/packs.ts`.
- **Landing is not animated; being shot is.** A ship that reaches the ground is simply not there
  any more — no landing sequence, no touchdown, no flash — because nothing you did caused it. A
  ship you *shoot* explodes: `createBurst()` in `landers.ts` throws an additive shell out to 26
  units over 1.1 s with fourteen tumbling shards inside it. It is deliberately bigger and longer
  than the saucer's pop (0.7 s, and no debris at all) over a hull half the size, because the
  saucer is a target of opportunity and a lander is the payoff for a flight across a continent.
  This reverses the original "no explosion" note, which had the two events sharing one treatment;
  they are not the same event.
- **A burst outlives the ship that made it**, so it is built per ship, parked invisible like the
  bolt pool, and ticked from `update()` *outside* the active check — otherwise it would freeze
  mid-expansion the instant the ship it belongs to stopped existing, which is immediately.
- **The approach is a straight line and a linear descent** — `lerp` between the two directions
  then `normalize`, rather than a proper slerp, which over the two thirds of a radian this
  covers agree to well under the ship's own width — from 150 units of altitude down to 1.5.
- **Three of them, staggered nine seconds apart on the first pass**, each with its own 8-20 s
  wait before the next appearance, so the map usually has one or two paths on it and they do not
  all arrive at once.
- **The bolt pool takes a list of targets now**, walked per bolt: a couple of dozen bolts against
  a handful of targets is cheaper than any structure that would avoid the loop. Each target's
  `hit()` has to tolerate being called twice, because two bolts can land in the same frame.

### The player's own health bar

`PLANE_MAX_HEALTH`, `updatePlaneHealthBar()` and the `#fly-plane-health` markup, all in
`fly-view.ts` / `index.html`.

- **It floats over the aeroplane, the same way a landing ship's floats over it** — a HUD element
  in a corner would put your own condition somewhere you are not looking while you are the thing
  being shot at. Only one aircraft ever exists, so unlike the landing ships' bars (one array,
  built per ship) this one is markup, `#fly-plane-health`, written directly rather than
  constructed in JS.
- **It is anchored to the aircraft's *own* up, not the local vertical.** A landing ship sits
  still relative to the ground it is over, so anchoring its bar to the radial "up" at its
  position is enough. The aeroplane banks constantly; anchoring to world "up" would swing the bar
  out to one side of the fuselage in every turn instead of staying parked over it the way the
  chase camera expects. `PLANE_BAR_OFFSET` (3 units) clears the tail fin, the tallest point on
  the model.
- **Same after-the-render ordering as the reticle and the landing ships' bars, for the same
  reason**: `Vector3.project()` reads `camera.matrixWorldInverse` without refreshing it, and the
  camera has just moved this frame.
- **It was invisible on first landing, and the bug is worth remembering.** The landing ships'
  bar layer, `#fly-lander-health`, was `position: absolute` with no size and no inset — which
  collapses to a zero-size box at its static position — and every bar inside it is *also*
  `position: absolute`, so their percentage `left`/`top` resolved against that zero-size
  container instead of against `#fly-view`. Every bar landed pinned to the same point instead of
  tracking its own ship. The fix is `inset: 0` on the layer, so it fills the view and the
  percentages mean what they say. `#fly-plane-health` never had this bug because there is only
  one of it and it sits directly under `#fly-view`, the positioned ancestor, rather than under an
  intermediate layer of its own.

### Losing

`destroyed`, `DEFEAT_MESSAGE`, `planeBurst` and the top of `update()`, all in `fly-view.ts`.

- **Zero health explodes the aircraft and stops the flight, and this is the one consequence
  written in for reaching zero.** `planeTarget.hit()` sets `destroyed` once health has nowhere
  further to go, hides `plane`, fires `planeBurst` at its last position and puts up
  `DEFEAT_MESSAGE` through the command post's own message line, the same one `BRIEFING` uses to
  open the view.
- **The message has to say how to get out of the state it just put you in, and the first version
  didn't.** A frozen scene with no other on-screen prompt gives no hint that Space is the way
  back, so `DEFEAT_MESSAGE` is two sentences: "The fight for Earth has been lost. Press Space to
  fly again." The corner legend is told too — `spaceLabel` swaps "laser" for "restart" for as
  long as `destroyed` is true, because that permanent legend is the one other place on screen
  that claims to say what Space does, and leaving it saying "laser" over a gun that no longer
  exists would be its own small lie. `reset()` swaps it back.
- **The explosion is `fly/burst.ts`**, a module that used to be private to `fly/landers.ts` and
  was pulled out once a second user for it turned up — the same move `fly/bolts.ts` went through
  for the landing ships' return fire (see "And the landing ships" above): a burst does not care
  who died any more than a bolt cares who fired it. The aircraft's own is warm rather than a
  landing ship's cold green, and bigger and a little slower (34 units / 1.4 s / eighteen shards
  against 26 / 1.1 s / fourteen), because this is the one explosion here that ends the flight
  rather than removing one target among several.
- **`update()` returns immediately once `destroyed` is set, after ticking `planeBurst` and
  nothing else.** Every other moving part — the landers, the saucer, the rings, bolts already in
  the air — holds exactly where it was, because their own `.update()` calls live in the same
  function and never run again until `reset()`. This is a considered choice, not the cheapest
  possible one: keeping the world alive around a plane that is no longer there would need every
  one of those systems taught to ignore a gone aircraft, for a state that is about to be reset
  anyway. A held frame reads as a stopping point; a frame that quietly keeps going reads as a
  bug.
- **Space restarts, and it is read from the keydown event, not from `keys.has('Space')` in the
  render loop.** The key is very likely still physically held — it is the trigger, and a death
  usually happens mid-volley — so a level-triggered check in `update()` would call `reset()` on
  the very first frame after the explosion starts, before there was any chance to read the
  message. `onKeyDown` checks `destroyed` before adding the key to the held set at all, so the
  same press neither restarts twice nor leaves Space stuck "held" into the new flight.
- **The message survives being frozen, because the code that would end it is what got frozen.**
  `say()` just starts a countdown (`messageLeft`) that a later, different part of `update()`
  ticks down and eventually clears — the same part that never runs again once `destroyed` is
  true. No sentinel value, no special-casing in `say()` itself: the message outlives its own
  timer for the boring reason that the timer stopped being wound.
- **`start()` has to choose which message to show, because `stop()` takes any message down with
  it.** Switching away mid-defeat and back would otherwise reopen the view with the aircraft
  still gone, still uncontrollable, and nothing on screen explaining either — so `start()` shows
  `DEFEAT_MESSAGE` again rather than `BRIEFING` if `destroyed` is still true. `reset()` is what
  actually clears the flag; merely returning to the view does not forgive a death.
- **`reset()` is the only way out**, and it undoes every part of dying in one place: `destroyed`
  false, the aircraft visible again, `planeBurst` hidden, the message panel closed, health back
  to `PLANE_MAX_HEALTH`, alongside everything else it already put back for an ordinary restart.

### The parking game

`src/park-view.ts` and `src/park/`, and nothing else in the repo touches any of it. Two decisions
govern everything below and neither is cosmetic.

- **The board is a fixed 360 x 640 field, letterboxed.** Every number in the game — the car's
  length, the target's half-width, the error you are scored on — is in board units, and one
  transform in `render()` maps the whole field onto the canvas. This is not about looking right
  in portrait. It is what makes two runs the *same run*: the stated goal for this scene is
  eventually to be able to say "here is how close you got on level 7, and here is how close
  everybody else got", and a board that stretched to the viewport would make a four-unit miss a
  different achievement on a phone and on a desktop. Letterboxing is the price and it is cheap.
- **The ladder is a pure function of the level number.** `park/levels.ts` may not call
  `Math.random()` — the speed, the target's size and position, the oil slicks and the bonus zone
  all come out of two curves and a 32-bit integer hash of *n*. A single random call in there
  would look identical on screen and would quietly delete the comparison the board was shaped
  for, along with any hope of going back to beat your own stage record. `dev/park.mjs` asserts
  the ladder is byte-identical across two page loads, which is the only way that stays true.

And the rest of it, in the order it bites:

- **The whole field is visible and the camera never scrolls.** You see the car, the gap and the
  target from the moment it launches, which is what makes the tap a judgement rather than a
  reaction — the feeling the scene is for. The cost is a 308-unit track, which puts a hard
  ceiling on speed: at 260 u/s there is well under a second of approach and no room for more. So
  **difficulty is carried by the clearance shrinking**, 36 units either side of the tyres down to
  4 — a nine-fold squeeze — while the speed curve asymptotes short of unwatchable. The five rungs
  a session actually uses give tap windows of 686, 246, 102, 48 and 34 ms; the last is about where
  human timing precision runs out, and exactly where five rounds should finish. **Both curves are
  much steeper than they first were**, and that is a correction rather than a taste: the original
  pair took twenty rungs to become interesting, which in a game whose whole appeal is the instant
  of a tap is nineteen too many.
- **A rating band has to be measured against the perfect band, not only against the clearance.**
  At the top of the ladder a quarter of the clearance is *narrower* than the perfect band itself,
  so `GREAT` — tested after `PERFECT` — had a window entirely inside it and could never be
  awarded. It takes the wider of the two now. Worth remembering before any further tuning of
  either curve: the shrinking target eventually crosses every fixed threshold in the file.
- **The stop is instantaneous, and back-dated to the tap.** There is no braking curve and no
  skid, because either would put a second skill between the tap and the result when the tap *is*
  the result. More importantly the car's position is computed from the *event's* own timestamp,
  not read at the next animation frame: at 255 u/s one frame is over four board units against a
  level-20 half-width of 4.6, so sampling at the frame would hand the whole zone to the frame
  clock and no amount of skill would get it back. `MAX_BACKDATE_MS` caps how far that
  interpolation is trusted, so a stale or synthetic timestamp cannot teleport the car. What the
  player gets instead of brakes is weight — a nose dip, tyre smoke, a squash — all of which are
  cosmetic and none of which move the judged number.
- **The win condition is the whole car inside the bay, and the ladder is built out of that.**
  The judged point is the car's centre — one number, and the only one a tap can move — but the
  band it has to land in is the round's **clearance**, which is the bay's half-width less
  `CAR_HALF`. So `park/levels.ts` shrinks the clearance, 36 units down to 4, and the bay itself
  only goes from 130 units wide to 67. It can never go below 58: **a bay shorter than the car is
  not a hard bay, it is an impossible one.** An earlier ladder shrank the *bay* to ±4 and judged
  the centre alone, which worked only because the car's own size was not in the question — and
  that is what made the target read as a mark to aim at rather than a space to fit into.
- **It was the tyres for a while, and the car's outline is better.** `WHEEL_X + WHEEL_R` is 27.5
  against a 29-unit half-length, so the bumper legitimately overhung a bay the game called
  parked, and the rule needed a sentence to explain. The car's own silhouette needs none — you
  can see whether it is between the lines — and it takes the drawing and the scoring off two
  different measurements of the same object. Nothing drawn may now stick out past `CAR_HALF`;
  `dev/park.mjs` asserts the wheels do not.
- **The wheels are symmetric about the car's centre.** They were drawn at -16 and +17 while they
  were only ever decoration, and a car whose centre is not the midpoint of its own drawing is one
  whose judged number sits half a unit out in one direction forever.
- **The nose dip is a vertical shear, not a rotation, and that is a correctness fix.** The bay is
  measured against the car's outline, so **anything that changes the car's drawn width is a
  scoring bug, not a visual one** — the player checks "is it between the lines" by eye, and a
  drawing that narrows under the brakes puts a car genuinely over a line inside it. A rotation
  does exactly that: it used to swing the axles in by **1.7 units** at the crash tilt, 40% of the
  last round's clearance, and "it said missed and the car was in" was the entirely reasonable
  conclusion. `transform(1, k, 0, 1, 0, 0)` maps (x, y) to (x, y + kx), so every point keeps its
  x: the nose drops, the tail lifts, and the footprint is provably untouched at any tilt. The
  wheels sit outside it and stay on the road, which is also what a suspension does.
- **The nose dip was pointing the wrong way.** Canvas y runs *down*, so the negative tilt that
  called itself a dip was lifting the nose under braking. `NOSE_DIP` is positive now.
- **The bay's two lines are painted outside the judged edges, not inside them.** Drawn inward —
  which they were — five units of paint at each end meant the gap you could see between the lines
  was ten units narrower than the space the judge measured, so "both tyres between the lines" and
  "both tyres in the bay" were two different rules and a marginal call could look wrong either
  way. Outside, the inner edges of the paint *are* the boundary.
- **A failed round marks the line it crossed in red and the end of the car that crossed it in
  white.** This is not decoration: at the last round's 4.3 units of clearance, missing by a tenth
  of a unit puts the bodywork a tenth of a *pixel* past the paint, and an honest verdict on a stop
  like that is indistinguishable from a bug. The mark is the difference between "the game is
  wrong" and "oh — that end, that line". White rather than red on the car, because red bodywork
  against a red line is three ways of saying nothing.
- **The block stands directly after the bay, and `BLOCK_GAP` is as small as the geometry
  allows.** `failLine` is `bay far edge + BLOCK_GAP - CAR_HALF`. With the whole car measured the
  bumper and the judged edge are the same line, so the band between "your nose crossed the paint"
  and "your nose hit the wall" is exactly `BLOCK_GAP` on every round — `dev/park.mjs` asserts that
  identity rather than a range, which is the tightest form the invariant has ever had.
- **It was 24, and crashing was then almost impossible.** You had to overshoot the bay by most of
  a car length to find the block, so in practice every failure was a miss and the block was
  scenery. The rule now is simply **stop short and you miss, go past and you hit it**: four units
  is sixteen milliseconds at round five's speed.
- **The cheaper failure is the early one, and that is deliberate.** A miss costs 40 and a crash
  60, so the whole session is played a fraction early on purpose — which is exactly how anyone
  parks a real car towards a wall. Because the block is fixed to the bay's far line and the bay
  narrows every round, the space you may stop in closes from the left as the session goes on,
  with the wall staying where it is.
- **The bay never starts where the car does.** At level 1 it is 127 units wide on a 308-unit
  street, and without `BAY_CLEAR` the near line would land behind the start line and the car
  would begin the level already parked. That constraint binds at the bottom of the ladder and the
  roll-time one binds at the top, which is why `minCentre` is a `max` of the two.
- **The bay is drawn as a bay — a wash of colour between two bold end lines — not as a block of
  hazard chevrons.** The chevrons were right while the target was something to aim the middle of
  the bonnet at. They are wrong for a space to fit into, where the two lines and the gap between
  them are the entire question, so the fill dropped back and the ends took the weight. The centre
  mark survives as a faint dashed tick, because it is what the score is measured from rather than
  what you have to hit.
- **There is no precision ruler, and its removal is the reason the board is 512 tall rather than
  640.** A hundred units above the mat carried the level's clearance blown up to the full width of
  the board, with a dashed bracket for the stage record and a tick for where the car stopped. It
  was the densest thing on the screen and it did not read: a second, magnified coordinate space
  stacked over the real one, which people took for a progress bar. **The mat says the same thing
  in the only frame that matters — the car sitting between two painted lines** — and everything
  the ruler added was a restatement of that in a space nobody had been taught. Its ghost bracket
  became `personalBest` on the verdict: "your best here", a fact rather than a figure.
- The street is *drawn* only as far as the block, which is also why it visibly lengthens as the
  levels place their bays further out — a street carrying on past the thing that ends it makes
  the block read as an obstacle in the middle of it rather than as the end of it.
- **A session is five fixed bays and you always play all five. This is the load-bearing decision
  and it took two wrong turns to reach.** There are exactly two structures that produce a number
  two strangers can compare: a *variable* length whose score **is** the length (Flappy Bird — a
  count of pipes, comparable because the unit repeats), or a *fixed* length scored on quality
  (Dialed.gg, and this). The game was neither for a while — endless with one life, scored on
  total distance with lower being better — under which quitting on round one with a tidy stop
  beat a flawless run to round twenty, and the only honest comparable number the structure could
  produce was "how far did you get". Before that, failing had no consequence at all: a stop
  nowhere near the bay scored a little and advanced you anyway. **A fixed denominator is the fix,
  and the one-life rule is what had to go for it.** `SESSION` in `park/levels.ts` is the five
  rungs, spread across the ladder rather than taken off the bottom of it, so one session runs from
  686 ms of tap window down to 34 ms.
- **A failed round costs a flat penalty, not the distance it missed by.** A failure has to score
  *something* or the total is meaningless, and the distance actually missed by can be two hundred
  units if you stop at the start line — one flubbed round would swamp four good ones and the
  session score would be a record of your worst moment. `MISS_PENALTY` is 40, more than the widest
  round can score by parking badly (round one's clearance is 36), so failing is always worse than
  any successful park however sloppy; `dev/park.mjs` asserts that against the session's own
  widest clearance rather than trusting the comment. The verdict still shows the *real* distance
  as feedback; the results screen shows what the round cost. Those differ on a failure, and the
  word next to the number is what makes that legible.
- **`CRASH_PENALTY` is 60 — a crash costs half as much again as a miss, because it is worse.**
  Stopping outside the bay is bad parking; putting the bumper through the block is bad parking
  *and* hitting something, and charging the same for both says the block is scenery. It also
  gives the two failures different shapes to play against: overshooting long is cheaper than
  overshooting into the wall, so a round that is already lost still has something left to get
  right. Five crashes cap a session at 300.
- **The score is the distance, and lower is better.** `error` — how far the car's centre finished
  from the bay's centre, in board units — is the whole of it. There is no points formula: there
  used to be one (a thousand times a squared falloff of the nearness, plus a five-hundred perfect
  bonus, all of it multiplied by a zone multiplier) and it was three arbitrary constants standing
  between the player and the one fact the game actually measures. `PERFECT` / `GREAT` / `CLOSE`
  survive as *feedback* — they pick the colour and fire the confetti — but they are derived from
  the distance and they are not a second score.
- **The session's figure is the total distance, which only ever goes up.** The header calls it
  `TOTAL OFF` rather than `SCORE`, because a number labelled "score" is one a player assumes they
  want large, and this is the opposite. It sits beside `ROUND 3/5` — **the denominator is on
  screen the whole time**, because it is the entire reason the total means anything. A best total
  is a legitimate record now and `park/best.ts` keeps one; it was refused while the game was
  endless, because totals over runs of different lengths cannot be compared and a run that failed
  on round one with a tidy stop would have held a "best" no honest session could ever beat.
- **The two failures differ only in what they look like.** `CRASHED` is the car past the fail
  line and into the block: debris, a toppled block and a hard shake. `MISSED` is a car parked
  politely in the wrong place: a puff of smoke and nothing else. They cost differently too — see
  `CRASH_PENALTY` — and the verdict names which it was.
- **The results screen is its own screen, not a panel over the mat.** A summary laid on top of
  the parked car covers the one thing worth looking at — a run-ending card did exactly that once
  and was deleted for it. **Don't put a modal over the mat.** The results are fine as a full
  screen because by the time they show, the last round's verdict has been and gone and there is
  nothing underneath left to read. They carry the total, whether it beat the stored best, and a
  row per round: number, rating, and what it cost. The breakdown earns its place — a total of 53
  built from five sloppy stops and one built from four good stops and a miss are very different
  sessions, and the rows say which round to go back for.
- **A failed round's penalty counts towards the round record but is not announced.**
  "Your best here" printed under a word that has just cost you forty units reads as
  congratulation for failing.
- **`reset()` starts a fresh session and is the only way out of `results`.** Round 1, the total
  and the per-round scores cleared, effects cleared. Nothing carries forward except what
  `park/best.ts` wrote to disk.
- **There is one bay on the street and nothing else, and this reverses two earlier features.**
  Oil slicks on the approach — patches you must not stop on, which slid the car on if you did —
  and a small 3x zone beyond the main one both existed and both are gone. Each was defensible on
  its own and together they were the problem: three things to read in the half-second before a
  tap that is only ever about one of them, on a screen already carrying too many numbers. A
  street with patches on it also stops looking like a street. **Everything is the parking zone
  now** — how wide it is, how far away, and how fast you are going at it — and difficulty comes
  from the two curves alone. Don't reintroduce a second scoring target or a hazard on the tarmac;
  that is the history you would be arguing with.
- **The mat carries nothing printed on it either.** It briefly had a tape measure under the
  street, unnumbered graduations for a sense of scale. It went with the rest: the verdict under
  the mat is where a distance is read, and the mat's job is to be the thing the street lies on.
- **There is no run-history strip.** A row of small bars along the bottom of the verdict showed
  every stop of the run as a height. It said nothing a player could act on and read as a chart
  nobody had asked for.
- **The `ready` phase exists so the target can be read before anything moves.** Each level parks
  the car at the start line and waits for a tap to launch. Without it the first thing you would
  do every level is look at where the target is while the car was already rolling towards it.
- **`arm()` clears the last verdict, and forgetting to was a real bug.** The verdict is drawn
  whenever the phase is not `ready`, so a `result` left lying around reappeared
  the instant the *next* level was launched: the previous stop's word and distance, under a car
  that had not been anywhere yet. It looked like the game was scoring you before you had done
  anything. The fix is one line in `arm()`, and the harness now asserts `result` is null once a
  level advances.
- **`INPUT_LOCKOUT` is not politeness.** The tap that stopped the car is very often still on its
  way up when the verdict lands, and without the lockout the same press would stop the car and
  launch the next level.
- **`stop()` re-arms a level that was mid-roll.** Switching away and back would otherwise return
  you to a car still rolling towards a target you have not looked at since. The run and the score
  are kept; the launch is not.
- **This is the repo's only `localStorage`**, and `park/best.ts` carries the reasoning: one
  versioned key, every access in a `try/catch` because the property access itself throws in some
  private-browsing modes, and a malformed record treated as no record. `bestError` — the smallest
  distance on each level, in board units — is the leaderboard-shaped half of it. **Nothing on
  screen reads it back any more**, now that the ruler that drew its ghost is gone; what the player
  gets is `personalBest`, the one-bit answer to "was that your best here". `errorFor()` stays as
  the read side so the data is not orphaned, and `best.ts` says so. The key is at `v2`: `v1` also
  held a best run *score*, which could not survive the score becoming a distance, and there was
  nothing there worth migrating.
- **Effects are drawn under the car, not over it.** Dust and tyre smoke belong beneath the thing
  that threw them; drawn on top they read as mud on the paintwork, which is exactly what the
  first pass looked like.
- **The DPR cap is 2 even on a coarse pointer**, unlike `fly-view.ts`, which caps at 1.5. That cap
  is there because nearly every pixel in flight view is shader work under a bloom composer; this
  is a few dozen flat fills, and crisp text at arm's length is worth more than the fragments.
- **There is no sound**, deliberately: `src/audio/` is CC0-only by policy and view-owned, and a
  satisfying stop wants a real sound pass and a licence check rather than a file dropped in.
- **`node dev/park.mjs`** is the harness, and it exists for the two things no screenshot can
  show: that the ladder is deterministic, and that the stop is back-dated. It also walks the
  ladder asserting every bay is on the street and wider than the car that has to fit in it, that
  none starts where the car does, that every fail line leaves room for the block and every bay's
  far end is reachable before the bumper meets it, and that every level gives at least
  `MIN_ROLL_SECONDS` of approach. It also drives the win condition at its own boundary — a tyre
  on the line is in, a tyre a tenth of a unit past it is out — through `tapAt`, so that is tested
  through the real judging rather than by doing the arithmetic twice. It prints the ladder as a table with
  each level's tap window in milliseconds, which is the number the curves are really tuned
  against. Like `shots.mjs` and `walk.mjs` it is not wired into `npm run build`.

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
| `planet-minimap-1024.webp` (1024×512, 59 KB) | — | same day-map record | downscaled from `planet-day-8k.webp` |

So the 4k set is 1.2 MB and the 8k set 2.9 MB.

The minimap file is in no set and is not a `MAP_SETS` entry: it is the flight view's flat map of
the world, and it is the one texture here reached from **CSS** (`url()` in `#minimap::before`)
rather than imported from TS. Vite content-hashes and rewrites a CSS `url()` exactly as it does
a TS import, so the deployed `/games/` sub-path still works; it is loaded that way because
nothing in the TypeScript ever needs to know the file exists. It is deliberately independent of
the 4K/8K switch — a 272 px panel has no use for a bigger map, and the minimap should not change
under someone who was only choosing how much of the *planet* to download. **Clouds have no larger version** — NASA
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
- **The two layers have two different owners, and that is the design.** The bed is the *room*:
  it comes up with the view, stays up the whole time you are aboard, and the radio has nothing
  to do with it — a pressurised hull hums whether or not anybody fancies listening to it, and
  that hum is most of what makes the place feel inhabited. The music is the *radio's*, and it
  starts off; switching the radio off leaves the hum running. This reverses an earlier note
  ("the radio kills both layers, or the switch does not read as a switch"), which was written
  when *all* audio was off by default and the radio was the only way to hear anything. With a
  hull hum as the baseline the reading changes: the radio is a radio, not a mute button for
  the station. Don't quietly put them back under one switch.
- **A layer is not fetched until it is wanted.** No `src` is assigned for the bed until
  `setEnabled(true)` or for the music until `setOn(true)`, so a visitor who never touches the
  radio downloads the bed and nothing else — which matters, because `music/` is much the
  larger of the two.
- **M is a shortcut to the radio, not a second control.** `planet-view.ts` binds it to the same
  `toggleMusic()` the unit on the table calls, so the indicator can never disagree with what is
  playing.
  It adds no HUD element, which is the line the "diegetic controls" roadmap item actually draws
  — a key you cannot see is not screen furniture. Gated on the view running, or a keypress aimed
  at the asset viewer would flip the radio behind its back. There is no M key on an iPad, which
  is why the unit on the lounge table stays the control this is a shortcut *to*.
- **`available` is about the music only.** `station/index.ts` reads it to decide whether the
  radio is offered as an interaction target at all; a radio with an empty `music/` should not
  be, even though the bed is playing. `buildLounge()` supplies that target now — it used to come
  from the office.
- **Nothing is persisted.** Every visit starts with the radio off. Persisting "on" is three
  lines, but the browser would refuse to autoplay it before a gesture anyway, so the stored
  state would be a lie half the time.
- **Everything in `bed/` plays at once and repeats; `music/` is a shuffled playlist.** The old
  system layered every file in `nature/` because a forest is many sources — a pressurised hull
  is one, so the bed is expected to be a single file, and currently is (`station-drone.mp3`).
- **The bed repeats by crossfading into itself, not with `el.loop`.** An MP3 carries encoder
  padding at both ends, so `loop` inserts a short silence every time round — a tick every two
  minutes, forever. `repeatBed()` builds a fresh element from the same URL and crossfades, which
  hides the padding and covers a source whose own loop point is untidy too. It shares
  `crossTo()` with the playlist's track change; the tail check for both lives in `update(dt)`.
- **The playlist is advanced from the render loop's `dt`, not a `setInterval`.** The old
  `scheduleCrossfade()` polled every 500 ms for the life of the page even with the view parked.
  Driving it from `update(dt)` in `tick()` means it stops exactly when the view does.
- **Fades use `requestAnimationFrame`, not that same `dt`.** The most important fade is the one
  on the way out, and by then `stop()` has already cancelled the render loop. Volume is plain
  linear `HTMLAudioElement.volume` — no WebAudio, so there is no `AudioContext` to unlock.
- **Keep the folder under ~4 MB.** It downloads on top of the surface maps. `music/` is
  currently ~22 MB and over that line — tolerated only because it is now an opt-in download
  that nothing fetches until the radio is switched on. The fix if it ever needs to shrink is
  re-encoding the three tracks to 96 kbps (`ffmpeg`, per `src/audio/CREDITS.md`), which would
  bring them to roughly 3-4 MB. The bed has to stay small on its own terms: it *is* fetched
  on arrival, on top of the maps.
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

**The station is a place to inhabit, not a game.** The long-run shape is: move around on board,
and eventually go outside in a suit on a tether — but never really leave. The design goal is
*presence*. **No score, no timers, no objectives, no collectibles.** Those would work against the
only thing that makes a place worth standing in.

**That rule is about the station, and the other scenes are outside it.** It is worth saying
plainly, because the exceptions have been growing and pretending otherwise would make the rule
useless where it actually matters. The asset view is unaffected — it stays the plain preview tool
it has always been. The flight view is not the station: it has a saucer to shoot at, landing ships
that shoot back, a lander countdown, boost rings, health bars for both sides of that fight, a
tally of landers brought down and a way to lose. Even there the line held loosely — no score, no
timer counting up, no reward for anything done right, only a consequence for what the landing
ships do to you.

**Precision Parking breaks it outright, and that is the point of it.** It is a score game with a
level ladder, a personal best, one life and a stated ambition to compare stages between players.
Nothing about it is meant to migrate inboard: it is a toy on a mat in its own hash, sharing no
code, no world and no lighting with the station, and it exists partly *because* keeping it
entirely separate is what lets the station go on being a place rather than a thing to do.

**Real outside, warm inside.** The NASA Earth stays photoreal in the window; the warmth and
softness go into the station, not onto the planet. The contrast is the point — a cluttered
warm human box with something sublime out of the window, which is what the ISS actually is.
So: don't restyle the planet (see "The surface is the NASA maps, untouched" above), and don't
leave the interior a bare box.

The interior is where the effort is owed. Ranked by presence gained per hour of work:

1. **Fit out the hall.** *Started; the shell is right and the lounge is done.* The lounge is now
   upholstered rather than blocked out — a dais, a U of couch with cushions, a rolled back, arms
   and throw pillows, a table with the radio and a plant on it — and it is the pattern for
   everything else: authored around the origin, placed by one constant, returning its own box
   chain for `obstacles`. Upstairs is still bare: a console and a globe and nothing else. Still
   wanted: a hatch, stowage, floor grating, and something on the bridge besides the console. Each
   is a new module beside `lounge.ts`, returning its own footprints (tagged with a storey).
   Note where they can go: the canopy starts at z = 1.8, so anything mounted to a wall or a roof
   has to live aft of that, on the mezzanine or under it. The reference sheet puts its stowage
   and its hatch exactly there, in the wall below the mezzanine, and that is the one stretch of
   solid interior wall the station has.
2. **Relight it warm — and then dimmer.** *Largely done, and now constrained by the glass.* Every
   light aboard is warm: the lounge table's lamp, the globe's emitter, two under the mezzanine,
   two over the bridge deck and a pair on the seam hoop. The cold roof points that read clinical
   are gone — not for warmth but because they ended up inside the canopy — and the desk lamp went
   with the desk. The last pass took the *floor* out of the light budget entirely: the four rim
   points deleted, every floor-level strip dropped below the bloom threshold, the seam pair and
   the table lamp cut roughly in half, and `planetShine` raised to carry the forward hall
   instead. The forward half is deliberately dim now and the aft half, which is roofed by the
   slab, is where the remaining warmth is. Judge it against that: a frame in which the deck is
   brighter than the Earth is the failure mode this was fixing.
3. **Use `ai-assets/`.** The blueberry bush and chanterelle already committed there become a
   hydroponics tray and a mushroom log. A growing thing aboard a station is exactly the detail
   that says someone lives here, and it connects the repo's two halves.
4. **Diegetic controls.** *Largely done.* The radio was the pattern — a switch with an
   invisible aiming box and a stateful label, and **no HUD element at all** — and the
   navigation console followed it: altitude, horizon, bearing, orbit mode and the clock are
   seven keys you walk up to the bridge to press, and the HUD they used to live on is gone.
   Only the texture-quality dropdown is left off the console, because it is a download rather
   than a thing the station does.
5. **Sound.** *Started.* `audio.ts` is the old game's two-layer design rebuilt — a room-tone bed
   under a crossfaded music playlist — but with the bed running whenever you are aboard and the
   music behind the radio in `station/radio.ts`, and discovered with `import.meta.glob`
   rather than the old `virtual:audio-manifest` plugin. See "Ambient audio" below. Both folders
   now have files (a CC0 station drone, three CC0 synthwave tracks); an empty folder is still a
   supported state. The retired implementation is still in git at
   `git show 29d1246^:src/audio.ts` if the old crossfade is ever wanted back.
6. **EVA.** `fpv-controls.ts` is better positioned for it than it was: `decks`, `obstacles`
   and `eyeHeight` are injected, the Y axis is already driven by data rather than pinned to a
   constant, and anything parented to `stationRig` floats along for free. Going outside is a
   second controller mode — free Y entirely, swap the deck clamp for a tether sphere — plus a
   hatch and an exterior hull to look back at. Keep floor-clamping out of anything new and it
   stays cheap.

## Notes for whoever picks this up
- The asset view is a utility — keep it simple there, "clean and readable" is the whole brief.
  The planet views are held to a different standard; see "Where this is going" above.
- If the gallery grows large or assets get much bigger, revisit: lazy-loading thumbnails,
  a loading spinner during `viewer.load()`, and possibly Draco/meshopt compression for
  the `.glb`s themselves (`GLTFLoader` supports both via extra decoder setup, not wired
  up yet since the current handful of files load fine uncompressed).
