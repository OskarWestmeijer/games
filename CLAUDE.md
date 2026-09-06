# 3D Asset Viewer — project brief & working notes

> **This file was shortened around Precision Parking, the scene under active work — it keeps its
> full notes; everything else is compressed to the rules that would cost real work to rediscover.**
> The long-form version, with each scene's full design history and the reasoning behind every
> experiment that was tried and reverted, is one command away: `git show ed3f592:CLAUDE.md`. Read it
> before re-litigating a decision that looks arbitrary here — the odds are it was tried already.
>
> The repo was previously a narrative game, *Vuodenkierto*, now fully retired (still in git
> history). Old commit messages reference it.

## What this is

A **GitHub Pages site with five scenes**, picked from a fixed dropdown in the top-right corner
(`#mode-switcher`). Four are Three.js and share one world; the fifth, **Precision Parking**, is a
plain 2D canvas game and shares nothing with them at all.

**Precision Parking** (`…/#`, what the site opens on) is the odd one out and deliberately so: no
three.js, no planet, no shared anything. **The street is seen from above**: a chunky toy taxi rolls
left to right along a kerbside towards a painted bay; one tap stops it dead; the score is how close
its centre landed to the bay's centre. **Parked means the whole car between the bay's two lines** —
the car's own size is part of the question, which is what makes it parking rather than target
practice, and overhead that rule needs no explaining, because the gap you can see is the gap the car
has to fit into. A session is **five fixed bays, the same five for everybody, and you always play
all five**: putting the bodywork over a line or running into the car in front costs a flat penalty
and the session carries on. At the end you get one number, the total distance off centre, which is
the point of the whole thing — a score two strangers can hold up against each other. It is drawn on
a plain 2D canvas onto a **fixed 360 x 512 portrait board that is letterboxed into whatever viewport
it lands in** — not decoration but the load-bearing decision of the whole scene. See "The parking
game" below, and the header of `src/park-view.ts`.

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
                      #minimap-paths), and #park-view, which is one #park-canvas and nothing else —
                      every readout in the parking game is drawn inside its own letterboxed board,
                      where a .hud pill could not follow it. Loads /src/main.ts
vite.config.ts        publicDir -> ai-assets/; modelManifest() plugin scans it and exposes
                      virtual:model-manifest
src/
  main.ts             bootstrap: manifest, gallery, click-to-load, and setMode() — the dropdown,
                      the URL hash, each mode's render loop. The only file that touches DOM ids
  viewer.ts           asset view: GLTFLoader load() that swaps and disposes the previous model and
                      auto-frames the camera to its bounding box
  park-view.ts        Precision Parking. createParkView(canvas) — the board transform, the
                      ready/rolling/judging/over state machine, the tap (back-dated to the event's
                      own timestamp, which is the whole reason the game is fair), the scoring and
                      the render loop. The only scene here with no three.js in it
  park/board.ts       the board as constants: the 360x512 field, the street's bands (roofs,
                      pavements, kerbs, through lane, parking lane, LANE_Y), the track geometry,
                      the warm daylight palette, and rrect(). Stated once because three files
                      draw into it
  park/levels.ts      levelSpec(n) — the deterministic ladder: two curves and an integer hash of
                      the level number, and **no Math.random anywhere**, which is what makes
                      everybody's level 7 the same level 7. One bay per level, sized as the car's
                      own CAR_HALF plus the round's clearance, and nothing else on the street
  park/draw.ts        every 2D drawing routine, in board units and all of it from overhead: the
                      roofs opposite, the pavements and their props, the asphalt, the parking bay,
                      the taxi and the car parked in front of it, the skids and speed lines, the
                      header and the verdict. One hullPath()/drawHull() serves both cars
  park/effects.ts     createEffects() — one fixed particle pool (grit, tyre smoke, confetti,
                      debris, the roof sign coming off) plus the screen shake, allocated once and
                      parked. **No gravity**: a plan view has no down to fall towards
  park/best.ts        the only persistence in the repo: a versioned localStorage record holding
                      the best run and the smallest error achieved on each level
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
`viewer.setActive(false)` / `planetView.stop()` / `inspect.stop()` / `fly.stop()` / `park.stop()`,
so the WebGL contexts never compete. Parking has no WebGL, so also no `webglcontextlost` handler and
no part in the texture-quality fan-out. `MODE_HASHES` maps each mode to its hash both ways (parking,
the default, gets the bare `#`).

