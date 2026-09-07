# Asset Viewer — project brief & working notes

> **This is one of several independent games in this repo.** It has its own `package.json`,
> `vite.config.ts`, `tsconfig.json` and `node_modules`; nothing here imports from a sibling folder
> and nothing in a sibling folder imports from here. **It is not deployed** — see "Deploy" below.
>
> **This was `#assets`, one of four views behind a dropdown in `earth-defender/`** — alongside the
> flight game, a walkable space station and a planet inspector, all sharing one `src/`, one page
> and one renderer budget. They are four root folders now, and this one took `ai-assets/` and the
> Vite plugin that scans it. It is the only one of the four with no planet in it: no `space.ts`, no
> NASA maps, no bloom composer, no shaders at all.
>
> The long-form design history of the whole thing is `git show ed3f592:CLAUDE.md`. Paths in it are
> pre-split twice over.

## What this is

**A gallery and viewer for AI-generated 3D assets.** `.glb` models from tools like
[Meshy](https://www.meshy.ai/) and [Tripo3D](https://www.tripo3d.ai/), plus reference PNGs, live in
[`ai-assets/`](ai-assets) grouped by source; the site auto-discovers them, lists them in a sidebar
gallery and loads the selected one into an orbit/zoom/pan viewport.

**A utility — "clean and readable" is the whole brief.** The three sibling projects are held to a
different standard; this one is a tool for looking at a file, and every temptation to make it a
*place* should be declined. It has no design history worth defending, which is precisely why it is
the safest of the four to change.

## Adding new assets

Drop a `.glb` into `ai-assets/<source>/` and it appears in the gallery on next dev-server reload or
build — no manifest to hand-edit. **Name its thumbnail after it**: a same-folder `.png` whose
filename starts with the `.glb`'s basename is guaranteed to be picked up (`scanModels()` in
`vite.config.ts`). An unmatched PNG is handed out round-robin to models still lacking one — best
effort; rename rather than rely on it.

`ai-assets/` is committed to git — it is the content the site serves, not a build artifact.
**Exception:** `ai-assets/not-public/` is gitignored and must never be pushed (this repo is public).

**Only subdirectories are scanned.** A loose file at the root of `ai-assets/` is served but never
listed, which is how three space-station concept images sat there unnoticed for a while; they are
`space-station/reference/` now. If you want a file *served* but not *in the gallery*, the root is
the place — but say so in a comment, because the next reader will assume it is a bug.

## Architecture

```
index.html            #asset-view (the #gallery sidebar with #gallery-list, #credits and
                      #homepage-link, over #viewport-wrap with #viewport, #model-name and
                      #empty-state). Loads /src/main.ts. No settings bar: nothing here has a
                      surface map
vite.config.ts        publicDir -> ai-assets/; modelManifest() scans it and exposes
                      virtual:model-manifest
src/
  main.ts             bootstrap: build the gallery list from the manifest, wire clicks, load the
                      first model. The only file that touches DOM ids
  viewer.ts           GLTFLoader load() that swaps and disposes the previous model and
                      auto-frames the camera to its bounding box
  style.css
ai-assets/            the models themselves, grouped by generator. Committed
```

- **The manifest is built by scanning the filesystem, so there is no manifest in git and it cannot
  drift.** `url` and `thumbnail` are `encodeURIComponent`d because source filenames contain spaces,
  and they are **publicDir-relative with no leading slash** on purpose: Vite's `base: './'` only
  rewrites references it recognises at build time, not arbitrary string data, so a leading `/`
  would point at the domain root instead of a deployed `/games/` sub-path. `withBase()` in
  `main.ts` is the other half of that contract — **don't remove it without removing the comment in
  `vite.config.ts` that promises it exists**.
- **Filesystem mtimes were considered as a thumbnail-pairing fallback and rejected**: files from one
  export land within moments of each other, but git does not preserve mtimes across a clone, so the
  heuristic would silently stop working the moment the repo is checked out fresh.
- **`viewer.ts` used to have a `setActive()`**, to park its render loop while the gallery sat hidden
  behind one of the other three modes. There is no other scene to yield the GPU to now, so the loop
  simply runs; `main.ts` no longer has anything to park.
- **Everything is imported statically**, where three.js used to arrive through a dynamic `import()`
  so it was only fetched by asking for a scene that needed it. You always need it here.

## Where this is going

Nowhere in particular, deliberately. If the gallery grows large or the assets get much bigger, the
three things worth doing, in order:

1. **Lazy thumbnails.** The list is built eagerly (it is just DOM) and every `<img>` is requested on
   load. `loading="lazy"` is a one-line fix and buys the most.
2. **A loading indicator during `viewer.load()`.** The current handful run to tens of megabytes and
   there is nothing on screen while one arrives.
3. **Draco/meshopt compression** for the `.glb`s. `GLTFLoader` supports both with extra decoder
   setup; not wired up, since the current handful load fine uncompressed.

**The assets themselves have a second life**: `space-station/CLAUDE.md` wants the blueberry bush and
the chanterelle aboard as a hydroponics tray and a mushroom log. That means **copying the `.glb`
into that folder** — a sibling reaching into `ai-assets/` is the one thing the repo's house rules
forbid.

## Deploy — not yet, but it is a one-word change

**This project is not deployed**, and there is no CI check on it either, so it is on whoever
changes it to run `npm run build` before believing it still works.

Publishing it is **adding `asset-viewer` to the `GAMES` variable in
`.github/workflows/deploy.yml`, plus an `<li>` in `site/index.html`.** That workflow builds every
folder it names and gives each one a directory in a single Pages site, so this is no longer a
decision about who owns the root URL — it used to be, and the older notes in this repo may still
say so. It would land at `https://oskarwestmeijer.github.io/games/asset-viewer/`.

The build is ready for it: `base: './'` keeps every emitted asset path relative, which is the one
requirement for being served from a sub-path.
`publicDir: 'ai-assets'` copies the models into `dist/` with no extra step, so they would ship too —
which is ~71 MB of `.glb` and preview PNGs. **That is the thing to weigh**, and it is why this one is a plausible
candidate for never being published: it is a tool for looking at files while working on them, and
the files are in the repo already.
