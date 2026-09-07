# Earth Defender — project brief & working notes

> **This is one of several independent games in this repo.** It has its own `package.json`,
> `vite.config.ts`, `tsconfig.json` and `node_modules`; nothing here imports from a sibling folder
> and nothing in a sibling folder imports from here. **It is not deployed** — see "Deploy" below.
>
> **This folder used to be four views behind a dropdown** — this game, a walkable space station, a
> planet inspector and an AI-asset gallery, all sharing one `src/`, one page and one renderer
> budget. They are four root folders now (`space-station/`, `planet-inspector/`, `asset-viewer/`),
> and this one keeps the game. `space.ts` and `src/textures/` were **copied**, not shared: three
> folders own a private copy of the same planet, which is the repo's house rule and is why there
> is no root package.json to install. The split is `git log --follow` away if a decision here
> looks like it was made for a view that is no longer in this folder.
>
> **This file is compressed to the rules that would cost real work to rediscover.** The long-form
> version, with each scene's full design history and the reasoning behind every experiment that was
> tried and reverted, is one command away: `git show ed3f592:CLAUDE.md`. Read it before
> re-litigating a decision that looks arbitrary here — the odds are it was tried already. Note that
> paths in it are pre-split twice over: what it calls `src/` is now spread across four folders, and
> its Precision Parking notes live in `parking-game/CLAUDE.md`.
>
> The repo was previously a narrative game, *Vuodenkierto*, now fully retired (still in git
> history). Old commit messages reference it.

## What this is

**A small aeroplane defending the Earth from alien bombers**, flown from a chase camera around a
Three.js globe: arrows climb and bank, `A`/`D` rudder, `W`/`S` throttle, `Space` the laser, `R` a
rocket, speed, altitude and what is left in the guns in a centre pill, a notepad above it and a key
legend over a minimap bottom-right. **It flies in a lane** — a fixed cruise altitude that is also
its floor, with a ceiling Arrow Up climbs to and glides back down from (`fly/lane.ts`) — and the
bombers, the boost rings and the saucer are all in that same band, which is what makes them things
you fly *at*. Twelve fixed sites carry one boost ring each — the throttle's ceiling is deliberately
modest and rings are how you go fast (and quietly heal). An unarmed saucer drifts somewhere over
the planet, and **alien bombers run in on the world's capitals and bomb them flat** — a level
transit at a fixed speed, then a circling bombardment you can still stop, then on to the nearest
capital left standing. A city that falls leaves a red cross on the minimap for the rest of the
session, damage to one that survives is permanent, and **when the last capital goes the flight is
over**. The ships shoot back and can be shot down for a repair pack. **The gun locks on** — the
curve of the planet puts a target at your own altitude well below a level nose — and **ammunition
is finite**, shown on the aeroplane itself as a draining bar and four rocket pips, which is what
the command post is for: it orbits at the ceiling with a resupply package on a tether under it, and
a pass through that fills both guns and repairs the aircraft. Run dry and the reticle stops hunting
and points at the package instead. Take enough fire and the aircraft explodes until Space restarts
it. The flight model is deliberately the *minimum* that reads as flying — no lift, drag, stall,
gravity or ground; an orientation, a speed along the nose, a bank *command*, a commanded altitude,
and a level-hold that puts the nose on the flight path and bends the track round the globe.
Keyboard only.

## Architecture