- **`setMode()` is `async` and every scene arrives through a dynamic `import()`.** three.js is half a
  megabyte and is reached only by asking for a scene that needs it — **and parking is the landing
  view, so a visitor who never touches the dropdown downloads no renderer at all.**
- **Construction must happen *after* the container is unhidden**: the renderer sizes itself from
  `canvas.clientWidth`, which is 0 while `hidden`. That is why `setMode()` sets the flags first.
- The gallery list is built eagerly (it is just DOM), and `selectModel()` tolerates being called
  before the viewer exists. `modelManifest()` builds its JSON by scanning the filesystem — no
  manifest in git, so it cannot drift; `url`/`thumbnail` are `encodeURIComponent`d because source
  filenames contain spaces.

## The parking game

`src/park-view.ts` and `src/park/`, and nothing else in the repo touches any of it. **This is the
scene under active work.** Three decisions govern everything below and none is cosmetic.

- **The scene is drawn from above, and it was side-on for a long time.** That was the mistake and
  the redesign is the correction: in profile the action reads as *stop the truck on the mark*,
  which is precisely the framing the game left behind when the win condition became the whole
  vehicle between two lines. Overhead the rule explains itself — the gap you can see **is** the
  gap the car has to fit into — and a car is far easier to draw legibly at 58 units than a van in
  profile was. **Nothing about the geometry moved when the camera did**: every scoring constant in
  `board.ts` and the whole of `levels.ts` are byte-identical across the change, which is why the
  ladder, `dev/park.mjs` and every stored personal best survived it untouched. Two consequences
  run through the drawing: a plan view has **no gravity**, so nothing thrown arcs; and the car's
  *width* is free while its *length* is what the game is scored on, so every transform applied to
  the car touches y and never x.
- **The board is a fixed 360 x 512 field, letterboxed.** Every number in the game — the car's
  length, the bay's half-width, the error you are scored on — is in board units, and one
  transform in `render()` maps the field onto the canvas. This is not about looking right in
  portrait. It is what makes two runs the *same run*: the stated goal is eventually to say "here
  is how close you got on level 7, and here is how close everybody else got", and a board that
  stretched to the viewport would make a four-unit miss a different achievement on a phone and on
  a desktop. Letterboxing is the price and it is cheap. **The scene's size is set by the board's
  width** — the street spans 26..334 of the 360 — so making the board *taller* cannot make the car
  bigger; only making it wider could, and that would mean re-tuning the whole ladder.
- **The ladder is a pure function of the level number.** `park/levels.ts` may not call
  `Math.random()` — speed, bay size and position all come out of two curves and a 32-bit integer
  hash of *n*. A single random call in there would look identical on screen and would quietly
  delete the comparison the board was shaped for, along with any hope of going back to beat your
  own stage record. `dev/park.mjs` asserts the ladder is byte-identical across two page loads,
  which is the only way that stays true.

And the rest of it, in the order it bites:

- **The whole field is visible and the camera never scrolls.** You see the car, the gap and the
  bay from the moment it launches, which is what makes the tap a judgement rather than a reaction
  — the feeling the scene is for. The cost is a 308-unit track, which caps speed: at 260 u/s
  there is well under a second of approach. So **difficulty is carried by the clearance
  shrinking**, 36 units either side of the car down to 4 — a nine-fold squeeze — while the speed
  curve asymptotes short of unwatchable. The five rungs a session uses give tap windows of 686,
  246, 102, 48 and 34 ms; the last is about where human timing precision runs out, and exactly
  where five rounds should finish. **Both curves are much steeper than they first were**, which
  is a correction rather than a taste: the original pair took twenty rungs to become interesting,
  which in a game whose whole appeal is the instant of a tap is nineteen too many.
