# Asset Viewer

A gallery and viewer for AI-generated 3D assets. The `.glb` files in [`ai-assets/`](ai-assets) are
discovered at build time, listed in a sidebar with thumbnails, and loaded into an orbit/zoom/pan
viewport.

A utility — "clean and readable" is the whole brief.

## Adding a model

Drop a `.glb` into `ai-assets/<source>/` and it appears on the next reload; no manifest to edit.
Name its thumbnail after it (`my model.glb` → `my model-0.png`, same folder) and the pairing is
guaranteed. See [CLAUDE.md](CLAUDE.md) for the fallback rules.

## Run

```bash
npm install
npm run dev      # then open the printed http://localhost URL
npm run build    # type-check (tsc) + production build to dist/
```

## Stack

Vite + TypeScript + [Three.js](https://threejs.org/) `GLTFLoader`.

**Not deployed.** The repo's Pages workflow builds the parking game instead; see the root
[README](../README.md).

## Credits

Models generated with [Meshy](https://www.meshy.ai/) and [Tripo3D](https://www.tripo3d.ai/).
