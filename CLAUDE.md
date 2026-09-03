# 3D Asset Viewer — project brief & working notes

> This repo was previously a narrative game, *Vuodenkierto* (working title *Suvanto*
> before that). That project has been fully retired — its code, art, and design docs are
> gone from the working tree (still in git history if ever needed) — and the repo is now
> a small, different tool. Old commit messages and the git log may still reference it.

## What this is

A **GitHub Pages site with three Three.js scenes**, picked from a fixed dropdown in the
top-right corner (`#mode-switcher`).

**Planet view** (`…/#`, what the site opens on) is a space station in orbit around Earth, with a
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
                      .hud control pill (#planet-controls: how to move; #inspect-controls: sun),
                      #planet-view (#planet-canvas + #crosshair + #interact-prompt) and
                      #inspect-view (#inspect-canvas + the #sun-azimuth slider),
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
                       behind the 4K/8K switch, and the orbital plane both the pod and the
                       moon fly in (SUN_BETA / ORBIT_NORMAL / ORBIT_NOON / ORBIT_DAWN)
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
`viewer.setActive(false)` / `planetView.stop()` / `inspect.stop()` to park their
`requestAnimationFrame` loops, so the WebGL contexts never compete. `MODE_HASHES` in
`main.ts` maps each mode to its URL hash in both directions (planet view, the default, gets
the bare `#`). `setMode()` is `async`, because every scene arrives through a dynamic
`import()` — three.js never has to be fetched by a browser that only ever looks at one mode.

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
  **The spawn is up here now**, so the bridge framing is what the site opens on: the limb sits
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
- **The planet must never be a black sphere on load.** Planet view is the site's landing
  view and the maps take a moment, so the shader carries a procedural fallback selected by
  the `uHasMaps` uniform, faded in over ~0.4s once the textures resolve.
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