- **A rating band has to be measured against the perfect band, not only against the clearance.**
  At the top of the ladder a quarter of the clearance is *narrower* than the perfect band itself,
  so `GREAT` — tested after `PERFECT` — had a window entirely inside it and could never be
  awarded. It takes the wider of the two now. Worth remembering before any further tuning: the
  shrinking bay eventually crosses every fixed threshold in the file.
- **The stop is instantaneous, and back-dated to the tap.** No braking curve and no skid, because
  either would put a second skill between the tap and the result when the tap *is* the result.
  More importantly the car's position is computed from the *event's* own timestamp, not read at
  the next animation frame: at 255 u/s one frame is over four board units against a level-22
  clearance of 4.3, so sampling at the frame would hand the whole bay to the frame clock and no
  amount of skill would get it back. `MAX_BACKDATE_MS` caps how far that interpolation is
  trusted, so a stale or synthetic timestamp cannot teleport the car. What the player gets
  instead of brakes is weight — the body splaying on its springs, smoke off all four contact
  patches, two black lines on the tarmac — all cosmetic, none of which move the judged number.
- **The win condition is the whole car inside the bay, and the ladder is built out of that.** The
  judged point is the car's centre — one number, and the only one a tap can move — but the band
  it has to land in is the round's **clearance**, which is the bay's half-width less `CAR_HALF`.
  So `park/levels.ts` shrinks the clearance, 36 down to 4, and the bay itself only goes from 130
  units wide to 67. It can never go below 58: **a bay shorter than the car is not a hard bay, it
  is an impossible one.** An earlier ladder shrank the *bay* to ±4 and judged the centre alone,
  which worked only because the car's own size was not in the question — and that is what made
  the target read as a mark to aim at rather than a space to fit into.
- **It was the tyres for a while, and the car's outline is better.** The tyres reached 1.5 units
  inside the bodywork, so the bumper legitimately overhung a bay the game called parked, and the
  rule needed a sentence to explain. The silhouette needs none — you can see whether it is between
  the lines — and it takes the drawing and the scoring off two different measurements of the same
  object. **Nothing drawn may stick out past `CAR_HALF`**; `dev/park.mjs` asserts the wheels do
  not, and `WHEEL_R` is the tyre's half-length *along the street* now (5.5, not the side-on
  wheel's 11 — a 22-unit tyre on a 58-unit car reads as a tractor from overhead).
- **The wheels are symmetric about the car's centre.** They were drawn at -16 and +17 while they
  were only ever decoration, and a car whose centre is not the midpoint of its own drawing is one
  whose judged number sits half a unit out in one direction forever.
- **The brake squash is lateral, and that is a correctness fix.** The bay is measured against the
  car's outline, so **anything that changes its drawn length is a scoring bug, not a visual one** —
  the player checks "is it between the lines" by eye, and a drawing that shortens under the brakes
  puts a car genuinely over a line inside it. Side-on the same rule made the nose dip a vertical
  shear rather than a rotation, because a rotation swung the axles in by 1.7 units at the crash
  tilt, 40% of the last round's clearance. From above the answer is a scale in y alone:
  `transform(1, 0, 0, 1 + k, 0, 0)` maps (x, y) to (x, y(1 + k)), the body splays out on its
  springs, and the footprint is provably untouched at any k. The same constraint binds anything
  drawn on the car — the shadow is offset **down the board only**, because an offset along x would
  put a dark edge past the bumper the player is judging.
- **The car's front must be tellable from its back, and from above that is not free.** The roof
  panel is offset aft inside the greenhouse, which leaves a windscreen half again as deep as the
  rear window; the headlights are wide and pale and the tail lights narrow and amber. A game about
  which end of the car crossed which line is unplayable if the car looks the same both ways round.