```
index.html            #settings (the surface-resolution select, and nothing else), #fly-view
                      (#fly-canvas, #fly-reticle, #fly-bomber-health + .capital-health,
                      #fly-notes, #fly-plane-health, #fly-alerts, #fly-message, #fly-controls,
                      #fly-corner = #fly-keys over #minimap with #minimap-plane / #minimap-ufo /
                      #minimap-post / #minimap-paths). Loads /src/main.ts
vite.config.ts        `base: './'` and nothing else — no publicDir, no plugins. The manifest
                      plugin that scans AI assets went to `asset-viewer/` with them
src/
  main.ts             bootstrap: find the elements, pick a map resolution, build the view, start
                      it. The only file that touches DOM ids
  fly-view.ts         createFlyView() — aeroplane, four-key flight model, chase camera, trigger,
                      reticle, own health/defeat, updateMinimap(). Its header carries the
                      reasoning for every constant in it
  fly/lane.ts         the vertical band: cruise altitude (also the floor) and ceiling. Owned here
                      because the aeroplane, the ships, the rings and the saucer must agree on it
  fly/ufo.ts          the saucer. Unarmed, deliberately
  fly/bombers.ts      the bombers: transit in the lane, then bomb a capital until it falls. Owns
                      the capitals' health, the bombs, and the hop to the nearest survivor
  fly/burst.ts        expanding shell + thrown shards; used by bombers, by rockets and by the
                      aircraft's death
  fly/places.ts       CAPITALS — ~4 per continent. The board: what the bombers attack, what the
                      crosses on the minimap are, and what running out of means losing
  fly/rings.ts        boost rings: 12 Fibonacci sites, one hoop each in the lane, swept pass test
  fly/packs.ts        repair packs: 10 s, magnet pull + tether, swept pickup
  fly/trail.ts        wingtip ribbons while boosting: camera-facing strips, fixed length
  fly/rockets.ts      guided rockets: 6-deep pool, one press one rocket, proximity fuse, 6 hits
  fly/command-post.ts the Earth defence station: a circular orbit at the ceiling, and where you
                      rearm and repair — REARM_RANGE is measured from the package hanging under it
  fly/bolts.ts        a pool of bolts, cadence, swept hit test. Parametrised, so it is the
                      player's laser, the bombers' return fire and the bombs, from one module
  space.ts            planet, two atmosphere shells, moon, starfield, nebula; the noise GLSL, the
                      planet shader, MAP_SETS and the map cache, the orbital plane (SUN_BETA /
                      ORBIT_NORMAL / ORBIT_NOON / ORBIT_DAWN), surfaceUv() and worldFromLatLon().
                      **A private copy** — `space-station/` and `planet-inspector/` have their own
  textures/, style.css
```

- **Everything is imported statically, and that is a change.** It used to be four scenes behind a
  dropdown, each arriving through a dynamic `import()` so that half a megabyte of three.js was
  only fetched by asking for a scene that needed it. There is one scene now and you always ask for
  it, so the indirection bought nothing and went.
- **`main.ts` is the only file that knows a DOM id**, which is what makes `fly-view.ts` testable
  from a harness that hands it its own elements.

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
- **A bomber gets a line, not a mark** — a mark says where something is, a line says where it is
  *going*. The SVG overlay is its own space (`viewBox="0 0 100 50"`, `preserveAspectRatio="none"`),
  a path spanning more than half the map is drawn twice a map width apart, and paths are redrawn
  every frame because the planet turns underneath them. **The boost rings are deliberately not on
  the map** — it is for the things that are *happening*.
- **Altitude is commanded, not flown, and the aeroplane is placed on a shell every frame**
  (`plane.position.setLength`) rather than clamped between a floor and a ceiling it could wander
  between. Arrow Up asks for `CEILING_ALTITUDE` and holds it, releasing asks for `CRUISE_ALTITUDE`
  back, Arrow Down only hurries that — **there is nothing below the lane**. Climb and glide are
  *angles* (`CLIMB_ANGLE`), so the rate scales with speed and a boosted climb is a second, not six.
  The pitch stick has no direct authority at all: **the level-hold points the nose along whatever
  climb actually happened**, which is why the attitude can never be a lie and why the aeroplane can
  no longer be aimed at empty sky. Side effect worth keeping: a held bank now costs no height,
  where it used to spiral into the floor.
- **One number, four files** — `fly/lane.ts` exists because the aeroplane, the bombers, the
  rings and the saucer all place against the band, and any of them tuned alone puts something the
  player is meant to reach where the aeroplane cannot go.
