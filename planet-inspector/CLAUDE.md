# Planet Inspector — project brief & working notes

> **This is one of several independent games in this repo.** It has its own `package.json`,
> `vite.config.ts`, `tsconfig.json` and `node_modules`; nothing here imports from a sibling folder
> and nothing in a sibling folder imports from here. **It is not deployed** — see "Deploy" below.
>
> **This was `#inspect`, one of four views behind a dropdown in `earth-defender/`** — alongside the
> flight game, a walkable space station and an AI-asset gallery, all sharing one `src/`, one page
> and one renderer budget. They are four root folders now. `space.ts` and `src/textures/` were
> **copied** out, not shared: `earth-defender/` and `space-station/` own their own copies of the
> same planet, which is the repo's house rule. A fix to the planet shader made here does not reach
> them.
>
> **This is the smallest of the four** — two source files and a stylesheet over a shared world — and
> that is the point of it. The long-form design history is one command away:
> `git show ed3f592:CLAUDE.md`. Paths in it are pre-split twice over.

## What this is

**The Earth from outside, on an `OrbitControls`**: drag to swing round, scroll to zoom, and a `Sun`
slider sweeps the sun round the equator. It is the same world the other two Three.js projects
render — same maps, same shader, same nebula — with nothing in it and nowhere to be.

It exists because the planet is the expensive, fiddly part of all three and it needs somewhere it
can be looked at directly. **It is a study tool, not a place**, which is the whole reason the sun
slider is on screen here and the station's equivalent controls are keys on a console you walk to:
there is nobody in this scene to walk anywhere.

## Architecture

```
index.html            #settings (the surface-resolution select), #inspect-view (#inspect-canvas,
                      #inspect-controls with #sun-azimuth). Loads /src/main.ts
vite.config.ts        `base: './'` and nothing else — no publicDir, no plugins
src/
  main.ts             bootstrap: find the elements, pick a map resolution, seed the sun slider
                      from DEFAULT_SUN_AZIMUTH, build the view, start it. The only file that
                      touches DOM ids
  planet-inspect.ts   createPlanetInspect() — the space, OrbitControls outside it, the sun slider,
                      the bloom composer
  space.ts            planet, two atmosphere shells, moon, starfield, nebula; the noise GLSL, the
                      planet shader, MAP_SETS and the map cache, the orbital plane (SUN_BETA /
                      ORBIT_NORMAL / ORBIT_NOON / ORBIT_DAWN), surfaceUv() and worldFromLatLon().
                      **A private copy** — `earth-defender/` and `space-station/` have their own
  textures/, style.css
```

- **`space.ts` is carried whole, not trimmed to what this view uses.** It brings the moon, the
  orbital plane and `worldFromLatLon()` along, none of which this scene asks for — three-shaking
  drops most of it from the bundle, and a locally pruned copy would silently diverge from the other
  two the first time one of them changed.
- **Everything is imported statically**, where it used to arrive through a dynamic `import()` so
  half a megabyte of three.js was only fetched by asking for a scene that needed it. There is one
  scene here and you always ask for it.

## The inspector

Compressed hard — the reasoning behind each of these is in `git show ed3f592:CLAUDE.md`.

- `MAX_DISTANCE` is `min(PLANET_RADIUS * 8, MOON_ORBIT_RADIUS - MOON_RADIUS * 3)` so moving either
  can't let the camera fly through the moon; `MIN_DISTANCE` is `ATMOSPHERE_RADIUS * 1.03`.
- **Rotate speed is scaled by distance** — the surface moves past the eye at
  `distance / (distance - PLANET_RADIUS)` times the angular rate, 16x at closest approach.
- **The planet doesn't spin here** (`spinRate: 0`); the sun slider moves the terminator on demand.
  **The sun is per-space, not global**, so the slider relights this scene without touching the pod's.

## The world under it — `space.ts`

- **Bloom does the glowing** — colours authored over 1.0, threshold just above it. `OutputPass` must
  stay last. Reach for `toneMappingExposure` and the threshold before touching light intensities.
  (In `space-station/` this is also a *design* rule — which side of the threshold a light strip sits
  on. Nothing in this scene is authored over 1.0 except the sun's own limb, so here it is only a
  tone-mapping knob.)
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

- **`touch-action: none` on the canvas**, or Safari treats a drag as a page scroll. OrbitControls
  sets this itself, so unlike `space-station/`'s `PointerLockControls` canvas there is nothing to
  add in CSS — the rule in `style.css` is belt and braces.
- **`100dvh`, not `100vh`** — iOS counts the space behind its own chrome and pushes the HUD off.
- **The hint text swaps at `pointer: coarse`** ("scroll to zoom" becomes "pinch to zoom"), and the
  **sun slider is given 2 rem of height at `any-pointer: coarse`** — a slider is a small target for
  a thumb. Those are two different queries on purpose: an iPad in a keyboard case reports
  `pointer: fine` from its trackpad and is still a device you poke with a thumb.
- **Pixel ratio is capped at 1.5 on coarse pointers** — full-screen shader work under a bloom
  composer.

## Checking a change

There is no harness here, and the view is small enough not to want one: open it, drag it round,
sweep the slider. What to look at is the **terminator** and the **limb** — those are what the
shader is for, and they are where every regression in it has shown up first.

If a change touches `space.ts` rather than `planet-inspect.ts`, remember it is a copy:
`space-station/dev/shots.mjs` is the harness that renders the same shader from inside a hull, and
running it over there is the closest thing to a regression test the planet has.

## Deploy — not yet, but it is a one-word change

**This project is not deployed**, and there is no CI check on it either, so it is on whoever
changes it to run `npm run build` before believing it still works.

Publishing it is **adding `planet-inspector` to the `GAMES` variable in
`.github/workflows/deploy.yml`, plus an `<li>` in `site/index.html`.** That workflow builds every
folder it names and gives each one a directory in a single Pages site, so this is no longer a
decision about who owns the root URL — it used to be, and the older notes in this repo may still
say so. It would land at `https://oskarwestmeijer.github.io/games/planet-inspector/`.

The build is ready for it: `base: './'` keeps every emitted asset path relative, which is the one
requirement for being served from a sub-path.

At ~4.2 MB of build, nearly all of it surface maps for a scene with nothing in it, this is the cheapest of the three to
add and the least obviously worth adding: it is a study tool, and the same planet is already
deployed inside `earth-defender/`.

## Where this is going

Probably nowhere, and that is fine — it is a lens on the planet, and it does that. **Don't grow it
into a place.** If it ever wants more, the honest additions are ones that let you *see* something
the other two projects hide: a wireframe of the orbital plane, the terminator drawn as a line, an
axis, a lat/lon graticule over the maps. **Not** clouds you can toggle into being pretty, and not a
grade on the surface — see "the surface is the NASA maps, untouched" above, which is the one rule
in this file that has been broken and reverted more than once.

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
the path against `base: './'`, so nothing has to be copied by hand or resolved at runtime.

`earth-defender/` and `space-station/` carry their own copies of these same files.
**Re-encoding one means re-encoding all three** — or deciding, deliberately, that they are
different worlds now.