- **The bay's two lines are painted outside the judged edges, not inside them.** Drawn inward,
  five units of paint at each end meant the visible gap was ten units narrower than the space the
  judge measured, so "between the lines" and "in the bay" were two different rules. Outside, the
  inner edges of the paint *are* the boundary.
- **A failed round marks the line it crossed in red and the end of the car that crossed it in
  white, on a dark backing.** Not decoration: at the last round's 4.3 units of clearance, missing by a tenth of a
  unit puts the bodywork a tenth of a *pixel* past the paint, and an honest verdict on a stop like
  that is indistinguishable from a bug. The mark is the difference between "the game is wrong" and
  "oh — that end, that line". The dark backing is not decoration either: on a small overhang the
  mark lands *on top of* the red line it is calling out, and white on red on a yellow car is one
  contrast too few.
- **The car in front stands directly after the bay, and `BLOCK_GAP` is as small as the geometry
  allows.** `failLine` is `bay far edge + BLOCK_GAP - CAR_HALF`. With the whole car measured, the
  bumper and the judged edge are the same line, so the band between "your nose crossed the paint"
  and "your nose is in somebody's boot" is exactly `BLOCK_GAP` on every round — `dev/park.mjs`
  asserts that identity rather than a range. It was 24, and crashing was then almost impossible:
  you had to overshoot by most of a car length, so every failure was a miss and the thing at the
  end was scenery. The rule now is **stop short and you miss, go past and you hit it** — four
  units is sixteen milliseconds at round five's speed.
- **`BUFFER_W` is the judged footprint of that car and not how much of it is drawn.** Only the face
  is ever tested, so the car ahead is drawn a full 58 units long from it and simply runs off the
  board when the bay sits far down the street. Widening `BUFFER_W` to a real car length instead
  would cost 44 units of usable track, narrow the level-22 placement window from 75 units to 31,
  move every bay through `hash01()` and invalidate every stored record — for a number nothing
  reads.
- **The cheaper failure is the early one, and that is deliberate.** A miss costs 40 and a crash
  60, so the whole session is played a fraction early on purpose — exactly how anyone parks a real
  car towards the one in front. Because that car is fixed to the bay's far line and the bay narrows
  every round, the space you may stop in closes from the left as the session goes on, with the
  obstacle staying where it is.
- **The bay never starts where the car does.** At level 1 it is 127 units wide on a 308-unit
  street, and without `BAY_CLEAR` the near line would land behind the start line and the car would
  begin the level already parked. That constraint binds at the bottom of the ladder and the
  roll-time one binds at the top, which is why `minCentre` is a `max` of the two.
- **The setting is a kerbside street, and it lives everywhere except the tarmac.** The far side of
  the board is the **roofs** of the buildings opposite, because from directly overhead that is what
  a row of buildings is — drawn as shopfronts first, it read as a keyboard laid along the top of
  the board. Below them a pavement, a kerb, the through lane, the parking lane the bay is painted
  in, the near kerb, and the pavement that carries every prop: a street tree, a lamp post reaching
  out over the kerb, a bench, a bin, two bollards and the pigeon (which survived the delivery
  depot it was invented for, being the only living thing in the scene). **None of it is on the
  tarmac between the start and the bay** — that stretch stays empty, settled twice over, and props
  are drawn before the asphalt so nothing can creep onto it. From above the rule costs nothing: a
  pavement is exactly where a bin and a tree belong.
- **The roof sign comes off on a crash, once.** `effects.trim()` throws it at the moment of impact
  and `drawCar` stops drawing it from then on, so the one cartwheeling down the street is the only
  one left. It is how the "a thing you can lose" beat survives the delivery van that beat was
  invented for — something visibly leaves the car when you hit somebody, and it is not a scoring
  event. A miss keeps its sign: you parked badly, you did not hit anything.
- **The bay is drawn as a bay — a wash of colour between two bold end lines — not as a block of
  hazard chevrons.** The chevrons were right while the target was something to aim the bonnet at;
  they are wrong for a space to fit into, where the two lines and the gap between them are the
  entire question. The centre mark survives as a faint dashed tick, because it is what the score
  is measured from rather than what you have to hit.
