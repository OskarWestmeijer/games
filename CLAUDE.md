# 3D Asset Viewer — project brief & working notes

> This repo was previously a narrative game, *Vuodenkierto* (working title *Suvanto*
> before that). That project has been fully retired — its code, art, and design docs are
> gone from the working tree (still in git history if ever needed) — and the repo is now
> a small, different tool. Old commit messages and the git log may still reference it.

## What this is

A **GitHub Pages site that visualizes AI-generated 3D assets**. The assets — `.glb`
models produced by tools like [Meshy](https://www.meshy.ai/) and
[Tripo3D](https://www.tripo3d.ai/), plus their reference/preview PNGs — live in
[`ai-assets/`](ai-assets), grouped by source (`ai-assets/meshy/`, `ai-assets/tripo3d/`,
...). The site auto-discovers whatever `.glb` files are present, lists them in a sidebar
gallery, and loads the selected one into an interactive Three.js viewport (orbit, zoom,
pan via mouse). There's no game logic here — it's a preview/inspection tool.

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

## Architecture

```
index.html            #gallery sidebar + #viewport canvas, loads /src/main.ts
vite.config.ts         publicDir -> ai-assets/ (served as-is, copied into dist/ on
                       build); modelManifest() Vite plugin scans ai-assets/ at
                       dev/build time and exposes virtual:model-manifest
src/
  main.ts             bootstrap: reads the model manifest, renders the gallery list,
                      wires click-to-load, selects the first model by default
  viewer.ts            createViewer(canvas) — Three.js scene/camera/lights/controls,
                       GLTFLoader-based load(url) that swaps and disposes the previous
                       model, auto-frames the camera to the new model's bounding box
  vite-env.d.ts        type declarations, incl. the virtual:model-manifest module shape
  style.css
```

### How the manifest works
`modelManifest()` in `vite.config.ts` follows the same pattern the old game used for its
audio track list: a Vite plugin that resolves a `virtual:model-manifest` module id and
`load()`s it with a JSON array built by scanning the filesystem — no manifest file
checked into git, so it can never drift out of sync with what's actually in
`ai-assets/`. Each entry is `{ url, name, source, thumbnail, sizeBytes }`; `url`/
`thumbnail` are `encodeURIComponent`-escaped since source filenames contain spaces (e.g.
`rock with moss 3d model.glb`); `sizeBytes` is the `.glb` file's raw size from `statSync`,
formatted client-side (`formatBytes()` in `main.ts`) and shown per-item in the gallery
and in the `#model-name` info line under the viewport (a running total in scene mode).

### Viewer behaviour
- **Two modes**, toggled top of the sidebar (`#mode-toggle` in `index.html`,
  `setMode()` in `main.ts`): **Single** (default) shows one model at a time, gallery
  clicks select it; **All together** (`viewer.loadScene()`) loads every model into one
  shared scene, arranged in a grid on the ground so they can be compared side by side.
  In scene mode the gallery list is dimmed and inert (`#gallery-list.inert`, `pointer-
  events: none`) rather than hidden, since it's still useful as a legend of what's shown.
- Switching mode/model fully disposes whatever was previously in the scene — a single
  model or the whole group — via `disposeCurrent()`/`disposeObject()` in `viewer.ts`, to
  avoid leaking GPU memory across a long browsing session. Both `load()` and
  `loadScene()` are `async` (loading one or many `.glb`s) and guard against a slower call
  being superseded by a newer one before it resolves, via a bumped `loadToken`.
- Camera auto-frames to whatever's now in the scene — one model or the whole group — via
  its combined bounding box (`Box3.setFromObject`, `frameToObject()`). Each model is
  shifted to sit on the ground grid (`y -= box.min.y`) rather than straddling it, since
  exported models don't share a common scale or origin; in scene mode each is additionally
  re-centred on its own footprint before being placed on the grid (spacing derived from
  the largest model's footprint), so the grid layout only has to reason about spacing,
  not each model's own off-centre origin.
- Lighting is a simple three-point-ish studio setup (hemisphere + key + fill directional
  lights) — these are isolated asset previews, not a scene with its own mood/atmosphere.

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