- **Rings are why the throttle ceiling came down** (130 → 30): boosted the aeroplane does 120, so one
  ring is worth half as much again as the whole throttle range. **The boost is its own term**,
  decaying on top of the throttle, so the aeroplane surges and coasts back to what you left it on.
- **Nothing about a ring is solid** — no collision, no deflection; the only question is whether the
  segment flown this frame crossed the disc, tested **swept** like the laser's and the packs'.
  **Sites are fixed to the ground** (12 Fibonacci points, **one hoop each, in the lane**), so a run
  between three of them is a route you can fly twice. It was a stack of three at 50/110/170, which
  was an answer to an aeroplane that could be at any height; two of every three now hung above the
  only altitude it is ever at. **A hoop is a lit object, not a light** — over the bloom threshold,
  a skyful of white-hot circles outshouted the bombers; what blooms is its six lamps. **Every
  hoop turns to face the aeroplane**, rate-limited.
- **The wake is capped shorter than the chase camera's standoff**, which is the whole of why it looks
  like a wake, and tapers by **distance along the wake, not sample index**. Camera-facing strips, not
  lines. Lives in world space; history dropped when the boost ends or the view is parked.
- **A pack is what a bomber leaves when *you* shoot it down** — one that gets its run in leaves nothing. Ten
  seconds; inside `MAGNET_RANGE` it comes to you on a ramp (the ramp, not the top speed, reads as a
  magnet), tether recomputed *after* the pack moves. Cleared when the view is parked.
- **Bombers take 12 hits — two seconds of sustained fire** — and **shoot back** through a second
  `createBolts` instance whose own `interval` caps the *combined* incoming rate from every ship.
  `BOMBER_HIT_DAMAGE` 15, so seven hits kills a fresh aircraft; `PACK_HEAL_AMOUNT` 60 and
  `RING_HEAL_AMOUNT` a quarter of the tank undo it. The ring's heal is deliberately **unmarked** —
  two marks were tried in the hoop and both were pulled.
- **A run is two halves, and the second one is the game.** A bomber flies a level **transit** in
  the lane to a capital, and then **bombs it**: circling at `ORBIT_OFFSET`, one bomb every
  `BOMB_INTERVAL`, six of them to level a city. The bombardment is the window you can do something
  in — a countdown you either beat or miss is a notice, a city coming apart under a ship you can
  still shoot down is somewhere to fly to. It replaced a 40 s descent from 150 to the deck, most
  of which happened at a height the aeroplane cannot be at.
- **The clock is distance, not a constant.** `BOMBER_SPEED` is fixed and a hop is however long it
  is, so `secondsLeft` is real — the fixed 40 s made no sense once a ship hopped from the city it
  just destroyed to the nearest one standing. Under the bombs the same field counts what the bombs
  still have to do. Both ends stay lat/lon converted every frame: held in world space a target
  drifts ~9° west of its own city over a run.
- **A destroyed capital stays destroyed, and a damaged one stays damaged.** The health lives in
  `fly/bombers.ts` for the life of the flight — kill a ship at 2 of 6 and that is what the next
  one finds. **The player can never touch a city**: the bombs are a third `createBolts` pool owned
  by that module, and the cities' targets never enter `boltTargets`, so it is true by construction
  rather than by care.
- **The crosses are placed once and never touched again.** The minimap is static and `surfaceUv()`
  is asked in the planet's local frame, so a fallen capital has a fixed place on it however far
  the world has turned — unlike the ships' marks and the approach lines, which are redrawn every
  frame. Cleared only by `reset()`.
- **Losing every capital is a defeat, and the aeroplane is not exploded for it** — nothing shot
  it; the world it was defending is simply gone (`EARTH_LOST_MESSAGE`). Everything else about the
  state is what being shot down leaves: `update()` returns at the top, Space is the way out.