- **The paint is white, and red is reserved for failure.** The bay's lines were the same yellow as
  the car for a while, which is two ways of saying nothing; they have to be the loudest thing on
  the board because they are the only question it asks. And nothing else on the street is allowed
  to be red — no red cars, no postbox, no red awning — so the crossed-line mark and the verdict
  word are the only red anywhere, which is the entire reason they read. The car in front is teal
  and the tail lights are amber for exactly that reason.
- **There is no precision ruler, and its removal is why the board is 512 tall rather than 640.** A
  hundred units above the street carried the level's clearance blown up to the full width of the
  board, with a dashed bracket for the stage record and a tick for where the car stopped. It was
  the densest thing on screen and it did not read: a second, magnified coordinate space stacked
  over the real one, which people took for a progress bar. **The street says the same thing in the
  only frame that matters — the car sitting between two painted lines.** Its ghost bracket became
  `personalBest` on the verdict: "your best here", a fact rather than a figure.
- **The asphalt runs the full width of the board and off both edges, and this reverses an earlier
  rule.** The road used to be drawn only as far as the obstacle, so it visibly lengthened as the
  levels placed their bays further out — because a wooden block standing in the middle of a road
  reads as an obstacle rather than as the end of one. The thing at the end is a parked car now,
  and a street carrying on past a parked car is the most ordinary sight there is. It is also what
  lets that car be drawn a full length long and simply run out of frame, instead of being cut off
  by a road that stops around it. The whole street band is clipped to `STREET_TOP..STREET_BOTTOM`,
  which is what keeps the bleed off the header and the verdict.
- **A session is five fixed bays and you always play all five. This is the load-bearing decision
  and it took two wrong turns to reach.** There are exactly two structures that produce a number
  two strangers can compare: a *variable* length whose score **is** the length (Flappy Bird — a
  count of pipes, comparable because the unit repeats), or a *fixed* length scored on quality
  (Dialed.gg, and this). The game was neither for a while — endless with one life, scored on total
  distance, lower better — under which quitting on round one with a tidy stop beat a flawless run
  to round twenty. Before that, failing had no consequence at all. **A fixed denominator is the
  fix, and the one-life rule is what had to go for it.** `SESSION` in `park/levels.ts` is the five
  rungs, spread across the ladder rather than taken off the bottom of it, so one session runs from
  686 ms of tap window down to 34 ms.
- **A failed round costs a flat penalty, not the distance it missed by.** A failure has to score
  *something* or the total is meaningless, and the real distance can be two hundred units if you
  stop at the start line — one flubbed round would swamp four good ones. `MISS_PENALTY` is 40,
  more than the widest round can score by parking badly (round one's clearance is 36), so failing
  is always worse than any successful park however sloppy; `dev/park.mjs` asserts that against the
  session's own widest clearance rather than trusting the comment. The verdict still shows the
  *real* distance as feedback; the results screen shows what the round cost. Those differ on a
  failure, and the word next to the number is what makes that legible.
- **`CRASH_PENALTY` is 60 — a crash costs half as much again as a miss, because it is worse.**
  Stopping outside the bay is bad parking; putting the bumper into somebody's boot is bad parking
  *and* hitting something, and charging the same for both says the car in front is scenery. It also gives
  the two failures different shapes to play against: overshooting long is cheaper than overshooting
  into the wall, so a round that is already lost still has something left to get right. Five
  crashes cap a session at 300.
- **The score is the distance, and lower is better.** `error` — how far the car's centre finished
  from the bay's centre, in board units — is the whole of it. There is no points formula: there
  used to be one (a thousand times a squared falloff, plus a perfect bonus, times a zone
  multiplier) and it was three arbitrary constants standing between the player and the one fact
  the game measures. `PERFECT` / `GREAT` / `CLOSE` survive as *feedback* — they pick the colour and
  fire the confetti — but they are derived from the distance and are not a second score.
- **The session's figure is the total distance, which only ever goes up.** The header calls it
  `TOTAL OFF` rather than `SCORE`, because a number labelled "score" is one a player assumes they
  want large. It sits beside `ROUND 3/5` — **the denominator is on screen the whole time**, because
  it is the entire reason the total means anything. A best total is a legitimate record now and
  `park/best.ts` keeps one; it was refused while the game was endless.
- **The two failures differ only in what they look like.** `CRASHED` is the car past the fail line
  and into the one in front: debris, the car ahead nudged and skewed, the roof sign thrown and a
  hard shake. (The skew is legal there for the reason it is forbidden on the taxi — nothing about
  that car is measured.) `MISSED` is a car parked politely in the wrong place: a puff of smoke and
  nothing else. The verdict names which.
- **The results screen is its own screen, not a panel over the street.** A summary laid over the
  parked car covers the one thing worth looking at — a run-ending card did exactly that once and
  was deleted for it. **Don't put a modal over the street.** Results are fine as a full screen because
  by then the last verdict has been and gone. They carry the total, whether it beat the stored
  best, and a row per round: number, rating, and what it cost. The breakdown earns its place — a
  total of 53 built from five sloppy stops and one built from four good stops and a miss are very
  different sessions, and the rows say which round to go back for.
- **A failed round's penalty counts towards the round record but is not announced.** "Your best
  here" printed under a word that has just cost you forty units reads as congratulation for
  failing.
- **`reset()` starts a fresh session and is the only way out of `results`.** Round 1, total and
  per-round scores cleared, effects cleared. Nothing carries forward except what `park/best.ts`
  wrote to disk.
- **There is one bay on the street and nothing else, and this reverses several earlier features.**
  Oil slicks on the approach and a small 3x bonus zone both existed and both are gone; so did an
  unnumbered tape measure under the street and a run-history strip of small bars along the bottom
  of the verdict. Each was defensible alone and together they were the problem: three things to
  read in the half-second before a tap that is only ever about one of them, on a screen already
  carrying too many numbers. A street with patches on it also stops looking like a street — which
  is also why the two worn patches briefly painted on the tarmac from overhead came straight back
  off: they read as puddles, and a plain road beats a road with artefacts on it.
  **Everything is the parking bay now** — how wide it is, how far away, and how fast you are going
  at it — and difficulty comes from the two curves alone. Don't reintroduce a second scoring
  target, a hazard on the tarmac, or anything painted on the road that is not the bay; that is the
  history you would be arguing with.
- **The `ready` phase exists so the bay can be read before anything moves.** Each level parks the
  car at the start line and waits for a tap to launch. Without it the first thing you would do
  every level is look at where the bay is while the car was already rolling towards it.
- **`arm()` clears the last verdict, and forgetting to was a real bug.** The verdict is drawn
  whenever the phase is not `ready`, so a `result` left lying around reappeared the instant the
  *next* level was launched: the previous stop's word and distance, under a car that had not been
  anywhere yet. It looked like the game was scoring you before you had done anything. The harness
  asserts `result` is null once a level advances.
- **`INPUT_LOCKOUT` is not politeness.** The tap that stopped the car is very often still on its
  way up when the verdict lands, and without it the same press would stop the car and launch the
  next level.
- **`stop()` re-arms a level that was mid-roll.** Switching away and back would otherwise return
  you to a car still rolling towards a bay you have not looked at since. Run and score are kept;
  the launch is not.
- **This is the repo's only `localStorage`**, and `park/best.ts` carries the reasoning: one
  versioned key, every access in a `try/catch` because the property access itself throws in some
  private-browsing modes, and a malformed record treated as no record. `bestError` — the smallest
  distance on each level — is the leaderboard-shaped half of it. **Nothing on screen reads it back
  any more** now the ruler is gone; what the player gets is `personalBest`, the one-bit answer to
  "was that your best here". `errorFor()` stays as the read side so the data is not orphaned. The
  key is at `v2`: `v1` also held a best run *score*, which could not survive the score becoming a
  distance.
- **Effects are drawn under the car, not over it, and so are the skid marks.** Grit and tyre smoke
  belong beneath the thing that threw them; on top they read as dirt on the paintwork, which is
  what the first pass looked like. The skids go under the **bay's paint** as well — in life rubber
  would sit on top of it, but the two lines are the only question the picture asks and nothing is
  allowed to dim them.
- **The DPR cap is 2 even on a coarse pointer**, unlike `fly-view.ts`, which caps at 1.5. That cap
  is there because nearly every pixel in flight view is shader work under a bloom composer; this
  is a few dozen flat fills, and crisp text at arm's length is worth more than the fragments.
- **There is no sound**, deliberately: `src/audio/` is CC0-only by policy and view-owned, and a
  satisfying stop wants a real sound pass and a licence check rather than a file dropped in.
- **`node dev/park.mjs`** is the harness, and it exists for the two things no screenshot can show:
  that the ladder is deterministic, and that the stop is back-dated. It also walks the ladder
  asserting every bay is on the street and wider than the car, that none starts where the car
  does, that every fail line leaves room for the car in front and every bay's far end is reachable
  before the bumper meets it, and that every level gives at least `MIN_ROLL_SECONDS` of approach. It
  drives the win condition at its own boundary — a nose on the line is in, a tenth of a unit past
  it is out — through `tapAt`, so that is tested through the real judging rather than by doing the
  arithmetic twice. It prints the ladder as a table with each level's tap window in milliseconds,
  which is the number the curves are really tuned against. Not wired into `npm run build`.

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
  under a bloom composer). Parking caps at 2 — see its own note.