- **The alert row's bar says two different things**, and `.bombing` says which: the approach
  draining in transit, then the city's own health in red. Same question either way — how long has
  this place got — answered by whatever is actually deciding it. It is deliberately *not* the
  `.urgent` state, which is about a clock running out rather than about the thing happening.
- **Capitals are a short table on purpose** (`fly/places.ts`, ~4 per continent). Sixty-four
  countries was right when a target was a place to vanish at; a capital is a thing you can lose,
  so the list has to be short enough that losing one matters and that the crosses can be told
  apart on a 100 x 50 panel. The old "must be well inland" rule retired with the descent — nothing
  touches down any more, so a coastal capital is fine. What survives of it is the better half: the
  target *is* the row, so the countdown's label cannot disagree with the place.
- **The alert bar is the one thing here that shouts**; everything else is a dim pill in a corner.
- **Ammunition is finite and the command post is where it comes from.** `LASER_AMMO` 120 (twenty
  seconds of held fire), `ROCKET_AMMO` 4; a round is spent when `bolts.fire()` actually *fires*,
  not per frame the trigger is down. **The post moved from 220 to the ceiling for this** — it was
  scenery, and a place you must reach has to be reachable — so rearming is a climb out of the lane
  and a pass inside `REARM_RANGE`, and the ceiling finally has a job. A pass **also repairs the
  aircraft to full**: a pack is 60 and a ring a quarter of the tank because both are picked up *in*
  the fight, and this is the one thing you have to leave the fight for. Empty says so once
  (`DRY_MESSAGE`), and the pill's number goes red rather than blinking.