## Checking a change

`dev/` has three harnesses; none is wired into `npm run build`. **Every harness names its hash
explicitly** — `#planet` for the station ones, since the landing view is now parking and a harness
left on `#` waits sixty seconds for a `window.__station` that never arrives.

- **`node dev/park.mjs`** — the parking game's: determinism, back-dating, and the ladder's
  invariants. See "The parking game" above.
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

## Deploy — GitHub Pages

`.github/workflows/deploy.yml` builds with Vite and publishes `dist/` on every push to `main`.
`base: './'` keeps asset paths relative so the `/games/` sub-path works
(`https://oskarwestmeijer.github.io/games/`). `publicDir: 'ai-assets'` copies the asset folder into
`dist/` — no extra copy step.

## Where this is going

**Precision Parking is the current focus.** It is a score game with a level ladder, a personal best
and a stated ambition to compare stages between players — and it breaks every rule below on purpose.
Nothing about it is meant to migrate inboard: it is a toy street in its own hash, sharing no code,
no world and no lighting with the station, and it exists partly *because* keeping it entirely
separate is what lets the station go on being a place rather than a thing to do.

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
   mushroom log — a growing thing aboard says someone lives here, and connects the repo's two halves.
4. **Diegetic controls.** *Largely done* — the radio was the pattern and the console followed it.
   Only the texture-quality dropdown is left off the console, being a download rather than a thing
   the station does.
5. **Sound.** *Started* — see "Ambient audio" above. An empty folder is still a supported state.
6. **EVA.** `fpv-controls.ts` is well positioned: `decks`, `obstacles` and `eyeHeight` are injected,
   Y is already data-driven, and anything parented to `stationRig` floats along for free. Going
   outside is a second controller mode — free Y, swap the deck clamp for a tether sphere — plus a
   hatch. Keep floor-clamping out of anything new and it stays cheap.

## Notes for whoever picks this up

- The asset view is a utility — "clean and readable" is the whole brief. The planet views are held to
  a different standard; parking to a different one again.
- If the gallery grows large or assets get much bigger, revisit lazy thumbnails, a loading spinner
  during `viewer.load()`, and Draco/meshopt for the `.glb`s (`GLTFLoader` supports both with extra
  decoder setup, not wired up since the current handful load fine uncompressed).