- **The magazine is on the aeroplane, not only in the pill** (`buildPlane()`): a bar across the
  spine that drains and reddens with the rounds, and four pips under the port wing that go out
  with the rockets. **Across the fuselage, not along it** — the chase camera sits directly astern,
  so a fore-and-aft bar is foreshortened into a dot, which is exactly what the first pass was. The
  fill scales from its port end (the geometry is translated so the box's origin is that end) and
  never quite reaches zero: a bar of no length reads as "no gauge", not as "nothing left".
- **The station carries a resupply package on a tether**, `PACKAGE_DROP` under the hub, and
  `REARM_RANGE` is measured **from the package** — the thing you aim at and the thing that counts
  have to be the same, or a 50-unit station has an invisible sweet spot in it. It hangs at ~102 of
  altitude against the station's 120, so a rearm run is a climb you can make roughly rather than a
  height you have to hold exactly.
- **Out of everything, the reticle stops hunting and becomes a waypoint on that package** — at any
  range and any bearing, because a lock you can only get by already facing the right way is no
  help. Same brackets, wider and in the station's pale light rather than the gun's amber, and
  `lockTarget` stays null: "fly here" and "shoot this" must not look alike.
- **Rockets are the laser's opposite** (`fly/rockets.ts`): four of them, guided at the locked
  target, `ROCKET_DAMAGE` 6 so two end a bomber. **Fired from the keydown event, not the held
  keys** — one press is one rocket, and a level-triggered check either empties the rack in six
  frames or drops a tap taken between two of them. Guidance is a rate-limited turn towards the
  *live* target vector, so the lock has to be a lock; with no target it flies straight and is
  wasted.
- **The throttle is sprung, like the lane is**: `CRUISE_SPEED` is where the aeroplane lives, W and
  S are things you *hold*, and letting go walks it back. Left as a setting, the aeroplane's usual
  state was whatever the last fight left it on — most often 12, because slowing down is what you
  do in one.
- **`#fly-notes` is the design notes on screen, and it is markup and nothing else** — a `<ul>` in
  `index.html`, always visible above the pill, no script, no storage, no clicks, read by nothing.
  Adding a note is adding an `<li>`, which is the point of keeping it in the file the view is
  built from. Small and dim like the control legend, but **on its own dark ground and darker than
  the pill**, which the legend does not need: nine lines across the middle of the screen sit over
  the sunlit limb, and a text shadow alone left half of them unreadable. `fly-view.ts` keeps
  `isTyping()` even though nothing there takes a caret today — every key
  here is a control with no modifier, so the first text field ever put over this HUD would fly the
  aeroplane as it was typed in. `keyup` stays ungated: a key released over a field may have been
  pressed over the scene, and a stuck control is worse.
- **Landing is not animated; being shot is** — nothing you did caused a landing. A burst **outlives
  the ship that made it**, so it is ticked *outside* the active check.
- **Health bars float over their target**, placed **after the render**. The aircraft's own is anchored
  to its **own up**, or it swings out to one side in every bank. `#fly-bomber-health` needs
  `inset: 0`: a zero-size absolute layer makes every bar's percentage offset resolve to one point.
- **Bolts**: a pool that never allocates, cadence owned by `bolts`, a swept hit test, no inherited
  aircraft speed, targets walked per bolt (`hit()` must tolerate two bolts in one frame), and **no
  lead prediction on either side**. **`Space` is `preventDefault`ed** or the page scrolls.
- **The gun locks on, and it has to** (`takeAim()`): with everything in the fight at one altitude
  (below), a ship 220 ahead sits ~18° *under* a level nose, and a boresighted laser fired over the
  top of every target — this is the whole reason the aim assist exists, not a convenience. The pick
  is **bearing only**, flattened onto the local horizontal, tightest bearing inside `LOCK_CONE`
  wins; elevation is the curve's business, not the player's. `LOCK_RANGE` **must stay inside the
  horizon** (~360 between two aircraft in the lane) or the gun locks through the planet. Unlocked,
  it aims at the lane `RETICLE_RANGE` ahead — *not* down the nose, which is a tangent and misses
  by 15 units per 100. **The reticle is drawn over that same point** and becomes a bracketed square
  when it is a target: the lock is a thing you can see.
- **The saucer is unarmed and slower than `MIN_SPEED`**, a place to go rather than a chase, spawning
  in a band 1.0–2.4 radians of arc away.
- **Zero health explodes the aircraft and stops the flight.** `update()` returns immediately once
  `destroyed` is set, ticking only the burst — a held frame reads as a stopping point where a world
  quietly running on round a missing aeroplane reads as a bug. `DEFEAT_MESSAGE` must say how to get
  out of the state it just put you in, and `spaceLabel` swaps "laser" for "restart". Space is read
  from the **keydown event**, not the held-keys set, because the trigger is likely still down.
  `start()` re-shows the defeat message if `destroyed`; `reset()` is the only way out.
- **The command post is scenery with a job description** — it makes the saucers read as being
  *answered*. Not the walkable station in the `space-station/` project: that is 15.6 m for a first-person interior, this
  view is arcade-scaled. Its orbit is evaluated, not integrated, and `SUN_BETA` means it is never
  eclipsed and never fully front-lit.


## The world under it — `space.ts`

The planet, the atmosphere shells, the moon, the starfield and the nebula, plus the orbital
plane everything in this view is placed against. **A private copy**: `space-station/` and
`planet-inspector/` have their own, and a fix made here does not reach them.

- **Bloom does the glowing** — colours authored over 1.0, threshold just above it. `OutputPass` must
  stay last. Reach for `toneMappingExposure` and the threshold before touching light intensities.
  It is what makes the boost hoops' lamps, the bolts and the bursts read as *hot* rather than as
  bright grey — and why a hoop itself is deliberately under the threshold while its six lamps are
  over it.
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

Flight view is **keyboard only** and says so: the control legend is hidden outright at
`pointer: coarse` and the readout pill carries "needs a keyboard" in its place. That leaves two
rules, and they are not optional:

- **`100dvh`, not `100vh`** — iOS counts the space behind its own chrome and pushes the HUD off.
- **`touch-action` is deliberately *absent* on `#fly-canvas`**, unlike the other three projects'
  canvases: there is no pointer input here to reserve, so there is nothing for Safari to mistake
  for a page scroll.

## Checking a change

There is no committed harness for this view. `dev/.fly-shots.tmp.mjs` is the scratch one the
flight model was tuned against — it starts a Vite dev server, drives the aeroplane through a
scripted sequence of held keys with a headless Chromium, and writes a PNG per moment:

```sh
node dev/.fly-shots.tmp.mjs dev/shots
```

It reads `window.__fly` (installed by `fly-view.ts` under `import.meta.env.DEV`) for the speed and
altitude it prints beside each shot, and it waits on `window.__fly.mapsReady` — until the surface
maps resolve the shader draws its procedural fallback and every screenshot is of the wrong planet.
**Don't edit source while it runs**: Vite hot-reloads mid-shot and the screenshot times out.

*Actually look at the output.* The numbers say nothing about whether the reticle is over the
target, whether the wake reads as a wake, or whether the alert bar has walked into the notes.

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
the path against `base: './'`, so nothing has to be copied by hand or resolved at runtime.

`space-station/` and `planet-inspector/` carry their own copies of these same files, minus the
minimap, which is flight view's alone. **Re-encoding one means re-encoding all three** — or
deciding, deliberately, that they are different worlds now.


## Deploy — GitHub Pages

**This project is deployed**, at `https://oskarwestmeijer.github.io/games/earth-defender/`.

`.github/workflows/deploy.yml` at the repo root builds every folder named in its `GAMES` variable —
currently this one and `parking-game/` — and assembles them into one site, a folder each under a
static menu from `site/`. `npm run build` is what CI runs, so **the `tsc` half is this project's
only automated check**: there are no tests and no linting, and a type error is the one class of
mistake that will stop a deploy. Everything else is on whoever changes it — `dev/.fly-shots.tmp.mjs`
and looking at the result.

**`base: './'` is what makes the sub-path work**, and it is not a default. Vite emits `./assets/…`,
which includes the minimap's `url(./planet-minimap-*.webp)` in the compiled CSS, so nothing here
knows or cares which folder it is served from. A root-absolute path added anywhere — a `fetch('/…')`,
a hand-written `href="/…"` — works in `npm run dev`, works in `npm run preview`, and 404s only once
deployed. That is the one deployment trap in this project.

Worth knowing: this game is ~4.3 MB of the site, nearly all of it the 8K and 4K surface maps. That
is fine, and it is also most of why the 4K set is chosen automatically on a coarse-pointer or
data-saving device — see `main.ts`.

## Where this is going

**No score, no timer counting up, no reward for anything done right.** That line is inherited from
the station this folder used to share a page with, and it holds loosely here: there is a saucer, a
countdown, boost rings and a way to lose, but nothing accumulates and nothing is being graded.

**Real outside.** The NASA Earth stays photoreal; don't restyle the planet to suit the game on top
of it.

Wanted, roughly in order of how much they'd add:

1. **Something to do with the saucer.** It is unarmed and slower than `MIN_SPEED` — a place to go,
   not a fight. It has been that way since before the bombers existed, and it now reads as the one
   thing in the sky with no part in what is happening.
2. **A reason to be at the ceiling other than rearming.** The lane gave the ceiling a job; the
   command post gave it a second. A third would make the vertical axis a decision.
3. **Art for the command post.** Its minimap mark and its message icon are both stand-ins, and
   `#fly-message`'s SVG says so in a comment.
4. **Sound.** There is none here — the room tone and the playlist went to `space-station/` with the
   radio that switches them on. Anything added must be **CC0 / public domain**, for the same reason
   the textures are NASA's: this repo is public and the files would be committed. **CC BY is not
   acceptable** however generous it looks.

## Notes for whoever picks this up

- **The header of `fly-view.ts` is the real document.** This file is the shape; that file carries
  the reasoning for every constant, and there are a lot of constants.
- If a decision here looks arbitrary, check `git show ed3f592:CLAUDE.md` before changing it. Most
  of them were argued out and several were tried the other way first.
